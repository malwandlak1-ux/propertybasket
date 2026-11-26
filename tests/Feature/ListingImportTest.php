<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Listing;
use App\Models\User;
use App\Services\ListingImport\ListingImporter;
use App\Services\ListingImport\ListingPhotoStore;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Agency → Listings → Import: listings from another CRM's export. */
class ListingImportTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $agent;

    private Agency $agency;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Storage::fake('public');
        [$this->owner, $this->agency] = $this->makeAgency('Sandton Realty');
        $this->agent = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active, 'email' => 'sipho@sandton.test']);
        $this->agent->assignRole(Role::Agent->value);
        AgencyAgent::create(['agency_id' => $this->agency->id, 'user_id' => $this->agent->id, 'commission_split_percent' => 50,
            'lead_allocation_position' => 0, 'ffc_number' => 'A1', 'ffc_expires_at' => CarbonImmutable::now()->addYear(), 'status' => 'active']);
    }

    protected function tearDown(): void
    {
        ListingPhotoStore::$resolver = null;
        parent::tearDown();
    }

    private function makeAgency(string $name): array
    {
        $owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $owner->assignRole(Role::AgencyAdmin->value);
        $agency = Agency::create(['user_id' => $owner->id, 'name' => $name, 'slug' => str($name)->slug() . '-' . $owner->id,
            'email' => $owner->email, 'status' => 'active', 'eaab_ffc_number' => 'F1', 'eaab_ffc_expires_at' => now()->addYear(),
            'subscription_plan' => 'growth', 'subscription_expires_at' => now()->addYear()]);

        return [$owner, $agency];
    }

    private function import(array $rows, array $opts = [], ?User $as = null)
    {
        return $this->actingAs($as ?? $this->owner)->postJson('/agency/listings/import', $opts + [
            'rows' => $rows, 'default_listing_type' => 'for_sale', 'publish' => false, 'source' => 'entegral',
        ]);
    }

    #[Test]
    public function messy_crm_values_are_cleaned_up(): void
    {
        $this->assertSame(1250000.0, ListingImporter::money('R 1 250 000'));
        $this->assertSame(1250000.5, ListingImporter::money('R1,250,000.50'));
        $this->assertSame(8500.0, ListingImporter::money('R 8 500 pm'));
        $this->assertNull(ListingImporter::money('POA'));
        $this->assertSame('long_term_rent', ListingImporter::listingType('To Let'));
        $this->assertSame('long_term_rent', ListingImporter::listingType('Rental'));
        $this->assertSame('for_sale', ListingImporter::listingType('For Sale'));
        $this->assertSame('apartment', ListingImporter::propertyType('Sectional Title Unit'));
        $this->assertSame('townhouse', ListingImporter::propertyType('Cluster'));
        $this->assertSame('house', ListingImporter::propertyType('Freehold'));
        $this->assertSame('land', ListingImporter::propertyType('Vacant Land / Plot'));
        $this->assertSame('commercial', ListingImporter::propertyType('Office'));
        $this->assertSame('sold', ListingImporter::status('Sold'));
        $this->assertSame('leased', ListingImporter::status('Rented'));
        $this->assertSame('archived', ListingImporter::status('Withdrawn'));
        $this->assertSame('available', ListingImporter::status('Active'));
        $this->assertSame('KwaZulu-Natal', ListingImporter::province('KZN'));
        $this->assertSame('Western Cape', ListingImporter::province('western cape'));
        $this->assertSame(['Pool', 'Garden', 'Borehole'], ListingImporter::features('Pool, Garden; Borehole | yes'));
        $this->assertSame('3 bedroom house for sale in Bryanston', ListingImporter::autoTitle(3, 'house', 'Bryanston', 'for_sale'));
    }

    #[Test]
    public function rows_import_as_drafts_and_a_second_import_updates_instead_of_duplicating(): void
    {
        $rows = [
            ['_row' => 2, 'external_ref' => 'ENT-101', 'listing_type' => 'For Sale', 'property_type' => 'Freehold', 'price' => 'R 2 450 000',
                'suburb' => 'Bryanston', 'city' => 'Sandton', 'province' => 'GP', 'bedrooms' => '4', 'bathrooms' => '2.5', 'area_sqm' => '320 m²',
                'agent_email' => 'SIPHO@sandton.test', 'features' => 'Pool, Garden', 'description' => 'Family home'],
            ['_row' => 3, 'external_ref' => 'ENT-102', 'listing_type' => 'To Let', 'property_type' => 'Apartment', 'price' => '9 800',
                'title' => 'Rosebank flat', 'status' => 'Rented'],
            ['_row' => 4, 'external_ref' => 'ENT-103', 'price' => 'POA', 'title' => 'No price'],
        ];
        $res = $this->import($rows, ['default_agent_id' => null])->assertOk()->json('results');

        $this->assertSame(['created', 'created', 'skipped'], array_column($res, 'action'));
        $this->assertSame([2, 3, 4], array_column($res, 'row'));
        $house = Listing::where('external_ref', 'ENT-101')->firstOrFail();
        $this->assertSame('draft', $house->status);
        $this->assertSame('4 bedroom house for sale in Bryanston', $house->title);
        $this->assertSame('house', $house->property_type);
        $this->assertEquals(2450000, (float) $house->sale_price);
        $this->assertSame('Gauteng', $house->province);
        $this->assertEquals(320, (float) $house->area_sqm);
        $this->assertSame($this->agent->id, $house->agent_id); // matched by email, any case
        $this->assertSame(['Pool', 'Garden'], $house->amenities);
        $this->assertSame('entegral', $house->import_source);
        $flat = Listing::where('external_ref', 'ENT-102')->firstOrFail();
        $this->assertSame('leased', $flat->status); // CRM says rented → never shown publicly
        $this->assertEquals(9800, (float) $flat->monthly_rent);
        $this->assertNull($flat->sale_price);

        // Same file again with a new price: updated in place.
        $rows[0]['price'] = 'R 2 300 000';
        $res = $this->import([$rows[0]])->assertOk()->json('results');
        $this->assertSame('updated', $res[0]['action']);
        $this->assertSame(2, Listing::forAgency($this->agency)->count());
        $this->assertEquals(2300000, (float) $house->fresh()->sale_price);

        // The CRM now says sold: follow it.
        $rows[0]['status'] = 'Sold';
        $this->import([$rows[0]])->assertOk();
        $this->assertSame('sold', $house->fresh()->status);
    }

    #[Test]
    public function publish_straight_away_and_the_default_agent(): void
    {
        $this->import([['external_ref' => 'X1', 'price' => '1500000', 'title' => 'Ready house']], ['publish' => true, 'default_agent_id' => $this->agent->id])->assertOk();
        $l = Listing::where('external_ref', 'X1')->firstOrFail();
        $this->assertSame('available', $l->status);
        $this->assertSame($this->agent->id, $l->agent_id);

        // An agent from another agency can't be the default.
        [, $other] = $this->makeAgency('Other');
        $stranger = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        AgencyAgent::create(['agency_id' => $other->id, 'user_id' => $stranger->id, 'commission_split_percent' => 50,
            'lead_allocation_position' => 0, 'ffc_number' => 'B1', 'ffc_expires_at' => CarbonImmutable::now()->addYear(), 'status' => 'active']);
        $this->import([['external_ref' => 'X2', 'price' => '900000', 'title' => 'Another']], ['default_agent_id' => $stranger->id])->assertOk();
        $this->assertNull(Listing::where('external_ref', 'X2')->value('agent_id'));
    }

    #[Test]
    public function photos_from_the_zip_upload_one_by_one_and_only_to_your_own_imports(): void
    {
        $id = $this->import([['external_ref' => 'P1', 'price' => '1000000', 'title' => 'With photos']])->json('results.0.id');

        $this->actingAs($this->owner)->post("/agency/listings/import/{$id}/photo", ['photo' => UploadedFile::fake()->image('1.jpg', 800, 600)])
            ->assertOk()->assertJson(['ok' => true, 'photos' => 1]);
        $this->actingAs($this->owner)->post("/agency/listings/import/{$id}/photo", ['photo' => UploadedFile::fake()->image('2.jpg', 800, 600)])
            ->assertOk()->assertJson(['photos' => 2]);
        $l = Listing::findOrFail($id);
        $this->assertNotNull($l->primary_image);
        $this->assertCount(1, $l->gallery_images);

        // Re-import: it already has photos, so the browser is told not to upload them again.
        $this->assertFalse($this->import([['external_ref' => 'P1', 'price' => '1000000', 'title' => 'With photos']])->json('results.0.needs_photos'));

        [$otherOwner] = $this->makeAgency('Other');
        $this->actingAs($otherOwner)->post("/agency/listings/import/{$id}/photo", ['photo' => UploadedFile::fake()->image('x.jpg')])->assertNotFound();
    }

    #[Test]
    public function photo_links_are_downloaded_in_the_background_but_never_from_internal_addresses(): void
    {
        ListingPhotoStore::$resolver = fn (string $host) => $host === 'cdn.example.com' ? ['93.184.216.34'] : ['10.0.0.5'];
        $jpeg = UploadedFile::fake()->image('a.jpg', 40, 30)->getContent();
        Http::fake([
            'cdn.example.com/1.jpg' => Http::response($jpeg, 200, ['Content-Type' => 'image/jpeg']),
            'cdn.example.com/doc.html' => Http::response('<html>', 200, ['Content-Type' => 'text/html']),
            'cdn.example.com/hop' => Http::response('', 302, ['Location' => 'http://169.254.169.254/latest/meta-data']),
            '*' => Http::response($jpeg, 200, ['Content-Type' => 'image/jpeg']),
        ]);

        $id = $this->import([['external_ref' => 'U1', 'price' => '750000', 'title' => 'Linked photos',
            'photo_urls' => 'https://cdn.example.com/1.jpg; https://cdn.example.com/doc.html https://internal.local/x.jpg, https://cdn.example.com/hop, ftp://x/y.jpg']])
            ->json('results.0.id');
        $this->assertCount(4, Listing::findOrFail($id)->pending_photo_urls); // ftp dropped up front

        $this->artisan('listings:fetch-photos')->assertSuccessful();

        $l = Listing::findOrFail($id);
        $this->assertNotNull($l->primary_image);
        $this->assertEmpty($l->gallery_images ?? []); // html, private host and the redirect to metadata were all refused
        $this->assertNull($l->pending_photo_urls);
        Http::assertNotSent(fn ($r) => str_contains($r->url(), 'internal.local') || str_contains($r->url(), '169.254.169.254'));
    }

    #[Test]
    public function reviewed_drafts_are_published_or_discarded_from_the_import_page(): void
    {
        $ids = array_column($this->import([
            ['external_ref' => 'D1', 'price' => '1200000', 'title' => 'Draft one'],
            ['external_ref' => 'D2', 'price' => '1300000', 'title' => 'Draft two'],
        ])->json('results'), 'id');

        $this->actingAs($this->owner)->get('/agency/listings/import')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Agency/ListingImport')->has('drafts', 2)->where('agents.0.email', 'sipho@sandton.test'));

        $this->actingAs($this->owner)->post('/agency/listings/import/publish', ['ids' => [$ids[0]]])->assertSessionHas('success');
        $this->assertSame('available', Listing::find($ids[0])->status);
        $this->actingAs($this->owner)->post('/agency/listings/import/discard', ['ids' => [$ids[1]]])->assertSessionHas('success');
        $this->assertSoftDeleted('listings', ['id' => $ids[1]]);

        // Another agency can't publish or delete them.
        [$otherOwner] = $this->makeAgency('Other');
        $id = $this->import([['external_ref' => 'D3', 'price' => '1', 'title' => 'Mine']])->json('results.0.id');
        $this->actingAs($otherOwner)->post('/agency/listings/import/publish', ['ids' => [$id]]);
        $this->actingAs($otherOwner)->post('/agency/listings/import/discard', ['ids' => [$id]]);
        $this->assertSame('draft', Listing::find($id)->status);
    }
}
