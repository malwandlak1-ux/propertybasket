<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Http\Middleware\ResolveAgencySite;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\AgencyWebsite;
use App\Models\Inquiry;
use App\Models\Listing;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Agency websites: host routing, shared visibility with the main portal
 * (sold / rented listings drop off BOTH), inquiry attribution, and the
 * agency-admin Website settings page.
 */
class AgencySiteTest extends TestCase
{
    use RefreshDatabase;

    private const SITE = 'http://sandton.localhost';
    // Always absolute: the test URL generator otherwise reuses the previous request's host.
    private const MAIN = 'http://localhost';

    private User $owner;
    private User $agent;
    private Agency $agency;
    private AgencyWebsite $site;
    private Listing $rental;
    private Listing $sale;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->seed(RolesAndPermissionsSeeder::class);
        Notification::fake();

        $this->owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->owner->assignRole(Role::AgencyAdmin->value);
        $this->agent = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active, 'name' => 'Sipho Ndlovu']);
        $this->agent->assignRole(Role::Agent->value);

        $this->agency = Agency::create([
            'user_id' => $this->owner->id, 'name' => 'Sandton Realty', 'slug' => 'sandton-realty',
            'email' => $this->owner->email, 'status' => 'active',
            'eaab_ffc_number' => 'F1', 'eaab_ffc_expires_at' => now()->addYear(),
            'subscription_plan' => 'growth', 'subscription_expires_at' => now()->addYear(),
        ]);
        AgencyAgent::create([
            'agency_id' => $this->agency->id, 'user_id' => $this->agent->id,
            'commission_split_percent' => 50, 'lead_allocation_position' => 0,
            'ffc_number' => 'A1', 'ffc_expires_at' => CarbonImmutable::now()->addYear(), 'status' => 'active',
        ]);

        $this->site = AgencyWebsite::create([
            'agency_id' => $this->agency->id, 'subdomain' => 'sandton',
            'template' => 'editorial', 'status' => 'published', 'published_at' => now(),
        ]);

        $this->rental = $this->listing('Rosebank flat', 'long_term_rent');
        $this->sale = $this->listing('Bryanston house', 'for_sale');
    }

    private function listing(string $title, string $type, ?Agency $agency = null): Listing
    {
        return Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Agency::class, 'owner_id' => ($agency ?? $this->agency)->id,
            'agent_id' => $this->agent->id, 'title' => $title, 'slug' => Str::slug($title).'-'.Str::random(4),
            'listing_type' => $type, 'property_type' => 'house', 'status' => 'available',
            'monthly_rent' => $type === 'long_term_rent' ? 12000 : null,
            'sale_price' => $type === 'for_sale' ? 2_500_000 : null,
            'suburb' => 'Rosebank', 'city' => 'Johannesburg',
        ]);
    }

    private function visibleOnBoth(Listing $l): void
    {
        $this->get(self::MAIN.'/properties/'.$l->slug)->assertOk();
        $this->get(self::SITE.'/properties/'.$l->slug)->assertOk();
        $this->get(self::SITE.'/properties')->assertInertia(fn (Assert $p) => $p
            ->where('listings.data', fn ($rows) => collect($rows)->pluck('id')->contains($l->id)));
    }

    private function goneFromBoth(Listing $l): void
    {
        $this->get(self::MAIN.'/properties/'.$l->slug)->assertNotFound();
        $this->get(self::SITE.'/properties/'.$l->slug)->assertNotFound();
        $this->get(self::MAIN.'/properties')->assertInertia(fn (Assert $p) => $p
            ->where('listings.data', fn ($rows) => ! collect($rows)->pluck('id')->contains($l->id)));
        $this->get(self::SITE.'/properties')->assertInertia(fn (Assert $p) => $p
            ->where('listings.data', fn ($rows) => ! collect($rows)->pluck('id')->contains($l->id)));
    }

    #[Test]
    public function site_resolves_by_subdomain_and_main_host_still_serves_portal(): void
    {
        $this->get(self::SITE.'/')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('Site/Home')
            ->where('site.name', 'Sandton Realty')
            ->has('featured.for_sale', 1)
            ->has('featured.long_term_rent', 1));

        $this->get(self::MAIN.'/')->assertOk()->assertInertia(fn (Assert $p) => $p->component('Public/Home'));
    }

    #[Test]
    public function unknown_and_unpublished_hosts_404(): void
    {
        $this->get('http://nobody.localhost/')->assertNotFound();

        $this->site->update(['status' => 'draft']);
        $this->get(self::SITE.'/')->assertNotFound();

        // The dashboard preview link unlocks a draft.
        $token = ResolveAgencySite::previewToken($this->site);
        $this->get(self::SITE.'/?preview='.$token)->assertOk();
    }

    #[Test]
    public function custom_domain_serves_the_site_only_once_live(): void
    {
        $this->site->update(['custom_domain' => 'sandtonrealty.co.za', 'domain_status' => 'verified']);
        $this->get('http://sandtonrealty.co.za/')->assertNotFound();

        $this->site->update(['domain_status' => 'live']);
        $this->get('http://sandtonrealty.co.za/')->assertOk();
        $this->get('http://www.sandtonrealty.co.za/')->assertOk();
    }

    #[Test]
    public function platform_pages_are_not_served_on_an_agency_host(): void
    {
        $this->get(self::SITE.'/login')->assertNotFound();
        $this->get(self::SITE.'/agencies')->assertNotFound();
    }

    #[Test]
    public function only_this_agencys_listings_appear(): void
    {
        $otherOwner = User::factory()->create(['role' => Role::AgencyAdmin]);
        $other = Agency::create(['user_id' => $otherOwner->id, 'name' => 'Other', 'slug' => 'other', 'status' => 'active']);
        $foreign = $this->listing('Camps Bay villa', 'for_sale', $other);

        $this->get(self::SITE.'/properties/'.$foreign->slug)->assertNotFound();
        $this->get(self::MAIN.'/properties/'.$foreign->slug)->assertOk();
    }

    #[Test]
    public function marking_sold_removes_listing_from_both_front_ends(): void
    {
        $this->visibleOnBoth($this->sale);

        $this->actingAs($this->agent)
            ->post(self::MAIN."/agent/listings/{$this->sale->id}/mark-sold", ['sale_price' => 2_400_000])
            ->assertRedirect();
        auth()->logout();

        $this->assertSame('sold', $this->sale->fresh()->status);
        $this->goneFromBoth($this->sale);
    }

    #[Test]
    public function marking_rented_removes_listing_from_both_and_reactivate_restores_it(): void
    {
        $this->visibleOnBoth($this->rental);

        $this->actingAs($this->agent)
            ->post(self::MAIN."/agent/listings/{$this->rental->id}/mark-leased")
            ->assertRedirect();
        auth()->logout();

        $this->assertSame('leased', $this->rental->fresh()->status);
        $this->goneFromBoth($this->rental);

        $this->actingAs($this->agent)->post(self::MAIN."/agent/listings/{$this->rental->id}/reactivate")->assertRedirect();
        auth()->logout();
        $this->visibleOnBoth($this->rental);
    }

    #[Test]
    public function mark_leased_is_limited_to_the_agents_available_rentals(): void
    {
        $this->actingAs($this->agent)->post(self::MAIN."/agent/listings/{$this->sale->id}/mark-leased")->assertStatus(422);

        $stranger = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        $stranger->assignRole(Role::Agent->value);
        AgencyAgent::create([
            'agency_id' => $this->agency->id, 'user_id' => $stranger->id, 'commission_split_percent' => 50,
            'ffc_number' => 'A2', 'ffc_expires_at' => now()->addYear(), 'status' => 'active',
        ]);
        $this->actingAs($stranger)->post(self::MAIN."/agent/listings/{$this->rental->id}/mark-leased")->assertForbidden();
    }

    #[Test]
    public function site_inquiry_is_attributed_to_the_site_and_preferred_agent(): void
    {
        $this->post(self::SITE.'/inquiries', [
            'listing_id' => $this->rental->id, 'name' => 'Lerato', 'email' => 'l@example.test',
            'message' => 'Is it available?', 'agent_id' => $this->agent->id,
        ])->assertRedirect();

        $inq = Inquiry::latest('id')->first();
        $this->assertSame('website', $inq->source);
        $this->assertSame($this->site->id, $inq->agency_website_id);
        $this->assertSame($this->agent->id, $inq->assigned_to);
    }

    #[Test]
    public function valuation_request_lands_in_the_agency_pipeline(): void
    {
        $this->post(self::SITE.'/contact', [
            'intent' => 'sell', 'name' => 'Thabo', 'email' => 't@example.test', 'address' => '12 Oak Ave, Rosebank',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $inq = Inquiry::latest('id')->first();
        $this->assertNull($inq->listing_id);
        $this->assertSame($this->site->id, $inq->agency_website_id);
        $this->assertSame($this->agent->id, $inq->assigned_to);
        $this->assertStringContainsString('thinking of selling', $inq->message);
    }

    #[Test]
    public function site_inquiry_rejects_another_agencys_listing(): void
    {
        $otherOwner = User::factory()->create(['role' => Role::AgencyAdmin]);
        $other = Agency::create(['user_id' => $otherOwner->id, 'name' => 'Other', 'slug' => 'other2', 'status' => 'active']);
        $foreign = $this->listing('Elsewhere', 'for_sale', $other);

        $this->post(self::SITE.'/inquiries', [
            'listing_id' => $foreign->id, 'name' => 'X', 'email' => 'x@example.test',
        ])->assertNotFound();
    }

    #[Test]
    public function agent_pages_list_only_that_agents_listings(): void
    {
        $this->get(self::SITE.'/agents')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('Site/Agents/Index')->has('agents', 1)->where('agents.0.slug', 'sipho-ndlovu'));

        $this->get(self::SITE.'/agents/sipho-ndlovu')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('Site/Agents/Show')->has('listings', 2));

        AgencyAgent::where('user_id', $this->agent->id)->update(['show_on_website' => false]);
        $this->get(self::SITE.'/agents/sipho-ndlovu')->assertNotFound();
    }

    #[Test]
    public function sitemap_lists_visible_listings_only(): void
    {
        $this->sale->update(['status' => 'sold']);

        $xml = $this->get(self::SITE.'/sitemap.xml')->assertOk()->getContent();
        $this->assertStringContainsString($this->rental->slug, $xml);
        $this->assertStringNotContainsString($this->sale->slug, $xml);
    }

    #[Test]
    public function agency_admin_manages_website_settings(): void
    {
        $this->actingAs($this->owner)->get(self::MAIN.'/agency/website')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Agency/Website')->where('website.subdomain', 'sandton'));

        $this->actingAs($this->owner)->post(self::MAIN.'/agency/website', [
            'subdomain' => 'sandton-realty', 'template' => 'minimal', 'tagline' => 'Homes that fit',
            'primary_color' => '#0EA5E9', 'show_agents' => true,
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame('sandton-realty', $this->site->fresh()->subdomain);
        $this->assertSame('minimal', $this->site->fresh()->template);

        $this->actingAs($this->agent)->get(self::MAIN.'/agency/website')->assertForbidden();
    }

    #[Test]
    public function reserved_and_taken_subdomains_are_rejected(): void
    {
        $otherOwner = User::factory()->create(['role' => Role::AgencyAdmin]);
        $other = Agency::create(['user_id' => $otherOwner->id, 'name' => 'Other', 'slug' => 'other3', 'status' => 'active']);
        AgencyWebsite::create(['agency_id' => $other->id, 'subdomain' => 'taken']);

        foreach (['www', 'manage', 'admin', 'taken', 'Bad_Name', '-x'] as $sub) {
            $this->actingAs($this->owner)->post(self::MAIN.'/agency/website', ['subdomain' => $sub, 'template' => 'modern'])
                ->assertSessionHasErrors('subdomain');
        }
    }
}
