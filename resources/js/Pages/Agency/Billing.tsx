import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import { Spinner } from '@/Components/Skeleton';
import { PageHeader, SectionCard, SummaryStrip } from '@/Components/Dashboard/Charts';

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

            <div className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Billing & Plan"
                    subtitle="Choose the subscription that fits your agency. Prices are set by the platform and update here automatically."
                />

                <SummaryStrip
                    title="Subscription Summary"
                    subtitle={current ? current.headline : 'Pick a plan below to activate billing on your agency'}
                    cells={current ? [
                        { label: 'Current Plan', value: current.name.replace(/^Agency · /, ''), sub: current.headline },
                        { label: 'Monthly Cost', value: `R ${fmtPrice(current.price)}`, sub: 'Billed monthly', tone: 'muted' },
                        { label: 'Renews', value: current.expires_at ?? '—', sub: 'Next billing date', tone: 'muted' },
                        { label: 'Status', value: 'Active', sub: `${current.features.length} features included`, tone: 'success' },
                    ] : [
                        { label: 'Current Plan', value: 'None', sub: 'No active subscription', tone: 'danger' },
                        { label: 'Plans Available', value: String(plans.length), sub: 'Choose one below', tone: 'muted' },
                        { label: 'From', value: plans.length ? `R ${fmtPrice(Math.min(...plans.map((pl) => pl.price)))}` : '—', sub: 'Per month', tone: 'muted' },
                        { label: 'Status', value: 'Inactive', sub: 'Billing not activated', tone: 'warning' },
                    ]}
                />

                {/* Plan grid */}
                <SectionCard title="Available Plans" subtitle="Switch at any time; the new price applies from your next billing date">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-2">
                    {plans.map((p) => {
                        const isCurrent = current?.key === p.key;
                        return (
                            <div
                                key={p.key}
                                className={
                                    'relative bg-white rounded-2xl p-5 shadow-soft transition ' +
                                    (isCurrent
                                        ? 'border-2 border-success shadow-lift'
                                        : p.popular
                                            ? 'border-2 border-brand-500 shadow-lift'
                                            : 'border border-ink-200/70 hover:shadow-lift')
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

                                <p className="text-[15px] font-semibold tracking-tight mb-3">{p.name}</p>

                                <div className="flex items-baseline gap-1 mb-1">
                                    <span className="text-lg font-bold text-ink-500">R</span>
                                    <span className="text-[34px] font-semibold tracking-tight leading-none tabular-nums">{fmtPrice(p.price)}</span>
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
                                        'w-full py-2.5 text-[12.5px] rounded-full font-semibold transition inline-flex items-center justify-center gap-2 ' +
                                        (isCurrent
                                            ? 'bg-success/10 text-success cursor-default'
                                            : p.popular
                                                ? 'bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-60'
                                                : 'border border-ink-300 hover:bg-ink-50 disabled:opacity-60')
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
                </SectionCard>

                <p className="text-[12px] text-ink-500 mt-2">
                    Pricing is set by the Property Basket platform team. You'll always see the current published prices here.
                </p>
            </div>
        </AgencyLayout>
    );
}
