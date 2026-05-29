<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Commission;
use App\Models\Contractor;
use App\Models\Inspection;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\MaintenanceRequest;
use App\Models\PayoutBatch;
use App\Models\RentPayment;
use App\Models\User;
use App\Notifications\CommissionApproved;
use App\Notifications\CommissionPaid;
use App\Notifications\InspectionCompleted;
use App\Notifications\MaintenanceJobAccepted;
use App\Notifications\MaintenanceJobCompleted;
use App\Notifications\MaintenanceRequestSubmitted;
use App\Notifications\RentPaymentReceived;
use App\Notifications\UserInvited;
use App\Notifications\WelcomeUser;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class EmailNotificationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Notification::fake();
    }

    // ── Welcome / Registration ───────────────────────────────────────────

    #[Test]
    public function landlord_registration_sends_welcome_email(): void
    {
        $this->post('/register', [
            'role'                  => 'landlord',
            'name'                  => 'Welcome Test',
            'email'                 => 'welcome@example.test',
            'password'              => 'longpassword123',
            'password_confirmation' => 'longpassword123',
            'terms_accepted'        => true,
        ])->assertRedirect('/dashboard');

        $user = User::where('email', 'welcome@example.test')->firstOrFail();
        Notification::assertSentTo($user, WelcomeUser::class);
    }

    #[Test]
    public function welcome_email_body_includes_role_specific_guidance(): void
    {
        $this->post('/register', [
            'role'                  => 'agency',
            'name'                  => 'Agency Owner',
            'email'                 => 'agency-owner@example.test',
            'password'              => 'longpassword123',
            'password_confirmation' => 'longpassword123',
            'business_name'         => 'Test Realty',
            'compliance_number'     => 'FFC-TEST-001',
            'terms_accepted'        => true,
        ]);

        $user = User::where('email', 'agency-owner@example.test')->firstOrFail();

        Notification::assertSentTo($user, WelcomeUser::class, function ($notification) use ($user) {
            $message = $notification->toMail($user);
            $body = implode(' ', $message->introLines);
            return str_contains($body, 'EAAB FFC');
        });
    }

    // ── Invitation ──────────────────────────────────────────────────────

    #[Test]
    public function agency_inviting_agent_sends_invitation_email(): void
    {
        $owner = User::factory()->create(['role' => Role::AgencyAdmin]);
        $agency = Agency::create([
            'user_id' => $owner->id,
            'name'    => 'Inv Test',
            'slug'    => 'inv-' . Str::random(6),
            'email'   => $owner->email,
            'status'  => 'active',
            'eaab_ffc_number'  => 'FFC-1',
            'eaab_verified_at' => now(),
        ]);

        $this->actingAs($owner)->post('/agency/agents/invite', [
            'email' => 'invited.agent@example.test',
            'commission_split_percent' => 70,
            'area_speciality' => 'Sandton',
        ])->assertRedirect();

        Notification::assertSentOnDemand(UserInvited::class, function ($notification, $channels, $notifiable) {
            return $notifiable->routes['mail'] === 'invited.agent@example.test';
        });
    }

    // ── Maintenance lifecycle ───────────────────────────────────────────

    #[Test]
    public function tenant_submitting_request_notifies_managing_agent(): void
    {
        ['agent' => $agent, 'tenant' => $tenant] = $this->buildLease();

        $this->actingAs($tenant)->post('/tenant/maintenance', [
            'title'       => 'Leaking tap',
            'description' => 'Drip drip drip',
            'category'    => 'plumbing',
            'urgency'     => 'medium',
        ]);

        Notification::assertSentTo($agent, MaintenanceRequestSubmitted::class);
    }

    #[Test]
    public function contractor_starting_job_notifies_tenant(): void
    {
        ['lease' => $lease, 'tenant' => $tenant] = $this->buildLease();
        $contractorUser = User::factory()->create(['role' => Role::Contractor, 'status' => UserStatus::Active]);
        Contractor::create(['user_id' => $contractorUser->id, 'business_name' => 'X', 'status' => 'active']);

        $req = MaintenanceRequest::create([
            'property_id' => $lease->listing_id, 'lease_id' => $lease->id,
            'submitted_by' => $tenant->id, 'title' => 'Job',
            'description' => 'desc', 'category' => 'plumbing', 'urgency' => 'low',
            'assigned_to' => $contractorUser->id, 'status' => 'open',
        ]);

        $this->actingAs($contractorUser)
            ->post("/contractor/jobs/{$req->id}/start")
            ->assertRedirect();

        Notification::assertSentTo($tenant, MaintenanceJobAccepted::class);
    }

    #[Test]
    public function contractor_completing_job_notifies_tenant_and_agent(): void
    {
        ['lease' => $lease, 'tenant' => $tenant, 'agent' => $agent] = $this->buildLease();
        $contractorUser = User::factory()->create(['role' => Role::Contractor]);
        Contractor::create(['user_id' => $contractorUser->id, 'business_name' => 'X', 'status' => 'active']);

        $req = MaintenanceRequest::create([
            'property_id' => $lease->listing_id, 'lease_id' => $lease->id,
            'submitted_by' => $tenant->id, 'title' => 'Job',
            'description' => 'desc', 'category' => 'plumbing', 'urgency' => 'low',
            'assigned_to' => $contractorUser->id, 'status' => 'in_progress',
        ]);

        $this->actingAs($contractorUser)
            ->post("/contractor/jobs/{$req->id}/complete")
            ->assertRedirect();

        Notification::assertSentTo($tenant, MaintenanceJobCompleted::class);
        Notification::assertSentTo($agent, MaintenanceJobCompleted::class);
    }

    // ── Commission ──────────────────────────────────────────────────────

    #[Test]
    public function approving_commissions_notifies_each_affected_agent(): void
    {
        ['agency' => $agency, 'agent' => $agent, 'tenant' => $tenant, 'lease' => $lease, 'listing' => $listing] = $this->buildLease();
        $owner = $agency->owner;

        $c = Commission::create([
            'agency_id' => $agency->id, 'agent_id' => $agent->id,
            'deal_type' => 'rental', 'listing_id' => $listing->id, 'lease_id' => $lease->id,
            'deal_value' => 120_000, 'gross_commission' => 9_000,
            'agent_split_percent' => 70, 'agent_amount' => 6_300,
            'agency_amount' => 2_700, 'vat_amount' => 0, 'agent_net' => 6_300,
            'status' => 'pending',
        ]);

        $this->actingAs($owner)
            ->post('/agency/commissions/approve', ['commission_ids' => [$c->id]])
            ->assertRedirect();

        Notification::assertSentTo($agent, CommissionApproved::class);
    }

    // ── Helper ──────────────────────────────────────────────────────────

    /** @return array{agency:Agency, agent:User, tenant:User, lease:Lease, listing:Listing} */
    private function buildLease(): array
    {
        $owner = User::factory()->create(['role' => Role::AgencyAdmin]);
        $agency = Agency::create([
            'user_id' => $owner->id, 'name' => 'Notif Agency',
            'slug' => 'notif-' . Str::random(6), 'email' => $owner->email,
            'status' => 'active',
        ]);

        $agent = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        AgencyAgent::create([
            'agency_id' => $agency->id, 'user_id' => $agent->id,
            'commission_split_percent' => 70, 'lead_allocation_position' => 0, 'status' => 'active',
        ]);

        $tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active]);

        $listing = Listing::create([
            'ulid' => (string) Str::ulid(),
            'owner_type' => Agency::class, 'owner_id' => $agency->id, 'agent_id' => $agent->id,
            'title' => 'Test', 'slug' => 'test-' . Str::random(8),
            'description' => 'Test', 'listing_type' => 'long_term_rent', 'property_type' => 'apartment',
            'status' => 'leased', 'monthly_rent' => 10_000,
            'bedrooms' => 2, 'bathrooms' => 1,
            'suburb' => 'Sandton', 'city' => 'Joburg', 'province' => 'Gauteng',
        ]);

        $lease = Lease::create([
            'listing_id' => $listing->id, 'agency_id' => $agency->id, 'agent_id' => $agent->id,
            'tenant_id' => $tenant->id,
            'start_date' => CarbonImmutable::now()->subMonth()->toDateString(),
            'end_date'   => CarbonImmutable::now()->addYear()->toDateString(),
            'monthly_rent' => 10_000, 'deposit_amount' => 15_000,
            'deposit_interest_rate' => 6.75, 'escalation_percent' => 8,
            'notice_period_days' => 30, 'status' => 'active',
        ]);

        return compact('agency', 'agent', 'tenant', 'lease', 'listing');
    }
}
