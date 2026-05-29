<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\AgencyAgent;
use App\Models\Commission;
use App\Models\Invitation;
use App\Models\Listing;
use App\Notifications\UserInvited;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AgentsController extends Controller
{
    use ResolvesAgency;

    public function index(Request $request): Response
    {
        $agency = $this->resolveAgency($request);
        $now = CarbonImmutable::now();
        $monthStart = $now->startOfMonth();

        $pivots = AgencyAgent::query()
            ->where('agency_id', $agency->id)
            ->with('user:id,name,email,phone,paystack_recipient_code,status')
            ->get();

        $listingCounts = Listing::query()
            ->where('owner_type', \App\Models\Agency::class)
            ->where('owner_id', $agency->id)
            ->selectRaw('agent_id, COUNT(*) as total')
            ->groupBy('agent_id')
            ->pluck('total', 'agent_id');

        $mtdCommissions = Commission::query()
            ->where('agency_id', $agency->id)
            ->whereDate('created_at', '>=', $monthStart)
            ->selectRaw('agent_id, COUNT(*) as deals, SUM(agent_amount) as commission')
            ->groupBy('agent_id')
            ->get()
            ->keyBy('agent_id');

        $rows = $pivots->map(function (AgencyAgent $p) use ($listingCounts, $mtdCommissions) {
            $stats = $mtdCommissions->get($p->user_id);
            $ffcStatus = $this->ffcStatus($p->ffc_expires_at);
            $paystackStatus = match (true) {
                ! $p->user || $p->status === 'pending' => 'pending',
                $p->user->paystack_recipient_code => 'linked',
                default => 'missing',
            };

            return [
                'id' => $p->id,
                'user_id' => $p->user_id,
                'name' => $p->user?->name ?? '—',
                'email' => $p->user?->email,
                'initials' => $this->initials($p->user?->name ?? '?'),
                'status' => $p->status,
                'area_speciality' => $p->area_speciality ?? [],
                'property_type_speciality' => $p->property_type_speciality ?? [],
                'commission_split_percent' => (float) $p->commission_split_percent,
                'listings' => (int) ($listingCounts[$p->user_id] ?? 0),
                'mtd_deals' => $stats ? (int) $stats->deals : 0,
                'mtd_commission' => $stats ? (float) $stats->commission : 0.0,
                'ffc' => [
                    'status' => $ffcStatus['status'],
                    'expires_at' => $p->ffc_expires_at?->toDateString(),
                    'days_left' => $ffcStatus['days_left'],
                ],
                'paystack' => $paystackStatus,
            ];
        })->values();

        $leaderboard = $rows
            ->sortByDesc('mtd_commission')
            ->take(3)
            ->values()
            ->all();

        $pendingInvites = Invitation::where('invited_by', $agency->user_id)
            ->where('role', 'agent')
            ->whereNull('accepted_at')
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->orderByDesc('created_at')
            ->get(['id', 'email', 'expires_at', 'created_at']);

        return Inertia::render('Agency/Agents', [
            'agency' => [
                'id' => $agency->id,
                'name' => $agency->name,
            ],
            'agents' => $rows,
            'leaderboard' => $leaderboard,
            'pending_invites' => $pendingInvites,
            'totals' => [
                'agents' => $rows->count(),
                'active' => $rows->where('status', 'active')->count(),
                'pending' => $rows->where('status', 'pending')->count(),
            ],
        ]);
    }

    public function invite(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);

        $data = $request->validate([
            'email' => ['required', 'email', 'max:180', Rule::unique('users', 'email')],
            'commission_split_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'area_speciality' => ['nullable', 'string', 'max:200'],
        ]);

        $token = (string) Str::uuid();

        $invitation = Invitation::create([
            'email' => $data['email'],
            'role' => 'agent',
            'invited_by' => $request->user()->id,
            'invitable_type' => \App\Models\Agency::class,
            'invitable_id' => $agency->id,
            'token' => $token,
            'expires_at' => now()->addDays(14),
        ]);

        Notification::route('mail', $data['email'])->notify(new UserInvited($invitation));

        return redirect()
            ->route('agency.agents.index')
            ->with('success', 'Invitation sent to '.$data['email'].'. Link expires in 14 days.');
    }

    private function initials(string $name): string
    {
        return collect(explode(' ', $name))
            ->take(2)
            ->map(fn ($w) => mb_substr($w, 0, 1))
            ->implode('');
    }

    private function ffcStatus(?\Illuminate\Support\Carbon $expiresAt): array
    {
        if (! $expiresAt) {
            return ['status' => 'pending', 'days_left' => null];
        }
        $days = (int) now()->startOfDay()->diffInDays($expiresAt->startOfDay(), false);
        if ($days < 0) return ['status' => 'expired', 'days_left' => $days];
        if ($days < 60) return ['status' => 'expiring', 'days_left' => $days];

        return ['status' => 'valid', 'days_left' => $days];
    }
}
