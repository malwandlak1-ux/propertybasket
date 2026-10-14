import { FormEvent, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import TenantLayout from '@/Layouts/TenantLayout';
import { useInertiaLoading } from '@/Hooks/useInertiaLoading';
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
    /** Date of an EFT the tenant reported that is awaiting confirmation. */
    eft_pending: string | null;
};

type Payee = { name: string; holder: string; bank: string; account: string; branch: string; type: string | null; reference: string };

type Range = '3' | '6' | '12' | 'lease';

type Props = {
    tenant: { id: number; name: string };
    filters: { lease: number | null; range: Range; range_label: string; from: string; to: string };
    ranges: { key: Range; label: string }[];
    leases: { id: number; name: string; current: boolean }[];
    payee: Payee | null;
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

/** Query string for the statement PDF matching the current filters. */
function statementQuery(f: Props['filters'], extra: Record<string, string> = {}): string {
    const q = new URLSearchParams({ range: f.range, ...extra });
    if (f.lease) q.set('lease', String(f.lease));
    return q.toString();
}

export default function TenantPayments({ lease, kpis, rows, upcoming, statements, filters, ranges, leases, payee }: Props) {
    const [eftFor, setEftFor] = useState<Upcoming | null>(null);
    const loading = useInertiaLoading();
    const periodShort = filters.range === 'lease' ? 'full lease period' : filters.range_label.toLowerCase();

    function applyFilters(next: { lease?: number | null; range?: Range }) {
        const l = next.lease !== undefined ? next.lease : filters.lease;
        const range = next.range ?? filters.range;
        router.get('/tenant/payments', { ...(l ? { lease: l } : {}), range }, { preserveScroll: true, preserveState: true });
    }
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
                            <a href={`/tenant/payments/statement.pdf?${statementQuery(filters, { download: '1' })}`} className={btnOutline}>
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
                                    {busy ? 'Redirecting…' : `Pay ${fmtMoney(nextDue.amount)} online`}
                                </button>
                            )}
                            {nextDue && nextDue.id && ! nextDue.eft_pending && (
                                <button type="button" onClick={() => setEftFor(nextDue)} className={btnOutline}>
                                    <Icon name="file" className="w-4 h-4" />Pay via EFT
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
                        {nextDue && nextDue.eft_pending && (
                            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 ring-1 ring-white/25 px-4 py-2 text-[12.5px] font-semibold">
                                <Icon name="clock" className="w-4 h-4" />EFT of {nextDue.eft_pending} reported · waiting for {payee?.name ?? 'your landlord'} to confirm
                            </p>
                        )}
                        {nextDue && ! nextDue.eft_pending && (
                            <div className="flex flex-wrap items-center gap-2.5 mt-5">
                                <button
                                    type="button"
                                    onClick={() => payNow(nextDue.period)}
                                    disabled={!! payingPeriod}
                                    className="inline-flex items-center gap-2 rounded-full bg-white text-ink-900 px-4 py-2.5 text-[13px] font-semibold hover:bg-white/90 disabled:opacity-60"
                                >
                                    {busy ? <Spinner size={14} /> : <Icon name="wallet" className="w-4 h-4" />}
                                    {busy ? 'Redirecting…' : 'Pay online'}
                                </button>
                                {nextDue.id && (
                                    <button
                                        type="button"
                                        onClick={() => setEftFor(nextDue)}
                                        className="inline-flex items-center gap-2 rounded-full bg-white/15 ring-1 ring-white/40 text-white px-4 py-2.5 text-[13px] font-semibold hover:bg-white/25"
                                    >
                                        <Icon name="file" className="w-4 h-4" />Pay via EFT
                                    </button>
                                )}
                                {payee && <span className="text-[12px] text-white/75">EFT reference: <span className="font-semibold text-white">{payee.reference}</span></span>}
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

                {/* Filters: lease (if more than one) + period. History, totals and statements follow them. */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-4 mb-4 flex flex-col xl:flex-row xl:items-center gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Icon name="calendar" className="w-4 h-4" /></span>
                        {leases.length > 1 ? (
                            <select
                                aria-label="Lease"
                                value={filters.lease ?? leases.find((l) => l.current)?.id ?? ''}
                                onChange={(e) => {
                                    const id = Number(e.target.value);
                                    applyFilters({ lease: leases.find((l) => l.id === id)?.current ? null : id });
                                }}
                                className="min-w-0 w-full sm:w-[320px] bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
                            >
                                {leases.map((l) => <option key={l.id} value={l.id}>{l.name}{l.current ? ' (current)' : ''}</option>)}
                            </select>
                        ) : (
                            <div className="min-w-0">
                                <p className="text-[13.5px] font-semibold">Payment history &amp; statements</p>
                                <p className="text-[11.5px] text-ink-500 truncate">{lease.address}</p>
                            </div>
                        )}
                    </div>
                    <div className="overflow-x-auto -mx-1 px-1">
                        <Segmented<Range>
                            options={ranges.map((r) => ({ value: r.key, label: r.label }))}
                            value={filters.range}
                            onChange={(range) => applyFilters({ range })}
                        />
                    </div>
                    <div className="flex items-center gap-3 xl:ml-auto">
                        <span className="text-[12px] text-ink-500 whitespace-nowrap">{filters.from} – {filters.to}</span>
                        <a href={`/tenant/payments/statement.pdf?${statementQuery(filters, { download: '1' })}`} className={btnPrimary + ' whitespace-nowrap'}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                            Download statement
                        </a>
                    </div>
                </div>

                <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                {/* KPI tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">Total paid</p>
                        <p className="text-[30px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{fmtMoney(kpis.total_paid)}</p>
                        <p className="text-[11.5px] text-ink-500 mt-2">{kpis.count} payment{kpis.count === 1 ? '' : 's'} · {periodShort}</p>
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
                                        {u.eft_pending ? (
                                            <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-warning/15 text-amber-700 whitespace-nowrap">EFT reported · awaiting confirmation</span>
                                        ) : (isFirst || u.is_overdue) && (
                                            <>
                                                <button
                                                    onClick={() => payNow(u.period)}
                                                    disabled={payingPeriod !== null}
                                                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 hover:bg-brand-800 text-white px-3.5 py-1.5 text-[12px] font-semibold disabled:opacity-60"
                                                >
                                                    {payingPeriod === u.period && <Spinner size={11} />}
                                                    {payingPeriod === u.period ? 'Redirecting…' : 'Pay online'}
                                                </button>
                                                {u.id && (
                                                    <button
                                                        onClick={() => setEftFor(u)}
                                                        className="inline-flex items-center gap-1.5 rounded-full border border-ink-300 hover:bg-ink-50 px-3.5 py-1.5 text-[12px] font-semibold"
                                                    >
                                                        EFT
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                {/* Payment history */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden mb-4">
                    <div className="p-5 border-b border-ink-200 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-[16px] font-semibold tracking-tight">Payment History</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">{rows.length} rent charge{rows.length === 1 ? '' : 's'} · {periodShort} · a receipt for every paid month</p>
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
                                <td colSpan={4} className="px-5 py-3">Total paid · {periodShort}</td>
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
                        <a href={`/tenant/payments/statement.pdf?${statementQuery(filters)}`} target="_blank" rel="noopener" className="text-[12px] font-semibold text-brand-700 hover:underline">
                            View statement · {periodShort} →
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
                                    <a href={`/tenant/payments/statement.pdf?${statementQuery(filters, { month: st.period })}`} target="_blank" rel="noopener" className="text-[11.5px] font-semibold text-ink-600 hover:text-ink-900">View</a>
                                    <a href={`/tenant/payments/statement.pdf?${statementQuery(filters, { month: st.period, download: '1' })}`} className="text-[11.5px] font-semibold text-brand-700 hover:underline">PDF ↓</a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                </div>
            </section>

            {eftFor && <EftModal charge={eftFor} payee={payee} onClose={() => setEftFor(null)} />}
        </TenantLayout>
    );
}

function CopyRow({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);
    function copy() {
        navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }
    return (
        <div className="flex items-center justify-between gap-3 py-2 border-b border-ink-100 last:border-0">
            <span className="text-[12px] text-ink-500">{label}</span>
            <span className="flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-semibold tabular-nums truncate">{value}</span>
                <button type="button" onClick={copy} className="text-[11px] font-semibold text-brand-700 hover:underline shrink-0">{copied ? 'Copied' : 'Copy'}</button>
            </span>
        </div>
    );
}

function EftModal({ charge, payee, onClose }: { charge: Upcoming; payee: Payee | null; onClose: () => void }) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, setData, post, processing, errors, progress } = useForm<{
        rent_payment_id: number | null; amount: string; paid_on: string; proof: File | null; note: string;
    }>({
        rent_payment_id: charge.id,
        amount: String(charge.amount),
        paid_on: today,
        proof: null,
        note: '',
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/tenant/payments/eft', { preserveScroll: true, forceFormData: true, onSuccess: () => onClose() });
    }

    const inputCls = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[14px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-card w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-5 border-b border-ink-100 flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-[18px] font-semibold tracking-tight">Pay via EFT</h2>
                        <p className="text-[12.5px] text-ink-500 mt-0.5">{charge.period_label} · {fmtMoney(charge.amount)}</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700 text-xl leading-none">×</button>
                </div>

                <div className="p-5 space-y-5">
                    {payee ? (
                        <div>
                            <p className="text-[12px] font-semibold text-ink-700 mb-1">1. Pay into this account from your banking app</p>
                            <div className="rounded-xl border border-ink-200/70 px-4 py-1">
                                <CopyRow label="Account holder" value={payee.holder} />
                                <CopyRow label="Bank" value={payee.bank} />
                                <CopyRow label="Account number" value={payee.account} />
                                <CopyRow label="Branch code" value={payee.branch} />
                                {payee.type && <CopyRow label="Account type" value={payee.type.charAt(0).toUpperCase() + payee.type.slice(1)} />}
                                <CopyRow label="Reference" value={payee.reference} />
                                <CopyRow label="Amount" value={charge.amount.toFixed(2)} />
                            </div>
                            <p className="text-[11.5px] text-ink-500 mt-2">Use the reference exactly as shown so the payment can be matched to you.</p>
                        </div>
                    ) : (
                        <div className="rounded-xl bg-warning/10 border border-warning/30 px-4 py-3 text-[12.5px] text-amber-800">
                            Your landlord hasn't added their bank account to the portal yet. Use the banking details in your lease agreement, then let us know below.
                        </div>
                    )}

                    <form onSubmit={submit} className="space-y-4">
                        <p className="text-[12px] font-semibold text-ink-700">2. Let us know once you've paid</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Amount paid (R)</label>
                                <input type="number" min="1" step="0.01" value={data.amount} onChange={(e) => setData('amount', e.target.value)} required className={inputCls + ' tabular-nums'} />
                                {errors.amount && <p className="text-[11px] text-danger mt-1">{errors.amount}</p>}
                            </div>
                            <div>
                                <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Date paid</label>
                                <input type="date" max={today} value={data.paid_on} onChange={(e) => setData('paid_on', e.target.value)} required className={inputCls} />
                                {errors.paid_on && <p className="text-[11px] text-danger mt-1">{errors.paid_on}</p>}
                            </div>
                        </div>
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Proof of payment <span className="font-normal text-ink-400">(optional · PDF, JPG or PNG, up to 5 MB)</span></label>
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setData('proof', e.target.files?.[0] ?? null)} className="block w-full text-[12.5px] file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:text-brand-700 file:px-3.5 file:py-1.5 file:font-semibold" />
                            {progress && <p className="text-[11px] text-ink-500 mt-1">Uploading {progress.percentage}%</p>}
                            {errors.proof && <p className="text-[11px] text-danger mt-1">{errors.proof}</p>}
                        </div>
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Note <span className="font-normal text-ink-400">(optional)</span></label>
                            <input value={data.note} onChange={(e) => setData('note', e.target.value)} maxLength={500} className={inputCls} placeholder="e.g. Paid from my partner's account" />
                        </div>
                        {errors.rent_payment_id && <p className="text-[12px] text-danger">{errors.rent_payment_id}</p>}

                        <p className="text-[11.5px] text-ink-500">Your rent shows as paid once {payee?.name ?? 'your landlord'} confirms the money has reflected (usually 1 to 2 working days).</p>

                        <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={onClose} className="px-4 py-2.5 text-[13px] rounded-full border border-ink-200 font-semibold hover:bg-ink-50">Cancel</button>
                            <button type="submit" disabled={processing} className={btnPrimary}>
                                {processing && <Spinner size={13} />}I've paid
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
