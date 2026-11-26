<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\Listing;
use App\Services\ListingImport\ListingImporter;
use App\Services\ListingImport\ListingPhotoStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Agency → Listings → Import: bring listings over from another CRM's export
 * (Entegral, Prop Data, any spreadsheet). The browser reads the file and the
 * photos ZIP; rows arrive here in batches, photos one per request (keeps every
 * request under the host's upload limits). Imports land as drafts to review.
 */
class ListingImportController extends Controller
{
    use ResolvesAgency;

    public function index(Request $request): Response
    {
        $agency = $this->resolveAgency($request);
        $agents = $agency->agents()->wherePivot('status', 'active')->orderBy('name')->get(['users.id', 'users.name', 'users.email']);

        $drafts = Listing::forAgency($agency)->where('status', 'draft')->whereNotNull('imported_at')
            ->with('agent:id,name')->latest('imported_at')->limit(500)->get()
            ->map(fn (Listing $l) => [
                'id'             => $l->id,
                'title'          => $l->title,
                'ref'            => $l->external_ref,
                'type'           => $l->listing_type,
                'price'          => (float) ($l->listing_type === 'for_sale' ? $l->sale_price : $l->monthly_rent),
                'place'          => trim(implode(', ', array_filter([$l->suburb, $l->city])), ', '),
                'agent'          => $l->agent?->name,
                'photos'         => ($l->primary_image ? 1 : 0) + count($l->gallery_images ?? []),
                'photos_pending' => count($l->pending_photo_urls ?? []),
                'image'          => $l->primary_image,
            ])->values();

        return Inertia::render('Agency/ListingImport', [
            'agents'    => $agents->map(fn ($a) => ['id' => $a->id, 'name' => $a->name, 'email' => $a->email])->values(),
            'drafts'    => $drafts,
            'fields'    => ListingImporter::FIELDS,
            'provinces' => ListingImporter::PROVINCES,
            'max_photos' => ListingPhotoStore::MAX_PHOTOS,
        ]);
    }

    /** POST /agency/listings/import — one batch of mapped rows (JSON in, JSON out). */
    public function store(Request $request, ListingImporter $importer): JsonResponse
    {
        $agency = $this->resolveAgency($request);
        $data = $request->validate([
            'rows'                 => ['required', 'array', 'min:1', 'max:200'],
            'rows.*'               => ['array'],
            'rows.*._row'          => ['nullable', 'integer'],
            'rows.*.description'   => ['nullable', 'string', 'max:20000'],
            'rows.*.photo_urls'    => ['nullable', 'string', 'max:60000'],
            'rows.*.features'      => ['nullable', 'string', 'max:5000'],
            'default_listing_type' => ['required', Rule::in(['for_sale', 'long_term_rent'])],
            'default_agent_id'     => ['nullable', 'integer'],
            'publish'              => ['boolean'],
            'source'               => ['nullable', 'string', 'max:60'],
        ]);

        // Only the known fields, as short strings: the importer cleans each one up.
        $rows = array_map(function (array $r) {
            $clean = ['_row' => $r['_row'] ?? null];
            foreach (ListingImporter::FIELDS as $f) {
                $v = $r[$f] ?? null;
                $clean[$f] = is_scalar($v) ? mb_substr((string) $v, 0, $f === 'description' ? 20000 : ($f === 'photo_urls' ? 60000 : 2000)) : null;
            }

            return $clean;
        }, array_values(array_filter((array) $request->input('rows'), 'is_array')));

        return response()->json([
            'results' => $importer->import($agency, $rows, [
                'default_listing_type' => $data['default_listing_type'],
                'default_agent_id'     => $data['default_agent_id'] ?? null,
                'publish'              => (bool) ($data['publish'] ?? false),
                'source'               => $data['source'] ?? 'spreadsheet',
            ]),
        ]);
    }

    /** POST /agency/listings/import/{listing}/photo — one photo from the ZIP. */
    public function photo(Request $request, Listing $listing, ListingPhotoStore $photos): JsonResponse
    {
        $this->ownImported($request, $listing);
        $request->validate(['photo' => ['required', 'image', 'max:5120']]);

        $added = $photos->addUpload($listing, $request->file('photo'));

        return response()->json(['ok' => $added, 'photos' => $photos->count($listing->fresh())], $added ? 200 : 422);
    }

    /** POST /agency/listings/import/publish — make reviewed drafts live. */
    public function publish(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        $ids = $request->validate(['ids' => ['required', 'array', 'min:1', 'max:500'], 'ids.*' => ['integer']])['ids'];

        $drafts = Listing::forAgency($agency)->where('status', 'draft')->whereIn('id', $ids)->get();
        $ready = $drafts->filter(fn (Listing $l) => $l->title && ($l->listing_type === 'for_sale' ? $l->sale_price > 0 : $l->monthly_rent > 0));
        Listing::whereIn('id', $ready->pluck('id'))->update(['status' => 'available']);

        $skipped = $drafts->count() - $ready->count();

        return back()->with('success', $ready->count() . ' listing' . ($ready->count() === 1 ? '' : 's') . ' published'
            . ($skipped ? " ({$skipped} skipped: missing a title or price)." : '.'));
    }

    /** POST /agency/listings/import/discard — delete imported drafts (e.g. a wrong file). */
    public function discard(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        $ids = $request->validate(['ids' => ['required', 'array', 'min:1', 'max:500'], 'ids.*' => ['integer']])['ids'];

        $n = 0;
        Listing::forAgency($agency)->where('status', 'draft')->whereNotNull('imported_at')->whereIn('id', $ids)
            ->get()->each(function (Listing $l) use (&$n) {
                $l->forceFill(['pending_photo_urls' => null])->save();
                $l->delete();
                $n++;
            });

        return back()->with('success', "{$n} imported draft" . ($n === 1 ? '' : 's') . ' deleted.');
    }

    private function ownImported(Request $request, Listing $listing): void
    {
        $agency = $this->resolveAgency($request);
        abort_unless($listing->owner_type === \App\Models\Agency::class && (int) $listing->owner_id === $agency->id && $listing->imported_at, 404);
    }
}
