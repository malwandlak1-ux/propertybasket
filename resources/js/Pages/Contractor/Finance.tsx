import { Head } from '@inertiajs/react';
import ContractorLayout from '@/Layouts/ContractorLayout';
import ErrorBoundary from '@/Components/ErrorBoundary';

type Payout = {
    id: number;
    reference: string;
    title: string;
    paid_at: string | null;
    gross: number;
    fee: number;
    net: number;
};

type TrendPoint = { label: string; period: string; gross: number; net: number };

type Props = {
    counts: { requests?: number; active_jobs?: number; messages?: number };
    kpis: {
        ytd_gross: number;
        ytd_net: number;
        ytd_fee: number;
        month_gross: number;
        month_fee: number;
        outstanding: number;
        fee_percent: number;
        next_payout: string;
    };
    trend: TrendPoint[];
    payouts: Payout[];
    vat_registered: boolean;
    vat_number: string | null;
};

function fmtMoney(n: number) {
    if (n >= 1_000_000) return `R ${(n / 1_000_000).toFixed(1)}m`;
    if (n >= 1_000)     return `R ${(n / 1_000).toFixed(0)}k`;
    return `R ${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}
function fmtFull(n: number) {
    return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ContractorFinance({ counts, kpis, trend, payouts, vat_registered, vat_number }: Props) {
    const maxTrend = Math.max(...trend.map((t) => t.gross), 1);

    return (
        <ContractorLayout crumb="Finance" section="Billing" counts={counts}>
            <Head title="Finance" />

            <div className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Earnings, payouts & platform fee summary · Next payout on {kpis.next_payout}
                        </p>
                    </div>
                    <button className="px-3.5 py-2 text-[13px] border border-ink-200 bg-white rounded-lg hover:bg-ink-50 flex items-center gap-2 transition">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        Export tax summary
                    </button>
                </div>

                {/* KPI strip */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <Kpi label="Earned YTD (gross)" value={fmtMoney(kpis.ytd_gross)} sub="From paid invoices" tone="ink" />
                    <Kpi label="Earned YTD (net)" value={fmtMoney(kpis.ytd_net)} sub={`After ${kpis.fee_percent}% platform fee`} tone="success" />
                    <Kpi label="Outstanding" value={fmtMoney(kpis.outstanding)} sub="Submitted + approved" tone="warning" />
                    <Kpi label="Platform fee YTD" value={fmtMoney(kpis.ytd_fee)} sub={`${kpis.fee_percent}% per completed invoice`} tone="danger" />
                </div>

                {/* Revenue trend */}
                <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-base font-semibold">Earnings — last 6 months</h2>
                            <p className="text-xs text-ink-500 mt-0.5">Gross (top) vs net after platform fee (filled portion)</p>
                        </div>
                    </div>
                    <ErrorBoundary variant="section" label="earnings chart">
                        <div className="flex items-end gap-3 h-40">
                            {trend.map((t) => {
                                const grossPct = (t.gross / maxTrend) * 100;
                                const netPct   = t.gross > 0 ? (t.net / t.gross) * 100 : 0;
                                return (
                                    <div key={t.period} className="flex-1 flex flex-col items-center gap-1">
                                        <span className="text-[10px] text-ink-500 font-mono">{fmtMoney(t.gross)}</span>
                                        <div className="w-full bg-ink-100 rounded-t-sm relative overflow-hidden" style={{ height: '110px' }}>
                                            <div
                                                className="absolute bottom-0 left-0 right-0 bg-brand-200 transition-all"
                                                style={{ height: `${Math.max(grossPct, 3)}%` }}
                                            >
                                                <div
                                                    className="absolute bottom-0 left-0 right-0 bg-brand-500"
                                                    style={{ height: `${netPct}%` }}
                                                />
                                            </div>
                                        </div>
                                        <span className="text-[11px] text-ink-500 font-semibold">{t.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </ErrorBoundary>
                </div>

                {/* VAT card + payouts table */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft self-start">
                        <h2 className="text-base font-semibold mb-3">Tax & Compliance</h2>
                        <div className="space-y-3 text-[12px]">
                            <div className="flex justify-between items-center">
                                <span className="text-ink-500">VAT registered</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${vat_registered ? 'bg-success/15 text-success' : 'bg-ink-100 text-ink-500'}`}>
                                    {vat_registered ? 'Yes' : 'No'}
                                </span>
                            </div>
                            {vat_registered && (
                                <div className="flex justify-between items-center">
                                    <span className="text-ink-500">VAT number</span>
                                    <span className="font-mono text-[11px]">{vat_number ?? '—'}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-2 border-t border-ink-100">
                                <span className="text-ink-500">Platform fee rate</span>
                                <span className="font-mono font-bold">{kpis.fee_percent}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-ink-500">Next payout</span>
                                <span className="font-semibold text-brand-600">{kpis.next_payout}</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-ink-400 mt-4 pt-3 border-t border-ink-100">
                            Payouts run Wednesdays for invoices marked approved by Tuesday 17:00.
                        </p>
                    </div>

                    <div className="col-span-2 bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                        <div className="p-5 border-b border-ink-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-semibold">Recent Payouts</h2>
                                <p className="text-xs text-ink-500 mt-0.5">{payouts.length} payouts in the ledger</p>
                            </div>
                        </div>

                        {payouts.length === 0 ? (
                            <div className="p-10 text-center text-[13px] text-ink-400">No payouts yet</div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                        <th className="font-semibold px-5 py-3">Reference</th>
                                        <th className="font-semibold py-3">Job</th>
                                        <th className="font-semibold py-3">Paid</th>
                                        <th className="font-semibold py-3 text-right">Gross</th>
                                        <th className="font-semibold py-3 text-right">Fee</th>
                                        <th className="font-semibold py-3 text-right pr-5">Net</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[13px]">
                                    {payouts.map((p) => (
                                        <tr key={p.id} className="border-b border-ink-100 hover:bg-ink-50 transition">
                                            <td className="px-5 py-3 font-mono text-[12px] text-ink-700">{p.reference}</td>
                                            <td className="py-3 truncate max-w-[180px]">{p.title}</td>
                                            <td className="py-3 text-[12px] text-ink-500">{p.paid_at ?? '—'}</td>
                                            <td className="py-3 text-right font-mono">{fmtFull(p.gross)}</td>
                                            <td className="py-3 text-right font-mono text-danger">– {fmtFull(p.fee)}</td>
                                            <td className="py-3 text-right pr-5 font-mono font-bold text-success">{fmtFull(p.net)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </ContractorLayout>
    );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'ink' | 'success' | 'warning' | 'danger' }) {
    const cls = tone === 'success' ? 'text-success' :
                tone === 'warning' ? 'text-warning' :
                tone === 'danger'  ? 'text-danger' :
                                     'text-ink-900';
    return (
        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
            <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold mb-2">{label}</p>
            <p className={`text-2xl font-bold ${cls}`}>{value}</p>
            <p className="text-[11px] text-ink-400 mt-1">{sub}</p>
        </div>
    );
}
