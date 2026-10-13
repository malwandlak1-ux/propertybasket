import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import TenantLayout from '@/Layouts/TenantLayout';
import { Spinner } from '@/Components/Skeleton';
import { PageHeader, Segmented, btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';
import Icon from '@/Components/Dashboard/Icon';

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
    late_fee: number;
    is_overdue: boolean;
};

type Props = {
    tenant: { id: number; name: string };
    lease: { id: number; monthly_rent: number; address: string; late_fee: string | null };
    kpis: { total_paid: number; count: number; streak: number; avg_payment: number; outstanding: number };
    rows: Row[];
    upcoming: Upcoming[];
    statements: Statement[];
};

type Statement = { period: string; label: string; charged: number; paid: number; closing: number };
type Filter = 'all' | 'paid' | 'pending';

const statusTone = (s: string) => {
    if (s === 'paid')    return 'bg-success/15 text-success';
    if (s === 'overdue') return 'bg-danger/15 text-danger';
    if (s === 'partial') return 'bg-warning/15 text-amber-700';
    return 'bg-ink-100 text-ink-700';
};

const methodLabel = (m: string | null) => {
    if (!m) return '—';
    return {
        paystack_card: 'Paystack · Card',
        paystack_eft:  'Paystack · EFT',
        debit_order:   'Debit Order',
        manual:        'EFT',
    }[m] ?? m;
};

