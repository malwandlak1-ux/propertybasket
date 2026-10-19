<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\ApiKey;
use App\Models\FacilityEntry;
use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\RentPayment;
use App\Models\User;
use App\Services\LeaseBillingService;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Landlord → Operations: running costs + other income, separate from rent/maintenance. */
class FacilityOperationsTest extends TestCase
{
    use RefreshDatabase;

    private const BASE = '/api/integration/v1';

    private User $owner;
    private Landlord $landlord;
    private Listing $house;
    private string $key;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        CarbonImmutable::setTestNow('2026-10-15 09:00');
        Carbon::setTestNow('2026-10-15 09:00');

        [$this->owner, $this->landlord, $this->house] = $this->landlordWithProperty('45 MacDougall Street', 'Careline Clinic');
        $tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active]);
        $lease = Lease::create([
            'listing_id' => $this->house->id, 'tenant_id' => $tenant->id, 'landlord_id' => $this->owner->id,
            'start_date' => '2026-08-01', 'end_date' => '2027-07-31', 'monthly_rent' => 3000, 'deposit_amount' => 3000, 'status' => 'active',
        ]);
        app(LeaseBillingService::class)->ensureCharges($lease);
        RentPayment::where('lease_id', $lease->id)->whereIn('period_month', ['2026-08', '2026-09'])->get()
            ->each(fn ($p) => $p->update(['status' => 'paid', 'paid_at' => CarbonImmutable::parse($p->due_date)->setTime(10, 0), 'payment_method' => 'manual']));

        [, $this->key] = ApiKey::issue($this->landlord, 'Accounting sync', $this->owner->id);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function landlordWithProperty(string $address, string $name): array
    {
        $user = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active, 'name' => $name]);
        $user->assignRole('landlord');
        $landlord = Landlord::create(['user_id' => $user->id]);
        $landlord->activateSubscription('promo', now()->addYear());
        $listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Landlord::class, 'owner_id' => $landlord->id,
            'title' => $address, 'address' => $address, 'slug' => 'test-' . Str::random(8),
            'listing_type' => 'long_term_rent', 'property_type' => 'house', 'status' => 'leased', 'monthly_rent' => 3000,
        ]);

        return [$user, $landlord, $listing];
    }

    private function add(array $data): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->owner)->post('/landlord/operations', $data + [
            'type' => 'expense', 'category' => 'rates', 'description' => 'Rates', 'amount' => 1000, 'entry_date' => '2026-10-01',
        ]);
    }

    private function seedLedger(): void
    {
        $this->add(['category' => 'rates', 'description' => 'City of Tshwane rates — Oct', 'amount' => 4200.50, 'entry_date' => '2026-10-01', 'counterparty' => 'City of Tshwane', 'reference' => 'ACC-778']);
        $this->add(['category' => 'electricity', 'description' => 'Electricity — Sep', 'amount' => 1800, 'entry_date' => '2026-09-28']);
        $this->add(['category' => 'gardening', 'description' => 'Garden service', 'amount' => 650, 'entry_date' => '2026-09-15', 'listing_id' => $this->house->id]);
        $this->add(['type' => 'income', 'category' => 'canteen', 'description' => 'Canteen sales — Sep', 'amount' => 9000, 'entry_date' => '2026-09-30']);
    }

    #[Test]
    public function a_landlord_captures_expenses_and_income_and_sees_the_net(): void
    {
        $this->seedLedger();
        $this->assertSame(4, FacilityEntry::count());

        $this->actingAs($this->owner)->get('/landlord/operations?range=3')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Landlord/Operations')
                ->where('summary.totals.operating_expenses', 6650.5)
                ->where('summary.totals.other_income', 9000)
                ->where('summary.totals.net', 2349.5)
                ->has('entries', 4)
                ->where('summary.expenses_by_category.0.category', 'rates'));

        // Type filter narrows the ledger, not the totals.
        $this->actingAs($this->owner)->get('/landlord/operations?range=3&type=income')
            ->assertInertia(fn (Assert $p) => $p->has('entries', 1)->where('summary.totals.operating_expenses', 6650.5));

        // Whole-facility filter leaves out the property-specific gardening bill.
        $this->actingAs($this->owner)->get('/landlord/operations?range=3&property=facility')
            ->assertInertia(fn (Assert $p) => $p->where('summary.totals.operating_expenses', 6000.5));
    }

    #[Test]
    public function rent_maintenance_and_owner_statements_are_unaffected(): void
    {
        $before = $this->withHeader('Authorization', "Bearer {$this->key}")->get(self::BASE . '/statements/owner?range=3')->json('data.totals');
        $this->seedLedger();
        $after = $this->withHeader('Authorization', "Bearer {$this->key}")->get(self::BASE . '/statements/owner?range=3')->json('data.totals');

        $this->assertEquals($before, $after);
        $this->assertEquals(6000, $after['rent_income']);
        $this->assertEquals(0, $after['maintenance']);

        $this->actingAs($this->owner)->get('/landlord/finance?range=3')
            ->assertInertia(fn (Assert $p) => $p->where('income_statement.rent_income', 6000)->where('income_statement.maintenance', 0));
    }

    #[Test]
    public function validation_attachments_and_privacy(): void
    {
        Storage::fake('local');

        // An income category can't be used on an expense.
        $this->add(['category' => 'canteen'])->assertSessionHasErrors('category');

        $this->add(['attachment' => UploadedFile::fake()->create('rates-oct.pdf', 120, 'application/pdf')])->assertSessionHas('success');
        $entry = FacilityEntry::firstOrFail();
        Storage::disk('local')->assertExists($entry->attachment_path);
        $this->actingAs($this->owner)->get("/landlord/operations/{$entry->id}/attachment")->assertOk();

        $this->actingAs($this->owner)->post("/landlord/operations/{$entry->id}", [
            'type' => 'expense', 'category' => 'water', 'description' => 'Water', 'amount' => 999, 'entry_date' => '2026-10-02',
        ])->assertSessionHas('success');
        $this->assertSame('water', $entry->fresh()->category);

        [$stranger] = $this->landlordWithProperty('1 Other Road', 'Someone Else');
        $this->actingAs($stranger)->get("/landlord/operations/{$entry->id}/attachment")->assertNotFound();
        $this->actingAs($stranger)->delete("/landlord/operations/{$entry->id}")->assertNotFound();
        $this->actingAs($stranger)->get('/landlord/operations')->assertInertia(fn (Assert $p) => $p->has('entries', 0));

        $this->actingAs($this->owner)->delete("/landlord/operations/{$entry->id}")->assertSessionHas('success');
        $this->assertSame(0, FacilityEntry::count());
    }

    #[Test]
    public function the_integration_api_reports_operations_separately(): void
    {
        $this->seedLedger();
        [$otherUser, $other] = $this->landlordWithProperty('9 Elsewhere', 'Other Landlord');
        FacilityEntry::create(['landlord_id' => $other->id, 'type' => 'expense', 'category' => 'rates', 'description' => 'Not ours', 'amount' => 99999, 'entry_date' => '2026-10-01']);

        $api = fn (string $path) => $this->withHeader('Authorization', "Bearer {$this->key}")->get(self::BASE . $path);

        $api('/operations?range=3')->assertOk()
            ->assertJsonPath('data.totals.operating_expenses', 6650.5)
            ->assertJsonPath('data.totals.other_income', 9000)
            ->assertJsonPath('data.totals.net', 2349.5)
            ->assertJsonPath('data.expenses_by_category.0.label', 'Rates & taxes')
            ->assertJsonCount(4, 'data.lines')
            ->assertJsonPath('data.lines.0.description', 'Garden service');

        $api('/operations?month=2026-09&type=expense')->assertOk()->assertJsonCount(2, 'data.lines');
        $api('/operations?range=3&property=facility')->assertJsonPath('data.totals.operating_expenses', 6000.5);
        $api("/operations?range=3&property={$this->house->id}")->assertJsonPath('data.totals.operating_expenses', 650);

        $api('/operations/monthly?range=3')->assertOk()
            ->assertJsonFragment(['month' => '2026-09', 'income' => 9000, 'expenses' => 2450, 'net' => 6550])
            ->assertJsonPath('meta.totals.net', 2349.5);

        $csv = $api('/operations.csv?range=3');
        $csv->assertOk();
        $this->assertStringContainsString('City of Tshwane rates', $csv->streamedContent());
        $this->assertStringNotContainsString('Not ours', $csv->streamedContent());

        $api('/operations?range=7')->assertStatus(422);
        $api('/operations?type=other')->assertStatus(422);
    }
}
