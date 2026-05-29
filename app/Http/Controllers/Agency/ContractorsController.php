<?php

namespace App\Http\Controllers\Agency;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\Contractor;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ContractorsController extends Controller
{
    use ResolvesAgency;

    public function index(Request $request): Response
    {
        $agency = $this->resolveAgency($request);
        $tab = $request->query('tab') === 'mine' ? 'mine' : 'marketplace';

        $base = Contractor::query()->with('user:id,name,email,phone');

        $marketplaceQuery = (clone $base)
            ->where('status', 'active')
            ->whereNull('created_by_agency_id');

        $mineQuery = (clone $base)
            ->where('created_by_agency_id', $agency->id);

        $list = ($tab === 'mine' ? $mineQuery : $marketplaceQuery)
            ->orderByDesc('average_rating')
            ->orderByDesc('total_jobs')
            ->get()
            ->map(fn ($c) => $this->card($c));

        return Inertia::render('Agency/Contractors', [
            'agency' => ['id' => $agency->id, 'name' => $agency->name],
            'tab'    => $tab,
            'list'   => $list,
            'counts' => [
                'marketplace' => $marketplaceQuery->count(),
                'mine'        => $mineQuery->count(),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);

        $data = $request->validate([
            'business_name'   => ['required', 'string', 'max:160'],
            'contact_name'    => ['required', 'string', 'max:120'],
            'email'           => ['required', 'email', 'max:180'],
            'phone'           => ['nullable', 'string', 'max:30'],
            'specialities'    => ['nullable', 'array'],
            'specialities.*'  => ['string', 'max:60'],
            'service_areas'   => ['nullable', 'array'],
            'service_areas.*' => ['string', 'max:60'],
        ]);

        DB::transaction(function () use ($data, $agency) {
            $user = User::where('email', $data['email'])->first();
            if (! $user) {
                $user = User::create([
                    'name'     => $data['contact_name'],
                    'email'    => $data['email'],
                    'phone'    => $data['phone'] ?? null,
                    'password' => Hash::make(Str::random(40)),
                    'role'     => Role::Contractor,
                    'status'   => UserStatus::Pending,
                ]);
                $user->assignRole(Role::Contractor->value);
            }

            Contractor::create([
                'user_id'              => $user->id,
                'created_by_agency_id' => $agency->id,
                'business_name'        => $data['business_name'],
                'specialities'         => $data['specialities'] ?? [],
                'service_areas'        => $data['service_areas'] ?? [],
                'status'               => 'active',
            ]);
        });

        return redirect()
            ->route('agency.contractors.index', ['tab' => 'mine'])
            ->with('success', "Added {$data['business_name']} to your contractor list.");
    }

    private function card(Contractor $c): array
    {
        return [
            'id'             => $c->id,
            'business_name'  => $c->business_name,
            'contact_name'   => $c->user?->name,
            'email'          => $c->user?->email,
            'phone'          => $c->user?->phone,
            'specialities'   => is_array($c->specialities) ? $c->specialities : [],
            'service_areas'  => is_array($c->service_areas) ? $c->service_areas : [],
            'average_rating' => (float) $c->average_rating,
            'total_reviews'  => (int) $c->total_reviews,
            'total_jobs'     => (int) $c->total_jobs,
            'is_private'     => ! is_null($c->created_by_agency_id),
        ];
    }
}
