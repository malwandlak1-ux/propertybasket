import { FormEvent } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Spinner } from '@/Components/Skeleton';

type Code = {
    id: number;
    code: string;
    description: string | null;
    audience: 'agency' | 'landlord' | 'both';
    duration_days: number;
    max_redemptions: number | null;
    times_redeemed: number;
    redemptions: number;
    valid_until: string | null;
    is_active: boolean;
    is_expired: boolean;
};

type Props = { codes: Code[] };
type SharedProps = { flash?: { success?: string | null; error?: string | null } };

const audienceLabel: Record<string, string> = {
    agency: 'Agencies',
    landlord: 'Landlords',
    both: 'Agencies + Landlords',
};

export default function AdminPromoCodes({ codes }: Props) {
    const { flash } = usePage<SharedProps>().props;

    const form = useForm({
        code: '',
        description: '',
        audience: 'both',
        duration_days: 90,
        max_redemptions: '',
        valid_until: '',
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        form.post('/admin/promo-codes', { onSuccess: () => form.reset() });
    }

    function toggle(c: Code) {
        router.patch(`/admin/promo-codes/${c.id}/toggle`);
    }
    function destroy(c: Code) {
        if (confirm(`Delete promo code "${c.code}"? This cannot be undone.`)) {
            router.delete(`/admin/promo-codes/${c.id}`);
        }
    }

    const inputCls = 'w-full bg-white border border-ink-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition';
    // Selects need extra right padding so the native dropdown caret doesn't
    // crowd / overlap the option text (e.g. "Agencies + Landlords").
    const selectCls = 'w-full bg-white border border-ink-200 rounded-lg pl-3 pr-9 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition';

    return (
        <AdminLayout crumb="Promo Codes" section="Financials">
            <Head title="Promo Codes" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Promo Codes</h1>
                    <p className="text-[14px] text-ink-500 mt-1">
                        Issue full-access codes for agencies &amp; landlords. Each code grants free access for the set
                        duration; once it lapses the user is prompted to renew and can't reuse the same code.
                    </p>
                </div>

                {flash?.success && (
                    <div className="mb-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="mb-4 rounded-lg bg-danger/10 border border-danger/30 text-danger px-4 py-3 text-[13px]">
                        {flash.error}
                    </div>
                )}

                {/* Create form */}
                <form onSubmit={submit} className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft mb-6">
                    <h2 className="text-[15px] font-bold mb-4">Create a code</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="col-span-2 lg:col-span-1">
                            <label className="block text-[12px] font-semibold text-ink-700 mb-1">Code</label>
                            <input
                                value={form.data.code}
                                onChange={(e) => form.setData('code', e.target.value.toUpperCase())}
                                placeholder="PBLAUNCH"
                                className={inputCls + ' uppercase tracking-wider'}
                            />
                            {form.errors.code && <p className="text-danger text-[11px] mt-1">{form.errors.code}</p>}
                        </div>
                        <div className="col-span-2 lg:col-span-1">
                            <label className="block text-[12px] font-semibold text-ink-700 mb-1">Description</label>
                            <input
                                value={form.data.description}
                                onChange={(e) => form.setData('description', e.target.value)}
                                placeholder="Launch promo"
                                className={inputCls}
                            />
                        </div>
                        <div className="lg:col-span-2">
                            <label className="block text-[12px] font-semibold text-ink-700 mb-1">Audience</label>
                            <select value={form.data.audience} onChange={(e) => form.setData('audience', e.target.value)} className={selectCls}>
                                <option value="both">Agencies + Landlords</option>
                                <option value="agency">Agencies only</option>
                                <option value="landlord">Landlords only</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[12px] font-semibold text-ink-700 mb-1">Access (days)</label>
                            <input
                                type="number" min={1} max={3650}
                                value={form.data.duration_days}
                                onChange={(e) => form.setData('duration_days', Number(e.target.value))}
                                className={inputCls}
                            />
                            {form.errors.duration_days && <p className="text-danger text-[11px] mt-1">{form.errors.duration_days}</p>}
                        </div>
                        <div>
                            <label className="block text-[12px] font-semibold text-ink-700 mb-1">Max uses</label>
                            <input
                                type="number" min={1}
                                value={form.data.max_redemptions}
                                onChange={(e) => form.setData('max_redemptions', e.target.value)}
                                placeholder="∞"
                                className={inputCls}
                            />
                        </div>
                    </div>
                    <div className="flex items-end justify-between gap-3 mt-3">
                        <div className="w-48">
                            <label className="block text-[12px] font-semibold text-ink-700 mb-1">Redeemable until (optional)</label>
                            <input
                                type="date"
                                value={form.data.valid_until}
                                onChange={(e) => form.setData('valid_until', e.target.value)}
                                className={inputCls}
                            />
                            {form.errors.valid_until && <p className="text-danger text-[11px] mt-1">{form.errors.valid_until}</p>}
                        </div>
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="px-5 py-2 bg-brand-500 text-white rounded-lg font-semibold text-[13px] hover:bg-brand-600 disabled:opacity-50 inline-flex items-center gap-2 transition"
                        >
                            {form.processing ? <><Spinner size={14} />Creating…</> : '+ Create code'}
                        </button>
                    </div>
                    <p className="text-[11px] text-ink-400 mt-2">
                        "Access (days)" is how long a user keeps free access after redeeming — e.g. 90 = 3 months.
                    </p>
                </form>

                {/* Codes table */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                    <table className="w-full text-[13px]">
                        <thead className="bg-ink-50 text-ink-500 text-[11px] uppercase tracking-wider">
                            <tr>
                                <th className="text-left font-semibold px-4 py-3">Code</th>
                                <th className="text-left font-semibold px-4 py-3">Audience</th>
                                <th className="text-left font-semibold px-4 py-3">Access</th>
                                <th className="text-left font-semibold px-4 py-3">Used</th>
                                <th className="text-left font-semibold px-4 py-3">Redeemable until</th>
                                <th className="text-left font-semibold px-4 py-3">Status</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-100">
                            {codes.length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-400">No promo codes yet.</td></tr>
                            )}
                            {codes.map((c) => (
                                <tr key={c.id} className="hover:bg-ink-50/50">
                                    <td className="px-4 py-3">
                                        <span className="font-mono font-bold tracking-wider">{c.code}</span>
                                        {c.description && <p className="text-[11px] text-ink-400">{c.description}</p>}
                                    </td>
                                    <td className="px-4 py-3 text-ink-600">{audienceLabel[c.audience]}</td>
                                    <td className="px-4 py-3 text-ink-600">{c.duration_days} days</td>
                                    <td className="px-4 py-3 text-ink-600">
                                        {c.times_redeemed}{c.max_redemptions ? ` / ${c.max_redemptions}` : ''}
                                    </td>
                                    <td className="px-4 py-3 text-ink-600">{c.valid_until ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        {c.is_expired ? (
                                            <span className="inline-flex items-center rounded-full bg-ink-100 text-ink-500 px-2 py-0.5 text-[11px] font-semibold">Expired</span>
                                        ) : c.is_active ? (
                                            <span className="inline-flex items-center rounded-full bg-success/10 text-success px-2 py-0.5 text-[11px] font-semibold">Active</span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full bg-warning/15 text-warning px-2 py-0.5 text-[11px] font-semibold">Disabled</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                        <button onClick={() => toggle(c)} className="text-[12px] text-ink-500 hover:text-ink-900 mr-3">
                                            {c.is_active ? 'Disable' : 'Enable'}
                                        </button>
                                        <button onClick={() => destroy(c)} className="text-[12px] text-danger hover:underline">
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AdminLayout>
    );
}
