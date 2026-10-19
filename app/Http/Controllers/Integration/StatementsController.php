<?php

namespace App\Http\Controllers\Integration;

use App\Http\Controllers\Controller;
use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Services\FacilityLedgerService;
use App\Services\LandlordStatementService;
use App\Services\PdfService;
use App\Services\TenantStatementService;
use App\Support\StatementRange;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Integration API v1 (read-only): a landlord's properties, leases and
 * financial statements, for another system (accounting, BI, ERP) to pull.
 * Same figures as the Finance page and statement PDFs (cash basis).
 * Authenticated by App\Http\Middleware\AuthenticateApiKey.
 */
class StatementsController extends Controller
{
    public function __construct(
        private readonly LandlordStatementService $owner,
        private readonly TenantStatementService $tenant,
    ) {}

    /** GET /properties */
    public function properties(Request $request): JsonResponse
    {
        $landlord = $this->landlord($request);

        $data = Listing::where('owner_type', Landlord::class)->where('owner_id', $landlord->id)
            ->orderBy('id')
            ->get()
            ->map(fn (Listing $l) => [
                'id'           => $l->id,
                'name'         => $l->address ?: $l->title,
                'title'        => $l->title,
                'address'      => $l->address,
                'suburb'       => $l->suburb,
                'city'         => $l->city,
                'listing_type' => $l->listing_type,
                'status'       => $l->status,
                'monthly_rent' => $l->monthly_rent !== null ? (float) $l->monthly_rent : null,
            ]);

        return response()->json(['data' => $data]);
    }

    /** GET /leases?status=active|all */
    public function leases(Request $request): JsonResponse
    {
        $landlord = $this->landlord($request);
        $status = $request->query('status', 'active');

        $data = Lease::whereIn('listing_id', $this->owner->listingIds($landlord))
            ->when($status !== 'all', fn ($q) => $q->whereIn('status', ['active', 'pending']))
            ->with(['tenant:id,name,email', 'listing:id,title,address'])
            ->orderBy('id')
            ->get()
            ->map(fn (Lease $l) => [
                'id'                => $l->id,
                'property_id'       => $l->listing_id,
                'property'          => $l->listing?->address ?: $l->listing?->title,
                'tenant'            => ['name' => $l->tenant?->name, 'email' => $l->tenant?->email],
                'status'            => $l->status,
                'start_date'        => $l->start_date?->toDateString(),
                'end_date'          => $l->end_date?->toDateString(),
                'monthly_rent'      => (float) $l->monthly_rent,
                'deposit'           => (float) $l->deposit_amount,
                'payment_reference' => app(\App\Services\RentPayee::class)->reference($l),
            ]);

        return response()->json(['data' => $data]);
    }

