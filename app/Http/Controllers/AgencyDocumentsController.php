<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\AgencyDocument;
use App\Models\Lease;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Documentation: the agency's standard lease agreement and listing packs.
 * Agency admins upload/replace (versioned); agents read and share; tenants
 * only ever get the lease agreement (via their lease).
 */
class AgencyDocumentsController extends Controller
{
    use ResolvesAgency;

    public function index(Request $request): Response
    {
        $agency = $this->agency($request);
        $manage = $request->routeIs('agency.*');
        $base = $manage ? '/agency/documents' : '/agent/documents';

        $docs = AgencyDocument::where('agency_id', $agency->id)->with('uploader:id,name')->orderByDesc('version')->get()->groupBy('category');
        $categories = [];
        foreach (AgencyDocument::CATEGORIES as $key => $meta) {
            $versions = $docs->get($key, collect());
            $current = $versions->firstWhere('is_current', true);
            $categories[] = [
                'key' => $key,
                'label' => $meta['label'],
                'hint' => $meta['hint'],
                'accept' => '.' . str_replace(',', ',.', $meta['mimes']),
                'shareable' => $meta['shareable'],
                'share_url' => $meta['shareable'] && $current ? url('/docs/' . $this->shareToken($agency) . '/' . $key) : null,
                'current' => $current ? $this->row($current, $base) : null,
                'history' => $manage ? $versions->where('is_current', false)->map(fn ($d) => $this->row($d, $base))->values() : [],
            ];
        }

        $signing = null;
        if ($manage) {
            $leases = Lease::where('agency_id', $agency->id)->whereIn('status', ['pending', 'active'])
                ->with(['tenant:id,name', 'listing:id,title', 'agencyDocument:id,version'])->orderByDesc('start_date')->limit(200)->get();
            $signing = $leases->map(fn (Lease $l) => [
                'lease_id' => $l->id,
                'tenant' => $l->tenant?->name ?? '—',
                'property' => $l->listing?->title ?? '—',
                'signed_at' => $l->tenant_signed_at?->timezone('Africa/Johannesburg')->format('d M Y, H:i'),
                'version' => $l->agencyDocument?->version,
                'own_upload' => $l->document_path && ! $l->agency_document_id,
            ])->values();
        }

        return Inertia::render('Documents/Index', [
            'role' => $manage ? 'agency' : 'agent',
            'agencyName' => $agency->name,
            'base' => $base,
            'categories' => $categories,
            'signing' => $signing,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $agency = $this->agency($request);
        $category = $request->input('category');
        $meta = AgencyDocument::CATEGORIES[$category] ?? null;
        $request->validate([
            'category' => ['required', Rule::in(array_keys(AgencyDocument::CATEGORIES))],
            'file' => ['required', 'file', 'max:25600', 'mimes:' . ($meta['mimes'] ?? 'pdf')],
            'notes' => ['nullable', 'string', 'max:500'],
        ], [
            'file.mimes' => $category === 'lease_agreement' ? 'Upload the lease agreement as a PDF so tenants can read and sign it online.' : 'That file type isn’t supported.',
            'file.max' => 'Files can be up to 25 MB.',
        ]);

        $file = $request->file('file');
        DB::transaction(function () use ($agency, $category, $file, $request) {
            $last = AgencyDocument::where('agency_id', $agency->id)->where('category', $category)->lockForUpdate()->max('version') ?? 0;
            AgencyDocument::where('agency_id', $agency->id)->where('category', $category)->update(['is_current' => false]);
            AgencyDocument::create([
                'agency_id' => $agency->id,
                'category' => $category,
                'version' => $last + 1,
                'is_current' => true,
                'path' => $file->store("agency-documents/{$agency->id}/{$category}", 'local'),
                'original_name' => mb_substr($file->getClientOriginalName(), 0, 200),
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
                'sha256' => hash_file('sha256', $file->getRealPath()),
                'notes' => $request->input('notes'),
                'uploaded_by' => $request->user()->id,
            ]);
        });

        $label = $meta['label'];
        $extra = $category === 'lease_agreement'
            ? ' Tenants who haven’t signed yet will now see this version. Leases already signed keep the version that was signed.'
            : ' Agents see it straight away, and shared links now open this version.';

        return back()->with('success', "{$label} updated.{$extra}");
    }

    /** Make an older version current again. */
    public function restore(Request $request, AgencyDocument $document): RedirectResponse
    {
        $agency = $this->agency($request);
        abort_unless($document->agency_id === $agency->id, 404);
        DB::transaction(function () use ($document) {
            AgencyDocument::where('agency_id', $document->agency_id)->where('category', $document->category)->update(['is_current' => false]);
            $document->update(['is_current' => true]);
        });

        return back()->with('success', 'Version ' . $document->version . ' is current again.');
    }

    public function destroy(Request $request, AgencyDocument $document): RedirectResponse
    {
        $agency = $this->agency($request);
        abort_unless($document->agency_id === $agency->id, 404);
        if (Lease::where('agency_document_id', $document->id)->exists()) {
            return back()->with('error', 'Tenants have signed this version, so it is kept on record.');
        }
        Storage::disk('local')->delete($document->path);
        $wasCurrent = $document->is_current;
        $document->delete();
        if ($wasCurrent) {
            AgencyDocument::where('agency_id', $agency->id)->where('category', $document->category)->orderByDesc('version')->limit(1)->update(['is_current' => true]);
        }

        return back()->with('success', 'Version ' . $document->version . ' deleted.');
    }

    public function show(Request $request, AgencyDocument $document): StreamedResponse
    {
        $agency = $this->agency($request);
        abort_unless($document->agency_id === $agency->id, 404);
        // Agents only get current versions.
        abort_unless($request->routeIs('agency.*') || $document->is_current, 404);

        return $this->stream($document, $request->boolean('download'));
    }

    /** GET /docs/{token}/{category} — public share link; always the current version. */
    public function shared(Request $request, string $token, string $category): StreamedResponse
    {
        abort_unless(preg_match('/^[A-Za-z0-9]{40}$/', $token) && (AgencyDocument::CATEGORIES[$category]['shareable'] ?? false), 404);
        $agency = Agency::where('documents_share_token', $token)->firstOrFail();
        $doc = AgencyDocument::currentFor($agency->id, $category) ?? abort(404);
        $doc->setRelation('agency', $agency);

        return $this->stream($doc, $request->boolean('download'));
    }

    // ── helpers ─────────────────────────────────────────────────────────

    public static function stream(AgencyDocument $doc, bool $download): StreamedResponse
    {
        abort_unless(Storage::disk('local')->exists($doc->path), 404);
        $doc->loadMissing('agency');

        return Storage::disk('local')->response($doc->path, $doc->downloadName(), [
            'Content-Type' => $doc->mime ?: 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
        ], $download ? 'attachment' : 'inline');
    }

    private function row(AgencyDocument $d, string $base): array
    {
        return [
            'id' => $d->id,
            'version' => $d->version,
            'name' => $d->original_name,
            'size' => $d->size,
            'notes' => $d->notes,
            'uploaded_by' => $d->uploader?->name,
            'uploaded_at' => $d->created_at?->timezone('Africa/Johannesburg')->format('d M Y'),
            'url' => "{$base}/{$d->id}",
            'is_pdf' => str_contains((string) $d->mime, 'pdf'),
        ];
    }

    private function shareToken(Agency $agency): string
    {
        if (! $agency->documents_share_token) {
            $agency->forceFill(['documents_share_token' => Str::random(40)])->save();
        }

        return $agency->documents_share_token;
    }

    private function agency(Request $request): Agency
    {
        if ($request->routeIs('agency.*')) {
            abort_unless(in_array($request->user()->role, [Role::AgencyAdmin, Role::SuperAdmin], true), 403);

            return $this->resolveAgency($request);
        }
        $record = AgencyAgent::where('user_id', $request->user()->id)->with('agency')->first();
        abort_unless($record, 403, 'You are not linked to an agency.');

        return $record->agency;
    }
}
