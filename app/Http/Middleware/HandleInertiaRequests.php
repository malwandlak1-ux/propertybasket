<?php

namespace App\Http\Middleware;

use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Conversation;
use App\Models\Message;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user()?->only([
                    'id', 'name', 'email', 'role', 'status', 'avatar',
                ]),
            ],
            'ziggy' => fn () => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'ffc' => fn () => $this->ffcStatus($request),
            'agency_ffc' => fn () => $this->agencyFfcStatus($request),
            'notifications' => fn () => $this->notifications($request),
            'unread_messages' => fn () => $this->unreadMessagesCount($request),
        ];
    }

    /**
     * Compliance status for the agency the current user belongs to (as owner
     * or active agent). Drives the agency-wide banner + Compliance sidebar
     * badge.
     */
    private function agencyFfcStatus(Request $request): ?array
    {
        $user = $request->user();
        if (! $user) return null;

        $agency = Agency::where('user_id', $user->id)->first();
        if (! $agency) {
            $pivot  = AgencyAgent::where('user_id', $user->id)->where('status', 'active')->first();
            $agency = $pivot?->agency;
        }
        if (! $agency) return null;

        $now = CarbonImmutable::now()->startOfDay();
        $daysLeft = $agency->eaab_ffc_expires_at
            ? (int) round($now->diffInDays($agency->eaab_ffc_expires_at->startOfDay(), false))
            : null;

        $state = match (true) {
            empty($agency->eaab_ffc_number) || ! $agency->eaab_ffc_expires_at => 'missing',
            $daysLeft !== null && $daysLeft < 0                               => 'expired',
            $daysLeft !== null && $daysLeft <= 30                             => 'expiring',
            default                                                            => 'valid',
        };

        return [
            'state'      => $state,
            'days_left'  => $daysLeft,
            'expires_at' => $agency->eaab_ffc_expires_at?->format('d M Y'),
        ];
    }

    private function unreadMessagesCount(Request $request): int
    {
        $user = $request->user();
        if (! $user) return 0;

        $convoIds = Conversation::whereJsonContains('participants', $user->id)->pluck('id');
        if ($convoIds->isEmpty()) return 0;

        return Message::whereIn('conversation_id', $convoIds)
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->count();
    }

    private function notifications(Request $request): ?array
    {
        $user = $request->user();
        if (! $user) return null;

        $unreadCount = $user->unreadNotifications()->count();

        // Surface up to the 10 most-recent notifications regardless of read state
        // so the dropdown always has content to show.
        $recent = $user->notifications()
            ->latest()
            ->limit(10)
            ->get()
            ->map(function ($n) {
                $formatted = $this->formatNotification($n->type, (array) $n->data);
                return [
                    'id'         => $n->id,
                    'type'       => $n->type,
                    'title'      => $formatted['title'],
                    'body'       => $formatted['body'],
                    'href'       => $formatted['href'],
                    'tone'       => $formatted['tone'],
                    'read_at'    => $n->read_at?->toIso8601String(),
                    'created_at' => $n->created_at?->toIso8601String(),
                    'created_human' => $n->created_at?->diffForHumans(),
                ];
            })
            ->all();

        return [
            'unread_count' => $unreadCount,
            'recent'       => $recent,
        ];
    }

    /**
     * Map a notification class + payload to a UI-ready { title, body, href, tone }.
     * Unknown types fall back to the class basename.
     */
    private function formatNotification(string $type, array $data): array
    {
        return match ($type) {
            \App\Notifications\FfcExpiring::class => [
                'title' => 'FFC expiring soon',
                'body'  => 'Your certificate expires in ' . ($data['days_left'] ?? '?') . ' days.',
                'href'  => '/agent/ffc',
                'tone'  => ($data['days_left'] ?? 99) <= 7 ? 'danger' : 'warning',
            ],
            \App\Notifications\AgencyFfcExpiring::class => [
                'title' => 'Agency FFC expiring soon',
                'body'  => "Your agency's FFC expires in " . ($data['days_left'] ?? '?') . ' days — renew before listings get blocked.',
                'href'  => '/agency/compliance',
                'tone'  => ($data['days_left'] ?? 99) <= 7 ? 'danger' : 'warning',
            ],
            \App\Notifications\InquiryReceived::class => [
                'title' => 'New lead allocated',
                'body'  => ($data['inquirer_name'] ?? 'Someone') . ' inquired about ' . ($data['listing_title'] ?? 'a listing') . '.',
                'href'  => '/agent/pipeline',
                'tone'  => 'brand',
            ],
            \App\Notifications\UserInvited::class => [
                'title' => 'Invitation sent',
                'body'  => 'Invitation sent to ' . ($data['email'] ?? 'a new user') . '.',
                'href'  => null,
                'tone'  => 'muted',
            ],
            \App\Notifications\CommissionApproved::class => [
                'title' => 'Commission approved',
                'body'  => 'Your commission payout has been approved.',
                'href'  => '/agent/commission',
                'tone'  => 'success',
            ],
            \App\Notifications\CommissionPaid::class => [
                'title' => 'Commission paid out',
                'body'  => 'Your commission has been transferred.',
                'href'  => '/agent/commission',
                'tone'  => 'success',
            ],
            \App\Notifications\QuoteAccepted::class => [
                'title' => 'Quote accepted',
                'body'  => 'The agency accepted ' . ($data['reference'] ?? 'your quote')
                    . ($data['job_title'] ? ' on "' . $data['job_title'] . '"' : '')
                    . ' — you can now schedule the job.',
                'href'  => '/contractor/requests',
                'tone'  => 'success',
            ],
            \App\Notifications\QuoteRejected::class => [
                'title' => 'Quote not accepted',
                'body'  => 'The agency didn\'t accept ' . ($data['reference'] ?? 'your quote')
                    . ($data['job_title'] ? ' on "' . $data['job_title'] . '"' : '')
                    . ' — revise and resubmit if you\'d like.',
                'href'  => '/contractor/requests',
                'tone'  => 'warning',
            ],
            \App\Notifications\MaintenanceInvoicePaid::class => [
                'title' => 'Invoice paid',
                'body'  => 'Your invoice for R ' . number_format((float) ($data['total'] ?? 0), 2)
                    . ' has been paid. Funds settle in 1–2 business days.',
                'href'  => '/contractor/finance',
                'tone'  => 'success',
            ],
            \App\Notifications\MaintenanceJobAccepted::class => [
                'title' => 'Contractor accepted your request',
                'body'  => 'A contractor has accepted your maintenance request.',
                'href'  => '/tenant/maintenance',
                'tone'  => 'brand',
            ],
            \App\Notifications\MaintenanceJobCompleted::class => [
                'title' => 'Maintenance job completed',
                'body'  => 'The contractor has marked the job as completed.',
                'href'  => '/tenant/maintenance',
                'tone'  => 'success',
            ],
            \App\Notifications\MaintenanceRequestSubmitted::class => [
                'title' => 'New maintenance request',
                'body'  => 'A tenant has submitted a maintenance request that needs your attention.',
                'href'  => '/agency/maintenance',
                'tone'  => 'warning',
            ],
            \App\Notifications\RentPaymentReceived::class => [
                'title' => 'Rent payment received',
                'body'  => 'Your rent payment has been confirmed. Receipt is in your email.',
                'href'  => '/tenant/payments',
                'tone'  => 'success',
            ],
            \App\Notifications\WelcomeUser::class => [
                'title' => 'Welcome to Property Basket',
                'body'  => 'Your account is ready. Explore your dashboard to get started.',
                'href'  => null,
                'tone'  => 'brand',
            ],
            \App\Notifications\InspectionCompleted::class => [
                'title' => 'Inspection completed',
                'body'  => 'A property inspection has been completed. The signed report is attached to the email.',
                'href'  => null,
                'tone'  => 'brand',
            ],
            default => [
                'title' => class_basename($type) ?: 'Notification',
                'body'  => '',
                'href'  => null,
                'tone'  => 'muted',
            ],
        };
    }

    /**
     * Compliance status for the logged-in agent. Used by the agent layout to
     * render the global banner that nags about missing / expiring FFCs.
     */
    private function ffcStatus(Request $request): ?array
    {
        $user = $request->user();
        if (! $user) return null;

        $pivot = AgencyAgent::where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if (! $pivot) return null;

        $now = CarbonImmutable::now()->startOfDay();
        $daysLeft = $pivot->ffc_expires_at
            ? (int) round($now->diffInDays($pivot->ffc_expires_at->startOfDay(), false))
            : null;

        $state = match (true) {
            empty($pivot->ffc_number) || ! $pivot->ffc_expires_at => 'missing',
            $daysLeft !== null && $daysLeft < 0                   => 'expired',
            $daysLeft !== null && $daysLeft <= 30                 => 'expiring',
            default                                                => 'valid',
        };

        return [
            'state'     => $state,
            'days_left' => $daysLeft,
            'expires_at'=> $pivot->ffc_expires_at?->format('d M Y'),
        ];
    }
}
