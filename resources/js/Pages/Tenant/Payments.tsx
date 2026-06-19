import { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import TenantLayout from '@/Layouts/TenantLayout';
import { Spinner } from '@/Components/Skeleton';

type FlashShared = {
    flash?: { success?: string | null; error?: string | null };
};

function fmtMoney(n: number): string {
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

type Row = {
    id: number;
    date: string;
    description: string;
    method: string | null;
    reference: string | null;
    status: string;
    status_label: string;
    amount: number;
    has_receipt: boolean;
};

type Upcoming = {
    id: number | null;
    period: string;
    period_label: string;
    due_date: string;
    days_remaining: number;
    amount: number;
    is_overdue: boolean;
};

type Props = {
    tenant: { id: number; name: string };
    lease: { id: number; monthly_rent: number; address: string };
    kpis: { total_paid: number; count: number; streak: number; avg_payment: number; outstanding: number };
    rows: Row[];
    upcoming: Upcoming[];
};

const statusTone = (s: string) => {
    if (s === 'paid')    return 'bg-success/15 text-success';
    if (s === 'overdue') return 'bg-danger/15 text-danger';
    if (s === 'partial') return 'bg-warning/15 text-warning';
    return 'bg-ink-100 text-ink-700';
};

const methodLabel = (m: string | null) => {
    if (!m) return '—';
    return {
        paystack_card: 'Paystack · Card',
        paystack_eft:  'Paystack · EFT',
        debit_order:   'Debit Order',
        manual:        'Manual EFT',
    }[m] ?? m;
};

export default function TenantPayments({ tenant, lease, kpis, rows, upcoming }: Props) {
    const [payingPeriod, setPayingPeriod] = useState<string | null>(null);
    const { flash } = usePage<FlashShared>().props;

    function payNow(period: string) {
        if (payingPeriod) return;
        setPayingPeriod(period);
        // Full-page POST so the response redirect → external Paystack URL works.
        router.post('/tenant/payments/pay', { period }, {
            onFinish: () => setPayingPeriod(null),
        });
    }

    const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');

    const filtered = filter === 'all'
        ? rows
        : rows.filter((r) => filter === 'paid' ? r.status === 'paid' : r.status !== 'paid');

    return (
        <TenantLayout crumb="Payments" leaseAddress={lease.address}>
            <Head title="Payments" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                {flash?.success && (
                    <div className="mb-4 p-3 rounded-lg border border-success/30 bg-success/5 text-[13px] text-success font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7"/></svg>
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="mb-4 p-3 rounded-lg border border-danger/30 bg-danger/5 text-[13px] text-danger font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                        {flash.error}
                    </div>
                )}
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            All your payments since lease started · {kpis.streak} consecutive on-time payment{kpis.streak === 1 ? '' : 's'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 flex items-center gap-2">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                            Download statement
                        </button>
                        {(() => {
                            // Pick the most urgent unpaid period: overdue first, then soonest-due.
                            const nextDue = [...upcoming].sort((a, b) => {
                                if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
                                return a.days_remaining - b.days_remaining;
                            })[0];

                            if (! nextDue) {
                                return (
                                    <button
                                        disabled
                                        title="No rent is currently due"
                                        className="px-3.5 py-2 text-[13px] bg-ink-200 text-ink-500 rounded-lg cursor-not-allowed flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2"/></svg>
                                        Pay Rent
                                    </button>
                                );
                            }

                            const busy = payingPeriod === nextDue.period;
                            return (
                                <button
                                    type="button"
                                    onClick={() => payNow(nextDue.period)}
                                    disabled={!! payingPeriod}
                                    title={nextDue.is_overdue
                                        ? `Pay overdue rent for ${nextDue.period_label} (${fmtMoney(nextDue.amount)})`
                                        : `Pay rent for ${nextDue.period_label} (${fmtMoney(nextDue.amount)})`}
                                    className={`px-3.5 py-2 text-[13px] text-white rounded-lg flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                                        nextDue.is_overdue ? 'bg-danger hover:bg-danger/90' : 'bg-ink-900 hover:bg-ink-800'
                                    }`}
                                >
                                    {busy ? (
                                        <Spinner size={14} />
                                    ) : (
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2"/></svg>
                                    )}
                                    {busy ? 'Redirecting…' : `Pay ${fmtMoney(nextDue.amount)}`}
                                </button>
                            );
                        })()}
                    </div>
                </div>

                {/* KPI strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">Total paid (lease)</p>
                        <p className="text-2xl font-bold mt-2">{fmtMoney(kpis.total_paid)}</p>
                        <p className="text-[11px] text-ink-500 mt-1">{kpis.count} payment{kpis.count === 1 ? '' : 's'}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">On-time streak</p>
                        <p className="text-2xl font-bold mt-2 text-success">{kpis.streak} month{kpis.streak === 1 ? '' : 's'}</p>
                        <p className="text-[11px] text-success mt-1">{kpis.streak >= 6 ? '⭐ Excellent tenant' : 'Keep it up'}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">Avg payment</p>
                        <p className="text-2xl font-bold mt-2">{fmtMoney(kpis.avg_payment)}</p>
                        <p className="text-[11px] text-ink-500 mt-1">Per month</p>
                    </div>
                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">Outstanding</p>
                        <p className={`text-2xl font-bold mt-2 ${kpis.outstanding > 0 ? 'text-danger' : 'text-success'}`}>{fmtMoney(kpis.outstanding)}</p>
                        <p className="text-[11px] text-ink-500 mt-1">{kpis.outstanding > 0 ? 'Pay overdue rent' : 'Up to date'}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 mb-4">
                    {(['all', 'paid', 'pending'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`text-[12px] px-3 py-1.5 rounded-full font-medium capitalize ${
                                filter === f ? 'bg-ink-900 text-white' : 'bg-white border border-ink-200 hover:bg-ink-100'
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                    <div className="overflow-x-auto"><table className="w-full min-w-[700px]">
                        <thead>
                            <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                <th className="font-semibold px-5 py-3">Date</th>
                                <th className="font-semibold py-3">Description</th>
                                <th className="font-semibold py-3">Method</th>
                                <th className="font-semibold py-3">Reference</th>
                                <th className="font-semibold py-3">Status</th>
                                <th className="font-semibold py-3 text-right pr-5">Amount</th>
                                <th className="font-semibold py-3 text-right pr-5">Receipt</th>
                            </tr>
                        </thead>
                        <tbody className="text-[13px]">
                            {filtered.length === 0 ? (
                                <tr><td colSpan={7} className="py-8 text-center text-ink-400">No payments match this filter.</td></tr>
                            ) : filtered.map((r) => (
                                <tr key={r.id} className="border-b border-ink-100 hover:bg-ink-50">
                                    <td className="px-5 py-3 font-mono text-[12px]">{r.date}</td>
                                    <td className="font-semibold">{r.description}</td>
                                    <td className="text-[12px]">{methodLabel(r.method)}</td>
                                    <td className="font-mono text-[11px] text-ink-500">{r.reference ?? '—'}</td>
                                    <td><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusTone(r.status)}`}>{r.status_label}</span></td>
                                    <td className="text-right pr-5 font-mono font-semibold">{fmtMoney(r.amount)}</td>
                                    <td className="text-right pr-5">
                                        {r.has_receipt
                                            ? <a href={`/tenant/payments/${r.id}/receipt.pdf?download=1`} target="_blank" rel="noopener" className="text-brand-600 text-[12px] font-semibold hover:underline">PDF ↓</a>
                                            : <span className="text-ink-300 text-[12px]">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-ink-50 border-t-2 border-ink-200">
                            <tr className="text-[13px] font-semibold">
                                <td colSpan={5} className="px-5 py-3">Lease total</td>
                                <td className="text-right pr-5 font-mono py-3">{fmtMoney(kpis.total_paid)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table></div>
                </div>

                {/* Upcoming */}
                <div className="mt-6 bg-white rounded-xl border border-ink-200 shadow-soft p-5">
                    <h2 className="text-base font-semibold mb-3">Upcoming Payments</h2>
                    <div className="space-y-2">
                        {upcoming.map((u, idx) => {
                            const isFirst = idx === 0;
                            const tone = u.is_overdue
                                ? 'bg-danger/5 border border-danger/30'
                                : isFirst ? 'bg-warning/5 border border-warning/30' : 'hover:bg-ink-50';
                            const iconBg = u.is_overdue ? 'bg-danger/20' : isFirst ? 'bg-warning/20' : 'bg-ink-100';
                            const iconClr = u.is_overdue ? 'text-danger' : isFirst ? 'text-warning' : 'text-ink-700';
                            return (
                                <div key={u.id ?? `synth-${idx}`} className={`flex items-center justify-between p-3 rounded-lg ${tone}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
                                            <svg className={`w-4 h-4 ${iconClr}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-semibold">{u.period_label}</p>
                                            <p className="text-[11px] text-ink-500">
                                                Due {u.due_date} · {u.is_overdue ? `${Math.abs(u.days_remaining)} days overdue` : `in ${u.days_remaining} day${u.days_remaining === 1 ? '' : 's'}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-mono font-semibold ${isFirst || u.is_overdue ? 'text-ink-900' : 'text-ink-500'}`}>{fmtMoney(u.amount)}</span>
                                        {(isFirst || u.is_overdue) && (
                                            <button
                                                onClick={() => payNow(u.period)}
                                                disabled={payingPeriod !== null}
                                                className="px-3 py-1.5 text-[11px] bg-ink-900 text-white rounded-md font-semibold hover:bg-ink-800 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition"
                                            >
                                                {payingPeriod === u.period && <Spinner size={11} />}
                                                {payingPeriod === u.period ? 'Redirecting…' : 'Pay now'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </TenantLayout>
    );
}
