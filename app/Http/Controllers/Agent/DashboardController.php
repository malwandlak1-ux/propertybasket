<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use App\Models\Commission;
use App\Models\Inquiry;
use App\Models\Listing;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    use ResolvesAgent;

    public function overview(Request $request): Response
    {
        $user = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);
        $agency = $agentRecord->agency;
        $now = CarbonImmutable::now();
        $yearStart = $now->startOfYear();

        // ── KPIs ──────────────────────────────────────────────────────────────
        $activeListings = Listing::where('agent_id', $user->id)
            ->where('status', 'available')
            ->whereNull('deleted_at')
            ->count();

        $openLeads = Inquiry::where('assigned_to', $user->id)
            ->whereIn('status', ['new', 'contacted', 'qualified', 'viewing', 'offer'])
            ->count();

        $ytdCommission = (float) Commission::where('agent_id', $user->id)
            ->whereDate('created_at', '>=', $yearStart)
            ->whereIn('status', ['approved', 'paid'])
            ->sum('agent_net');

        $totalDeals    = Inquiry::where('assigned_to', $user->id)->count();
        $closedDeals   = Inquiry::where('assigned_to', $user->id)->where('status', 'closed')->count();
        $conversionRate = $totalDeals > 0 ? round(($closedDeals / $totalDeals) * 100, 1) : 0.0;

        // ── Pipeline snapshot ─────────────────────────────────────────────────
        $stages = [
            ['label' => 'New Lead',  'statuses' => ['new', 'contacted'], 'color' => 'brand'],
            ['label' => 'Qualified', 'statuses' => ['qualified'],         'color' => 'brand'],
            ['label' => 'Viewing',   'statuses' => ['viewing'],           'color' => 'brand'],
            ['label' => 'Offer',     'statuses' => ['offer'],             'color' => 'brand'],
            ['label' => 'Closed',    'statuses' => ['closed'],            'color' => 'success'],
        ];

        $pipelineSnapshot = [];
        $maxPipelineValue = 1.0;

        foreach ($stages as $s) {
            $rows = Inquiry::where('assigned_to', $user->id)
                ->whereIn('status', $s['statuses'])
                ->with('listing:id,listing_type,sale_price,monthly_rent,short_stay_nightly_price')
                ->get();

            $value = (float) $rows->sum(fn ($inq) => self::dealValue($inq->listing));

            if ($s['color'] !== 'success') {
                $maxPipelineValue = max($maxPipelineValue, $value);
            }

            $pipelineSnapshot[] = [
                'label'  => $s['label'],
                'count'  => $rows->count(),
                'value'  => $value,
                'color'  => $s['color'],
            ];
        }

        // ── Stats ─────────────────────────────────────────────────────────────
        $winDenom = Inquiry::where('assigned_to', $user->id)
            ->whereIn('status', ['closed', 'lost'])->count();
        $winRate = $winDenom > 0 ? (int) round(($closedDeals / $winDenom) * 100) : 0;
        $avgDealSize = (int) (Commission::where('agent_id', $user->id)
            ->whereIn('status', ['approved', 'paid'])
            ->avg('agent_net') ?? 0);

        // ── Today's schedule ──────────────────────────────────────────────────
        $todaySchedule = Inquiry::where('assigned_to', $user->id)
            ->whereNotNull('viewing_scheduled_at')
            ->whereDate('viewing_scheduled_at', $now->toDateString())
            ->with('listing:id,title,address,suburb')
            ->orderBy('viewing_scheduled_at')
            ->get()
            ->map(fn ($inq) => [
                'id'              => $inq->id,
                'name'            => $inq->name,
                'time'            => $inq->viewing_scheduled_at?->format('H:i'),
                'listing_title'   => $inq->listing?->title ?? '—',
                'listing_address' => $inq->listing?->address ?? '',
                'type'            => 'viewing',
            ]);

        // ── Hot leads ─────────────────────────────────────────────────────────
        $hotLeads = Inquiry::where('assigned_to', $user->id)
            ->whereIn('status', ['qualified', 'viewing', 'offer'])
            ->with('listing:id,listing_type,sale_price,monthly_rent,short_stay_nightly_price')
            ->get()
            ->map(function ($inq) {
                $dv = self::dealValue($inq->listing);
                return [
                    'id'         => $inq->id,
                    'name'       => $inq->name,
                    'initials'   => collect(explode(' ', $inq->name))->take(2)->map(fn ($w) => mb_substr($w, 0, 1))->implode(''),
                    'status'     => $inq->status,
                    'deal_value' => $dv,
                ];
            })
            ->sortByDesc('deal_value')
            ->take(3)
            ->values();

        // ── Listing performance ───────────────────────────────────────────────
        $listingPerformance = Listing::where('agent_id', $user->id)
            ->whereNull('deleted_at')
            ->orderByDesc('views_count')
            ->take(5)
            ->get()
            ->map(fn ($l) => [
                'id'            => $l->id,
                'title'         => $l->title,
                'location'      => implode(', ', array_filter([$l->suburb, $l->city])),
                'listing_type'  => $l->listing_type,
                'views'         => $l->views_count ?? 0,
                'inquiries'     => $l->inquiries_count ?? 0,
                'viewings'      => Inquiry::where('listing_id', $l->id)->where('status', 'viewing')->count(),
                'days_on_market'=> (int) ($l->created_at?->diffInDays(now()) ?? 0),
                'price_label'   => self::priceLabel($l),
            ]);

        return Inertia::render('Agent/Overview', [
            'agent' => [
                'id'          => $user->id,
                'name'        => $user->name,
                'initials'    => collect(explode(' ', $user->name))->take(2)->map(fn ($w) => mb_substr($w, 0, 1))->implode(''),
                'agency_name' => $agency->name,
                'ffc_number'  => $agentRecord->ffc_number,
                'ffc_expires_at' => $agentRecord->ffc_expires_at?->format('d M Y'),
            ],
            'kpis' => [
                'active_listings' => $activeListings,
                'open_leads'      => $openLeads,
                'ytd_commission'  => $ytdCommission,
                'conversion_rate' => $conversionRate,
            ],
            'pipeline_snapshot'   => $pipelineSnapshot,
            'pipeline_stats' => [
                'total_value'      => (float) collect($pipelineSnapshot)->sum('value'),
                'max_value'        => $maxPipelineValue,
                'win_rate'         => $winRate,
                'avg_deal_size'    => $avgDealSize,
            ],
            'today_schedule'      => $todaySchedule,
            'hot_leads'           => $hotLeads,
            'listing_performance' => $listingPerformance,
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static function dealValue(?Listing $listing): float
    {
        if (! $listing) {
            return 0.0;
        }

        return (float) match ($listing->listing_type) {
            'for_sale'        => $listing->sale_price ?? 0,
            'long_term_rent'  => ($listing->monthly_rent ?? 0) * 12,
            'short_term_stay' => ($listing->short_stay_nightly_price ?? 0) * 30,
            default           => 0,
        };
    }

    private static function priceLabel(Listing $l): string
    {
        return match ($l->listing_type) {
            'for_sale'        => 'R ' . number_format((float) ($l->sale_price ?? 0), 0, '.', ' '),
            'long_term_rent'  => 'R ' . number_format((float) ($l->monthly_rent ?? 0), 0, '.', ' ') . '/mo',
            'short_term_stay' => 'R ' . number_format((float) ($l->short_stay_nightly_price ?? 0), 0, '.', ' ') . '/night',
            default           => '—',
        };
    }
}
