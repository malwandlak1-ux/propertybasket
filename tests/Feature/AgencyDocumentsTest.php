<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\AgencyDocument;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\User;
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

/** Documentation: agency lease agreement + listing packs; tenant signs the lease. */
class AgencyDocumentsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $agent;

    private User $tenant;

    private Agency $agency;

    private Lease $lease;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Storage::fake('local');
        Notification::fake();

        $this->owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->owner->assignRole('agency_admin');
        $this->agency = Agency::create(['user_id' => $this->owner->id, 'name' => 'Basket Realty', 'slug' => 'br-' . Str::random(6), 'email' => $this->owner->email, 'status' => 'active']);
        $this->agency->activateSubscription('promo', now()->addYear());

        $this->agent = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        $this->agent->assignRole('agent');
        AgencyAgent::create(['agency_id' => $this->agency->id, 'user_id' => $this->agent->id, 'commission_split_percent' => 50, 'lead_allocation_position' => 0,
            'ffc_number' => 'FFC-1', 'ffc_certificate_path' => 'ffc/x.pdf', 'ffc_expires_at' => CarbonImmutable::now()->addYear(), 'status' => 'active']);

        $this->tenant = User::factory()->create(['name' => 'Thandi Mokoena', 'role' => Role::Tenant, 'status' => UserStatus::Active]);
        $this->tenant->assignRole('tenant');
        $listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Agency::class, 'owner_id' => $this->agency->id, 'agent_id' => $this->agent->id,
            'title' => '2 Bed in Sandton', 'slug' => 'sandton-' . Str::random(5), 'listing_type' => 'long_term_rent', 'property_type' => 'apartment',
            'status' => 'leased', 'suburb' => 'Sandton', 'city' => 'Johannesburg',
        ]);
        $this->lease = Lease::create([
            'listing_id' => $listing->id, 'tenant_id' => $this->tenant->id, 'agency_id' => $this->agency->id, 'agent_id' => $this->agent->id,
            'start_date' => now()->startOfMonth(), 'end_date' => now()->addYear(), 'monthly_rent' => 12000, 'deposit_amount' => 12000, 'status' => 'pending',
        ]);
    }

    private function upload(string $category, UploadedFile $file, ?User $as = null)
    {
        return $this->actingAs($as ?? $this->owner)->post('/agency/documents', ['category' => $category, 'file' => $file]);
    }

    #[Test]
    public function the_agency_uploads_and_replaces_versioned_documents(): void
    {
        $this->actingAs($this->owner)->get('/agency/documents')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Documents/Index')->where('role', 'agency')->has('categories', 3)->where('categories.0.current', null));

        $this->upload('rental_pack', UploadedFile::fake()->create('pack-2025.zip', 200, 'application/zip'))->assertSessionHas('success');
        $this->upload('rental_pack', UploadedFile::fake()->create('pack-2026.pdf', 200, 'application/pdf'))->assertSessionHas('success');
        $this->upload('lease_agreement', UploadedFile::fake()->create('lease.docx', 50, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))->assertSessionHasErrors('file');

        $current = AgencyDocument::currentFor($this->agency->id, 'rental_pack');
        $this->assertSame(2, $current->version);
        $this->assertSame('pack-2026.pdf', $current->original_name);
        $this->assertSame(2, AgencyDocument::count());

        $this->actingAs($this->owner)->get('/agency/documents')->assertInertia(fn (Assert $p) => $p
            ->where('categories.1.current.version', 2)->has('categories.1.history', 1)->where('categories.1.history.0.version', 1));

        // Restore v1, then delete v2.
        $v1 = AgencyDocument::where('version', 1)->first();
        $this->actingAs($this->owner)->post("/agency/documents/{$v1->id}/restore")->assertSessionHas('success');
        $this->assertTrue($v1->fresh()->is_current);
        $this->actingAs($this->owner)->delete("/agency/documents/{$current->id}")->assertSessionHas('success');
        $this->assertSame(1, AgencyDocument::count());
    }

    #[Test]
    public function agents_see_current_documents_and_share_links_always_serve_the_latest(): void
    {
        $this->upload('sale_pack', UploadedFile::fake()->createWithContent('sale-v1.pdf', '%PDF v1'));
        $this->upload('sale_pack', UploadedFile::fake()->createWithContent('sale-v2.pdf', '%PDF v2'));
        $old = AgencyDocument::where('version', 1)->first();
        $new = AgencyDocument::where('version', 2)->first();

        $shareUrl = null;
        $this->actingAs($this->agent)->get('/agent/documents')->assertOk()->assertInertia(function (Assert $p) use (&$shareUrl) {
            $p->where('role', 'agent')->where('categories.2.current.version', 2)->where('categories.2.history', [])->where('categories.0.share_url', null);
            $shareUrl = $p->toArray()['props']['categories'][2]['share_url'];
        });
        $this->actingAs($this->agent)->get("/agent/documents/{$new->id}")->assertOk();
        $this->actingAs($this->agent)->get("/agent/documents/{$old->id}")->assertNotFound();
        $this->actingAs($this->agent)->post('/agency/documents', ['category' => 'sale_pack', 'file' => UploadedFile::fake()->create('x.pdf')])->assertForbidden();

        auth()->logout();
        $path = parse_url($shareUrl, PHP_URL_PATH);
        $this->assertSame('%PDF v2', $this->get($path)->assertOk()->streamedContent());
        $this->upload('sale_pack', UploadedFile::fake()->createWithContent('sale-v3.pdf', '%PDF v3'));
        auth()->logout();
        $this->assertSame('%PDF v3', $this->get($path)->streamedContent(), 'same link, newest version');
        $this->get(str_replace('sale_pack', 'lease_agreement', $path))->assertNotFound();
    }

    #[Test]
    public function the_tenant_reads_and_signs_the_agency_lease_and_keeps_the_signed_version(): void
    {
        $this->upload('lease_agreement', UploadedFile::fake()->createWithContent('lease-v1.pdf', '%PDF lease v1'));

        $this->actingAs($this->tenant)->get('/tenant/lease')->assertInertia(fn (Assert $p) => $p->where('lease.needs_signature', true)->where('documents.0.subtitle', 'Lease agreement from Basket Realty'));
        $this->assertSame('%PDF lease v1', $this->actingAs($this->tenant)->get('/tenant/lease/agreement.pdf')->assertOk()->streamedContent());

        $this->actingAs($this->tenant)->post('/tenant/lease/sign', ['signature' => 'Thandi Mokoena', 'agreed' => true])->assertSessionHas('success');
        $lease = $this->lease->fresh();
        $this->assertNotNull($lease->tenant_signed_at);
        $this->assertSame(AgencyDocument::first()->id, $lease->agency_document_id);
        $this->assertSame(hash('sha256', '%PDF lease v1'), $lease->signed_document_sha256);
        $this->assertNotNull($lease->tenant_signed_ip);
        $this->assertSame('active', $lease->status);

        // The agency replaces its lease: the signed lease keeps v1.
        $this->upload('lease_agreement', UploadedFile::fake()->createWithContent('lease-v2.pdf', '%PDF lease v2'));
        $this->assertSame('%PDF lease v1', $this->actingAs($this->tenant)->get('/tenant/lease/agreement.pdf')->streamedContent());

        // The signed version can't be deleted.
        $v1 = AgencyDocument::where('version', 1)->first();
        $this->actingAs($this->owner)->delete("/agency/documents/{$v1->id}")->assertSessionHas('error');
        $this->assertNotNull($v1->fresh());

        $this->actingAs($this->owner)->get('/agency/documents')->assertInertia(fn (Assert $p) => $p
            ->where('signing.0.tenant', 'Thandi Mokoena')->where('signing.0.version', 1)->whereNot('signing.0.signed_at', null));

        // Tenants never see listing packs.
        $this->actingAs($this->tenant)->get('/agency/documents')->assertForbidden();
    }
}
