<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Listing;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Mobile API: agent Listings — detail, create/edit with photos, status actions. */
class ApiV1AgentListingsTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;
    private User $agent;
    private User $other;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Storage::fake('public');

        $owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->agency = Agency::create([
            'user_id' => $owner->id, 'name' => 'Test Agency', 'slug' => 'ta-' . Str::random(6), 'email' => $owner->email, 'status' => 'active',
            'eaab_ffc_number' => 'FFC-AGENCY-1', 'eaab_ffc_expires_at' => CarbonImmutable::now()->addYear(),
        ]);
        $this->agent = $this->makeAgent();
        $this->other = $this->makeAgent();
    }

    private function makeAgent(): User
    {
        $u = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        $u->assignRole('agent');
        AgencyAgent::create(['agency_id' => $this->agency->id, 'user_id' => $u->id, 'commission_split_percent' => 50,
            'lead_allocation_position' => 0, 'ffc_number' => 'FFC-' . $u->id, 'ffc_expires_at' => CarbonImmutable::now()->addYear(), 'status' => 'active']);

        return $u;
    }

    private function listing(User $agent, array $overrides = []): Listing
    {
        return Listing::create($overrides + [
            'ulid' => (string) Str::ulid(), 'owner_type' => Agency::class, 'owner_id' => $this->agency->id, 'agent_id' => $agent->id,
            'title' => 'Sunny 2-bed', 'slug' => 'sunny-' . Str::random(8), 'description' => 'Test listing.',
            'listing_type' => 'long_term_rent', 'listing_structure' => 'single_unit', 'property_type' => 'apartment', 'status' => 'available',
            'monthly_rent' => 9_500, 'bedrooms' => 2, 'bathrooms' => 1, 'suburb' => 'Montana', 'city' => 'Pretoria', 'province' => 'Gauteng',
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'listing_type' => 'for_sale', 'listing_structure' => 'single_unit', 'title' => 'Family home in Rynfield',
            'property_type' => 'house', 'sale_price' => 1_850_000, 'bedrooms' => 3, 'bathrooms' => 2,
            'suburb' => 'Rynfield', 'city' => 'Benoni', 'province' => 'Gauteng', 'amenities' => ['Garden', 'Garage'],
        ];
    }

    #[Test]
    public function the_form_options_and_a_listings_fields_are_returned(): void
    {
        $mine = $this->listing($this->agent);
        $theirs = $this->listing($this->other);

        Sanctum::actingAs($this->agent);

        $this->getJson('/api/v1/agent/listings/form')->assertOk()
            ->assertJsonPath('data.property_types.0.value', 'apartment')
            ->assertJsonCount(9, 'data.provinces')
            ->assertJsonStructure(['data' => ['amenities' => ['interior', 'safety']]]);

        $this->getJson("/api/v1/agent/listings/{$mine->id}")->assertOk()
            ->assertJsonPath('data.listing.title', 'Sunny 2-bed')
            ->assertJsonPath('data.listing.monthly_rent', '9500');

        $this->getJson("/api/v1/agent/listings/{$theirs->id}")->assertForbidden();
    }

    #[Test]
    public function an_agent_creates_a_listing_with_photos_from_the_app(): void
    {
        Sanctum::actingAs($this->agent);

        $this->post('/api/v1/agent/listings', $this->payload([
            'primary_image'  => UploadedFile::fake()->image('cover.jpg', 800, 600),
            'gallery_images' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.jpg')],
        ]), ['Accept' => 'application/json'])->assertCreated();

        $listing = Listing::where('title', 'Family home in Rynfield')->firstOrFail();
        $this->assertSame($this->agent->id, (int) $listing->agent_id);
        $this->assertSame('available', $listing->status);
        $this->assertEquals(1_850_000, (float) $listing->sale_price);
        $this->assertNotNull($listing->primary_image);
        $this->assertCount(2, $listing->gallery_images);
        $this->assertCount(3, Storage::disk('public')->files("listings/{$listing->id}"));
    }

    #[Test]
    public function listing_validation_errors_are_422_json(): void
    {
        Sanctum::actingAs($this->agent);

        $this->postJson('/api/v1/agent/listings', $this->payload(['title' => '', 'sale_price' => null]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'sale_price']);
    }

    #[Test]
    public function an_agent_edits_only_their_own_listing_and_gallery_photos_are_added(): void
    {
        $mine = $this->listing($this->agent, ['gallery_images' => ['/storage/listings/x/old.jpg']]);
        $theirs = $this->listing($this->other);

        Sanctum::actingAs($this->agent);

        $this->post("/api/v1/agent/listings/{$mine->id}", $this->payload([
            'listing_type' => 'long_term_rent', 'title' => 'Sunny 2-bed (renovated)', 'monthly_rent' => 10_500, 'sale_price' => null,
            'gallery_images' => [UploadedFile::fake()->image('new.jpg')],
        ]), ['Accept' => 'application/json'])->assertOk();

        $mine->refresh();
        $this->assertSame('Sunny 2-bed (renovated)', $mine->title);
        $this->assertEquals(10_500, (float) $mine->monthly_rent);
        $this->assertCount(2, $mine->gallery_images);

        $this->postJson("/api/v1/agent/listings/{$theirs->id}", $this->payload())->assertForbidden();
        $this->assertSame('Sunny 2-bed', $theirs->fresh()->title);
    }

    #[Test]
    public function status_actions_follow_the_web_rules(): void
    {
        $rental = $this->listing($this->agent);
        $sale = $this->listing($this->agent, ['listing_type' => 'for_sale', 'sale_price' => 2_000_000, 'monthly_rent' => null]);

        Sanctum::actingAs($this->agent);

        // Rented outside the platform, then back on the market.
        $this->postJson("/api/v1/agent/listings/{$rental->id}/mark-leased")->assertOk();
        $this->assertSame('leased', $rental->fresh()->status);
        $this->deleteJson("/api/v1/agent/listings/{$rental->id}")->assertStatus(422);
        $this->postJson("/api/v1/agent/listings/{$rental->id}/reactivate")->assertOk();
        $this->assertSame('available', $rental->fresh()->status);

        // A rental can't be sold; a sale can, and then can't be deleted.
        $this->postJson("/api/v1/agent/listings/{$rental->id}/mark-sold")->assertStatus(422);
        $this->postJson("/api/v1/agent/listings/{$sale->id}/mark-sold", ['sale_price' => 1_950_000])->assertOk();
        $this->assertSame('sold', $sale->fresh()->status);
        $this->assertEquals(1_950_000, (float) $sale->fresh()->sale_price);
        $this->deleteJson("/api/v1/agent/listings/{$sale->id}")->assertStatus(422);
        $this->assertNotNull(Listing::find($sale->id));

        // An available listing is removed (soft delete).
        $this->deleteJson("/api/v1/agent/listings/{$rental->id}")->assertOk();
        $this->assertNull(Listing::find($rental->id));

        $theirs = $this->listing($this->other);
        $this->deleteJson("/api/v1/agent/listings/{$theirs->id}")->assertForbidden();
    }

    #[Test]
    public function creating_a_listing_is_blocked_with_json_when_the_agency_ffc_has_lapsed(): void
    {
        $this->agency->update(['eaab_ffc_expires_at' => CarbonImmutable::now()->subDay()]);

        Sanctum::actingAs($this->agent);

        $this->postJson('/api/v1/agent/listings', $this->payload())
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'Agency FFC expired'));

        $this->assertSame(0, Listing::count());
        $this->getJson('/api/v1/agent/listings')->assertOk();
    }
}
