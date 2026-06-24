<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\PromoCode;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PromoCodesController extends Controller
{
    use EnsuresSuperAdmin;

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        $codes = PromoCode::withCount('redemptions')
            ->orderByDesc('id')
            ->get()
            ->map(fn (PromoCode $c) => [
                'id'              => $c->id,
                'code'            => $c->code,
                'description'     => $c->description,
                'audience'        => $c->audience,
                'duration_days'   => $c->duration_days,
                'max_redemptions' => $c->max_redemptions,
                'times_redeemed'  => $c->times_redeemed,
                'redemptions'     => $c->redemptions_count,
                'valid_until'     => $c->valid_until?->format('Y-m-d'),
                'is_active'       => $c->is_active,
                'is_expired'      => $c->valid_until !== null && $c->valid_until->endOfDay()->isPast(),
            ]);

        return Inertia::render('Admin/PromoCodes', [
            'counts' => $this->sidebarCounts(),
            'codes'  => $codes,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        $data = $request->validate([
            'code'            => ['required', 'string', 'max:60', 'regex:/^[A-Za-z0-9_-]+$/', 'unique:promo_codes,code'],
            'description'     => ['nullable', 'string', 'max:160'],
            'audience'        => ['required', Rule::in(['agency', 'landlord', 'both'])],
            'duration_days'   => ['required', 'integer', 'min:1', 'max:3650'],
            'max_redemptions' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'valid_until'     => ['nullable', 'date', 'after:today'],
        ]);

        PromoCode::create([
            'code'            => strtoupper($data['code']),
            'description'     => $data['description'] ?? null,
            'audience'        => $data['audience'],
            'duration_days'   => $data['duration_days'],
            'max_redemptions' => $data['max_redemptions'] ?? null,
            'valid_until'     => $data['valid_until'] ?? null,
            'is_active'       => true,
        ]);

        return back()->with('success', "Promo code \"{$data['code']}\" created.");
    }

    public function toggle(Request $request, PromoCode $promoCode): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        $promoCode->update(['is_active' => ! $promoCode->is_active]);

        return back()->with('success', $promoCode->is_active
            ? "Code \"{$promoCode->code}\" activated."
            : "Code \"{$promoCode->code}\" deactivated.");
    }

    public function destroy(Request $request, PromoCode $promoCode): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        $code = $promoCode->code;
        $promoCode->delete();

        return back()->with('success', "Promo code \"{$code}\" deleted.");
    }
}
