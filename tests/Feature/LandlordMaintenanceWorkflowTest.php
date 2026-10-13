<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Contractor;
use App\Models\Invitation;
use App\Models\Landlord;
use App\Models\Listing;
use App\Models\MaintenanceInvoice;
use App\Models\MaintenanceQuote;
use App\Models\MaintenanceRequest;
use App\Models\User;
use App\Notifications\InvoiceSubmitted;
use App\Notifications\MaintenanceInvoicePaid;
use App\Notifications\MaintenanceJobAssigned;
use App\Notifications\QuoteAccepted;
use App\Notifications\QuoteSubmitted;
use App\Notifications\UserInvited;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** A landlord runs maintenance end to end: invite contractor → quote → approve → invoice → pay. */
class LandlordMaintenanceWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Landlord $landlord;
    private User $tenant;
    private MaintenanceRequest $job;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        config(['edition.contractor_marketplace' => false]);
        Notification::fake();

        $this->owner = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active]);
        $this->owner->assignRole('landlord');
        $this->landlord = Landlord::create(['user_id' => $this->owner->id]);
        $this->landlord->activateSubscription('promo', now()->addYear());

        $this->tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active]);
        $listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Landlord::class, 'owner_id' => $this->landlord->id,
            'title' => '45 Test Street', 'address' => '45 Test Street', 'slug' => 'test-' . Str::random(8),
            'listing_type' => 'long_term_rent', 'property_type' => 'house', 'status' => 'leased',
        ]);
        $this->job = MaintenanceRequest::create([
            'property_id' => $listing->id, 'submitted_by' => $this->tenant->id, 'title' => 'Burst geyser pipe',
            'description' => 'Water everywhere', 'category' => 'plumbing', 'urgency' => 'high', 'status' => 'open',
        ]);
    }

    private function activeContractor(string $name = 'PlumbPro'): Contractor
    {
        $user = User::factory()->create(['role' => Role::Contractor, 'status' => UserStatus::Active, 'invite_accepted_at' => now()]);
        $user->assignRole('contractor');

        return Contractor::create([
            'user_id' => $user->id, 'business_name' => $name, 'status' => 'active',
            'bank_name' => 'FNB', 'bank_account_holder' => $name, 'bank_account_number' => '62000000000',
            'bank_branch_code' => '250655', 'bank_account_type' => 'cheque',
        ]);
    }

    #[Test]
    public function landlord_invites_a_new_contractor_by_email(): void
    {
        $this->actingAs($this->owner)->post('/landlord/contractors', [
            'business_name' => 'Kimberley Plumbing', 'contact_name' => 'Sam Dlamini',
            'email' => 'sam@plumbing.test', 'specialities' => ['Plumbing'],
        ])->assertRedirect();

        $user = User::where('email', 'sam@plumbing.test')->firstOrFail();
        $this->assertSame(Role::Contractor, $user->role);
        $contractor = Contractor::where('user_id', $user->id)->firstOrFail();
        $this->assertSame($this->landlord->id, $contractor->created_by_landlord_id);
        $this->assertTrue($this->landlord->contractors()->whereKey($contractor->id)->exists());
        $this->assertTrue(Invitation::where('email', 'sam@plumbing.test')->where('role', 'contractor')->exists());
        Notification::assertSentOnDemand(UserInvited::class);

        $this->actingAs($this->owner)->get('/landlord/contractors')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p->has('contractors', 1)->where('contractors.0.account_state', 'invited'));
    }

    #[Test]
    public function inviting_an_existing_contractor_reuses_their_profile(): void
    {
        $existing = $this->activeContractor();

        $this->actingAs($this->owner)->post('/landlord/contractors', [
            'business_name' => 'Whatever', 'contact_name' => 'X', 'email' => $existing->user->email,
        ])->assertRedirect();

        $this->assertSame(1, Contractor::where('user_id', $existing->user_id)->count());
        $this->assertTrue($this->landlord->contractors()->whereKey($existing->id)->exists());
        $this->assertFalse(Invitation::where('email', $existing->user->email)->exists());
    }

    #[Test]
    public function full_quote_to_payment_workflow(): void
    {
        $contractor = $this->activeContractor();
        $this->landlord->contractors()->attach($contractor->id);

        // 1. Landlord requests a quote.
        $this->actingAs($this->owner)
            ->post("/landlord/maintenance/{$this->job->id}/assign", ['contractor_id' => $contractor->id])
            ->assertRedirect();
        $this->assertSame($contractor->user_id, $this->job->fresh()->assigned_to);
        Notification::assertSentTo($contractor->user, MaintenanceJobAssigned::class);

        // 2. Contractor quotes; landlord is notified and sees it to review.
        $this->actingAs($contractor->user)->post('/contractor/quotes', [
            'maintenance_request_id' => $this->job->id,
            'line_items' => [['label' => 'Replace pipe', 'qty' => 1, 'unit_price' => 1200]],
            'status' => 'sent',
        ])->assertRedirect();
        $quote = MaintenanceQuote::where('maintenance_request_id', $this->job->id)->firstOrFail();
        Notification::assertSentTo($this->owner, QuoteSubmitted::class);

        $this->actingAs($this->owner)->get('/landlord/maintenance')
            ->assertInertia(fn (Assert $p) => $p
                ->where('grouped.open.0.stage', 'quote_review')
                ->where('grouped.open.0.quotes.0.total', 1200)
            );

        // Contractor can't schedule before approval.
        $this->actingAs($contractor->user)->post("/contractor/requests/{$this->job->id}/accept")->assertStatus(422);

        // 3. Landlord accepts; contractor schedules and completes.
        $this->actingAs($this->owner)->post("/landlord/maintenance/quotes/{$quote->id}/accept")->assertRedirect();
        $this->assertSame('accepted', $quote->fresh()->status);
        Notification::assertSentTo($contractor->user, QuoteAccepted::class);

        $this->actingAs($contractor->user)->post("/contractor/requests/{$this->job->id}/accept")->assertRedirect();
        $this->assertSame('in_progress', $this->job->fresh()->status);
        $this->actingAs($contractor->user)->post("/contractor/jobs/{$this->job->id}/complete")->assertRedirect();
        $this->assertSame('completed', $this->job->fresh()->status);

        // 4. Contractor invoices; landlord is notified.
        $this->actingAs($contractor->user)->post('/contractor/invoices', [
            'maintenance_request_id' => $this->job->id,
            'line_items' => [['label' => 'Replace pipe', 'qty' => 1, 'unit_price' => 1200]],
            'status' => 'submitted',
        ])->assertRedirect();
        $invoice = MaintenanceInvoice::where('maintenance_request_id', $this->job->id)->firstOrFail();
        Notification::assertSentTo($this->owner, InvoiceSubmitted::class);

        $this->actingAs($this->owner)->get('/landlord/maintenance')
            ->assertInertia(fn (Assert $p) => $p
                ->where('grouped.completed.0.stage', 'invoice_review')
                ->where('grouped.completed.0.invoice.bank.account', '62000000000')
            );

        // 5. Landlord records payment: job closed, contractor told.
        $this->actingAs($this->owner)->post("/landlord/maintenance/invoices/{$invoice->id}/paid")->assertRedirect();
        $this->assertSame('paid', $invoice->fresh()->status);
        $this->assertSame('paid', $this->job->fresh()->status);
        Notification::assertSentTo($contractor->user, MaintenanceInvoicePaid::class);

        // 6. Landlord rates the work.
        $this->actingAs($this->owner)->post("/landlord/maintenance/{$this->job->id}/rate", ['rating' => 5])->assertRedirect();
        $this->assertSame(5.0, (float) $contractor->fresh()->average_rating);
    }

    #[Test]
    public function landlord_can_only_request_quotes_from_their_own_contractors(): void
    {
        $stranger = $this->activeContractor('Stranger Co');

        $this->actingAs($this->owner)
            ->post("/landlord/maintenance/{$this->job->id}/assign", ['contractor_id' => $stranger->id])
            ->assertForbidden();
        $this->assertNull($this->job->fresh()->assigned_to);
    }

    #[Test]
    public function another_landlord_cannot_touch_this_job(): void
    {
        $contractor = $this->activeContractor();
        $this->job->update(['assigned_to' => $contractor->user_id]);
        $quote = MaintenanceQuote::create([
            'maintenance_request_id' => $this->job->id, 'contractor_id' => $contractor->id,
            'line_items' => [], 'subtotal' => 100, 'vat_amount' => 0, 'total' => 100, 'status' => 'sent',
        ]);

        $other = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active]);
        $other->assignRole('landlord');
        $otherLandlord = Landlord::create(['user_id' => $other->id]);
        $otherLandlord->activateSubscription('promo', now()->addYear());
        $otherLandlord->contractors()->attach($contractor->id);

        $this->actingAs($other)->post("/landlord/maintenance/quotes/{$quote->id}/accept")->assertForbidden();
        $this->actingAs($other)->post("/landlord/maintenance/{$this->job->id}/assign", ['contractor_id' => $contractor->id])->assertForbidden();
        $this->assertSame('sent', $quote->fresh()->status);
    }
}
