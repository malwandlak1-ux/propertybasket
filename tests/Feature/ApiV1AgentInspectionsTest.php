<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Inspection;
use App\Models\Lease;
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

/** Mobile API: agent Inspections — list, create, per-room photo upload. */
class ApiV1AgentInspectionsTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;
    private User $agent;
    private User $other;
    private Lease $lease;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Storage::fake('public');

        $owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->agency = Agency::create(['user_id' => $owner->id, 'name' => 'Test Agency', 'slug' => 'ta-' . Str::random(6), 'email' => $owner->email, 'status' => 'active']);
        $this->agent = $this->makeAgent();
        $this->other = $this->makeAgent();

        $tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active, 'name' => 'Naledi Sithole']);
        $listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Agency::class, 'owner_id' => $this->agency->id, 'agent_id' => $this->agent->id,
            'title' => 'Sunny 2-bed', 'slug' => 'sunny-' . Str::random(8), 'description' => 'Test listing.',
            'listing_type' => 'long_term_rent', 'property_type' => 'apartment', 'status' => 'leased',
            'monthly_rent' => 9_500, 'bedrooms' => 2, 'bathrooms' => 1, 'suburb' => 'Montana', 'city' => 'Pretoria', 'province' => 'Gauteng',
        ]);
        $this->lease = Lease::create([
            'listing_id' => $listing->id, 'tenant_id' => $tenant->id, 'agency_id' => $this->agency->id, 'agent_id' => $this->agent->id,
            'start_date' => now(), 'end_date' => now()->addYear(), 'monthly_rent' => 9_500, 'deposit_amount' => 9_500, 'status' => 'active',
        ]);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        \Illuminate\Support\Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeAgent(): User
    {
        $u = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        $u->assignRole('agent');
        AgencyAgent::create(['agency_id' => $this->agency->id, 'user_id' => $u->id, 'commission_split_percent' => 50,
            'lead_allocation_position' => 0, 'ffc_number' => 'FFC-' . $u->id, 'ffc_expires_at' => CarbonImmutable::now()->addYear(), 'status' => 'active']);

        return $u;
    }

    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'lease_id' => $this->lease->id, 'type' => 'move_in',
            'rooms' => [
                ['name' => 'Lounge', 'condition' => 'good', 'notes' => 'Small scuff by the door'],
                ['name' => 'Kitchen', 'condition' => 'excellent'],
            ],
        ];
    }

    #[Test]
    public function an_agent_completes_an_inspection_and_adds_room_photos_one_at_a_time(): void
    {
        Sanctum::actingAs($this->agent);

        $this->getJson('/api/v1/agent/inspections/form?type=move_in')->assertOk()
            ->assertJsonPath('data.type', 'move_in')
            ->assertJsonPath('data.leases.0.id', $this->lease->id);

        $id = $this->postJson('/api/v1/agent/inspections', $this->payload())->assertCreated()->json('id');
        $this->assertNotNull($id);

        $inspection = Inspection::findOrFail($id);
        $this->assertSame('completed', $inspection->status);
        $this->assertSame($this->agent->id, (int) $inspection->conducted_by);

        // Photos go up separately, each to its room.
        $this->post("/api/v1/agent/inspections/{$id}/rooms/0/photos", ['photo' => UploadedFile::fake()->image('lounge.jpg')], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonCount(1, 'photos');
        $this->post("/api/v1/agent/inspections/{$id}/rooms/1/photos", ['photo' => UploadedFile::fake()->image('kitchen.jpg')], ['Accept' => 'application/json'])
            ->assertCreated();
        $this->post("/api/v1/agent/inspections/{$id}/rooms/1/photos", ['photo' => UploadedFile::fake()->image('kitchen2.jpg')], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonCount(2, 'photos');

        $rooms = $inspection->fresh()->rooms;
        $this->assertCount(1, $rooms[0]['photos']);
        $this->assertCount(2, $rooms[1]['photos']);
        $this->assertCount(3, Storage::disk('public')->files("inspections/{$id}"));

        // It then shows in the list and the detail, and the lease no longer needs a move-in inspection.
        $this->getJson('/api/v1/agent/inspections')->assertOk()
            ->assertJsonPath('data.counts.move_in', 1)
            ->assertJsonPath('data.move_in.0.photo_count', 3);
        $this->getJson("/api/v1/agent/inspections/{$id}")->assertOk()
            ->assertJsonPath('data.inspection.rooms.0.name', 'Lounge')
            ->assertJsonPath('data.lease.tenant_name', 'Naledi Sithole');
        $this->getJson('/api/v1/agent/inspections/form?type=move_in')->assertOk()->assertJsonCount(0, 'data.leases');

        // A second move-in inspection for the same lease is refused.
        $this->postJson('/api/v1/agent/inspections', $this->payload())->assertStatus(422);
    }

    #[Test]
    public function photo_uploads_are_validated_and_limited(): void
    {
        Sanctum::actingAs($this->agent);
        $id = $this->postJson('/api/v1/agent/inspections', $this->payload())->assertCreated()->json('id');

        $this->postJson("/api/v1/agent/inspections/{$id}/rooms/0/photos", [])->assertStatus(422)->assertJsonValidationErrors(['photo']);
        $this->post("/api/v1/agent/inspections/{$id}/rooms/0/photos", ['photo' => UploadedFile::fake()->create('notes.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertStatus(422);
        $this->post("/api/v1/agent/inspections/{$id}/rooms/9/photos", ['photo' => UploadedFile::fake()->image('x.jpg')], ['Accept' => 'application/json'])
            ->assertNotFound();

        // Someone else can't add to it.
        Sanctum::actingAs($this->other);
        $this->post("/api/v1/agent/inspections/{$id}/rooms/0/photos", ['photo' => UploadedFile::fake()->image('x.jpg')], ['Accept' => 'application/json'])
            ->assertForbidden();

        // Once the agent has left site (hours later) the inspection is closed to new photos.
        Sanctum::actingAs($this->agent);
        \Illuminate\Support\Carbon::setTestNow(now()->addHours(7));
        $this->post("/api/v1/agent/inspections/{$id}/rooms/0/photos", ['photo' => UploadedFile::fake()->image('late.jpg')], ['Accept' => 'application/json'])
            ->assertStatus(422);
        $this->assertSame([], Inspection::find($id)->rooms[0]['photos']);
    }

    #[Test]
    public function an_agent_cannot_inspect_another_agents_lease_and_bad_input_is_422(): void
    {
        Sanctum::actingAs($this->other);
        $this->postJson('/api/v1/agent/inspections', $this->payload())->assertForbidden();

        Sanctum::actingAs($this->agent);
        $this->postJson('/api/v1/agent/inspections', $this->payload(['rooms' => [['name' => 'Lounge', 'condition' => 'spotless']]]))
            ->assertStatus(422)->assertJsonValidationErrors(['rooms.0.condition']);
        $this->postJson('/api/v1/agent/inspections', $this->payload(['rooms' => []]))->assertStatus(422);
        $this->assertSame(0, Inspection::count());
    }
}