export default function TenantPayments({ lease, kpis, rows, upcoming, statements }: Props) {
    const [payingPeriod, setPayingPeriod] = useState<string | null>(null);
    const [filter, setFilter] = useState<Filter>('all');
    const { flash } = usePage<FlashShared>().props;

    function payNow(period: string) {
        if (payingPeriod) return;
        setPayingPeriod(period);
        // Full-page POST so the response redirect → external Paystack URL works.
        router.post('/tenant/payments/pay', { period }, {
            onFinish: () => setPayingPeriod(null),
        });
    }

    const filtered = filter === 'all'
        ? rows
        : rows.filter((r) => filter === 'paid' ? r.status === 'paid' : r.status !== 'paid');

    // Most urgent unpaid period: overdue first, then soonest-due.
    const nextDue = [...upcoming].sort((a, b) => {
        if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
        return a.days_remaining - b.days_remaining;
    })[0];
    const hasArrears = upcoming.some((u) => u.is_overdue);
    const busy = !! nextDue && payingPeriod === nextDue.period;

    return (
        <TenantLayout crumb="Payments" leaseAddress={lease.address}>
            <Head title="Payments" />

            <section className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Payments"
                    subtitle={<>All your rent payments since the lease started · {kpis.streak} consecutive on-time payment{kpis.streak === 1 ? '' : 's'}</>}
                    actions={
                        <>
                            <a href="/tenant/payments/statement.pdf?download=1" className={btnOutline}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                Download statement
                            </a>
                            {nextDue && (
                                <button
                                    type="button"
                                    onClick={() => payNow(nextDue.period)}
                                    disabled={!! payingPeriod}
                                    className={btnPrimary + (nextDue.is_overdue ? ' !bg-danger hover:!bg-danger/90' : '')}
                                    title={`Pay rent for ${nextDue.period_label} (${fmtMoney(nextDue.amount)})`}
                                >
                                    {busy ? <Spinner size={14} /> : <Icon name="wallet" className="w-4 h-4" />}
                                    {busy ? 'Redirecting…' : `Pay ${fmtMoney(nextDue.amount)}`}
                                </button>
                            )}
                        </>
                    }
                />

                {flash?.success && (
                    <div className="mb-4 rounded-2xl border border-success/30 bg-success/10 text-success px-5 py-3 text-[13px] font-medium">{flash.success}</div>
                )}
                {flash?.error && (
                    <div className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 text-danger px-5 py-3 text-[13px] font-medium">{flash.error}</div>
                )}

                {/* Next payment hero + outstanding */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    <div className={`lg:col-span-2 rounded-2xl p-6 text-white shadow-lift pb-rise ${hasArrears ? 'bg-gradient-to-br from-danger to-rose-800' : 'pb-swirl'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <p className="text-[11px] text-white/75 uppercase tracking-wider font-semibold">
                                    {hasArrears ? 'Overdue rent' : 'Next payment'}
                                </p>
                                <p className="text-[40px] font-semibold tracking-tight leading-none mt-2 tabular-nums">
                                    {fmtMoney(nextDue?.amount ?? lease.monthly_rent)}
                                </p>
                                <p className="text-[13px] text-white/80 mt-2">
                                    {nextDue
                                        ? <>{nextDue.period_label} · due {nextDue.due_date} · {nextDue.is_overdue ? `${Math.abs(nextDue.days_remaining)} days overdue` : `in ${nextDue.days_remaining} day${nextDue.days_remaining === 1 ? '' : 's'}`}</>
                                        : 'Nothing due right now'}
                                </p>
                            </div>
                            <span className="text-[10.5px] bg-white/15 ring-1 ring-white/25 px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide">
                                {kpis.outstanding > 0 ? 'Arrears owing' : 'Up to date'}
                            </span>
                        </div>
                        {nextDue && (
                            <div className="flex flex-wrap items-center gap-3 mt-5">
                                <button
                                    type="button"
                                    onClick={() => payNow(nextDue.period)}
                                    disabled={!! payingPeriod}
                                    className="inline-flex items-center gap-2 rounded-full bg-white text-ink-900 px-4 py-2.5 text-[13px] font-semibold hover:bg-white/90 disabled:opacity-60"
                                >
                                    {busy ? <Spinner size={14} /> : <Icon name="wallet" className="w-4 h-4" />}
                                    {busy ? 'Redirecting…' : 'Pay with Paystack'}
                                </button>
                                <span className="text-[12px] text-white/75">or pay by EFT using your lease reference</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">Outstanding</p>
                        <p className={`text-[30px] font-semibold tracking-tight mt-3 leading-none tabular-nums ${kpis.outstanding > 0 ? 'text-danger' : ''}`}>{fmtMoney(kpis.outstanding)}</p>
                        <p className="text-[11.5px] text-ink-500 mt-2">{kpis.outstanding > 0 ? 'Past-due rent — please settle' : 'Nothing past due'}</p>
                        <div className="mt-4 pt-3 border-t border-ink-100 space-y-1.5 text-[12px]">
                            <div className="flex justify-between"><span className="text-ink-500">Monthly rent</span><span className="font-semibold tabular-nums">{fmtMoney(lease.monthly_rent)}</span></div>
                            <div className="flex justify-between"><span className="text-ink-500">Due on</span><span className="font-semibold">1st of each month</span></div>
                            {lease.late_fee && (
                                <div className="flex justify-between gap-3"><span className="text-ink-500">Late penalty</span><span className="font-semibold text-right">{lease.late_fee}</span></div>
                            )}
                        </div>
                    </div>
                </div>

                {/* KPI tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">Total paid</p>
                        <p className="text-[30px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{fmtMoney(kpis.total_paid)}</p>
                        <p className="text-[11.5px] text-ink-500 mt-2">{kpis.count} payment{kpis.count === 1 ? '' : 's'} on this lease</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">On-time streak</p>
                        <p className="text-[30px] font-semibold tracking-tight mt-3 leading-none tabular-nums text-success">{kpis.streak} month{kpis.streak === 1 ? '' : 's'}</p>
                        <p className="text-[11.5px] text-success mt-2">{kpis.streak >= 6 ? 'Excellent tenant' : 'Keep it up'}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">Average payment</p>
                        <p className="text-[30px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{fmtMoney(kpis.avg_payment)}</p>
                        <p className="text-[11.5px] text-ink-500 mt-2">Per month</p>
                    </div>
                </div>

                {/* Upcoming */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 mb-4">
                    <h2 className="text-[16px] font-semibold tracking-tight mb-4">Upcoming Payments</h2>
                    <ul className="space-y-2">
                        {upcoming.map((u, idx) => {
                            const isFirst = idx === 0;
                            return (
                                <li key={u.id ?? `synth-${idx}`} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 border ${u.is_overdue ? 'border-danger/30 bg-danger/5' : isFirst ? 'border-brand-200 bg-brand-50/50' : 'border-ink-200/70'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${u.is_overdue ? 'bg-danger/15 text-danger' : 'bg-brand-50 text-brand-700'}`}>
                                            <Icon name="calendar" className="w-4 h-4" />
                                        </span>
                                        <div>
                                            <p className="text-[13.5px] font-semibold">{u.period_label}</p>
                                            <p className="text-[11.5px] text-ink-500">
                                                Due {u.due_date} · {u.is_overdue ? `${Math.abs(u.days_remaining)} days overdue` : `in ${u.days_remaining} day${u.days_remaining === 1 ? '' : 's'}`}
                                            </p>
                                            {u.late_fee > 0 && (
                                                <p className="text-[11.5px] text-danger font-semibold mt-0.5">Includes late payment penalty of {fmtMoney(u.late_fee)}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-semibold tabular-nums">{fmtMoney(u.amount)}</span>
                                        {(isFirst || u.is_overdue) && (
                                            <button
                                                onClick={() => payNow(u.period)}
                                                disabled={payingPeriod !== null}
                                                className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 hover:bg-brand-800 text-white px-3.5 py-1.5 text-[12px] font-semibold disabled:opacity-60"
                                            >
                                                {payingPeriod === u.period && <Spinner size={11} />}
                                                {payingPeriod === u.period ? 'Redirecting…' : 'Pay now'}
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* Payment history */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden mb-4">
                    <div className="p-5 border-b border-ink-200 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-[16px] font-semibold tracking-tight">Payment History</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">{rows.length} rent charge{rows.length === 1 ? '' : 's'} · a receipt for every paid month</p>
                        </div>
                        <Segmented
                            options={[{ value: 'all', label: 'All' }, { value: 'paid', label: 'Paid' }, { value: 'pending', label: 'Unpaid' }]}
                            value={filter}
                            onChange={setFilter}
                        />
                    </div>
                    <div className="overflow-x-auto"><table className="w-full min-w-[700px]">
                        <thead>
                            <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50 whitespace-nowrap">
                                <th className="font-semibold px-5 py-3">Date</th>
                                <th className="font-semibold py-3">Description</th>
                                <th className="font-semibold py-3">Method</th>
                                <th className="font-semibold py-3">Status</th>
                                <th className="font-semibold py-3 text-right pr-6">Amount</th>
                                <th className="font-semibold py-3 text-right pr-5">Receipt</th>
                            </tr>
                        </thead>
                        <tbody className="text-[13px]">
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} className="py-8 text-center text-ink-400">No payments match this filter.</td></tr>
                            ) : filtered.map((r) => (
                                <tr key={r.id} className="border-b border-ink-100 hover:bg-ink-50">
                                    <td className="px-5 py-3 text-[12px] text-ink-500 whitespace-nowrap tabular-nums">{r.date}</td>
                                    <td className="py-3 font-medium">{r.description}</td>
                                    <td className="py-3 text-[12px] text-ink-600">{methodLabel(r.method)}</td>
                                    <td className="py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusTone(r.status)}`}>{r.status_label}</span></td>
                                    <td className="py-3 text-right pr-6 tabular-nums font-semibold">{fmtMoney(r.amount)}</td>
                                    <td className="py-3 text-right pr-5">
                                        {r.has_receipt
                                            ? <a href={`/tenant/payments/${r.id}/receipt.pdf?download=1`} className="text-brand-700 text-[12px] font-semibold hover:underline">PDF ↓</a>
                                            : <span className="text-ink-300 text-[12px]">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-ink-50 border-t border-ink-200">
                            <tr className="text-[13px] font-semibold">
                                <td colSpan={4} className="px-5 py-3">Total paid on this lease</td>
                                <td className="text-right pr-6 tabular-nums py-3">{fmtMoney(kpis.total_paid)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table></div>
                </div>

                {/* Monthly statements */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-[16px] font-semibold tracking-tight">Monthly Statements</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">Opening balance, rent charged, payments and closing balance for each month</p>
                        </div>
                        <a href="/tenant/payments/statement.pdf" target="_blank" rel="noopener" className="text-[12px] font-semibold text-brand-700 hover:underline">
                            View full statement →
                        </a>
                    </div>
                    {statements.length === 0 ? (
                        <p className="py-6 text-center text-[13px] text-ink-400">No statements yet.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                            {statements.map((st) => (
                                <div key={st.period} className="flex items-center gap-3 rounded-xl border border-ink-200/70 px-3.5 py-3 hover:bg-ink-50 transition">
                                    <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                                        <Icon name="file" className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-semibold">{st.label}</p>
                                        <p className="text-[11px] text-ink-500">Paid {fmtMoney(st.paid)}</p>
                                        <p className={`text-[11px] font-semibold ${st.closing > 0.004 ? 'text-danger' : 'text-success'}`}>
                                            {st.closing > 0.004 ? `${fmtMoney(st.closing)} owing` : 'Settled'}
                                        </p>
                                    </div>
                                    <a href={`/tenant/payments/statement.pdf?month=${st.period}`} target="_blank" rel="noopener" className="text-[11.5px] font-semibold text-ink-600 hover:text-ink-900">View</a>
                                    <a href={`/tenant/payments/statement.pdf?month=${st.period}&download=1`} className="text-[11.5px] font-semibold text-brand-700 hover:underline">PDF ↓</a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </TenantLayout>
    );
}
