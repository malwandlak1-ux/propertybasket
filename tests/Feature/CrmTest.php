<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\CrmActivity;
use App\Models\CrmProspect;
use App\Models\CrmRegion;
use App\Models\CrmScheme;
use App\Models\CrmSuburb;
use App\Models\Inquiry;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** CRM: farming tracker, outreach log, pipeline hand-off, agency view-only. */
class CrmTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $agent;
    private User $other;
    private Agency $agency;
    private CrmSuburb $suburb;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->owner->assignRole('agency_admin');
        $this->agency = Agency::create([
            'user_id' => $this->owner->id, 'name' => 'Sandton Realty', 'slug' => 'sandton-' . Str::random(6),
            'email' => $this->owner->email, 'status' => 'active',
        ]);
        $this->agency->activateSubscription('promo', now()->addYear());

        $this->agent = $this->makeAgent('Sipho Dlamini');
        $this->other = $this->makeAgent('Aisha Patel');

        $this->suburb = CrmSuburb::where('name', 'Sunnyside')->firstOrFail();
    }

    private function makeAgent(string $name): User
    {
        $u = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active, 'name' => $name]);
        $u->assignRole('agent');
        AgencyAgent::create([
            'agency_id' => $this->agency->id, 'user_id' => $u->id, 'commission_split_percent' => 50,
            'lead_allocation_position' => 0, 'ffc_number' => 'FFC-' . $u->id, 'ffc_expires_at' => now()->addYear(), 'status' => 'active',
        ]);

        return $u;
    }

    private function scheme(User $agent, string $name = 'SS Maxbie'): CrmScheme
    {
        return CrmScheme::create([
            'crm_suburb_id' => $this->suburb->id, 'agency_id' => $this->agency->id,
            'agent_id' => $agent->id, 'name' => $name, 'units_count' => 60,
        ]);
    }

    private function prospect(CrmScheme $scheme, array $attrs = []): CrmProspect
    {
        return $scheme->prospects()->create($attrs + [
            'agency_id' => $scheme->agency_id, 'agent_id' => $scheme->agent_id,
            'owner_name' => 'J SMITH', 'unit' => '4', 'phone1' => '0821234567', 'status' => 'not_contacted',
        ]);
    }

    #[Test]
    public function shared_reference_regions_and_suburbs_are_loaded(): void
    {
        $this->assertSame(8, CrmRegion::whereNull('agency_id')->count());
        $this->assertNotNull($this->suburb->stats['totalStock'] ?? null);
        $this->assertSame(0, CrmProspect::count(), 'No owner data ships with the reference set.');
    }

    #[Test]
    public function an_agent_drills_down_and_only_sees_their_own_schemes(): void
    {
        $mine = $this->scheme($this->agent);
        $this->prospect($mine);
        $this->scheme($this->other, 'SS Mitzin');

        $this->actingAs($this->agent)->get('/agent/crm/farming')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Agent/Crm/Farming')->where('farm.level', 'regions'));

        $this->actingAs($this->agent)->get('/agent/crm/farming?suburb=' . $this->suburb->id)->assertOk()
            ->assertInertia(fn (Assert $p) => $p->where('farm.level', 'suburb')
                ->has('farm.schemes', 1)->where('farm.schemes.0.name', 'SS Maxbie')->where('farm.schemes.0.owners', 1));

        $this->actingAs($this->agent)->get('/agent/crm/farming?scheme=' . $mine->id)->assertOk()
            ->assertInertia(fn (Assert $p) => $p->where('farm.level', 'scheme')->has('farm.prospects', 1));

        $theirs = CrmScheme::where('name', 'SS Mitzin')->first();
        $this->actingAs($this->agent)->get('/agent/crm/farming?scheme=' . $theirs->id)->assertNotFound();
    }

    #[Test]
    public function an_agent_adds_a_region_shared_with_their_agency_only(): void
    {
        $this->actingAs($this->agent)->post('/agent/crm/regions', ['name' => '  Centurion   West '])
            ->assertSessionHas('success');
        $region = CrmRegion::where('name', 'Centurion West')->firstOrFail();
        $this->assertSame($this->agency->id, $region->agency_id);
        $this->assertSame('centurion-west', $region->slug);
        $this->assertGreaterThan(CrmRegion::whereNull('agency_id')->max('sort'), $region->sort, 'Listed after the shared regions');

        // Lands inside the new region, ready for suburbs; a colleague sees it too.
        $this->actingAs($this->agent)->post('/agent/crm/suburbs', ['region_id' => $region->id, 'name' => 'Highveld'])->assertSessionHas('success');
        $this->actingAs($this->other)->get('/agent/crm/farming?region=' . $region->id)->assertOk()
            ->assertInertia(fn (Assert $p) => $p->where('farm.level', 'region')->has('farm.suburbs', 1));

        // Duplicate names (incl. shared regions) are refused.
        $this->actingAs($this->agent)->post('/agent/crm/regions', ['name' => 'centurion west'])->assertSessionHas('error');
        $shared = CrmRegion::whereNull('agency_id')->first();
        $this->actingAs($this->agent)->post('/agent/crm/regions', ['name' => strtoupper($shared->name)])->assertSessionHas('error');
        $this->assertSame(1, CrmRegion::where('agency_id', $this->agency->id)->count());

        // Another agency's agent can't see or use it.
        $owner2 = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $agency2 = Agency::create(['user_id' => $owner2->id, 'name' => 'Other Realty', 'slug' => 'other-' . Str::random(6), 'email' => $owner2->email, 'status' => 'active']);
        $agency2->activateSubscription('promo', now()->addYear());
        $outsider = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        $outsider->assignRole('agent');
        AgencyAgent::create(['agency_id' => $agency2->id, 'user_id' => $outsider->id, 'commission_split_percent' => 50,
            'lead_allocation_position' => 0, 'ffc_number' => 'FFC-X', 'ffc_expires_at' => now()->addYear(), 'status' => 'active']);
        $this->actingAs($outsider)->get('/agent/crm/farming')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->where('farm.regions', fn ($rs) => collect($rs)->doesntContain('name', 'Centurion West')));
        $this->actingAs($outsider)->post('/agent/crm/suburbs', ['region_id' => $region->id, 'name' => 'Sneaky'])->assertNotFound();
    }

    #[Test]
    public function an_agent_adds_a_scheme_and_imports_owners_skipping_duplicates(): void
    {
        $this->actingAs($this->agent)->post('/agent/crm/schemes', [
            'suburb_id' => $this->suburb->id, 'name' => 'SS Los Angeles', 'units_count' => 40,
        ])->assertRedirect();
        $scheme = CrmScheme::where('name', 'SS Los Angeles')->firstOrFail();
        $this->assertSame($this->agent->id, $scheme->agent_id);

        $rows = [
            ['owner_name' => 'A NKOSI', 'unit' => '1', 'phone1' => '0821111111'],
            ['owner_name' => 'B MOKOENA', 'unit' => '2'],
            ['owner_name' => 'A NKOSI', 'unit' => '1'],
        ];
        $this->actingAs($this->agent)->post("/agent/crm/schemes/{$scheme->id}/import", ['rows' => $rows])
            ->assertSessionHas('success', '2 owners imported (1 duplicates skipped).');
        $this->assertSame(2, $scheme->prospects()->count());

        $this->actingAs($this->agent)->post("/agent/crm/schemes/{$scheme->id}/import", ['rows' => $rows]);
        $this->assertSame(2, $scheme->prospects()->count());
    }

    #[Test]
    public function logging_a_contact_records_the_touch_and_moves_the_status_forward(): void
    {
        $p = $this->prospect($this->scheme($this->agent));

        $this->actingAs($this->agent)->post('/agent/crm/activities', [
            'prospect_id' => $p->id, 'channel' => 'call', 'outcome' => 'no_answer', 'occurred_on' => now()->toDateString(),
        ])->assertRedirect();
        $p->refresh();
        $this->assertSame('attempted', $p->status);
        $this->assertSame('call', $p->method);
        $this->assertNotNull($p->contacted_on);

        $this->actingAs($this->agent)->post('/agent/crm/activities', [
            'prospect_id' => $p->id, 'channel' => 'whatsapp', 'outcome' => 'interested', 'note' => 'Wants a valuation', 'occurred_on' => now()->toDateString(),
        ]);
        $this->assertSame('interested', $p->fresh()->status);

        // A soft outcome never moves a warm owner backwards.
        $this->actingAs($this->agent)->post('/agent/crm/activities', [
            'prospect_id' => $p->id, 'channel' => 'sms', 'outcome' => 'sent', 'occurred_on' => now()->toDateString(),
        ]);
        $this->assertSame('interested', $p->fresh()->status);
        $this->assertSame(3, CrmActivity::where('crm_prospect_id', $p->id)->count());
    }

    #[Test]
    public function the_overview_counts_touches_per_channel_including_batches(): void
    {
        $p = $this->prospect($this->scheme($this->agent));
        $today = now()->toDateString();
        $this->actingAs($this->agent)->post('/agent/crm/activities', ['channel' => 'sms', 'quantity' => 250, 'occurred_on' => $today]);
        $this->actingAs($this->agent)->post('/agent/crm/activities', ['prospect_id' => $p->id, 'channel' => 'call', 'outcome' => 'appointment', 'occurred_on' => $today]);

        $this->actingAs($this->agent)->get('/agent/crm?range=7')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Agent/Crm/Overview')
                ->where('data.kpis.touches', 251)
                ->where('data.kpis.appointments', 1)
                ->where('data.channels', fn ($ch) => collect($ch)->firstWhere('key', 'sms')['attempts'] === 250
                    && collect($ch)->firstWhere('key', 'call')['connected'] === 1)
                ->where('data.funnel', fn ($f) => collect($f)->firstWhere('key', 'appraisal_booked')['count'] === 1));
    }

    #[Test]
    public function a_warm_owner_goes_to_the_pipeline_as_a_seller_lead(): void
    {
        $p = $this->prospect($this->scheme($this->agent), ['status' => 'interested', 'est_value' => 850000]);

        $this->actingAs($this->agent)->post("/agent/crm/prospects/{$p->id}/pipeline")->assertSessionHas('success');

        $lead = Inquiry::where('source', 'farming')->firstOrFail();
        $this->assertNull($lead->listing_id);
        $this->assertSame($this->agent->id, $lead->assigned_to);
        $this->assertSame('qualified', $lead->status);
        $this->assertSame($lead->id, $p->fresh()->inquiry_id);

        $this->actingAs($this->agent)->get('/agent/crm/pipeline')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Agent/Pipeline')
                ->where('columns', fn ($cols) => collect($cols)->firstWhere('key', 'qualified')['cards'][0]['deal_value'] == 850000));

        // Only once.
        $this->actingAs($this->agent)->post("/agent/crm/prospects/{$p->id}/pipeline")->assertSessionHas('error');
        $this->assertSame(1, Inquiry::where('source', 'farming')->count());
    }

    #[Test]
    public function agents_cannot_touch_each_others_records(): void
    {
        $scheme = $this->scheme($this->other);
        $p = $this->prospect($scheme);

        $this->actingAs($this->agent)->patch("/agent/crm/prospects/{$p->id}/status", ['status' => 'lost'])->assertForbidden();
        $this->actingAs($this->agent)->delete("/agent/crm/prospects/{$p->id}")->assertForbidden();
        $this->actingAs($this->agent)->post("/agent/crm/schemes/{$scheme->id}/import", ['rows' => [['owner_name' => 'X']]])->assertForbidden();
        $this->actingAs($this->agent)->get("/agent/crm/schemes/{$scheme->id}/export")->assertForbidden();
        $this->actingAs($this->agent)->post('/agent/crm/activities', ['prospect_id' => $p->id, 'channel' => 'call', 'occurred_on' => now()->toDateString()])->assertForbidden();
        $this->assertSame('not_contacted', $p->fresh()->status);
    }

    #[Test]
    public function the_agency_sees_every_agents_crm_but_cannot_edit(): void
    {
        $this->prospect($this->scheme($this->agent));
        $this->prospect($this->scheme($this->other, 'SS Mitzin'), ['owner_name' => 'K MOLEFE']);
        CrmActivity::create(['agency_id' => $this->agency->id, 'agent_id' => $this->agent->id, 'channel' => 'call', 'quantity' => 30, 'occurred_on' => now()->toDateString()]);
        CrmActivity::create(['agency_id' => $this->agency->id, 'agent_id' => $this->other->id, 'channel' => 'email', 'quantity' => 12, 'occurred_on' => now()->toDateString()]);

        $this->actingAs($this->owner)->get('/agency/crm')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Agency/Crm/Overview')
                ->where('data.kpis.touches', 42)
                ->where('data.kpis.prospects', 2)
                ->where('leaderboard', fn ($rows) => collect($rows)->firstWhere('name', 'Sipho Dlamini')['calls'] === 30
                    && collect($rows)->firstWhere('name', 'Aisha Patel')['email'] === 12));

        $this->actingAs($this->owner)->get('/agency/crm?agent=' . $this->other->id)
            ->assertInertia(fn (Assert $p) => $p->where('data.kpis.touches', 12)->where('agent_id', $this->other->id));

        $this->actingAs($this->owner)->get('/agency/crm/farming?suburb=' . $this->suburb->id)->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Agency/Crm/Farming')->has('farm.schemes', 2));

        $scheme = CrmScheme::where('name', 'SS Mitzin')->first();
        $this->actingAs($this->owner)->get("/agency/crm/schemes/{$scheme->id}/export")->assertOk();

        // Agency admins aren't agents: the agent write routes refuse them.
        $p = CrmProspect::first();
        $this->actingAs($this->owner)->patch("/agent/crm/prospects/{$p->id}/status", ['status' => 'lost']);
        $this->assertSame('not_contacted', $p->fresh()->status);
    }

    #[Test]
    public function old_pipeline_links_redirect_into_the_crm(): void
    {
        $this->actingAs($this->agent)->get('/agent/pipeline')->assertRedirect('/agent/crm/pipeline');
        $this->actingAs($this->owner)->get('/agency/pipeline')->assertRedirect('/agency/crm/pipeline');
        $this->actingAs($this->owner)->get('/agency/crm/pipeline')->assertOk();
    }
}
