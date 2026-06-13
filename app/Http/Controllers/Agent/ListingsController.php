<?php

namespace App\Http\Controllers\Agent;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Inquiry;
use App\Models\Invitation;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\ListingUnit;
use App\Models\User;
use App\Notifications\UserInvited;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ListingsController extends Controller
{
    use ResolvesAgent;

    public function index(Request $request): Response
    {
        $user        = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);

        $typeFilter = $request->query('type', 'all');

        $query = Listing::where('agent_id', $user->id)
            ->whereNull('deleted_at')
            ->withCount('inquiries');

        if ($typeFilter !== 'all') {
            $typeMap = ['sale' => 'for_sale', 'rent' => 'long_term_rent', 'stay' => 'short_term_stay'];
            if (isset($typeMap[$typeFilter])) {
                $query->where('listing_type', $typeMap[$typeFilter]);
            }
        }

        $listings = $query->orderByDesc('created_at')->get()->map(fn ($l) => [
            'id'                => $l->id,
            'title'             => $l->title,
            'address'           => implode(', ', array_filter([$l->address, $l->suburb, $l->city])),
            'listing_type'      => $l->listing_type,
            'status'            => $l->status,
            'price_label'       => $this->priceLabel($l),
            'days_on_market'    => (int) ($l->created_at?->diffInDays(now()) ?? 0),
            'views'             => $l->views_count ?? 0,
            'inquiries'         => $l->inquiries_count ?? 0,
            'viewings'          => Inquiry::where('listing_id', $l->id)->where('status', 'viewing')->count(),
            'color_class'       => $this->colorClass($l->listing_type),
            'primary_image'     => $l->primary_image,
            'edit_url'          => route('agent.listings.edit', $l->id),
            'monthly_rent'      => $l->monthly_rent !== null ? (float) $l->monthly_rent : null,
            'can_invite_tenant' => $l->status === 'available' && $l->listing_type === 'long_term_rent',
            'can_reactivate'    => $l->status === 'leased',
            'can_mark_sold'     => $l->status === 'available' && $l->listing_type === 'for_sale' && $l->owner_type === Agency::class,
            'sale_price'        => $l->sale_price !== null ? (float) $l->sale_price : null,
        ]);

        // Rental listings the agent can invite a tenant to
        $invitable = Listing::where('agent_id', $user->id)
            ->whereNull('deleted_at')
            ->where('listing_type', 'long_term_rent')
            ->where('status', 'available')
            ->orderByDesc('created_at')
            ->get(['id', 'title', 'suburb', 'city', 'monthly_rent'])
            ->map(fn ($l) => [
                'id'           => $l->id,
                'label'        => $l->title . ($l->suburb ? " · {$l->suburb}" : ''),
                'monthly_rent' => $l->monthly_rent !== null ? (float) $l->monthly_rent : null,
            ]);

        $counts = [
            'all'  => Listing::where('agent_id', $user->id)->whereNull('deleted_at')->count(),
            'sale' => Listing::where('agent_id', $user->id)->whereNull('deleted_at')->where('listing_type', 'for_sale')->count(),
            'rent' => Listing::where('agent_id', $user->id)->whereNull('deleted_at')->where('listing_type', 'long_term_rent')->count(),
            'stay' => Listing::where('agent_id', $user->id)->whereNull('deleted_at')->where('listing_type', 'short_term_stay')->count(),
        ];

        return Inertia::render('Agent/Listings', [
            'agent'              => ['id' => $user->id, 'name' => $user->name, 'agency_name' => $agentRecord->agency->name],
            'listings'           => $listings,
            'counts'             => $counts,
            'type_filter'        => $typeFilter,
            'invitable_listings' => $invitable,
        ]);
    }

    private function priceLabel(Listing $l): string
    {
        return match ($l->listing_type) {
            'for_sale'        => 'R ' . number_format((float) ($l->sale_price ?? 0), 0, '.', ' '),
            'long_term_rent'  => 'R ' . number_format((float) ($l->monthly_rent ?? 0), 0, '.', ' ') . '/mo',
            'short_term_stay' => 'R ' . number_format((float) ($l->short_stay_nightly_price ?? 0), 0, '.', ' ') . '/night',
            default           => '—',
        };
    }

    private function colorClass(string $type): string
    {
        return match ($type) {
            'for_sale'        => 'from-sky-300 via-sky-200 to-cyan-300',
            'long_term_rent'  => 'from-amber-300 via-amber-200 to-orange-300',
            'short_term_stay' => 'from-rose-300 via-rose-200 to-pink-300',
            default           => 'from-slate-300 to-slate-200',
        };
    }

    // ── Create-listing flow ─────────────────────────────────────────────

    private const AMENITY_GROUPS = [
        'interior' => ['Air Conditioning', 'Furnished', 'Fireplace', 'Built-in cupboards', 'Open-plan kitchen'],
        'kitchen'  => ['Dishwasher', 'Modern Appliances', 'Gas stove', 'Scullery', 'Walk-in pantry'],
        'exterior' => ['Swimming Pool', 'Garden', 'Garage', 'Balcony', 'Carport', 'Patio', 'Braai area'],
        'safety'   => ['24/7 Security', 'Alarm System', 'Electric Fence', 'CCTV', 'Burglar bars'],
        'comfort'  => ['Solar Power', 'Borehole', 'Generator', 'Fibre Internet'],
    ];

    public function create(Request $request): Response
    {
        $pivot  = $this->resolveAgentRecord($request);
        $agency = $pivot->agency;

        return Inertia::render('Agent/CreateListing', [
            'agency'    => ['id' => $agency->id, 'name' => $agency->name],
            'agents'    => [],
            'amenities' => self::AMENITY_GROUPS,
            'property_types' => [
                ['value' => 'apartment',  'label' => 'Apartment'],
                ['value' => 'house',      'label' => 'House'],
                ['value' => 'townhouse',  'label' => 'Townhouse'],
                ['value' => 'commercial', 'label' => 'Commercial'],
                ['value' => 'land',       'label' => 'Land / Plot'],
                ['value' => 'other',      'label' => 'Other'],
            ],
            'provinces' => [
                'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
                'Free State', 'Mpumalanga', 'Limpopo', 'North West', 'Northern Cape',
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $pivot  = $this->resolveAgentRecord($request);
        $agency = $pivot->agency;
        $user   = $request->user();

        $data = $this->validateListing($request);

        $listing = DB::transaction(function () use ($data, $agency, $user, $request) {
            $listing = Listing::create([
                'ulid'                => (string) Str::ulid(),
                'owner_type'          => Agency::class,
                'owner_id'            => $agency->id,
                'agent_id'            => $user->id, // self-assign
                'title'               => $data['title'],
                'slug'                => $this->uniqueSlug($data['title']),
                'description'         => $data['description'] ?? null,
                'listing_type'        => $data['listing_type'],
                'property_type'       => $data['property_type'],
                'status'              => 'available',
                'sale_price'          => $data['listing_type'] === 'for_sale' ? ($data['sale_price'] ?? null) : null,
                'monthly_rent'        => $data['listing_type'] === 'long_term_rent' && $data['listing_structure'] === 'single_unit'
                    ? ($data['monthly_rent'] ?? null) : null,
                'listing_structure'   => $data['listing_structure'],
                'negotiator_protocol' => $request->boolean('negotiator_protocol'),
                'address'             => $data['address'] ?? null,
                'suburb'              => $data['suburb'] ?? null,
                'city'                => $data['city'] ?? null,
                'province'            => $data['province'] ?? null,
                'postal_code'         => $data['postal_code'] ?? null,
                'latitude'            => $data['latitude'] ?? null,
                'longitude'           => $data['longitude'] ?? null,
                'bedrooms'            => $data['bedrooms'] ?? null,
                'bathrooms'           => $data['bathrooms'] ?? null,
                'area_sqm'            => $data['area_sqm'] ?? null,
                'amenities'           => array_values(array_filter(array_merge(
                    $data['amenities'] ?? [],
                    $data['custom_amenities'] ?? [],
                ))),
            ]);

            if ($data['listing_structure'] === 'multi_unit' && ! empty($data['units'])) {
                foreach ($data['units'] as $u) {
                    ListingUnit::create([
                        'listing_id'   => $listing->id,
                        'unit_number'  => $u['unit_number'],
                        'monthly_rent' => $u['monthly_rent'],
                        'bedrooms'     => $u['bedrooms'] ?? null,
                        'bathrooms'    => $u['bathrooms'] ?? null,
                        'area_sqm'     => $u['area_sqm'] ?? null,
                        'status'       => 'vacant',
                    ]);
                }
            }

            $dir = "listings/{$listing->id}";
            if ($request->hasFile('primary_image')) {
                $listing->primary_image = Storage::url($request->file('primary_image')->store($dir, 'public'));
            }
            if ($request->hasFile('gallery_images')) {
                $gallery = [];
                foreach ($request->file('gallery_images') as $file) {
                    $gallery[] = Storage::url($file->store($dir, 'public'));
                }
                $listing->gallery_images = $gallery;
            }

            $listing->save();
            return $listing;
        });

        return redirect()
            ->route('agent.listings.index')
            ->with('success', "Listing \"{$listing->title}\" created and assigned to you.");
    }

    public function edit(Request $request, Listing $listing): Response
    {
        $user  = $request->user();
        $pivot = $this->resolveAgentRecord($request);
        $this->authorizeAgentOwnsListing($listing, $user);

        return Inertia::render('Agent/EditListing', [
            'agency'         => ['id' => $pivot->agency->id, 'name' => $pivot->agency->name],
            'amenities'      => self::AMENITY_GROUPS,
            'property_types' => [
                ['value' => 'apartment',  'label' => 'Apartment'],
                ['value' => 'house',      'label' => 'House'],
                ['value' => 'townhouse',  'label' => 'Townhouse'],
                ['value' => 'commercial', 'label' => 'Commercial'],
                ['value' => 'land',       'label' => 'Land / Plot'],
                ['value' => 'other',      'label' => 'Other'],
            ],
            'provinces' => [
                'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
                'Free State', 'Mpumalanga', 'Limpopo', 'North West', 'Northern Cape',
            ],
            'listing' => [
                'id'                  => $listing->id,
                'title'               => $listing->title,
                'description'         => $listing->description,
                'listing_type'        => $listing->listing_type,
                'property_type'       => $listing->property_type,
                'listing_structure'   => $listing->listing_structure ?? 'single_unit',
                'status'              => $listing->status,
                'sale_price'          => $listing->sale_price !== null ? (string) (float) $listing->sale_price : '',
                'monthly_rent'        => $listing->monthly_rent !== null ? (string) (float) $listing->monthly_rent : '',
                'bedrooms'            => $listing->bedrooms !== null ? (string) $listing->bedrooms : '',
                'bathrooms'           => $listing->bathrooms !== null ? (string) (float) $listing->bathrooms : '',
                'area_sqm'            => $listing->area_sqm !== null ? (string) (float) $listing->area_sqm : '',
                'address'             => $listing->address ?? '',
                'suburb'              => $listing->suburb ?? '',
                'city'                => $listing->city ?? '',
                'province'            => $listing->province ?? '',
                'postal_code'         => $listing->postal_code ?? '',
                'latitude'            => $listing->latitude !== null ? (string) (float) $listing->latitude : '',
                'longitude'           => $listing->longitude !== null ? (string) (float) $listing->longitude : '',
                'amenities'           => $listing->amenities ?? [],
                'negotiator_protocol' => (bool) $listing->negotiator_protocol,
                'primary_image'       => $listing->primary_image,
                'gallery_images'      => $listing->gallery_images ?? [],
                'units'               => $listing->units->map(fn ($u) => [
                    'unit_number'  => $u->unit_number,
                    'monthly_rent' => (string) (float) $u->monthly_rent,
                    'bedrooms'     => $u->bedrooms !== null ? (string) $u->bedrooms : '',
                    'bathrooms'    => $u->bathrooms !== null ? (string) (float) $u->bathrooms : '',
                    'area_sqm'     => $u->area_sqm !== null ? (string) (float) $u->area_sqm : '',
                ])->all(),
            ],
        ]);
    }

    public function update(Request $request, Listing $listing): RedirectResponse
    {
        $user = $request->user();
        $this->authorizeAgentOwnsListing($listing, $user);

        $data = $this->validateListing($request);

        DB::transaction(function () use ($data, $listing, $request) {
            $listing->fill([
                'title'               => $data['title'],
                'description'         => $data['description'] ?? null,
                'listing_type'        => $data['listing_type'],
                'property_type'       => $data['property_type'],
                'listing_structure'   => $data['listing_structure'],
                'sale_price'          => $data['listing_type'] === 'for_sale' ? ($data['sale_price'] ?? null) : null,
                'monthly_rent'        => $data['listing_type'] === 'long_term_rent' && $data['listing_structure'] === 'single_unit'
                    ? ($data['monthly_rent'] ?? null) : null,
                'negotiator_protocol' => $request->boolean('negotiator_protocol'),
                'address'             => $data['address'] ?? null,
                'suburb'              => $data['suburb'] ?? null,
                'city'                => $data['city'] ?? null,
                'province'            => $data['province'] ?? null,
                'postal_code'         => $data['postal_code'] ?? null,
                'latitude'            => $data['latitude'] ?? null,
                'longitude'           => $data['longitude'] ?? null,
                'bedrooms'            => $data['bedrooms'] ?? null,
                'bathrooms'           => $data['bathrooms'] ?? null,
                'area_sqm'            => $data['area_sqm'] ?? null,
                'amenities'           => array_values(array_filter(array_merge(
                    $data['amenities'] ?? [],
                    $data['custom_amenities'] ?? [],
                ))),
            ]);

            // Replace units only when multi_unit; clear them otherwise so a
            // structure change doesn't leave orphan rows.
            if ($data['listing_structure'] === 'multi_unit' && ! empty($data['units'])) {
                $listing->units()->delete();
                foreach ($data['units'] as $u) {
                    ListingUnit::create([
                        'listing_id'   => $listing->id,
                        'unit_number'  => $u['unit_number'],
                        'monthly_rent' => $u['monthly_rent'],
                        'bedrooms'     => $u['bedrooms'] ?? null,
                        'bathrooms'    => $u['bathrooms'] ?? null,
                        'area_sqm'     => $u['area_sqm'] ?? null,
                        'status'       => 'vacant',
                    ]);
                }
            } elseif ($data['listing_structure'] === 'single_unit') {
                $listing->units()->delete();
            }

            $dir = "listings/{$listing->id}";
            if ($request->hasFile('primary_image')) {
                $listing->primary_image = Storage::url($request->file('primary_image')->store($dir, 'public'));
            }
            if ($request->hasFile('gallery_images')) {
                $gallery = $listing->gallery_images ?? [];
                foreach ($request->file('gallery_images') as $file) {
                    $gallery[] = Storage::url($file->store($dir, 'public'));
                }
                $listing->gallery_images = $gallery;
            }

            $listing->save();
        });

        return redirect()
            ->route('agent.listings.index')
            ->with('success', "Listing \"{$listing->title}\" updated.");
    }

    /**
     * POST /agent/listings/{listing}/invite-tenant
     * Invites a tenant to occupy this rental listing. Creates (or reuses) the
     * tenant User, creates a Lease, flips the listing to status='leased' so it
     * disappears from public search, and emails the invite link.
     */
    public function inviteTenant(Request $request, Listing $listing): RedirectResponse
    {
        $user  = $request->user();
        $pivot = $this->resolveAgentRecord($request);
        $this->authorizeAgentOwnsListing($listing, $user);

        abort_unless(
            $listing->listing_type === 'long_term_rent',
            422,
            'You can only invite tenants to rental listings.'
        );

        $data = $request->validate([
            'tenant_email'   => ['required', 'email', 'max:180'],
            'tenant_name'    => ['required', 'string', 'max:120'],
            'tenant_phone'   => ['nullable', 'string', 'max:30'],
            'start_date'     => ['required', 'date'],
            'end_date'       => ['required', 'date', 'after:start_date'],
            'monthly_rent'   => ['required', 'numeric', 'min:0'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        $invitation = DB::transaction(function () use ($data, $listing, $user, $pivot, $request) {
            // Find or create the tenant user. withTrashed: the email may belong
            // to a user the admin soft-deleted — restore it instead of hitting
            // the unique-email constraint (500).
            $tenant = User::withTrashed()->where('email', $data['tenant_email'])->first();
            if ($tenant && $tenant->trashed()) {
                $tenant->restore();
                $tenant->update([
                    'name'   => $data['tenant_name'],
                    'phone'  => $data['tenant_phone'] ?? $tenant->phone,
                    'role'   => Role::Tenant,
                    'status' => UserStatus::Pending,
                    'invite_accepted_at' => null,
                ]);
                if (! $tenant->hasRole(Role::Tenant->value)) {
                    $tenant->assignRole(Role::Tenant->value);
                }
            }
            if (! $tenant) {
                $tenant = User::create([
                    'name'     => $data['tenant_name'],
                    'email'    => $data['tenant_email'],
                    'phone'    => $data['tenant_phone'] ?? null,
                    'password' => Hash::make(Str::random(40)),
                    'role'     => Role::Tenant,
                    'status'   => UserStatus::Pending,
                ]);
                $tenant->assignRole(Role::Tenant->value);
            }

            // Resolve landlord_id if the listing is landlord-owned
            $landlordId = null;
            if ($listing->owner_type === \App\Models\Landlord::class) {
                $landlordId = optional($listing->owner)->user_id;
            }

            $lease = Lease::create([
                'listing_id'     => $listing->id,
                'tenant_id'      => $tenant->id,
                'landlord_id'    => $landlordId,
                'agency_id'      => $pivot->agency_id,
                'agent_id'       => $user->id,
                'start_date'     => $data['start_date'],
                'end_date'       => $data['end_date'],
                'monthly_rent'   => $data['monthly_rent'],
                'deposit_amount' => $data['deposit_amount'] ?? 0,
                'status'         => 'pending',
            ]);

            // Create the invitation (only if tenant hasn't already accepted one)
            $invitation = null;
            if (! $tenant->invite_accepted_at) {
                $invitation = Invitation::create([
                    'email'          => $data['tenant_email'],
                    'role'           => 'tenant',
                    'invited_by'     => $user->id,
                    'invitable_type' => Lease::class,
                    'invitable_id'   => $lease->id,
                    'token'          => (string) Str::uuid(),
                    'expires_at'     => now()->addDays(14),
                ]);
            }

            // Pull the listing off the public site
            $listing->update(['status' => 'leased']);

            // Renting out an agency listing closes a rental deal — generate the
            // agent's rental commission into the agency payout queue. Idempotent
            // per lease, and idempotent against the pipeline-registration path.
            if ($listing->owner_type === Agency::class) {
                app(\App\Services\CommissionService::class)->recordRental($lease, $user);
            }

            return $invitation;
        });

        // Email outside the transaction: a mail-transport failure must not
        // roll back (or 500) an otherwise-successful invite.
        if ($invitation) {
            try {
                Notification::route('mail', $invitation->email)->notify(new UserInvited($invitation));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return redirect()
            ->route('agent.listings.index')
            ->with('success', "Tenant invited to \"{$listing->title}\" — the listing is no longer public.");
    }

    /**
     * POST /agent/listings/{listing}/reactivate
     * Marks any active/pending lease for this listing as terminated and flips
     * the listing back to status='available' so it's publicly visible again.
     */
    public function reactivate(Request $request, Listing $listing): RedirectResponse
    {
        $user = $request->user();
        $this->authorizeAgentOwnsListing($listing, $user);

        abort_unless(
            $listing->status === 'leased',
            422,
            'Only leased listings can be reactivated.'
        );

        DB::transaction(function () use ($listing) {
            Lease::where('listing_id', $listing->id)
                ->whereIn('status', ['active', 'pending'])
                ->update(['status' => 'terminated']);

            $listing->update(['status' => 'available']);
        });

        return redirect()
            ->route('agent.listings.index')
            ->with('success', "Listing \"{$listing->title}\" is live on the public site again.");
    }

    /**
     * POST /agent/listings/{listing}/mark-sold
     * Records a sale on a for-sale listing: flips it to status='sold' and
     * generates the agent's sale commission into the agency payout queue.
     */
    public function markSold(Request $request, Listing $listing): RedirectResponse
    {
        $user = $request->user();
        $this->authorizeAgentOwnsListing($listing, $user);

        abort_unless(
            $listing->listing_type === 'for_sale',
            422,
            'Only for-sale listings can be marked as sold.'
        );
        abort_unless(
            $listing->status === 'available',
            422,
            'Only an available listing can be marked as sold.'
        );
        abort_if(
            $listing->owner_type !== Agency::class,
            422,
            'Only agency listings earn a commission.'
        );

        $data = $request->validate([
            'sale_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($listing, $user, $data) {
            if (! empty($data['sale_price'])) {
                $listing->update(['sale_price' => $data['sale_price']]);
            }
            $listing->update(['status' => 'sold']);

            // Closing a sale generates the agent's commission into the agency
            // payout queue (idempotent per listing).
            app(\App\Services\CommissionService::class)->recordSale($listing->fresh(), $user);
        });

        return redirect()
            ->route('agent.listings.index')
            ->with('success', "Sale recorded for \"{$listing->title}\" — your commission is in the agency payout queue.");
    }

    private function authorizeAgentOwnsListing(Listing $listing, $user): void
    {
        abort_unless(
            $listing->agent_id === $user->id && $listing->deleted_at === null,
            403,
            'You can only edit listings assigned to you.'
        );
    }

    private function validateListing(Request $request): array
    {
        return $request->validate([
            'listing_type'        => ['required', 'in:for_sale,long_term_rent'],
            'title'               => ['required', 'string', 'max:200'],
            'property_type'       => ['required', 'in:apartment,house,townhouse,commercial,land,other'],
            'description'         => ['nullable', 'string', 'max:5000'],
            'listing_structure'   => ['required', 'in:single_unit,multi_unit'],
            'sale_price'          => ['nullable', 'numeric', 'min:0', 'required_if:listing_type,for_sale'],
            'monthly_rent'        => ['nullable', 'numeric', 'min:0'],
            'bedrooms'            => ['nullable', 'integer', 'min:0', 'max:50'],
            'bathrooms'           => ['nullable', 'numeric', 'min:0', 'max:50'],
            'area_sqm'            => ['nullable', 'numeric', 'min:0'],
            'units'               => ['nullable', 'array'],
            'units.*.unit_number' => ['required_with:units', 'string', 'max:40'],
            'units.*.monthly_rent'=> ['required_with:units', 'numeric', 'min:0'],
            'units.*.bedrooms'    => ['nullable', 'integer', 'min:0', 'max:20'],
            'units.*.bathrooms'   => ['nullable', 'numeric', 'min:0', 'max:20'],
            'units.*.area_sqm'    => ['nullable', 'numeric', 'min:0'],
            'address'             => ['nullable', 'string', 'max:255'],
            'suburb'              => ['nullable', 'string', 'max:120'],
            'city'                => ['nullable', 'string', 'max:120'],
            'province'            => ['nullable', 'string', 'max:80'],
            'postal_code'         => ['nullable', 'string', 'max:12'],
            'latitude'            => ['nullable', 'numeric', 'between:-90,90'],
            'longitude'           => ['nullable', 'numeric', 'between:-180,180'],
            'amenities'           => ['nullable', 'array'],
            'amenities.*'         => ['string', 'max:80'],
            'custom_amenities'    => ['nullable', 'array'],
            'custom_amenities.*'  => ['string', 'max:80'],
            'primary_image'       => ['nullable', 'image', 'max:5120'],
            'gallery_images'      => ['nullable', 'array', 'max:50'],
            'gallery_images.*'    => ['image', 'max:5120'],
            'negotiator_protocol' => ['nullable', 'boolean'],
        ]);
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title);
        if (! Listing::where('slug', $base)->exists()) return $base;
        $i = 2;
        while (Listing::where('slug', "{$base}-{$i}")->exists()) $i++;
        return "{$base}-{$i}";
    }
}
