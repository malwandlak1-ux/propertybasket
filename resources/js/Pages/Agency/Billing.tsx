import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
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
    payment_methods: string[];
};

type Period = 'monthly' | 'yearly';

function fmtPrice(n: number) {
    return n.toLocaleString('en-ZA');
}
const short = (name: string) => name.replace(/^Agency · /, '');

export default function AgencyBilling({ agency, current, plans, yearly_discount, payment_methods }: Props) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const [period, setPeriod] = useState<Period>(current?.period ?? 'monthly');
    const yearly = period === 'yearly';
    const currentPlan = current ? plans.find((p) => p.key === current.key) : undefined;

    const [checkout, setCheckout] = useState<{ plan: Plan; period: Period } | null>(null);

    function choose(p: Plan) {
        const isCurrent = current?.key === p.key && current.period === period;
        if (isCurrent) return;
        setCheckout({ plan: p, period });
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

                                    <button type="button" onClick={() => choose(p)} disabled={isCurrent}
                                        className={`w-full py-3 text-[13px] rounded-full font-semibold transition inline-flex items-center justify-center gap-2 ${isCurrent
                                            ? (dark ? 'bg-white/10 text-white cursor-default' : 'bg-success/10 text-success cursor-default')
                                            : dark
                                                ? 'bg-white text-ink-900 hover:bg-brand-50 disabled:opacity-60'
                                                : 'border border-ink-300 hover:bg-ink-50 disabled:opacity-60'}`}>
                                        {isCurrent
                                            ? 'Active plan'
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
                            ? 'Yearly plans are paid upfront and add 12 months to your subscription, starting from your current renewal date.'
                            : 'Monthly plans are paid upfront and add a month to your subscription, starting from your current renewal date.'}
                        {' '}Payments are processed securely by Paystack.
                    </p>
                </section>
            </div>
            {checkout && (
                <CheckoutModal
                    plan={checkout.plan}
                    period={checkout.period}
                    discount={yearly_discount}
                    methods={payment_methods}
                    renewsFrom={current?.expires_at ?? null}
                    onClose={() => setCheckout(null)}
                />
            )}
        </AgencyLayout>
    );
}

/** Paystack checkout channels we can offer, in display order. */
const METHODS: Record<string, { label: string; sub: string; icon: ReactNode }> = {
    card: {
        label: 'Card',
        sub: 'Visa, Mastercard, American Express',
        icon: <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7ZM3 10h18M7 15h3" />,
    },
    eft: {
        label: 'Instant EFT',
        sub: 'Pay from your bank account, no card needed',
        icon: <path d="M3 10 12 4l9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" />,
    },
    capitec_pay: {
        label: 'Capitec Pay',
        sub: 'Approve the payment in your Capitec app',
        icon: <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM11 18h2M9.5 11l2 2 3.5-4" />,
    },
    apple_pay: {
        label: 'Apple Pay',
        sub: 'On Safari with a card in Apple Wallet',
        icon: <path d="M15.5 4.5c-.9.1-2 .7-2.6 1.5-.6.7-1 1.7-.9 2.6 1 .1 2-.5 2.6-1.3.6-.8 1-1.8.9-2.8ZM18.4 15.6c-.5 1.1-.7 1.6-1.4 2.6-.9 1.4-2.2 3.1-3.8 3.1-1.4 0-1.8-.9-3.7-.9s-2.3.9-3.7.9C4.3 21.3 3 19.8 2.1 18.4-.4 14.5 0 9.9 2 7.7 3 6.6 4.5 5.9 5.9 5.9c1.5 0 2.4.9 3.7.9 1.2 0 1.9-.9 3.7-.9 1.3 0 2.6.7 3.6 1.9-3.2 1.7-2.7 6.3-.5 7.8Z" />,
    },
    qr: {
        label: 'Scan to Pay',
        sub: 'Scan a QR code with your banking or SnapScan app',
        icon: <path d="M4 4h6v6H4V4ZM14 4h6v6h-6V4ZM4 14h6v6H4v-6ZM14 14h2v2h-2zM18 14h2M14 18h2v2M18 18h2v2h-2" />,
    },
};

