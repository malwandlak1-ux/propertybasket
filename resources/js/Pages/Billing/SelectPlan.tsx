import { FormEvent, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AppLogo from '@/Components/AppLogo';
import { Spinner } from '@/Components/Skeleton';

type Plan = {
    key: string;
    name: string;
    price: number;
    headline: string;
    features: string[];
    popular: boolean;
};

type Props = {
    user: { name: string; email: string };
    audience: 'agency' | 'landlord';
    plans: Plan[];
    subscription: {
        active: boolean;
        expired: boolean;
        is_promo: boolean;
        plan: string | null;
        expires_at: string | null;
        days_remaining: number | null;
    };
};

export default function SelectPlan() {
    const { props } = usePage<{ flash: { success?: string; error?: string } } & Props>();
    const { user, audience, plans, subscription, flash } = props as unknown as Props & {
        flash: { success?: string; error?: string };
    };

    const [paying, setPaying] = useState<string | null>(null);
    const [promo, setPromo] = useState('');
    const [applying, setApplying] = useState(false);

    function pay(planKey: string) {
        setPaying(planKey);
        router.post('/billing/checkout', { plan_key: planKey }, { onFinish: () => setPaying(null) });
    }

    function applyPromo(e: FormEvent) {
        e.preventDefault();
        if (!promo.trim()) return;
        setApplying(true);
        router.post('/billing/promo', { promo_code: promo }, { onFinish: () => setApplying(false) });
    }

    const renewing = subscription.expired || subscription.active;

    return (
        <div className="min-h-screen bg-ink-50">
            <Head title="Choose your plan" />

            {/* Top bar */}
            <header className="bg-white border-b border-ink-200">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <AppLogo height={22} href="/" />
                    <div className="flex items-center gap-4 text-[13px]">
                        <span className="text-ink-500 hidden sm:inline">{user.email}</span>
                        <Link href="/logout" method="post" as="button" className="text-ink-500 hover:text-ink-900">
                            Log out
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-10">
                <div className="max-w-2xl">
                    <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">
                        {renewing ? 'Renew your subscription' : 'Activate your account'}
                    </p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight">
                        {renewing ? 'Renew to keep your access' : `Choose a plan, ${user.name.split(' ')[0]}`}
                    </h1>
                    <p className="mt-3 text-[14px] text-ink-500">
                        {renewing
                            ? subscription.expired
                                ? 'Your access has expired. Pick a plan or apply a promo code to get back in.'
                                : `Your access is active until ${subscription.expires_at}. Renew any time.`
                            : 'Your account is ready — select a plan or apply a promo code to unlock your dashboard.'}
                    </p>
                </div>

                {flash?.error && (
                    <div className="mt-6 bg-danger/5 border border-danger/30 text-danger rounded-xl p-3.5 text-[13px]">
                        {flash.error}
                    </div>
                )}
                {flash?.success && (
                    <div className="mt-6 bg-success/5 border border-success/30 text-success rounded-xl p-3.5 text-[13px]">
                        {flash.success}
                    </div>
                )}

                {/* Plan cards */}
                <div className={'mt-8 grid gap-5 ' + (plans.length >= 3 ? 'md:grid-cols-3' : 'sm:grid-cols-2 max-w-3xl')}>
                    {plans.map((plan) => (
                        <div
                            key={plan.key}
                            className={
                                'relative bg-white rounded-2xl border p-6 shadow-soft flex flex-col ' +
                                (plan.popular ? 'border-brand-500 ring-1 ring-brand-500/30' : 'border-ink-200')
                            }
                        >
                            {plan.popular && (
                                <span className="absolute -top-3 left-6 bg-brand-500 text-white text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                                    Most popular
                                </span>
                            )}
                            <h3 className="text-[16px] font-bold">{plan.name}</h3>
                            <p className="text-[12.5px] text-ink-500 mt-0.5">{plan.headline}</p>
                            <div className="mt-4 flex items-end gap-1">
                                <span className="text-3xl font-bold tracking-tight">R{plan.price.toLocaleString('en-ZA')}</span>
                                <span className="text-[13px] text-ink-400 mb-1">/month</span>
                            </div>
                            <ul className="mt-4 space-y-2 flex-1">
                                {plan.features.map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-[13px] text-ink-700">
                                        <svg className="w-4 h-4 text-success mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                            <path d="M5 13l4 4L19 7" />
                                        </svg>
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={() => pay(plan.key)}
                                disabled={paying !== null}
                                className="mt-6 w-full py-2.5 bg-brand-500 text-white rounded-lg font-semibold text-[13px] hover:bg-brand-600 disabled:opacity-50 inline-flex items-center justify-center gap-2 transition"
                            >
                                {paying === plan.key ? <><Spinner size={14} />Redirecting…</> : 'Pay & activate'}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Promo code */}
                <div className="mt-8 bg-white rounded-2xl border border-ink-200 p-6 shadow-soft max-w-xl">
                    <h3 className="text-[15px] font-bold">Have a promo code?</h3>
                    <p className="text-[12.5px] text-ink-500 mt-0.5">
                        Enter it below to unlock full free access for the code's duration. No payment needed.
                    </p>
                    <form onSubmit={applyPromo} className="mt-4 flex gap-2">
                        <input
                            value={promo}
                            onChange={(e) => setPromo(e.target.value.toUpperCase())}
                            placeholder="e.g. PBLAUNCH"
                            className="flex-1 bg-white border border-ink-200 rounded-lg px-3 py-2.5 text-[14px] tracking-wider uppercase placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
                        />
                        <button
                            type="submit"
                            disabled={applying || !promo.trim()}
                            className="px-5 py-2.5 bg-ink-900 text-white rounded-lg font-semibold text-[13px] hover:bg-ink-800 disabled:opacity-50 inline-flex items-center gap-2 transition"
                        >
                            {applying ? <><Spinner size={14} />Applying…</> : 'Apply code'}
                        </button>
                    </form>
                </div>

                <p className="mt-6 text-[12px] text-ink-400">
                    Payments are processed securely via Paystack. You can change plans later from your dashboard billing page.
                </p>
            </main>
        </div>
    );
}
