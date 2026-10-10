<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Inquiry;
use App\Models\Listing;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Agent → Analytics: 7/30/90-day range, period-over-period series, CSV export. */
class AgentAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    private User $agent;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->agent = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        $agency = Agency::create([
            'user_id' => $owner->id,
            'name'    => 'Test Agency',
            'slug'    => 'test-agency-' . Str::random(6),
            'email'   => $owner->email,
            'status'  => 'active',
        ]);
        AgencyAgent::create([
            'agency_id'                => $agency->id,
            'user_id'                  => $this->agent->id,
            'commission_split_percent' => 50,
            'lead_allocation_position' => 0,
            'ffc_expires_at'           => CarbonImmutable::now()->addYear(),
            'status'                   => 'active',
        ]);

        $listing = Listing::create([
            'ulid'          => (string) Str::ulid(),
            'owner_type'    => Agency::class,
            'owner_id'      => $agency->id,
            'title'         => 'Test Listing',
            'slug'          => 'test-' . Str::random(8),
            'description'   => 'A test listing for analytics.',
            'listing_type'  => 'long_term_rent',
            'property_type' => 'apartment',
            'status'        => 'available',
            'monthly_rent'  => 12_000,
            'bedrooms'      => 2,
            'bathrooms'     => 1,
            'suburb'        => 'Rosebank',
            'city'          => 'Johannesburg',
            'province'      => 'Gauteng',
        ]);

        // 3 leads this week, 1 in the previous 7-day window.
        foreach ([0, 1, 2, 9] as $daysAgo) {
            $lead = Inquiry::create([
                'listing_id' => $listing->id,
                'name' => 'Lead ' . $daysAgo, 'email' => "lead{$daysAgo}@example.test",
                'assigned_to' => $this->agent->id, 'source' => 'website', 'status' => 'new',
            ]);
            $lead->forceFill(['created_at' => now()->subDays($daysAgo), 'updated_at' => now()->subDays($daysAgo)])->saveQuietly();
        }
    }

    #[Test]
    public function seven_day_range_compares_against_previous_period(): void
    {
        $this->actingAs($this->agent)->get('/agent/analytics?range=7')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Agent/Analytics')
                ->where('range', 7)
                ->has('labels', 7)
                ->has('series.leads', 7)
                ->where('kpis.leads.value', 3)
                ->where('kpis.leads.prev', 1)
                ->where('kpis.leads.delta', 200)
                ->has('heatmap', 20)
                ->where('top_listings.0.label', 'Test Listing')
                ->where('top_listings.0.value', 3)
            );
    }

    #[Test]
    public function unknown_range_falls_back_to_thirty_days(): void
    {
        $this->actingAs($this->agent)->get('/agent/analytics?range=365')
            ->assertInertia(fn (Assert $page) => $page->where('range', 30)->has('labels', 30));
    }

    #[Test]
    public function csv_export_streams_daily_rows(): void
    {
        $response = $this->actingAs($this->agent)->get('/agent/analytics?range=7&export=csv');

        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
        $lines = array_filter(explode("\n", trim($response->streamedContent())));
        $this->assertCount(8, $lines); // header + 7 days
        $this->assertSame('date,leads,viewings,deals_closed,commission_zar', $lines[0]);
    }
}
