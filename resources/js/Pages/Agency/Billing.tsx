import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import { Spinner } from '@/Components/Skeleton';

type Plan = {
    key: string;
    name: string;
    audience: string;
    price: number;
    headline: string;
    features: string[];
    popular?: boolean;
};

type Current = {
    key: string;
    name: string;
    price: number;
    headline: string;
    features: string[];
    expires_at: string | null;
};

type Props = {
    agency: { id: number; name: string };
    current: Current | null;
    plans: Plan[];
};

function fmtPrice(n: number) {
    return n.toLocaleString('en-ZA');
}

export default function AgencyBilling({ agency, current, plans }: Props) {
    const [switching, setSwitching] = useState<string | null>(null);

    function switchPlan(key: string) {
        const label = plans.find((p) => p.key === key)?.name ?? key;
        if (current?.key === key) return;
        if (! confirm(`Switch your agency's subscription to "${label}"?`)) return;
        setSwitching(key);
        router.post('/agency/billing/switch', { plan_key: key }, {
            onFinish: () => setSwitching(null),
        });
    }

    return (
        <AgencyLayout crumb="Billing & Plan" agencyName={agency.name}>
            <Head title="Billing & Plan" />

            <div className="px-8 py-7">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Billing &amp; Plan</h1>
                    <p className="text-[14px] text-ink-500 mt-1">
                        Choose the subscription that fits your agency. Pricing is set by the platform admin and updates here automatically.
                    </p>
                </div>

                {/* Current plan summary */}
                {current ? (
                    <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5 mb-6 flex items-center gap-5 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                            <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">Current plan</p>
                            <p className="text-lg font-bold mt-0.5">{current.name}</p>
                            <p className="text-[12px] text-ink-500">{current.headline}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">Monthly cost</p>
                            <p className="text-2xl font-bold mt-0.5 font-mono">R{fmtPrice(current.price)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">Renews</p>
                            <p className="text-[13px] font-semibold mt-0.5">{current.expires_at ?? '—'}</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-warning/10 border border-warning/30 text-warning rounded-xl p-4 mb-6">
                        <p className="font-bold text-[14px]">No active subscription</p>
                        <p className="text-[13px] mt-1">Pick a plan below to activate billing on your agency.</p>
                    </div>
                )}

                {/* Plan grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {plans.map((p) => {
                        const isCurrent = current?.key === p.key;
                        return (
                            <div
                                key={p.key}
                                className={
                                    'relative bg-white rounded-xl p-5 shadow-soft transition ' +
                                    (isCurrent
                                        ? 'border-2 border-success shadow-card'
                                        : p.popular
                                            ? 'border-2 border-brand-500 shadow-card'
                                            : 'border border-ink-200 hover:shadow-card')
                                }
                            >
                                {isCurrent && (
                                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] bg-success text-white px-2 py-0.5 rounded-full font-bold tracking-wide">
                                        CURRENT
                                    </span>
                                )}
                                {! isCurrent && p.popular && (
                                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] bg-brand-500 text-white px-2 py-0.5 rounded-full font-bold tracking-wide">
                                        POPULAR
                                    </span>
                                )}

                                <p className="text-[14px] font-bold mb-3">{p.name}</p>

                                <div className="flex items-baseline gap-1 mb-1">
                                    <span className="text-lg font-bold text-ink-500">R</span>
                                    <span className="text-3xl font-bold">{fmtPrice(p.price)}</span>
                                    <span className="text-[12px] text-ink-500">/mo</span>
                                </div>
                                <p className="text-[12px] text-ink-500 mb-4">{p.headline}</p>

                                <ul className="text-[12px] space-y-1.5 mb-5 text-ink-700 min-h-[80px]">
                                    {p.features.map((f) => (
                                        <li key={f} className="flex items-start gap-1.5">
                                            <span className="text-success font-bold">✓</span>
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => switchPlan(p.key)}
                                    disabled={isCurrent || switching === p.key}
                                    className={
                                        'w-full py-2.5 text-[12.5px] rounded-lg font-semibold transition inline-flex items-center justify-center gap-2 ' +
                                        (isCurrent
                                            ? 'bg-ink-100 text-ink-500 cursor-default'
                                            : p.popular
                                                ? 'bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60'
                                                : 'border border-ink-200 hover:bg-ink-50 disabled:opacity-60')
                                    }
                                >
                                    {switching === p.key && <Spinner size={12} />}
                                    {isCurrent
                                        ? 'Active plan'
                                        : switching === p.key
                                            ? 'Switching…'
                                            : current
                                                ? `Switch to ${p.name.replace(/^Agency · /, '')}`
                                                : 'Choose this plan'}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <p className="text-[12px] text-ink-500 mt-6">
                    Pricing is set by the Property Basket platform team. You'll always see the current published prices here.
                </p>
            </div>
        </AgencyLayout>
    );
}