    /** GET /statements/owner — rent received less maintenance paid. */
    public function owner(Request $request): JsonResponse
    {
        $landlord = $this->landlord($request);
        $listingId = $this->propertyFilter($request, $landlord);
        [$from, $to, $label] = $this->ownerPeriod($request, $landlord, $listingId);

        $s = $this->owner->build($landlord, $from, $to, $listingId);

        return response()->json([
            'data' => [
                'landlord'    => $landlord->user?->name,
                'property_id' => $listingId,
                'property'    => $this->owner->propertyName($this->owner->ownedListing($landlord, $listingId)),
                'period'      => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'label' => $label],
                'currency'    => 'ZAR',
                'basis'       => 'cash',
                'totals'      => [
                    'rent_income' => $s['income'],
                    'maintenance' => $s['maintenance'],
                    'net'         => $s['net'],
                ],
                'by_property' => $s['by_property'],
                'lines'       => array_map(fn ($l) => [
                    'date'        => $l['date']->toDateString(),
                    'type'        => $l['type'],
                    'description' => $l['description'],
                    'property'    => $l['property'],
                    'reference'   => $l['reference'],
                    'income'      => round((float) $l['income'], 2),
                    'expense'     => round((float) $l['expense'], 2),
                    'running_net' => $l['net'],
                ], $s['lines']),
            ],
        ]);
    }

    /** GET /statements/owner/monthly — one row per month. */
    public function ownerMonthly(Request $request): JsonResponse
    {
        $landlord = $this->landlord($request);
        $listingId = $this->propertyFilter($request, $landlord);
        $range = $this->range($request, 'lease');
        [$from] = $this->owner->period($landlord, $range, $listingId);

        $months = array_map(fn ($m) => [
            'month'       => $m['period'],
            'label'       => $m['label'],
            'rent_income' => $m['income'],
            'maintenance' => $m['maintenance'],
            'net'         => $m['net'],
        ], $this->owner->availableMonths($landlord, $listingId, $from));

        return response()->json(['data' => $months, 'meta' => ['currency' => 'ZAR', 'property_id' => $listingId, 'range' => $range]]);
    }

    /** GET /statements/owner.pdf — the owner statement PDF (range or month). */
    public function ownerPdf(Request $request, PdfService $pdf)
    {
        $landlord = $this->landlord($request);
        $listingId = $this->propertyFilter($request, $landlord);
        $month = $this->month($request);

        return $pdf->landlordStatement($landlord, $month, download: true, listingId: $listingId, range: $month ? null : $this->range($request, 'lease'));
    }

    /** GET /leases/{lease}/statement — a tenant's rent account statement. */
    public function tenant(Request $request, Lease $lease): JsonResponse
    {
        $landlord = $this->landlord($request);
        $this->ownLease($landlord, $lease);

        if ($month = $this->month($request)) {
            $s = $this->tenant->month($lease, $month);
            $label = CarbonImmutable::parse($month . '-01')->format('F Y');
        } elseif ($request->filled('from') || $request->filled('to')) {
            [$from, $to] = $this->customDates($request);
            $s = $this->tenant->build($lease, $from, $to);
            $label = 'Custom';
        } else {
            $range = $this->range($request, 'lease');
            $s = $this->tenant->range($lease, $range);
            $label = StatementRange::LABELS[$range];
        }

        $lease->loadMissing(['tenant:id,name,email', 'listing:id,title,address']);

        return response()->json([
            'data' => [
                'lease_id' => $lease->id,
                'tenant'   => ['name' => $lease->tenant?->name, 'email' => $lease->tenant?->email],
                'property' => $lease->listing?->address ?: $lease->listing?->title,
                'period'   => ['from' => $s['from']->toDateString(), 'to' => $s['to']->toDateString(), 'label' => $label],
                'currency' => 'ZAR',
                'totals'   => [
                    'opening_balance' => $s['opening'],
                    'charged'         => $s['charged'],
                    'paid'            => $s['paid'],
                    'closing_balance' => $s['closing'],
                ],
                'lines'    => array_map(fn ($l) => [
                    'date'        => $l['date']->toDateString(),
                    'description' => $l['description'],
                    'reference'   => $l['reference'],
                    'charge'      => round((float) $l['charge'], 2),
                    'payment'     => round((float) $l['payment'], 2),
                    'balance'     => $l['balance'],
                ], $s['lines']),
            ],
            'meta' => ['balance_sign' => 'positive = tenant owes, negative = in credit'],
        ]);
    }

    /** GET /leases/{lease}/statement.pdf */
    public function tenantPdf(Request $request, Lease $lease, PdfService $pdf)
    {
        $landlord = $this->landlord($request);
        $this->ownLease($landlord, $lease);
        $month = $this->month($request);

        return $pdf->tenantStatement($lease, $month, download: true, range: $month ? null : $this->range($request, 'lease'));
    }

    // ── Facility operations (separate from rent + maintenance) ─────────

    /** GET /operations — operating expenses and other income, with totals and lines. */
    public function operations(Request $request, FacilityLedgerService $ledger): JsonResponse
    {
        $landlord = $this->landlord($request);
        [$from, $to, $label] = $this->opsPeriod($request, $landlord, $ledger);
        $property = $this->opsProperty($request, $landlord);
        $type = $this->opsType($request);

        $all = $ledger->entries($landlord, $from, $to, $property);
        $summary = $ledger->summary($all, $from, $to);
        $lines = ($type ? $all->where('type', $type) : $all)->values();

        return response()->json([
            'data' => [
                'landlord'             => $landlord->user?->name,
                'property'             => $property,
                'period'               => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'label' => $label],
                'currency'             => 'ZAR',
                'note'                 => 'Facility operations only. Rent and maintenance are reported separately under /statements/owner.',
                'totals'               => $summary['totals'],
                'expenses_by_category' => $summary['expenses_by_category'],
                'income_by_category'   => $summary['income_by_category'],
                'lines'                => $lines->map(fn ($e) => collect($ledger->line($e))->except(['has_attachment', 'attachment_name'])->all()),
            ],
        ]);
    }

    /** GET /operations/monthly — one row per month: other income, expenses, net. */
    public function operationsMonthly(Request $request, FacilityLedgerService $ledger): JsonResponse
    {
        $landlord = $this->landlord($request);
        [$from, $to] = $this->opsPeriod($request, $landlord, $ledger, 'all');
        $property = $this->opsProperty($request, $landlord);
        $summary = $ledger->summary($ledger->entries($landlord, $from, $to, $property), $from, $to);

        return response()->json(['data' => $summary['months'], 'meta' => ['currency' => 'ZAR', 'property' => $property, 'totals' => $summary['totals']]]);
    }

    /** GET /operations.csv — the same lines as a spreadsheet. */
    public function operationsCsv(Request $request, FacilityLedgerService $ledger)
    {
        $landlord = $this->landlord($request);
        [$from, $to] = $this->opsPeriod($request, $landlord, $ledger);
        $entries = $ledger->entries($landlord, $from, $to, $this->opsProperty($request, $landlord), $this->opsType($request));

        return \App\Http\Controllers\Landlord\OperationsController::csv($entries, $ledger, "facility-operations-{$from->format('Y-m-d')}-to-{$to->format('Y-m-d')}.csv");
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable, 2: string} */
    private function opsPeriod(Request $request, Landlord $landlord, FacilityLedgerService $ledger, string $default = '12'): array
    {
        if ($month = $this->month($request)) {
            $start = CarbonImmutable::parse($month . '-01')->startOfDay();

            return [$start, $start->endOfMonth(), $start->format('F Y')];
        }
        if ($request->filled('from') || $request->filled('to')) {
            [$from, $to] = $this->customDates($request);

            return [$from, $to, 'Custom'];
        }
        $range = FacilityLedgerService::normaliseRange((string) $request->query('range', $default));
        if ($range === null) {
            throw ValidationException::withMessages(['range' => 'range must be one of: 1, 3, 6, 12, all.']);
        }
        [$from, $to] = $ledger->period($landlord, $range);

        return [$from, $to, FacilityLedgerService::RANGES[$range]];
    }

    /** property=<id> one property, property=facility whole-facility entries only, omitted = everything. */
    private function opsProperty(Request $request, Landlord $landlord): int|string|null
    {
        if (! $request->filled('property')) {
            return null;
        }
        if ($request->query('property') === 'facility') {
            return 'facility';
        }

        return $this->propertyFilter($request, $landlord);
    }

    private function opsType(Request $request): ?string
    {
        $type = $request->query('type');
        if ($type === null) {
            return null;
        }
        if (! in_array($type, ['income', 'expense'], true)) {
            throw ValidationException::withMessages(['type' => 'type must be income or expense.']);
        }

        return $type;
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private function landlord(Request $request): Landlord
    {
        return $request->attributes->get('landlord');
    }

    private function propertyFilter(Request $request, Landlord $landlord): ?int
    {
        if (! $request->filled('property')) {
            return null;
        }
        $listing = $this->owner->ownedListing($landlord, (int) $request->query('property'));
        abort_if($listing === null, 404, 'Property not found.');

        return $listing->id;
    }

    private function ownLease(Landlord $landlord, Lease $lease): void
    {
        abort_unless($this->owner->listingIds($landlord)->contains($lease->listing_id), 404, 'Lease not found.');
    }

    private function range(Request $request, string $default): string
    {
        $range = (string) $request->query('range', $default);
        if (! StatementRange::valid($range)) {
            throw ValidationException::withMessages(['range' => 'range must be one of: ' . implode(', ', StatementRange::KEYS) . '.']);
        }

        return $range;
    }

    private function month(Request $request): ?string
    {
        $month = $request->query('month');
        if ($month === null) {
            return null;
        }
        if (! is_string($month) || ! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
            throw ValidationException::withMessages(['month' => 'month must look like 2026-09.']);
        }

        return $month;
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable} */
    private function customDates(Request $request): array
    {
        $request->validate([
            'from' => ['required_with:to', 'date_format:Y-m-d'],
            'to'   => ['required_with:from', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        return [
            CarbonImmutable::parse($request->query('from'))->startOfDay(),
            CarbonImmutable::parse($request->query('to'))->endOfDay(),
        ];
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable, 2: string} */
    private function ownerPeriod(Request $request, Landlord $landlord, ?int $listingId): array
    {
        if ($month = $this->month($request)) {
            $start = CarbonImmutable::parse($month . '-01')->startOfDay();

            return [$start, $start->endOfMonth(), $start->format('F Y')];
        }
        if ($request->filled('from') || $request->filled('to')) {
            [$from, $to] = $this->customDates($request);

            return [$from, $to, 'Custom'];
        }
        $range = $this->range($request, '12');
        [$from, $to] = $this->owner->period($landlord, $range, $listingId);

        return [$from, $to, StatementRange::LABELS[$range]];
    }
}
