<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Landlord uploads the signed lease agreement; tenant sees that copy. */
class LeaseAgreementUploadTest extends TestCase
{
    use RefreshDatabase;

    private User $landlordUser;
    private User $tenant;
    private Lease $lease;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Storage::fake('local');

        [$this->landlordUser, $landlord] = $this->landlord();
        $this->tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active]);

        $listing = $this->listing($landlord);
        $this->lease = Lease::create([
            'listing_id' => $listing->id, 'tenant_id' => $this->tenant->id, 'landlord_id' => $this->landlordUser->id,
            'start_date' => now()->subMonths(3)->startOfMonth(), 'end_date' => now()->addYear(),
            'monthly_rent' => 3000, 'deposit_amount' => 3000, 'status' => 'active',
        ]);
    }

    private function landlord(): array
    {
        $user = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active]);
        $user->assignRole('landlord');
        $landlord = Landlord::create(['user_id' => $user->id]);
        $landlord->activateSubscription('promo', now()->addYear());

        return [$user, $landlord];
    }

    private function listing(Landlord $landlord): Listing
    {
        return Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Landlord::class, 'owner_id' => $landlord->id,
            'title' => '45 Test Street', 'slug' => 'test-' . Str::random(8), 'listing_type' => 'long_term_rent',
            'property_type' => 'house', 'status' => 'leased', 'suburb' => 'El Toro Park', 'city' => 'Kimberley',
        ]);
    }

    #[Test]
    public function landlord_uploads_views_and_removes_agreement(): void
    {
        $this->actingAs($this->landlordUser)
            ->post("/landlord/leases/{$this->lease->id}/agreement", [
                'agreement' => UploadedFile::fake()->create('signed.pdf', 300, 'application/pdf'),
            ])
            ->assertSessionHasNoErrors();

        $path = $this->lease->fresh()->document_path;
        $this->assertStringStartsWith("lease-agreements/{$this->lease->id}/", $path);
        Storage::disk('local')->assertExists($path);

        $this->actingAs($this->landlordUser)->get("/landlord/leases/{$this->lease->id}/agreement")->assertOk();

        $this->actingAs($this->landlordUser)->delete("/landlord/leases/{$this->lease->id}/agreement");
        $this->assertNull($this->lease->fresh()->document_path);
        Storage::disk('local')->assertMissing($path);
    }

    #[Test]
    public function only_pdf_or_image_files_are_accepted(): void
    {
        $this->actingAs($this->landlordUser)
            ->post("/landlord/leases/{$this->lease->id}/agreement", [
                'agreement' => UploadedFile::fake()->create('lease.docx', 50),
            ])
            ->assertSessionHasErrors('agreement');

        $this->assertNull($this->lease->fresh()->document_path);
    }

    #[Test]
    public function another_landlord_cannot_touch_the_agreement(): void
    {
        [$otherUser] = $this->landlord();

        $this->actingAs($otherUser)
            ->post("/landlord/leases/{$this->lease->id}/agreement", [
                'agreement' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf'),
            ])
            ->assertForbidden();
        $this->actingAs($otherUser)->get("/landlord/leases/{$this->lease->id}/agreement")->assertForbidden();
    }

    #[Test]
    public function tenant_agreement_link_serves_the_uploaded_copy(): void
    {
        Storage::disk('local')->put("lease-agreements/{$this->lease->id}/signed.pdf", '%PDF-1.4 uploaded copy');
        $this->lease->forceFill(['document_path' => "lease-agreements/{$this->lease->id}/signed.pdf"])->save();

        $response = $this->actingAs($this->tenant)->get('/tenant/lease/agreement.pdf');

        $response->assertOk();
        $this->assertSame('%PDF-1.4 uploaded copy', $response->streamedContent());
    }
}
