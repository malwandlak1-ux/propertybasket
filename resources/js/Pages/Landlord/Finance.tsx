import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';
import ErrorBoundary from '@/Components/ErrorBoundary';
import { AreaChart, Donut, PageHeader, Segmented, btnPrimary } from '@/Components/Dashboard/Charts';
import { useInertiaLoading } from '@/Hooks/useInertiaLoading';
import Icon from '@/Components/Dashboard/Icon';

type Payment = {
    id: number;
    period: string;
    amount: number;
    due_date: string;
    paid_at: string | null;
    status: 'paid' | 'overdue' | 'pending';
    property: string | null;
    tenant: string | null;
    method: string;
    reference: string | null;
};

type Statement = { period: string; label: string; income: number; maintenance: number; net: number };
type Expense = { date: string; description: string; property: string; reference: string; amount: number };

type Range = '3' | '6' | '12' | 'lease';

type EftPending = {
    id: number; tenant: string | null; property: string | null; period: string | null;
    due: number; amount: number; paid_on: string; reference: string | null; note: string | null; has_proof: boolean;
};

type Props = {
    landlord: { id: number; name: string };
    year: number;
    filters: { property: number | null; range: Range; range_label: string; from: string; to: string };
    properties: { id: number; name: string }[];
    ranges: { key: Range; label: string }[];
    kpis: {
        monthly_roll: number;
        ytd_collected: number;
        this_month_collected: number;
        outstanding: number;
    };
    income_statement: {
        rent_income: number;
        maintenance: number;
        net: number;
        net_margin_pct: number;
        maintenance_pct: number;
    };
    cashflow: { month: string; period: string; income: number; maintenance: number }[];
    by_property: { property: string; income: number; maintenance: number; net: number }[];
    statements: Statement[];
    eft_pending: EftPending[];
    payments: Payment[];
    maintenance: Expense[];
};

type Filter = 'all' | 'paid' | 'pending';

function fmtMoney(n: number) {
    return `R ${Math.round(n).toLocaleString('en-ZA')}`;
}
function fmtMoneyShort(n: number): string {
    const sign = n < 0 ? '- ' : '';
    const a = Math.abs(n);
    if (a >= 1_000_000) return sign + 'R ' + (a / 1_000_000).toFixed(1) + 'm';
    if (a >= 1_000) return sign + 'R ' + Math.round(a / 1_000) + 'k';
    return sign + 'R ' + Math.round(a).toLocaleString('en-ZA');
}

