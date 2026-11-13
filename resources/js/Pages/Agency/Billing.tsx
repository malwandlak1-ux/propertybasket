import { Head, router, usePage } from '@inertiajs/react';
import { useState, type CSSProperties } from 'react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import { Spinner } from '@/Components/Skeleton';
import { FlashBanners, PageHeader, SummaryStrip } from '@/Components/Dashboard/Charts';
import RollingNumber from '@/Components/RollingNumber';

type Plan = {
    key: string;
    name: string;
    audience: string;
    price: number;
    yearly_total: number;
    yearly_monthly: number;
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
    period: 'monthly' | 'yearly';
};

type Props = {
    agency: { id: number; name: string };
    current: Current | null;
    plans: Plan[];
    yearly_discount: number;
};

type Period = 'monthly' | 'yearly';

function fmtPrice(n: number) {
    return n.toLocaleString('en-ZA');
}
const short = (name: string) => name.replace(/^Agency · /, '');

export default function AgencyBilling({ agency, current, plans, yearly_discount }: Props) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const [period, setPeriod] = useState<Period>(current?.period ?? 'monthly');
    const [busy, setBusy] = useState<string | null>(null);
    const yearly = period === 'yearly';
    const currentPlan = current ? plans.find((p) => p.key === current.key) : undefined;

    function choose(p: Plan) {
        const isCurrent = current?.key === p.key && current.period === period;
        if (isCurrent) return;
        if (yearly) {
            if (!confirm(`Pay R ${fmtPrice(p.yearly_total)} now for 12 months of ${short(p.name)}?\n\nThat's ${yearly_discount}% off the monthly price (R ${fmtPrice(p.price * 12)} a year). You'll go to Paystack to pay.`)) return;
            setBusy(p.key);
            router.post('/billing/checkout', { plan_key: p.key, period: 'yearly' }, { onFinish: () => setBusy(null) });
            return;
        }
        if (!confirm(`Switch your agency's subscription to "${short(p.name)}" at R ${fmtPrice(p.price)} a month?`)) return;
        setBusy(p.key);
        router.post('/agency/billing/switch', { plan_key: p.key }, { onFinish: () => setBusy(null) });
    }

    return (
        <AgencyLayout crumb="Billing & Plan" agencyName={agency.name}>
            <Head title="Billing & Plan" />

            <div className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Billing & Plan"
                    subtitle="Choose the subscription that fits your agency. Prices are set by the platform and update here automatically."
                />
                <FlashBanners flash={flash} />

                <SummaryStrip
                    title="Subscription Summary"
                    subtitle={current ? current.headline : 'Pick a plan below to activate billing on your agency'}
                    cells={current ? [
                        { label: 'Current Plan', value: short(current.name), sub: current.headline },
                        current.period === 'yearly' && currentPlan
                            ? { label: 'Yearly Cost', value: `R ${fmtPrice(currentPlan.yearly_total)}`, sub: `Billed yearly · ${yearly_discount}% off`, tone: 'muted' }
                            : { label: 'Monthly Cost', value: `R ${fmtPrice(current.price)}`, sub: 'Billed monthly', tone: 'muted' },
                        { label: 'Renews', value: current.expires_at ?? '—', sub: 'Next billing date', tone: 'muted' },
                        { label: 'Status', value: 'Active', sub: `${current.features.length} features included`, tone: 'success' },
                    ] : [
                        { label: 'Current Plan', value: 'None', sub: 'No active subscription', tone: 'danger' },
                        { label: 'Plans Available', value: String(plans.length), sub: 'Choose one below', tone: 'muted' },
                        { label: 'From', value: plans.length ? `R ${fmtPrice(Math.min(...plans.map((pl) => pl.yearly_monthly)))}` : '—', sub: 'Per month, billed yearly', tone: 'muted' },
                        { label: 'Status', value: 'Inactive', sub: 'Billing not activated', tone: 'warning' },
                    ]}
                />

                <section className="bg-white rounded-3xl border border-ink-200/60 shadow-soft px-4 sm:px-8 pt-8 pb-8 pb-rise">
                    <div className="text-center max-w-xl mx-auto">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-600">Plans</p>
                        <h2 className="text-[30px] sm:text-[36px] font-semibold mt-1">Pick your plan</h2>
                        <p className="text-[13px] text-ink-500 mt-2">Pay monthly, or pay for the year upfront and save {yearly_discount}%.</p>
                    </div>

                    {/* Monthly / Yearly switch */}
                    <div className="flex justify-center items-center gap-3 mt-6">
                        <div role="radiogroup" aria-label="Billing period" className="relative inline-grid grid-cols-2 p-1 rounded-full bg-ink-100 border border-ink-200/70">
                            <span aria-hidden className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-soft transition-transform duration-[400ms] ease-[cubic-bezier(.34,1.3,.64,1)]"
                                style={{ transform: yearly ? 'translateX(100%)' : 'translateX(0)' }} />
                            {(['monthly', 'yearly'] as const).map((p) => (
                                <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}
                                    className={`relative z-10 px-6 py-2 rounded-full text-[13px] font-semibold capitalize transition-colors ${period === p ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                        <span className={`pb-pop inline-block text-[11px] font-bold px-2.5 py-1 rounded-full bg-success/15 text-success whitespace-nowrap ${yearly ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} aria-hidden={!yearly}>
                            Save {yearly_discount}%
                        </span>
                    </div>

                    {/* Plan cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-8 max-w-5xl mx-auto items-stretch">
                        {plans.map((p) => {
                            const isCurrent = current?.key === p.key && current.period === period;
                            const sameTier = current?.key === p.key;
                            const dark = !!p.popular;
                            const perMonth = yearly ? p.yearly_monthly : p.price;
                            return (
                                <div key={p.key}
                                    className={`relative flex flex-col rounded-2xl p-6 transition ${dark
                                        ? 'bg-ink-900 text-white shadow-lift md:-translate-y-1'
                                        : 'bg-white border border-ink-200/70 shadow-soft hover:shadow-lift'} ${isCurrent ? 'ring-2 ring-success ring-offset-2' : ''}`}>
                                    <div className="flex items-center justify-between gap-2 mb-5">
                                        <p className="pb-shimmer text-[15px] font-semibold tracking-tight"
                                            style={dark ? ({ '--shimmer-base': '#fff', '--shimmer-light': 'var(--color-brand-300)' } as CSSProperties) : undefined}>
                                            {short(p.name)}
                                        </p>
                                        {isCurrent
                                            ? <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-success text-white">CURRENT</span>
                                            : p.popular && <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-brand-500 text-white">POPULAR</span>}
                                    </div>

                                    <div className="flex items-baseline gap-1.5">
                                        <span className={`text-[15px] font-semibold ${dark ? 'text-white/60' : 'text-ink-500'}`}>ZAR</span>
                                        <RollingNumber value={perMonth} className="text-[44px] font-semibold tracking-tight" />
                                        <span className={`text-[13px] ${dark ? 'text-white/60' : 'text-ink-500'}`}>/mo</span>
                                    </div>
                                    <p className={`text-[12px] mt-2 min-h-[18px] ${dark ? 'text-white/60' : 'text-ink-500'}`}>
                                        {yearly
                                            ? <><span className={`line-through mr-1.5 ${dark ? 'text-white/40' : 'text-ink-400'}`}>R {fmtPrice(p.price * 12)}</span>R {fmtPrice(p.yearly_total)} billed yearly</>
                                            : 'Billed monthly'}
                                    </p>

                                    <p className={`text-[13px] font-semibold mt-5 ${dark ? 'text-white' : 'text-ink-800'}`}>{p.headline}</p>
                                    <ul className={`text-[12.5px] space-y-2.5 mt-3 mb-6 flex-1 ${dark ? 'text-white/80' : 'text-ink-700'}`}>
                                        {p.features.map((f) => (
                                            <li key={f} className={`flex items-start gap-2 pb-2.5 border-b last:border-0 ${dark ? 'border-white/10' : 'border-ink-100'}`}>
                                                <svg className={`w-4 h-4 mt-px shrink-0 ${dark ? 'text-brand-300' : 'text-success'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="m5 12 5 5L20 7" /></svg>
                                                <span>{f}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <button type="button" onClick={() => choose(p)} disabled={isCurrent || busy === p.key}
                                        className={`w-full py-3 text-[13px] rounded-full font-semibold transition inline-flex items-center justify-center gap-2 ${isCurrent
                                            ? (dark ? 'bg-white/10 text-white cursor-default' : 'bg-success/10 text-success cursor-default')
                                            : dark
                                                ? 'bg-white text-ink-900 hover:bg-brand-50 disabled:opacity-60'
                                                : 'border border-ink-300 hover:bg-ink-50 disabled:opacity-60'}`}>
                                        {busy === p.key && <Spinner size={12} />}
                                        {isCurrent
                                            ? 'Active plan'
                                            : busy === p.key
                                                ? (yearly ? 'Opening Paystack…' : 'Switching…')
                                                : yearly
                                                    ? (sameTier ? 'Switch to yearly billing' : `Get ${short(p.name)} yearly`)
                                                    : current ? `Switch to ${short(p.name)}` : `Choose ${short(p.name)}`}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <p className="text-center text-[12px] text-ink-500 mt-6">
                        {yearly
                            ? 'Yearly plans are paid upfront through Paystack and add 12 months to your subscription, starting from your current renewal date.'
                            : 'Switch at any time; the new price applies from your next billing date.'}
                    </p>
                </section>
            </div>
        </AgencyLayout>
    );
}
