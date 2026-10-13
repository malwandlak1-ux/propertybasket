<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Contractor;
use App\Models\Landlord;
use App\Models\Listing;
use App\Models\MaintenanceInvoice;
use App\Models\MaintenanceRequest;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Contractor: marketplace switch, claim/decline authorization, no logo, finance page. */
class ContractorChangesTest extends TestCase
{
    use RefreshDatabase;

    private User $me;
    private User $other;
    private Contractor $contractor;
    private Listing $listing;
    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->me = User::factory()->create(['role' => Role::Contractor, 'status' => UserStatus::Active]);
        $this->me->assignRole('contractor');
        $this->contractor = Contractor::create(['user_id' => $this->me->id, 'business_name' => 'Me Plumbing', 'status' => 'active']);
        $this->other = User::factory()->create(['role' => Role::Contractor, 'status' => UserStatus::Active]);
        Contractor::create(['user_id' => $this->other->id, 'business_name' => 'Other Co', 'status' => 'active']);

        $this->owner = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active]);
        $landlord = Landlord::create(['user_id' => $this->owner->id]);
        $this->listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Landlord::class, 'owner_id' => $landlord->id,
            'title' => '45 Test Street', 'slug' => 'test-' . Str::random(8), 'listing_type' => 'long_term_rent',
            'property_type' => 'house', 'status' => 'leased',
        ]);
    }

    private function job(?int $assignedTo, string $status = 'open'): MaintenanceRequest
    {
        return MaintenanceRequest::create([
            'property_id' => $this->listing->id, 'submitted_by' => $this->owner->id, 'title' => 'Leaking tap',
            'description' => 'Drips', 'category' => 'plumbing', 'urgency' => 'low', 'status' => $status,
            'assigned_to' => $assignedTo,
        ]);
    }

    #[Test]
    public function marketplace_lists_open_jobs_by_default(): void
    {
        $this->job(null);

        $this->actingAs($this->me)->get('/contractor/requests')
            ->assertInertia(fn (Assert $p) => $p->where('marketplace_enabled', true)->has('marketplace', 1));
    }

    #[Test]
    public function marketplace_switch_hides_and_blocks_claiming(): void
    {
        config(['edition.contractor_marketplace' => false]);
        $open = $this->job(null);
        $mine = $this->job($this->me->id);

        $this->actingAs($this->me)->get('/contractor/requests')
            ->assertInertia(fn (Assert $p) => $p
                ->where('marketplace_enabled', false)
                ->has('marketplace', 0)
                ->has('assigned', 1)
                ->where('edition.marketplace', false)
            );

        $this->actingAs($this->me)->post("/contractor/requests/{$open->id}/accept")->assertNotFound();
        $this->assertNull($open->fresh()->assigned_to);

        // Own assigned jobs keep working (decline hands it back).
        $this->actingAs($this->me)->post("/contractor/requests/{$mine->id}/decline")->assertRedirect();
        $this->assertNull($mine->fresh()->assigned_to);
    }

    #[Test]
    public function cannot_claim_or_decline_another_contractors_job(): void
    {
        $theirs = $this->job($this->other->id);

        $this->actingAs($this->me)->post("/contractor/requests/{$theirs->id}/accept")->assertForbidden();
        $this->actingAs($this->me)->post("/contractor/requests/{$theirs->id}/decline")->assertForbidden();
        $this->assertSame($this->other->id, $theirs->fresh()->assigned_to);
    }

    #[Test]
    public function contractor_cannot_change_logo(): void
    {
        Storage::fake('public');

        $this->actingAs($this->me)->post('/settings/logo', ['logo' => UploadedFile::fake()->image('l.png', 300, 100)])->assertForbidden();
        $this->actingAs($this->me)->delete('/settings/logo')->assertForbidden();

        $this->actingAs($this->me)->get('/contractor/requests')
            ->assertInertia(fn (Assert $p) => $p->where('appearance.can_upload_logo', false));
    }

    #[Test]
    public function finance_page_and_tax_csv(): void
    {
        $job = $this->job($this->me->id, 'paid');
        MaintenanceInvoice::create([
            'maintenance_request_id' => $job->id, 'contractor_id' => $this->contractor->id, 'line_items' => [],
            'invoice_subtotal' => 1000, 'vat_amount' => 150, 'invoice_total' => 1150, 'status' => 'paid', 'paid_at' => now(),
        ]);

        $this->actingAs($this->me)->get('/contractor/finance')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p
                ->component('Contractor/Finance')
                ->where('kpis.ytd_gross', 1150)
                ->where('kpis.ytd_vat', 150)
                ->where('kpis.ytd_jobs', 1)
                ->has('by_category', 1)
                ->has('trend', 6)
            );

        $csv = $this->actingAs($this->me)->get('/contractor/finance?export=csv');
        $csv->assertOk();
        $lines = array_filter(explode("\n", trim($csv->streamedContent())));
        $this->assertCount(2, $lines);
        $this->assertStringContainsString('1150.00', $lines[1]);
    }
}
