import { FormEvent, useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Spinner } from '@/Components/Skeleton';

type Plan = {
    key: string;
    name: string;
    audience: string;
    price: number;
    headline: string;
    features: string[];
    popular: boolean;
    subs: number;
    mrr: number;
};

type Props = {
    plans: Plan[];
    contractor_fee_percent: number;
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

function fmtPrice(n: number) {
    return n.toLocaleString('en-ZA');
}

export default function AdminSubscriptions({ plans, contractor_fee_percent }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [editing, setEditing] = useState<string | null>(null);

    return (
        <AdminLayout crumb="Subscriptions" section="Financials">
            <Head title="Subscription Plans" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Subscription Plans</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Adjust pricing and features · changes propagate to every agency's Billing &amp; Plan tab on next load
                        </p>
                    </div>
                </div>

                {flash?.success && (
                    <div className="mb-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                        {flash.success}
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {plans.map((p) => (
                        <PlanCard
                            key={p.key}
                            plan={p}
                            isEditing={editing === p.key}
                            onEdit={() => setEditing(p.key)}
                            onClose={() => setEditing(null)}
                        />
                    ))}
                </div>

                <div className="mt-6 bg-brand-50 border border-brand-100 rounded-xl p-4 flex items-start gap-3">
                    <svg className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4M12 8h.01"/>
                    </svg>
                    <p className="text-[12.5px] text-ink-700">
                        Contractors join free — you can optionally charge a <strong>platform fee per completed job</strong>{' '}
                        (currently <strong>{contractor_fee_percent}%</strong> of invoice value) instead of a subscription.
                        Edit this under <a href="/admin/settings" className="text-brand-600 font-semibold hover:underline">Platform Settings → Fees</a>.
                    </p>
                </div>
            </div>
        </AdminLayout>
    );
}

function PlanCard({ plan, isEditing, onEdit, onClose }: { plan: Plan; isEditing: boolean; onEdit: () => void; onClose: () => void }) {
    if (isEditing) {
        return <PlanEditor plan={plan} onClose={onClose} />;
    }
    return (
        <div
            className={
                'relative bg-white rounded-xl p-5 shadow-soft transition ' +
                (plan.popular ? 'border-2 border-brand-500 shadow-card' : 'border border-ink-200 hover:shadow-card')
            }
        >
            {plan.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] bg-brand-500 text-white px-2 py-0.5 rounded-full font-bold tracking-wide">
                    POPULAR
                </span>
            )}
            <span className="absolute top-4 right-4 text-[10px] bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full font-semibold">
                {plan.subs} {plan.subs === 1 ? 'sub' : 'subs'}
            </span>

            <p className="text-[14px] font-bold mb-3 pr-16">{plan.name}</p>

            <div className="flex items-baseline gap-1 mb-1">
                <span className="text-lg font-bold text-ink-500">R</span>
                <span className="text-3xl font-bold">{fmtPrice(plan.price)}</span>
                <span className="text-[12px] text-ink-500">/mo</span>
            </div>
            <p className="text-[12px] text-ink-500 mb-4">{plan.headline}</p>

            <ul className="text-[12px] space-y-1.5 mb-5 text-ink-700">
                {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                        <span className="text-success font-bold">✓</span>
                        <span>{f}</span>
                    </li>
                ))}
            </ul>

            <button
                onClick={onEdit}
                className={
                    'w-full py-2.5 text-[12.5px] rounded-lg font-semibold transition ' +
                    (plan.popular
                        ? 'bg-brand-500 text-white hover:bg-brand-600'
                        : 'border border-ink-200 hover:bg-ink-50')
                }
            >
                Edit plan
            </button>
        </div>
    );
}

function PlanEditor({ plan, onClose }: { plan: Plan; onClose: () => void }) {
    const { data, setData, patch, processing, errors } = useForm({
        name:       plan.name,
        price:      plan.price,
        headline:   plan.headline,
        features:   [...plan.features],
        is_popular: plan.popular,
    });

    function updateFeature(i: number, v: string) {
        setData('features', data.features.map((f, idx) => idx === i ? v : f));
    }
    function addFeature() {
        setData('features', [...data.features, '']);
    }
    function removeFeature(i: number) {
        setData('features', data.features.filter((_, idx) => idx !== i));
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        patch(`/admin/subscriptions/${plan.key}`, {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    }

    return (
        <form onSubmit={submit} className="relative bg-white rounded-xl p-5 border-2 border-brand-500 shadow-card space-y-3">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] bg-ink-900 text-white px-2 py-0.5 rounded-full font-bold tracking-wide">
                EDITING
            </span>

            <div>
                <label className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold block mb-1">Name</label>
                <input
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    className="w-full bg-ink-50 border border-ink-200 rounded-md px-2.5 py-1.5 text-[13px] font-semibold outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
                {errors.name && <p className="text-[11px] text-danger mt-0.5">{errors.name}</p>}
            </div>

            <div>
                <label className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold block mb-1">Price (R / month)</label>
                <input
                    type="number"
                    min={0}
                    value={data.price}
                    onChange={(e) => setData('price', Number(e.target.value))}
                    className="w-full bg-ink-50 border border-ink-200 rounded-md px-2.5 py-1.5 text-[18px] font-bold font-mono outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
                {errors.price && <p className="text-[11px] text-danger mt-0.5">{errors.price}</p>}
            </div>

            <div>
                <label className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold block mb-1">Headline</label>
                <input
                    value={data.headline}
                    onChange={(e) => setData('headline', e.target.value)}
                    className="w-full bg-ink-50 border border-ink-200 rounded-md px-2.5 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
                {errors.headline && <p className="text-[11px] text-danger mt-0.5">{errors.headline}</p>}
            </div>

            <div>
                <label className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold block mb-1">Features</label>
                <div className="space-y-1.5">
                    {data.features.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                            <input
                                value={f}
                                onChange={(e) => updateFeature(i, e.target.value)}
                                className="flex-1 bg-ink-50 border border-ink-200 rounded-md px-2 py-1 text-[12px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            />
                            <button type="button" onClick={() => removeFeature(i)} className="text-ink-400 hover:text-danger p-1">×</button>
                        </div>
                    ))}
                    <button type="button" onClick={addFeature} className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold">
                        + Add feature
                    </button>
                </div>
            </div>

            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                <input
                    type="checkbox"
                    checked={data.is_popular}
                    onChange={(e) => setData('is_popular', e.target.checked)}
                    className="rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="font-semibold">Show as "Popular"</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 text-[11px] border border-ink-200 rounded-md hover:bg-ink-100"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={processing}
                    className="px-3 py-1.5 text-[11px] bg-ink-900 text-white rounded-md hover:bg-ink-800 disabled:opacity-60 inline-flex items-center gap-1 font-semibold"
                >
                    {processing && <Spinner size={11} />}
                    {processing ? 'Saving…' : 'Save'}
                </button>
            </div>
        </form>
    );
}