function CheckoutModal({ plan, period, discount, methods, renewsFrom, onClose }: {
    plan: Plan;
    period: Period;
    discount: number;
    methods: string[];
    renewsFrom: string | null;
    onClose: () => void;
}) {
    const options = methods.filter((m) => METHODS[m]);
    const [method, setMethod] = useState(options[0] ?? 'card');
    const [paying, setPaying] = useState(false);
    const { flash, errors } = usePage<{ flash?: { error?: string | null }; errors?: Record<string, string> }>().props;
    const problem = errors?.channel || errors?.plan_key || flash?.error;
    const yearly = period === 'yearly';
    const total = yearly ? plan.yearly_total : plan.price;

    useEffect(() => {
        const esc = (e: KeyboardEvent) => e.key === 'Escape' && !paying && onClose();
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [paying, onClose]);

    function pay() {
        setPaying(true);
        // The server answers with an Inertia location to Paystack's hosted checkout.
        router.post('/billing/checkout', { plan_key: plan.key, period, channel: method }, {
            preserveScroll: true,
            onError: () => setPaying(false),
            onFinish: () => setPaying(false),
        });
    }

    return (
        <div className="fixed inset-0 z-50 bg-ink-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !paying && onClose()}>
            <div role="dialog" aria-modal="true" aria-labelledby="checkout-title" onClick={(e) => e.stopPropagation()}
                className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-lift max-h-[94vh] overflow-y-auto pb-rise">
                <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-600">Checkout</p>
                        <h2 id="checkout-title" className="text-[22px] font-semibold mt-1">{short(plan.name)} · {yearly ? 'Yearly' : 'Monthly'}</h2>
                    </div>
                    <button type="button" onClick={onClose} disabled={paying} aria-label="Close"
                        className="w-9 h-9 rounded-full border border-ink-200 flex items-center justify-center text-ink-500 hover:text-ink-900 shrink-0">✕</button>
                </div>

                {/* Order summary */}
                <div className="mx-6 rounded-2xl bg-ink-50 border border-ink-200/70 p-4 text-[13px] space-y-2">
                    <div className="flex justify-between gap-3">
                        <span className="text-ink-600">{short(plan.name)} plan, {yearly ? '12 months' : '1 month'}</span>
                        <span className="font-semibold tabular-nums">R {fmtPrice(yearly ? plan.price * 12 : plan.price)}</span>
                    </div>
                    {yearly && (
                        <div className="flex justify-between gap-3 text-success">
                            <span>Yearly discount ({discount}%)</span>
                            <span className="font-semibold tabular-nums">− R {fmtPrice(plan.price * 12 - plan.yearly_total)}</span>
                        </div>
                    )}
                    <div className="flex justify-between gap-3 pt-2 border-t border-ink-200 text-[15px]">
                        <span className="font-semibold">Due today</span>
                        <span className="font-bold tabular-nums">R {fmtPrice(total)}</span>
                    </div>
                    <p className="text-[11.5px] text-ink-500">
                        {yearly ? 'Adds 12 months' : 'Adds 1 month'} to your subscription{renewsFrom ? `, from your current renewal date (${renewsFrom})` : ''}.
                    </p>
                </div>

                {/* Payment method */}
                <fieldset className="px-6 pt-5">
                    <legend className="text-[13px] font-semibold text-ink-800 mb-2.5">Payment method</legend>
                    <div className="space-y-2">
                        {options.map((m) => {
                            const o = METHODS[m];
                            const on = method === m;
                            return (
                                <label key={m} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition ${on ? 'border-brand-500 bg-brand-50/60 ring-4 ring-brand-100' : 'border-ink-200 hover:border-ink-300'}`}>
                                    <input type="radio" name="payment_method" value={m} checked={on} onChange={() => setMethod(m)} className="sr-only" />
                                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${on ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600'}`}>
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{o.icon}</svg>
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[13.5px] font-semibold">{o.label}</span>
                                        <span className="block text-[11.5px] text-ink-500">{o.sub}</span>
                                    </span>
                                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? 'border-brand-500' : 'border-ink-300'}`}>
                                        {on && <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

                <div className="px-6 pt-5 pb-6">
                    {problem && !paying && <p className="mb-3 rounded-xl bg-danger/10 border border-danger/30 text-danger px-3.5 py-2.5 text-[12.5px]">{problem}</p>}
                    <button type="button" onClick={pay} disabled={paying}
                        className="w-full py-3.5 rounded-full bg-ink-900 text-white text-[14px] font-semibold hover:bg-ink-800 disabled:opacity-60 inline-flex items-center justify-center gap-2">
                        {paying ? <><Spinner size={14} />Opening secure checkout…</> : <>Pay R {fmtPrice(total)}</>}
                    </button>
                    <p className="text-[11.5px] text-ink-500 text-center mt-3 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                        You’ll finish paying on Paystack’s secure page. Your plan updates as soon as the payment clears.
                    </p>
                </div>
            </div>
        </div>
    );
}
