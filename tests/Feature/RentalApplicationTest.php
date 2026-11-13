<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Listing;
use App\Models\RentalApplication;
use App\Models\User;
use App\Notifications\RentalApplicationDecision;
use App\Notifications\RentalApplicationLink;
use App\Notifications\RentalApplicationSubmitted;
use App\Notifications\UserInvited;
use App\Models\Commission;
use App\Models\Lease;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Tenants → Applications: link out, prospect applies online, agent decides. */
class RentalApplicationTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $agent;

    private User $other;

    private Agency $agency;

    private Listing $listing;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Storage::fake('local');

        $this->owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->owner->assignRole('agency_admin');
        $this->agency = Agency::create(['user_id' => $this->owner->id, 'name' => 'Basket Realty', 'slug' => 'br-' . Str::random(6), 'email' => $this->owner->email, 'status' => 'active']);
        $this->agency->activateSubscription('promo', now()->addYear());
        $this->agency->forceFill(['eaab_ffc_number' => 'FFC-AGENCY', 'eaab_ffc_expires_at' => now()->addYear()])->save();

        $this->agent = $this->makeAgent('Sipho Dlamini');
        $this->other = $this->makeAgent('Aisha Khan');

        $this->listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Agency::class, 'owner_id' => $this->agency->id, 'agent_id' => $this->agent->id,
            'title' => '2 Bed in Sandton', 'slug' => 'sandton-' . Str::random(5), 'description' => 'x', 'listing_type' => 'long_term_rent',
            'property_type' => 'apartment', 'status' => 'available', 'monthly_rent' => 12000, 'address' => '1 Rivonia Rd', 'suburb' => 'Sandton',
            'city' => 'Johannesburg', 'province' => 'Gauteng', 'bedrooms' => 2, 'bathrooms' => 1,
        ]);
    }

    private function makeAgent(string $name): User
    {
        $u = User::factory()->create(['name' => $name, 'role' => Role::Agent, 'status' => UserStatus::Active]);
        $u->assignRole('agent');
        AgencyAgent::create(['agency_id' => $this->agency->id, 'user_id' => $u->id, 'commission_split_percent' => 50, 'lead_allocation_position' => 0,
            'ffc_number' => 'FFC-' . $u->id, 'ffc_certificate_path' => 'ffc/x.pdf', 'ffc_expires_at' => CarbonImmutable::now()->addYear(), 'status' => 'active']);

        return $u;
    }

    private function answers(): array
    {
        return [
            'personal' => ['first_name' => 'Thandi', 'last_name' => 'Mokoena', 'id_type' => 'sa_id', 'id_number' => '9001015009087', 'email' => 'thandi@example.com', 'phone' => '082 123 4567', 'adults' => '2', 'children' => '1'],
            'address' => ['current_address' => '5 Main Rd, Randburg', 'residence_type' => 'renting', 'current_rent' => '9000'],
            'employment' => ['employer' => 'Acme', 'job_title' => 'Analyst', 'gross_income' => '45000', 'net_income' => '34000'],
            'contact' => ['kin_name' => 'Lerato Mokoena', 'kin_relationship' => 'Sister', 'kin_phone' => '083 000 0000'],
            'lease' => ['move_in_date' => now()->addMonth()->toDateString(), 'lease_term' => '12'],
            'consent' => ['credit_check' => true, 'declaration' => true, 'signature_name' => 'Thandi Mokoena'],
        ];
    }

    #[Test]
    public function an_agent_sends_a_link_and_the_prospect_applies_online(): void
    {
        Notification::fake();

        // Agent creates a link for their rental and emails it.
        $this->actingAs($this->agent)->get('/agent/tenants?tab=applications')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->where('applicationListings.0.id', $this->listing->id)->where('applications', []));
        $this->actingAs($this->agent)->post('/agent/tenants/applications', ['listing_id' => $this->listing->id, 'invitee_name' => 'Thandi', 'invitee_email' => 'thandi@example.com', 'send_email' => true])
            ->assertSessionHas('success', fn ($m) => str_contains($m, 'emailed'));
        $app = RentalApplication::firstOrFail();
        $this->assertSame($this->agent->id, $app->agent_id);
        Notification::assertSentOnDemand(RentalApplicationLink::class, fn ($n, $c, $to) => array_key_exists('thandi@example.com', $to->routes['mail']));

        // Prospect opens the link (no login).
        auth()->logout();
        $this->get("/apply/{$app->token}")->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Public/Apply')->where('listing.title', '2 Bed in Sandton')->where('editable', true)->where('agency.name', 'Basket Realty'));
        $this->assertNotNull($app->fresh()->opened_at);

        // Answers save section by section; unknown keys are dropped.
        $this->post("/apply/{$app->token}/save", ['employment_type' => 'salary', 'step' => 2])->assertRedirect();
        foreach ($this->answers() as $section => $values) {
            $this->post("/apply/{$app->token}/save", ['section' => $section, 'values' => $values + ['evil' => 'x'], 'step' => 3]);
        }
        $app->refresh();
        $this->assertSame('in_progress', $app->status);
        $this->assertSame('Thandi', $app->data['personal']['first_name']);
        $this->assertArrayNotHasKey('evil', $app->data['personal']);

        // Submitting without documents is refused, naming what's missing.
        $this->post("/apply/{$app->token}/submit")->assertSessionHasErrors(['documents.id_document', 'documents.payslip', 'documents.bank_statement', 'documents.proof_of_residence']);

        foreach (['id_document', 'payslip', 'bank_statement', 'proof_of_residence'] as $kind) {
            $this->post("/apply/{$app->token}/documents", ['kind' => $kind, 'files' => [UploadedFile::fake()->create("{$kind}.pdf", 120, 'application/pdf')]])->assertSessionHasNoErrors();
        }
        $this->post("/apply/{$app->token}/documents", ['kind' => 'other', 'files' => [UploadedFile::fake()->create('x.exe', 10, 'application/x-msdownload')]])->assertSessionHasErrors('files.0');

        $this->post("/apply/{$app->token}/submit")->assertSessionHasNoErrors();
        $app->refresh();
        $this->assertSame('submitted', $app->status);
        $this->assertNotNull($app->submitted_at);
        Notification::assertSentTo($this->agent, RentalApplicationSubmitted::class);

        // Locked after submitting.
        $this->post("/apply/{$app->token}/save", ['section' => 'personal', 'values' => ['first_name' => 'Changed']])->assertSessionHasErrors('application');
        $this->assertSame('Thandi', $app->fresh()->data['personal']['first_name']);

        // The agent sees it with the affordability check and can open documents.
        $this->actingAs($this->agent)->get('/agent/tenants')->assertInertia(fn (Assert $p) => $p
            ->where('applications.0.name', 'Thandi Mokoena')->where('applications.0.status', 'submitted')
            ->where('applications.0.income', 45000)->where('applications.0.rent_to_income', 27)
            ->where('applications.0.missing', [])->has('applications.0.documents', 4));
        $doc = $app->documents()->first();
        $this->actingAs($this->agent)->get("/agent/tenants/applications/{$app->id}/documents/{$doc->id}")->assertOk();

        // Approve and email the applicant.
        $this->actingAs($this->agent)->patch("/agent/tenants/applications/{$app->id}", ['status' => 'approved', 'note' => 'Welcome!', 'notify' => true])
            ->assertSessionHas('success', fn ($m) => str_contains($m, 'approved') && str_contains($m, 'emailed'));
        $this->assertSame('approved', $app->fresh()->status);
        Notification::assertSentOnDemand(RentalApplicationDecision::class, fn ($n, $c, $to) => array_key_exists('thandi@example.com', $to->routes['mail']));
        $this->get("/apply/{$app->token}")->assertInertia(fn (Assert $p) => $p->where('editable', false)->where('status', 'approved'));
    }

    #[Test]
    public function agents_only_see_their_own_applications_and_the_agency_sees_all(): void
    {
        $mine = RentalApplication::create(['agency_id' => $this->agency->id, 'listing_id' => $this->listing->id, 'agent_id' => $this->agent->id, 'created_by' => $this->agent->id]);
        RentalApplication::create(['agency_id' => $this->agency->id, 'agent_id' => $this->other->id, 'created_by' => $this->other->id]);

        $this->actingAs($this->agent)->get('/agent/tenants')->assertInertia(fn (Assert $p) => $p->has('applications', 1)->where('applications.0.id', $mine->id));
        $this->actingAs($this->other)->patch("/agent/tenants/applications/{$mine->id}", ['status' => 'approved'])->assertNotFound();
        $this->actingAs($this->other)->post('/agent/tenants/applications', ['listing_id' => $this->listing->id])->assertSessionHasErrors('listing_id');

        $this->actingAs($this->owner)->get('/agency/tenants?tab=applications')->assertInertia(fn (Assert $p) => $p->has('applications', 2)->where('applicationListings.0.id', $this->listing->id));
        $this->actingAs($this->owner)->post('/agency/tenants/applications', ['listing_id' => $this->listing->id])->assertSessionHas('success');
        $this->assertSame($this->agent->id, RentalApplication::latest('id')->first()->agent_id, 'agency-created link goes to the listing agent');
    }

    #[Test]
    public function bad_tokens_404_and_deleting_removes_documents(): void
    {
        $this->get('/apply/' . Str::random(40))->assertNotFound();
        $this->get('/apply/short')->assertNotFound();

        $app = RentalApplication::create(['agency_id' => $this->agency->id, 'listing_id' => $this->listing->id, 'agent_id' => $this->agent->id, 'created_by' => $this->agent->id]);
        $this->post("/apply/{$app->token}/documents", ['kind' => 'id_document', 'files' => [UploadedFile::fake()->image('id.jpg')]]);
        $path = $app->documents()->first()->path;
        Storage::disk('local')->assertExists($path);

        $this->actingAs($this->agent)->delete("/agent/tenants/applications/{$app->id}")->assertSessionHas('success');
        Storage::disk('local')->assertMissing($path);
        $this->assertSame(0, RentalApplication::count());
    }

    #[Test]
    public function self_employed_applicants_need_business_documents_and_details(): void
    {
        $app = RentalApplication::create(['agency_id' => $this->agency->id, 'listing_id' => $this->listing->id, 'agent_id' => $this->agent->id, 'employment_type' => 'self_employed']);
        $answers = $this->answers();
        $answers['employment'] = ['gross_income' => '60000', 'net_income' => '40000'];
        $app->update(['data' => $answers]);

        $this->post("/apply/{$app->token}/submit")->assertSessionHasErrors(['employment.business_name', 'employment.years_trading', 'documents.business_docs'])
            ->assertSessionDoesntHaveErrors('documents.payslip');
    }
    #[Test]
    public function create_lease_from_an_application_invites_the_tenant_and_leases_the_listing(): void
    {
        Notification::fake();
        $app = RentalApplication::create(['agency_id' => $this->agency->id, 'listing_id' => $this->listing->id, 'agent_id' => $this->agent->id,
            'created_by' => $this->agent->id, 'status' => 'submitted', 'employment_type' => 'salary', 'data' => $this->answers()]);

        // Not before submission.
        $draft = RentalApplication::create(['agency_id' => $this->agency->id, 'listing_id' => $this->listing->id, 'agent_id' => $this->agent->id, 'status' => 'in_progress']);
        $this->actingAs($this->agent)->post("/agent/tenants/applications/{$draft->id}/lease", [])->assertSessionHas('error');

        // Pre-filled from the answers (newest first: the draft is index 0).
        $this->actingAs($this->agent)->get('/agent/tenants')->assertInertia(fn (Assert $p) => $p
            ->where('applications.1.can_lease', true)
            ->where('applications.1.lease_defaults.tenant_name', 'Thandi Mokoena')
            ->where('applications.1.lease_defaults.tenant_email', 'thandi@example.com')
            ->where('applications.1.lease_defaults.start_date', now()->addMonth()->toDateString())
            ->where('applications.1.lease_defaults.monthly_rent', 12000));

        $this->actingAs($this->agent)->post("/agent/tenants/applications/{$app->id}/lease", [
            'tenant_name' => 'Thandi Mokoena', 'tenant_email' => 'thandi@example.com', 'tenant_phone' => '082 123 4567',
            'start_date' => now()->addMonth()->toDateString(), 'end_date' => now()->addMonths(13)->toDateString(),
            'monthly_rent' => 12000, 'deposit_amount' => 12000,
        ])->assertSessionHas('success');

        $app->refresh();
        $lease = Lease::findOrFail($app->lease_id);
        $this->assertSame('approved', $app->status);
        $this->assertSame('pending', $lease->status);
        $this->assertSame($this->agency->id, $lease->agency_id);
        $this->assertSame($this->agent->id, $lease->agent_id);
        $this->assertSame('thandi@example.com', $lease->tenant->email);
        $this->assertSame('leased', $this->listing->fresh()->status);
        $this->assertTrue(Commission::where('lease_id', $lease->id)->where('deal_type', 'rental')->exists());
        Notification::assertSentOnDemand(UserInvited::class);

        // Only once; the agency admin sees it as done, and other applications for the property can't lease it.
        $this->actingAs($this->agent)->post("/agent/tenants/applications/{$app->id}/lease", [])->assertSessionHas('error');
        $this->assertSame(1, Lease::count());
        $this->actingAs($this->owner)->get('/agency/tenants')->assertInertia(fn (Assert $p) => $p
            ->where('applications.1.lease.id', $lease->id)->where('applications.1.can_lease', false)->where('applications.0.listing_leased', true));
    }
    #[Test]
    public function invite_tenant_on_a_listing_still_creates_the_lease(): void
    {
        Notification::fake();
        $this->actingAs($this->agent)->post("/agent/listings/{$this->listing->id}/invite-tenant", [
            'tenant_name' => 'Sizwe Nkosi', 'tenant_email' => 'sizwe@example.com', 'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(), 'monthly_rent' => 12000, 'deposit_amount' => 12000,
        ])->assertRedirect('/agent/listings')->assertSessionHas('success');

        $lease = Lease::firstOrFail();
        $this->assertSame('sizwe@example.com', $lease->tenant->email);
        $this->assertSame($this->agent->id, $lease->agent_id);
        $this->assertSame('leased', $this->listing->fresh()->status);
        $this->assertTrue(Commission::where('lease_id', $lease->id)->exists());
        Notification::assertSentOnDemand(UserInvited::class);
    }
}
