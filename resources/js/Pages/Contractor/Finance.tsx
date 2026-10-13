import { Head } from '@inertiajs/react';
import ContractorLayout from '@/Layouts/ContractorLayout';
import ErrorBoundary from '@/Components/ErrorBoundary';
import { AreaChart, Donut, PageHeader, btnOutline } from '@/Components/Dashboard/Charts';

type Payout = {
    id: number;
    reference: string;
    title: string;
    paid_at: string | null;
    gross: number;
    fee: number;
    net: number;
};

type TrendPoint = { label: string; period: string; gross: number; fee: number; net: number };

type Props = {
    counts: { requests?: number; active_jobs?: number; messages?: number };
    year: number;
    kpis: {
        ytd_gross: number;
        ytd_net: number;
        ytd_fee: number;
        ytd_vat: number;
        ytd_jobs: number;
        month_gross: number;
        month_fee: number;
        outstanding: number;
        fee_percent: number;
        next_payout: string;
    };
    trend: TrendPoint[];
    by_category: { category: string; gross: number; jobs: number }[];
    payouts: Payout[];
    vat_registered: boolean;
    vat_number: string | null;
};

function fmtMoney(n: number) {
    return `R ${Math.round(n).toLocaleString('en-ZA')}`;
}
function fmtMoneyShort(n: number) {
    if (n >= 1_000_000) return `R ${(n / 1_000_000).toFixed(1)}m`;
    if (n >= 1_000) return `R ${Math.round(n / 1_000)}k`;
    return `R ${Math.round(n).toLocaleString('en-ZA')}`;
}
function fmtFull(n: number) {
    return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Cell({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'default' | 'muted' | 'success' }) {
    return (
        <div className={'p-5 ' + (tone === 'success' ? 'bg-success/5' : '')}>
            <p className={'text-[11px] uppercase tracking-wider font-semibold ' + (tone === 'success' ? 'text-success' : 'text-ink-500')}>{label}</p>
            <p className={'text-2xl font-semibold mt-2 tabular-nums ' + (tone === 'success' ? 'text-success' : tone === 'muted' ? 'text-ink-700' : '')}>{value}</p>
            <p className={'text-[12px] mt-1 ' + (tone === 'success' ? 'text-success' : 'text-ink-500')}>{sub}</p>
        </div>
    );
}

export default function ContractorFinance({ counts, year, kpis, trend, by_category, payouts, vat_registered, vat_number }: Props) {
    const netMargin = kpis.ytd_gross > 0 ? Math.round((kpis.ytd_net / kpis.ytd_gross) * 1000) / 10 : 0;

    return (
        <ContractorLayout crumb="Finance" section="Billing" counts={counts}>
            <Head title="Finance" />

            <section className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Finance"
                    subtitle={<>Earnings · platform fees · VAT · payouts · next payout on {kpis.next_payout}</>}
                    actions={
                        <>
                            <span className="text-[12px] bg-white border border-ink-200 rounded-full px-3.5 py-2 font-semibold text-ink-700">
                                FY {year} · YTD
                            </span>
                            <a href="/contractor/finance?export=csv" className={btnOutline}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                Export tax summary
                            </a>
                        </>
                    }
                />

                {/* Income statement summary */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden mb-4">
                    <div className="p-5 border-b border-ink-200">
                        <h2 className="text-base font-semibold">Income Statement Summary</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">YTD · {year} · paid invoices</p>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-ink-200">
                        <Cell
                            label="Gross Invoiced"
                            value={fmtMoney(kpis.ytd_gross)}
                            sub={kpis.ytd_jobs > 0 ? `${kpis.ytd_jobs} paid invoice${kpis.ytd_jobs === 1 ? '' : 's'} YTD` : 'No paid invoices yet'}
                            tone="default"
                        />
                        <Cell
                            label="Less: Platform Fee"
                            value={'- ' + fmtMoney(kpis.ytd_fee)}
                            sub={`${kpis.fee_percent}% per completed invoice`}
                            tone="muted"
                        />
                        <Cell
                            label={vat_registered ? 'VAT Collected' : 'VAT'}
                            value={fmtMoney(kpis.ytd_vat)}
                            sub={vat_registered ? `Payable to SARS · ${vat_number ?? 'VAT no. not set'}` : 'Not VAT registered'}
                            tone="muted"
                        />
                        <Cell
                            label="Net Earnings"
                            value={fmtMoney(kpis.ytd_net)}
                            sub={`${netMargin}% after platform fee`}
                            tone="success"
                        />
                    </div>
                </div>

                {/* Cash flow + payout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                        <h2 className="text-base font-semibold mb-1">Earnings Trend</h2>
                        <p className="text-[12px] text-ink-500 mb-4">Gross paid vs platform fees · last 6 months</p>
                        <ErrorBoundary variant="section" label="earnings chart">
                            <AreaChart
                                labels={trend.map((t) => t.label)}
                                series={trend.map((t) => t.gross)}
                                previous={trend.map((t) => t.fee)}
                                seriesLabel="Earnings (gross paid)"
                                previousLabel="Platform fees"
                                format={fmtMoneyShort}
                                height={220}
                            />
                        </ErrorBoundary>
                    </div>

                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-semibold">Payouts</h2>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-brand-50 text-brand-700">WEDNESDAYS</span>
                        </div>
                        <p className="text-[11px] text-ink-500 mb-3">Approved invoices are paid out weekly</p>
                        <div className="pb-swirl rounded-2xl p-4 text-white mb-4">
                            <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">Awaiting payment</p>
                            <p className="text-3xl font-semibold mt-1 tabular-nums">{fmtMoneyShort(kpis.outstanding)}</p>
                            <p className="text-[11px] opacity-70 mt-2">Next payout · {kpis.next_payout}</p>
                        </div>
                        <div className="space-y-2 text-[12px]">
                            <div className="flex justify-between">
                                <span className="text-ink-500">Earned this month</span>
                                <span className="tabular-nums font-semibold">{fmtMoney(kpis.month_gross)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-ink-500">Fees this month</span>
                                <span className="tabular-nums font-semibold">{fmtMoney(kpis.month_fee)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-ink-100">
                                <span className="text-ink-500">Platform fee rate</span>
                                <span className="tabular-nums font-semibold">{kpis.fee_percent}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-ink-500">VAT registered</span>
                                <span className="font-semibold">{vat_registered ? `Yes · ${vat_number ?? '—'}` : 'No'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Earnings by category + tiles */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                        <h2 className="text-base font-semibold mb-1">Earnings by Category</h2>
                        <p className="text-[12px] text-ink-500 mb-4">Gross paid · YTD</p>
                        {by_category.length === 0 ? (
                            <p className="py-10 text-center text-[13px] text-ink-400">No paid jobs this year yet.</p>
                        ) : (
                            <Donut
                                size={150}
                                centerValue={fmtMoneyShort(kpis.ytd_gross)}
                                centerLabel="gross YTD"
                                segments={by_category.map((c) => ({
                                    label: c.category,
                                    value: c.gross,
                                    display: `${fmtMoneyShort(c.gross)} · ${c.jobs} job${c.jobs === 1 ? '' : 's'}`,
                                }))}
                            />
                        )}
                    </div>
                    <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                        <div className="pb-swirl rounded-2xl p-5 text-white shadow-lift">
                            <p className="text-[13px] font-medium">Net Earnings</p>
                            <p className="text-[34px] font-semibold tracking-tight mt-4 leading-none tabular-nums">{fmtMoneyShort(kpis.ytd_net)}</p>
                            <p className="text-[12px] text-white/80 mt-2.5">{netMargin}% after fees · YTD</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                            <p className="text-[13px] font-medium text-ink-700">Platform Fees</p>
                            <p className="text-[34px] font-semibold tracking-tight mt-4 leading-none tabular-nums">{fmtMoneyShort(kpis.ytd_fee)}</p>
                            <p className="text-[12px] text-ink-500 mt-2.5">{kpis.fee_percent}% of gross · YTD</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                            <p className="text-[13px] font-medium text-ink-700">Gross Invoiced</p>
                            <p className="text-[34px] font-semibold tracking-tight mt-4 leading-none tabular-nums">{fmtMoneyShort(kpis.ytd_gross)}</p>
                            <p className="text-[12px] text-ink-500 mt-2.5">{kpis.ytd_jobs} paid invoice{kpis.ytd_jobs === 1 ? '' : 's'} · YTD</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                            <p className="text-[13px] font-medium text-ink-700">Outstanding</p>
                            <p className="text-[34px] font-semibold tracking-tight mt-4 leading-none tabular-nums">{fmtMoneyShort(kpis.outstanding)}</p>
                            <p className="text-[12px] text-ink-500 mt-2.5">Submitted + approved invoices</p>
                        </div>
                    </div>
                </div>

                {/* Payout history */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden">
                    <div className="p-5 border-b border-ink-200">
                        <h2 className="text-base font-semibold">Recent Payouts</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">{payouts.length} payouts in the ledger · payouts run Wednesdays for invoices approved by Tuesday 17:00</p>
                    </div>
                    {payouts.length === 0 ? (
                        <div className="p-10 text-center text-[13px] text-ink-400">No payouts yet</div>
                    ) : (
                        <div className="overflow-x-auto"><table className="w-full min-w-[700px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50 whitespace-nowrap">
                                    <th className="font-semibold px-5 py-3">Reference</th>
                                    <th className="font-semibold py-3">Job</th>
                                    <th className="font-semibold py-3">Paid</th>
                                    <th className="font-semibold py-3 text-right pr-6">Gross</th>
                                    <th className="font-semibold py-3 text-right pr-6">Fee</th>
                                    <th className="font-semibold py-3 text-right pr-5">Net</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {payouts.map((p) => (
                                    <tr key={p.id} className="border-b border-ink-100 hover:bg-ink-50 transition">
                                        <td className="px-5 py-3 tabular-nums text-[12px] text-ink-700">{p.reference}</td>
                                        <td className="py-3 truncate max-w-[220px]">{p.title}</td>
                                        <td className="py-3 text-[12px] text-ink-500 whitespace-nowrap">{p.paid_at ?? '—'}</td>
                                        <td className="py-3 text-right tabular-nums pr-6">{fmtFull(p.gross)}</td>
                                        <td className="py-3 text-right tabular-nums text-danger pr-6">- {fmtFull(p.fee)}</td>
                                        <td className="py-3 text-right pr-5 tabular-nums font-semibold text-success">{fmtFull(p.net)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table></div>
                    )}
                </div>
            </section>
        </ContractorLayout>
    );
}