function StatusBadge({ status }: { status: Payment['status'] }) {
    const cfg = {
        paid:    { label: 'PAID',    cls: 'bg-success/15 text-success' },
        overdue: { label: 'OVERDUE', cls: 'bg-danger/15 text-danger' },
        pending: { label: 'PENDING', cls: 'bg-warning/15 text-warning' },
    }[status];
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cfg.cls}`}>{cfg.label}</span>;
}

function Cell({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'default' | 'muted' | 'success' | 'danger' }) {
    const bg = tone === 'success' ? 'bg-success/5' : tone === 'danger' ? 'bg-danger/5' : '';
    const strong = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'muted' ? 'text-ink-700' : '';
    return (
        <div className={'p-5 ' + bg}>
            <p className={'text-[11px] uppercase tracking-wider font-semibold ' + (tone === 'success' ? 'text-success' : 'text-ink-500')}>{label}</p>
            <p className={'text-2xl font-semibold mt-2 tabular-nums ' + strong}>{value}</p>
            <p className={'text-[12px] mt-1 ' + (tone === 'success' ? 'text-success' : 'text-ink-500')}>{sub}</p>
        </div>
    );
}

/** Query string for the statement PDF matching the current filters. */
function statementQuery(f: Props['filters'], extra: Record<string, string> = {}): string {
    const q = new URLSearchParams({ range: f.range, ...extra });
    if (f.property) q.set('property', String(f.property));
    return q.toString();
}

export default function LandlordFinance({
    kpis, income_statement: pl, cashflow, by_property, statements, payments, maintenance, filters, properties, ranges, eft_pending,
}: Props) {
    const [filter, setFilter] = useState<Filter>('all');
    const loading = useInertiaLoading();

    const scope = filters.property ? properties.find((p) => p.id === filters.property)?.name ?? 'Property' : 'All properties';
    const periodShort = filters.range === 'lease' ? 'full lease period' : filters.range_label.toLowerCase();

    function applyFilters(next: { property?: number | null; range?: Range }) {
        const property = next.property !== undefined ? next.property : filters.property;
        const range = next.range ?? filters.range;
        router.get('/landlord/finance', { ...(property ? { property } : {}), range }, { preserveScroll: true, preserveState: true });
    }

    const filtered = filter === 'all' ? payments : payments.filter((p) => {
        if (filter === 'paid')    return p.status === 'paid';
        if (filter === 'pending') return p.status !== 'paid';
        return true;
    });

    return (
        <LandlordLayout crumb="Finance" section="Finance">
            <Head title="Finance" />

            <section className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Finance"
                    subtitle="Rent income · maintenance · net to you · monthly statements"
                />

                {/* Filters: property + period. Everything below, and the statement download, follows them. */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-4 mb-4 flex flex-col xl:flex-row xl:items-center gap-3">
                    <label className="flex items-center gap-2.5 min-w-0">
                        <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Icon name="pin" className="w-4 h-4" /></span>
                        <span className="sr-only">Property</span>
                        <select
                            value={filters.property ?? ''}
                            onChange={(e) => applyFilters({ property: e.target.value ? Number(e.target.value) : null })}
                            className="min-w-0 w-full sm:w-[300px] bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
                        >
                            <option value="">All properties ({properties.length})</option>
                            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </label>
                    <div className="overflow-x-auto -mx-1 px-1">
                        <Segmented<Range>
                            options={ranges.map((r) => ({ value: r.key, label: r.label }))}
                            value={filters.range}
                            onChange={(range) => applyFilters({ range })}
                        />
                    </div>
                    <div className="flex items-center gap-3 xl:ml-auto">
                        <span className="text-[12px] text-ink-500 whitespace-nowrap">{filters.from} – {filters.to}</span>
                        <a href={`/landlord/finance/statement.pdf?${statementQuery(filters, { download: '1' })}`} className={btnPrimary + ' whitespace-nowrap'}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                            Download statement
                        </a>
                    </div>
                </div>

                <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>

                {eft_pending.length > 0 && <EftToConfirm items={eft_pending} />}

                {/* Income statement summary */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden mb-4">
                    <div className="p-5 border-b border-ink-200">
                        <h2 className="text-base font-semibold">Income Statement Summary</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">{scope} · {filters.range_label} · cash basis (rent received, maintenance paid)</p>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-ink-200">
                        <Cell
                            label="Rental Income"
                            value={fmtMoney(pl.rent_income)}
                            sub={pl.rent_income > 0 ? `Rent received · ${periodShort}` : 'No rent received in this period'}
                            tone="default"
                        />
                        <Cell
                            label="Less: Maintenance"
                            value={'- ' + fmtMoney(pl.maintenance)}
                            sub={`${pl.maintenance_pct}% of income`}
                            tone="muted"
                        />
                        <Cell
                            label="Rent Outstanding"
                            value={fmtMoney(kpis.outstanding)}
                            sub={kpis.outstanding > 0 ? 'Past-due, not yet received' : 'All rent received'}
                            tone={kpis.outstanding > 0 ? 'danger' : 'muted'}
                        />
                        <Cell
                            label="Net to Landlord"
                            value={fmtMoney(pl.net)}
                            sub={`${pl.net_margin_pct}% net margin`}
                            tone="success"
                        />
                    </div>
                </div>

                {/* Cash flow + rent roll */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                        <h2 className="text-base font-semibold mb-1">Cash Flow Trend</h2>
                        <p className="text-[12px] text-ink-500 mb-4">Rent received vs maintenance paid · {periodShort}</p>
                        <ErrorBoundary variant="section" label="cash flow chart">
                            <AreaChart
                                labels={cashflow.map((m) => m.month)}
                                series={cashflow.map((m) => m.income)}
                                previous={cashflow.map((m) => m.maintenance)}
                                seriesLabel="Income (rent received)"
                                previousLabel="Maintenance (paid)"
                                format={fmtMoneyShort}
                                height={220}
                            />
                        </ErrorBoundary>
                    </div>

                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-semibold">Rent Roll</h2>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${kpis.outstanding > 0 ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success'}`}>
                                {kpis.outstanding > 0 ? 'ARREARS' : 'UP TO DATE'}
                            </span>
                        </div>
                        <p className="text-[11px] text-ink-500 mb-3">Active long-term leases · {scope}</p>
                        <div className="pb-swirl rounded-2xl p-4 text-white mb-4">
                            <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">Monthly rent roll</p>
                            <p className="text-3xl font-semibold mt-1 tabular-nums">{fmtMoneyShort(kpis.monthly_roll)}</p>
                            <p className="text-[11px] opacity-70 mt-2">Due on the 1st of each month</p>
                        </div>
                        <div className="space-y-2 text-[12px]">
                            <div className="flex justify-between">
                                <span className="text-ink-500">Collected this month</span>
                                <span className="tabular-nums font-semibold">{fmtMoney(kpis.this_month_collected)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-ink-500">Collected · {periodShort}</span>
                                <span className="tabular-nums font-semibold">{fmtMoney(kpis.ytd_collected)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-ink-100">
                                <span className="text-ink-500">Outstanding</span>
                                <span className={`tabular-nums font-semibold ${kpis.outstanding > 0 ? 'text-danger' : ''}`}>{fmtMoney(kpis.outstanding)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Income by property + tiles */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                        <h2 className="text-base font-semibold mb-1">Income by Property</h2>
                        <p className="text-[12px] text-ink-500 mb-4">Rent received · {periodShort}</p>
                        {by_property.length === 0 ? (
                            <p className="py-10 text-center text-[13px] text-ink-400">No income recorded in this period.</p>
                        ) : (
                            <Donut
                                size={150}
                                centerValue={fmtMoneyShort(pl.rent_income)}
                                centerLabel="income"
                                segments={by_property.map((r) => ({
                                    label: r.property,
                                    value: r.income,
                                    display: `${fmtMoneyShort(r.income)} · net ${fmtMoneyShort(r.net)}`,
                                }))}
                            />
                        )}
                    </div>
                    <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                        <div className="pb-swirl rounded-2xl p-5 text-white shadow-lift">
                            <p className="text-[13px] font-medium">Net to Landlord</p>
                            <p className="text-[34px] font-semibold tracking-tight mt-4 leading-none tabular-nums">{fmtMoneyShort(pl.net)}</p>
                            <p className="text-[12px] text-white/80 mt-2.5">{pl.net_margin_pct}% net margin · {periodShort}</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                            <p className="text-[13px] font-medium text-ink-700">Maintenance</p>
                            <p className="text-[34px] font-semibold tracking-tight mt-4 leading-none tabular-nums">{fmtMoneyShort(pl.maintenance)}</p>
                            <p className="text-[12px] text-ink-500 mt-2.5">{pl.maintenance_pct}% of income · {periodShort}</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                            <p className="text-[13px] font-medium text-ink-700">Rental Income</p>
                            <p className="text-[34px] font-semibold tracking-tight mt-4 leading-none tabular-nums">{fmtMoneyShort(pl.rent_income)}</p>
                            <p className="text-[12px] text-ink-500 mt-2.5">Rent received · {periodShort}</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                            <p className="text-[13px] font-medium text-ink-700">Outstanding</p>
                            <p className={`text-[34px] font-semibold tracking-tight mt-4 leading-none tabular-nums ${kpis.outstanding > 0 ? 'text-danger' : ''}`}>{fmtMoneyShort(kpis.outstanding)}</p>
                            <p className="text-[12px] text-ink-500 mt-2.5">{kpis.outstanding > 0 ? 'Rent past due' : 'Nothing past due'}</p>
                        </div>
                    </div>
                </div>

                {/* Monthly statements */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 mb-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-base font-semibold">Monthly Statements</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">Rent received less maintenance, per month · {scope}</p>
                        </div>
                        <a href={`/landlord/finance/statement.pdf?${statementQuery(filters)}`} target="_blank" rel="noopener" className="text-[12px] font-semibold text-brand-700 hover:underline">
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
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-semibold">{st.label}</p>
                                        <p className="text-[11px] text-ink-500">
                                            Income {fmtMoney(st.income)} · Maint. {fmtMoney(st.maintenance)}
                                        </p>
                                        <p className={`text-[11px] font-semibold ${st.net < 0 ? 'text-danger' : 'text-success'}`}>
                                            Net {st.net < 0 ? '- ' : ''}{fmtMoney(Math.abs(st.net))}
                                        </p>
                                    </div>
                                    <a href={`/landlord/finance/statement.pdf?${statementQuery(filters, { month: st.period })}`} target="_blank" rel="noopener" className="text-[11.5px] font-semibold text-ink-600 hover:text-ink-900">View</a>
                                    <a href={`/landlord/finance/statement.pdf?${statementQuery(filters, { month: st.period, download: '1' })}`} className="text-[11.5px] font-semibold text-brand-700 hover:underline">PDF ↓</a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Payment history */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden mb-4">
                    <div className="p-5 border-b border-ink-200 flex flex-wrap gap-3 items-center justify-between">
                        <div>
                            <h2 className="text-base font-semibold">Rent Payment History</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">{payments.length} rent charge{payments.length === 1 ? '' : 's'} · {scope} · {periodShort}</p>
                        </div>
                        <div className="flex gap-2">
                            {(['all', 'paid', 'pending'] as Filter[]).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1.5 text-[12px] rounded-full font-medium transition ${
                                        filter === f ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                                    }`}
                                >
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="p-10 text-center text-[13px] text-ink-400">No payments in this view.</div>
                    ) : (
                        <div className="overflow-x-auto"><table className="w-full min-w-[700px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50 whitespace-nowrap">
                                    <th className="font-semibold px-5 py-3">Period</th>
                                    <th className="font-semibold py-3">Property</th>
                                    <th className="font-semibold py-3">Tenant</th>
                                    <th className="font-semibold py-3">Due Date</th>
                                    <th className="font-semibold py-3">Paid On</th>
                                    <th className="font-semibold py-3 text-right pr-6">Amount</th>
                                    <th className="font-semibold py-3 pr-5">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {filtered.map((p) => (
                                    <tr key={p.id} className="border-b border-ink-100 hover:bg-ink-50 transition">
                                        <td className="px-5 py-3.5 tabular-nums text-[12px] text-ink-700">{p.period}</td>
                                        <td className="py-3.5 text-ink-700">{p.property ?? '—'}</td>
                                        <td className="py-3.5 text-ink-700">{p.tenant ?? '—'}</td>
                                        <td className="py-3.5 text-ink-500 text-[12px]">{p.due_date}</td>
                                        <td className="py-3.5 text-ink-500 text-[12px]">{p.paid_at ?? '—'}</td>
                                        <td className="py-3.5 text-right tabular-nums font-semibold pr-6">{fmtMoney(p.amount)}</td>
                                        <td className="py-3.5 pr-5"><StatusBadge status={p.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table></div>
                    )}
                </div>

                {/* Maintenance expenses */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden">
                    <div className="p-5 border-b border-ink-200">
                        <h2 className="text-base font-semibold">Maintenance Expenses</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">Contractor invoices paid · {scope} · {periodShort}</p>
                    </div>
                    {maintenance.length === 0 ? (
                        <div className="p-10 text-center text-[13px] text-ink-400">No maintenance paid in this period.</div>
                    ) : (
                        <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50 whitespace-nowrap">
                                    <th className="font-semibold px-5 py-3">Paid On</th>
                                    <th className="font-semibold py-3">Description</th>
                                    <th className="font-semibold py-3">Property</th>
                                    <th className="font-semibold py-3">Reference</th>
                                    <th className="font-semibold py-3 text-right pr-5">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {maintenance.map((m) => (
                                    <tr key={m.reference} className="border-b border-ink-100 hover:bg-ink-50 transition">
                                        <td className="px-5 py-3.5 text-[12px] text-ink-500 whitespace-nowrap">{m.date}</td>
                                        <td className="py-3.5 text-ink-700">{m.description}</td>
                                        <td className="py-3.5 text-ink-700">{m.property}</td>
                                        <td className="py-3.5 text-[11px] text-ink-500 tabular-nums">{m.reference}</td>
                                        <td className="py-3.5 text-right tabular-nums font-semibold pr-5 text-danger">- {fmtMoney(m.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table></div>
                    )}
                </div>
                </div>
            </section>
        </LandlordLayout>
    );
}

/** Tenants' "I've paid by EFT" notices: confirm once the money reflects, or reject. */
function EftToConfirm({ items }: { items: EftPending[] }) {
    const [busy, setBusy] = useState<number | null>(null);

    function confirmEft(e: EftPending) {
        if (! window.confirm(`Confirm that ${fmtMoney(e.amount)} from ${e.tenant ?? 'the tenant'} has reflected in your account? Their ${e.period ?? ''} rent will be marked paid.`)) return;
        setBusy(e.id);
        router.post(`/landlord/finance/eft/${e.id}/confirm`, {}, { preserveScroll: true, onFinish: () => setBusy(null) });
    }
    function rejectEft(e: EftPending) {
        const reason = window.prompt('Why can\'t this EFT be confirmed? The tenant will see this.', 'Payment not found in the account');
        if (! reason) return;
        setBusy(e.id);
        router.post(`/landlord/finance/eft/${e.id}/reject`, { reason }, { preserveScroll: true, onFinish: () => setBusy(null) });
    }

    return (
        <div className="bg-white rounded-2xl border border-warning/40 shadow-soft overflow-hidden mb-4 pb-rise">
            <div className="p-5 border-b border-ink-100 flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-warning/15 text-amber-700 flex items-center justify-center shrink-0"><Icon name="alert" className="w-4 h-4" /></span>
                <div>
                    <h2 className="text-base font-semibold">EFT payments to confirm</h2>
                    <p className="text-[12px] text-ink-500 mt-0.5">Tenants say they've paid by EFT. Check your bank account, then confirm so the rent is marked paid.</p>
                </div>
                <span className="ml-auto text-[11px] bg-warning/15 text-amber-700 px-2.5 py-1 rounded-full font-bold">{items.length}</span>
            </div>
            <div className="divide-y divide-ink-100">
                {items.map((e) => (
                    <div key={e.id} className="px-5 py-3.5 flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-semibold">{e.tenant} · {e.period} rent</p>
                            <p className="text-[11.5px] text-ink-500 truncate">
                                {e.property} · paid {e.paid_on} · ref {e.reference ?? '—'}
                                {Math.abs(e.amount - e.due) > 0.01 && <span className="text-amber-700 font-semibold"> · rent due {fmtMoney(e.due)}</span>}
                            </p>
                            {e.note && <p className="text-[11.5px] text-ink-600 mt-0.5">"{e.note}"</p>}
                        </div>
                        <span className="text-[15px] font-semibold tabular-nums">{fmtMoney(e.amount)}</span>
                        {e.has_proof && (
                            <a href={`/landlord/finance/eft/${e.id}/proof`} target="_blank" rel="noopener" className="text-[12px] font-semibold text-brand-700 hover:underline">Proof</a>
                        )}
                        <button type="button" onClick={() => rejectEft(e)} disabled={busy !== null} className="px-3.5 py-1.5 text-[12px] rounded-full border border-ink-200 font-semibold hover:bg-ink-50 disabled:opacity-50">Not received</button>
                        <button type="button" onClick={() => confirmEft(e)} disabled={busy !== null} className="px-3.5 py-1.5 text-[12px] rounded-full bg-brand-700 text-white font-semibold hover:bg-brand-800 disabled:opacity-50">
                            {busy === e.id ? 'Saving…' : 'Confirm received'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
