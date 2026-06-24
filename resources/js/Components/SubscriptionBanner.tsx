import { Link, usePage } from '@inertiajs/react';

type SubscriptionShared = {
    subscription?: {
        active: boolean;
        expired: boolean;
        is_promo: boolean;
        plan: string | null;
        expires_at: string | null;
        days_remaining: number | null;
        reminder: boolean;
    } | null;
};

/**
 * Dashboard renewal reminder for agencies & landlords. Appears once their
 * subscription (paid or promo) has 15 days or fewer remaining. Expiry itself is
 * handled by the EnsureSubscribed gate, which redirects to the renewal page.
 */
export default function SubscriptionBanner() {
    const { subscription } = usePage<SubscriptionShared>().props;
    if (!subscription || !subscription.reminder) return null;

    const days = subscription.days_remaining ?? 0;
    const urgent = days <= 5;
    const source = subscription.is_promo ? 'promo access' : 'subscription';

    return (
        <div
            className={
                'mx-4 sm:mx-8 mt-4 rounded-lg border px-4 py-3 flex items-center gap-3 text-[13px] ' +
                (urgent
                    ? 'bg-danger/5 border-danger/30 text-danger'
                    : 'bg-warning/10 border-warning/30 text-warning')
            }
        >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
            <span className="flex-1">
                Your {source} {days <= 0 ? 'expires today' : `expires in ${days} day${days === 1 ? '' : 's'}`}
                {subscription.expires_at ? ` (${subscription.expires_at})` : ''}. Renew now to avoid losing access.
            </span>
            <Link
                href="/billing/select"
                className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
            >
                Renew
            </Link>
        </div>
    );
}
