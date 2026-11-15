<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\User;
use App\Notifications\TrustAccountSubmitted;
use App\Notifications\TrustAccountVerified;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Agency captures its Section 54 trust account → platform admins are told → an admin verifies it. */
class TrustAccountVerificationTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $admin;
    private Agency $agency;

    private const DETAILS = [
        'trust_bank'                    => 'First National Bank (FNB)',
        'trust_account_holder'          => 'Property Basket',
        'trust_account_number'          => '63224695940',
        'trust_branch_code'             => '255355',
        'trust_account_type'            => 'current',
        'trust_auditor_name'            => 'Shaba Dreams',
        'trust_auditor_practice_number' => '904887',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->owner->assignRole('agency_admin');
        $this->agency = Agency::create(['user_id' => $this->owner->id, 'name' => 'Basket Realty', 'slug' => 'br-' . Str::random(6), 'email' => $this->owner->email, 'status' => 'active']);
        $this->agency->activateSubscription('promo', now()->addYear());

        $this->admin = User::factory()->create(['role' => Role::SuperAdmin, 'status' => UserStatus::Active]);
        $this->admin->assignRole('super_admin');
    }

    #[Test]
    public function capturing_a_trust_account_notifies_every_platform_admin(): void
    {
        Notification::fake();
        $inactiveAdmin = User::factory()->create(['role' => Role::SuperAdmin, 'status' => UserStatus::Suspended]);

        $this->actingAs($this->owner)->patch('/agency/trust-account', self::DETAILS)->assertSessionHas('success');

        Notification::assertSentTo($this->admin, TrustAccountSubmitted::class, fn ($n, $via) => $n->agency->is($this->agency) && ! $n->changed && in_array('mail', $via, true) && in_array('database', $via, true));
        Notification::assertNotSentTo($inactiveAdmin, TrustAccountSubmitted::class);
        Notification::assertNotSentTo($this->owner, TrustAccountSubmitted::class);

        // Saving again with nothing changed doesn't nag the admins.
        $this->actingAs($this->owner)->patch('/agency/trust-account', self::DETAILS);
        Notification::assertSentToTimes($this->admin, TrustAccountSubmitted::class, 1);

        // Changing the bank details asks for review again, marked as a change.
        $this->actingAs($this->owner)->patch('/agency/trust-account', ['trust_account_number' => '62000000001'] + self::DETAILS);
        Notification::assertSentToTimes($this->admin, TrustAccountSubmitted::class, 2);
        Notification::assertSentTo($this->admin, TrustAccountSubmitted::class, fn ($n) => $n->changed);
    }

    #[Test]
    public function the_admin_bell_links_to_the_agency_and_the_admin_can_verify_it(): void
    {
        $this->actingAs($this->owner)->patch('/agency/trust-account', self::DETAILS);

        $this->actingAs($this->admin)->get('/admin/agencies')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Admin/Agencies')
                ->where('notifications.unread_count', 1)
                ->where('notifications.recent.0.title', 'Trust account to verify')
                ->where('notifications.recent.0.href', '/admin/agencies?trust=' . $this->agency->id)
                ->where('stats.trust_review', 1)
                ->where('agencies.0.trust.status', 'review')
                ->where('agencies.0.trust.account_number', '63224695940')
                ->where('agencies.0.trust.auditor_number', '904887'));

        // Only super admins can verify.
        $this->actingAs($this->owner)->post("/admin/agencies/{$this->agency->id}/verify-trust")->assertForbidden();
        $this->assertNull($this->agency->fresh()->trust_verified_at);

        Notification::fake();
        $this->actingAs($this->admin)->post("/admin/agencies/{$this->agency->id}/verify-trust")->assertSessionHas('success');
        $this->assertNotNull($this->agency->fresh()->trust_verified_at);
        Notification::assertSentTo($this->owner, TrustAccountVerified::class);

        $this->actingAs($this->owner)->get('/agency/trust-account')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->where('trust.state', 'verified'));

        // A bank change sends it back for verification (and back to the admins).
        $this->actingAs($this->owner)->patch('/agency/trust-account', ['trust_branch_code' => '250655'] + self::DETAILS);
        $this->assertNull($this->agency->fresh()->trust_verified_at);
        Notification::assertSentTo($this->admin, TrustAccountSubmitted::class);

        // Toggling again on a verified account revokes it.
        $this->actingAs($this->admin)->post("/admin/agencies/{$this->agency->id}/verify-trust");
        $this->actingAs($this->admin)->post("/admin/agencies/{$this->agency->id}/verify-trust")->assertSessionHas('success');
        $this->assertNull($this->agency->fresh()->trust_verified_at);
    }

    #[Test]
    public function an_incomplete_trust_account_cannot_be_verified(): void
    {
        $this->agency->update(['trust_bank' => 'FNB']);

        $this->actingAs($this->admin)->post("/admin/agencies/{$this->agency->id}/verify-trust")->assertSessionHas('error');
        $this->assertNull($this->agency->fresh()->trust_verified_at);
    }
}
