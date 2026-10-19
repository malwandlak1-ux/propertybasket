<?php

namespace App\Http\Controllers\Landlord;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
use App\Models\FacilityEntry;
use App\Models\Landlord;
use App\Services\FacilityLedgerService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Landlord → Operations: the facility's running costs and other income.
 * A separate ledger — it never changes rent, maintenance or the Finance
 * statements.
 */
class OperationsController extends Controller
{
    use ResolvesLandlord;

    public function __construct(private FacilityLedgerService $ledger) {}

    public function index(Request $request): Response
    {
        $landlord = $this->resolveLandlord($request);
        [$range, $property, $type] = $this->filters($request, $landlord);
        [$from, $to] = $this->ledger->period($landlord, $range);

        $all = $this->ledger->entries($landlord, $from, $to, $property);
        $shown = $type ? $all->where('type', $type)->values() : $all;

        return Inertia::render('Landlord/Operations', [
            'summary'    => $this->ledger->summary($all, $from, $to),
            'entries'    => $shown->sortByDesc(fn ($e) => $e->entry_date->format('Ymd') . str_pad((string) $e->id, 10, '0', STR_PAD_LEFT))
                ->values()->map(fn ($e) => $this->ledger->line($e)),
            'filters'    => [
                'range' => $range, 'range_label' => FacilityLedgerService::RANGES[$range],
                'property' => $property, 'type' => $type,
                'from' => $from->format('d M Y'), 'to' => $to->format('d M Y'),
            ],
            'ranges'     => collect(FacilityLedgerService::RANGES)->map(fn ($l, $k) => ['key' => (string) $k, 'label' => $l])->values(),
            'properties' => $this->ledger->properties($landlord),
            'categories' => ['expense' => FacilityLedgerService::EXPENSE_CATEGORIES, 'income' => FacilityLedgerService::INCOME_CATEGORIES],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        $data = $this->validated($request, $landlord);

        $entry = FacilityEntry::create($data + ['landlord_id' => $landlord->id, 'created_by' => $request->user()->id]);
        $this->storeAttachment($request, $entry);

        return back()->with('success', ($entry->type === 'income' ? 'Income' : 'Expense') . ' of R ' . number_format((float) $entry->amount, 2) . ' recorded.');
    }

    public function update(Request $request, FacilityEntry $entry): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        $this->own($landlord, $entry);

        $entry->update($this->validated($request, $landlord));
        if ($request->boolean('remove_attachment') && $entry->attachment_path) {
            Storage::disk('local')->delete($entry->attachment_path);
            $entry->update(['attachment_path' => null, 'attachment_name' => null]);
        }
        $this->storeAttachment($request, $entry);

        return back()->with('success', 'Entry updated.');
    }

    public function destroy(Request $request, FacilityEntry $entry): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        $this->own($landlord, $entry);

        if ($entry->attachment_path) {
            Storage::disk('local')->delete($entry->attachment_path);
        }
        $entry->delete();

        return back()->with('success', 'Entry deleted.');
    }

    public function attachment(Request $request, FacilityEntry $entry)
    {
        $landlord = $this->resolveLandlord($request);
        $this->own($landlord, $entry);
        abort_unless($entry->attachment_path && Storage::disk('local')->exists($entry->attachment_path), 404);

        return Storage::disk('local')->response($entry->attachment_path, $entry->attachment_name ?? basename($entry->attachment_path));
    }

    /** GET /landlord/operations/export.csv — the filtered ledger as a spreadsheet. */
    public function export(Request $request): StreamedResponse
    {
        $landlord = $this->resolveLandlord($request);
        [$range, $property, $type] = $this->filters($request, $landlord);
        [$from, $to] = $this->ledger->period($landlord, $range);
        $entries = $this->ledger->entries($landlord, $from, $to, $property, $type);

        return self::csv($entries, $this->ledger, "facility-operations-{$from->format('Y-m-d')}-to-{$to->format('Y-m-d')}.csv");
    }

    /** Shared with the integration API. */
    public static function csv($entries, FacilityLedgerService $ledger, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($entries, $ledger) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Date', 'Type', 'Category', 'Description', 'Property', 'Supplier / payer', 'Reference', 'Income', 'Expense', 'Notes']);
            $in = $ex = 0.0;
            foreach ($entries as $e) {
                $l = $ledger->line($e);
                $isIncome = $l['type'] === 'income';
                $isIncome ? $in += $l['amount'] : $ex += $l['amount'];
                fputcsv($out, [
                    $l['date'], $isIncome ? 'Income' : 'Expense', $l['category_label'], $l['description'], $l['property'],
                    $l['counterparty'], $l['reference'],
                    $isIncome ? number_format($l['amount'], 2, '.', '') : '',
                    $isIncome ? '' : number_format($l['amount'], 2, '.', ''),
                    $l['notes'],
                ]);
            }
            fputcsv($out, []);
            fputcsv($out, ['', '', '', 'Totals', '', '', '', number_format($in, 2, '.', ''), number_format($ex, 2, '.', '')]);
            fputcsv($out, ['', '', '', 'Net (income less expenses)', '', '', '', number_format($in - $ex, 2, '.', '')]);
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    /** @return array{0: string, 1: int|string|null, 2: ?string} range, property, type */
    private function filters(Request $request, Landlord $landlord): array
    {
        $range = FacilityLedgerService::normaliseRange($request->query('range')) ?? '12';

        $property = $request->query('property');
        if ($property === 'facility') {
            // whole-facility entries only
        } elseif ($property !== null && $property !== '') {
            $property = (int) $property;
            abort_unless($this->ledger->properties($landlord)->contains('id', $property), 404);
        } else {
            $property = null;
        }

        $type = in_array($request->query('type'), ['income', 'expense'], true) ? $request->query('type') : null;

        return [$range, $property, $type];
    }

    private function validated(Request $request, Landlord $landlord): array
    {
        $type = $request->input('type');
        $data = $request->validate([
            'type'         => ['required', Rule::in(['income', 'expense'])],
            'category'     => ['required', Rule::in(array_keys(FacilityLedgerService::categories((string) $type)))],
            'description'  => ['required', 'string', 'max:255'],
            'amount'       => ['required', 'numeric', 'min:0.01', 'max:999999999'],
            'entry_date'   => ['required', 'date', 'before_or_equal:' . now()->addYear()->toDateString()],
            'listing_id'   => ['nullable', 'integer', Rule::in($this->ledger->properties($landlord)->pluck('id')->all())],
            'counterparty' => ['nullable', 'string', 'max:160'],
            'reference'    => ['nullable', 'string', 'max:80'],
            'notes'        => ['nullable', 'string', 'max:2000'],
            'attachment'   => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
        ], [
            'category.in' => 'Choose a category for this ' . ($type === 'income' ? 'income' : 'expense') . '.',
        ]);
        unset($data['attachment']);
        $data['listing_id'] = $data['listing_id'] ?? null;

        return $data;
    }

    private function storeAttachment(Request $request, FacilityEntry $entry): void
    {
        if (! $request->hasFile('attachment')) {
            return;
        }
        if ($entry->attachment_path) {
            Storage::disk('local')->delete($entry->attachment_path);
        }
        $file = $request->file('attachment');
        $entry->update([
            'attachment_path' => $file->store("facility-entries/{$entry->landlord_id}", 'local'),
            'attachment_name' => mb_substr($file->getClientOriginalName(), 0, 255),
        ]);
    }

    private function own(Landlord $landlord, FacilityEntry $entry): void
    {
        abort_unless($entry->landlord_id === $landlord->id, 404);
    }
}
