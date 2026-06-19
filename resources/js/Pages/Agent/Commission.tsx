import { Head } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';

function fmtMoney(n: number): string {
    if (n >= 1_000_000) return 'R ' + (n / 1_000_000).toFixed(1) + 'm';
    if (n >= 1_000) return 'R ' + Math.round(n / 1_000) + 'k';
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}
function fmtFull(n: number): string {
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

type MonthBar = {
    month: string;
    earned: number;
    target: number;
    is_current: boolean;
    is_future: boolean;
};

type LedgerRow = {
    id: number;
    date: string;
    description: string;
    type_label: string;
    gross: number;
    split_pct: number;
    agent_net: number;
    status: string;
    blocked_reason?: string;
    paid_at?: string;
};

type Props = {
    agent: { id: number; name: string; agency_name: string; split_pct: number };
    stats: {
        ytd_earned: number;
        annual_target: number;
        target_pct: number;
        pipeline_value: number;
        pending_payout: number;
        next_payout: string;
    };
    monthly_chart: MonthBar[];
    max_bar: number;
    ledger: LedgerRow[];
};

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
    paid:     { cls: 'bg-success/15 text-success',   label: 'Paid' },
    approved: { cls: 'bg-brand-50 text-brand-700',   label: 'Approved' },
    pending:  { cls: 'bg-warning/15 text-warning',   label: 'Pending' },
    blocked:  { cls: 'bg-danger/15 text-danger',     label: 'Blocked' },
};

export default function AgentCommission({ agent, stats, monthly_chart, max_bar, ledger }: Props) {
    const kpis = [
        { label: 'YTD Earned', value: fmtMoney(stats.ytd_earned), sub: `${stats.target_pct}% of annual target`, tone: 'text-success' },
        { label: 'Pipeline Value', value: fmtMoney(stats.pipeline_value), sub: 'Approved + pending', tone: 'text-brand-600' },
        { label: 'Pending Payout', value: fmtMoney(stats.pending_payout), sub: `Next: ${stats.next_payout}`, tone: 'text-warning' },
        { label: 'Split', value: `${agent.split_pct}%`, sub: `of gross commission`, tone: 'text-ink-700' },
    ];

    return (
        <AgentLayout crumb="Commission" agencyName={agent.agency_name}>
            <Head title="Commission" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Commission Tracker</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Annual target: {fmtMoney(stats.annual_target)} · {stats.target_pct}% achieved
                        </p>
                    </div>
                    <button className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 transition flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                        Export CSV
                    </button>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {kpis.map((k) => (
                        <div key={k.label} className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold mb-2">{k.label}</p>
                            <p className={`text-2xl font-bold ${k.tone}`}>{k.value}</p>
                            <p className="text-[11px] text-ink-400 mt-1">{k.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Target progress bar */}
                <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-base font-semibold">Annual Progress</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">
                                {fmtFull(stats.ytd_earned)} of {fmtFull(stats.annual_target)} target
                            </p>
                        </div>
                        <span className="text-[13px] font-bold text-brand-600">{stats.target_pct}%</span>
                    </div>
                    <div className="h-3 bg-ink-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all"
                            style={{ width: `${stats.target_pct}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-ink-400">
                        <span>R 0</span>
                        <span>Target: {fmtMoney(stats.annual_target)}</span>
                    </div>
                </div>

                {/* Monthly bar chart */}
                <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                        <div>
                            <h2 className="text-base font-semibold">Monthly Earnings vs Target</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">Last 12 months</p>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-ink-500">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm bg-brand-500" />Earned
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm bg-ink-200" />Target
                            </span>
                        </div>
                    </div>

                    <div className="flex items-end gap-2 h-40 overflow-x-auto">
                        {monthly_chart.map((m) => {
                            const earnedPct = (m.earned / max_bar) * 100;
                            const targetPct = (m.target / max_bar) * 100;
                            return (
                                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                                    <div className="w-full flex items-end gap-0.5 h-32">
                                        {/* Target bar (lighter) */}
                                        <div
                                            className="flex-1 bg-ink-100 rounded-t-sm"
                                            style={{ height: `${targetPct}%` }}
                                            title={`Target: ${fmtFull(m.target)}`}
                                        />
                                        {/* Earned bar */}
                                        <div
                                            className={`flex-1 rounded-t-sm transition-all ${
                                                m.is_current ? 'bg-brand-500' : m.earned > 0 ? 'bg-brand-400' : 'bg-ink-200'
                                            }`}
                                            style={{ height: `${Math.max(earnedPct, earnedPct > 0 ? 2 : 0)}%` }}
                                            title={`Earned: ${fmtFull(m.earned)}`}
                                        />
                                    </div>
                                    <span className={`text-[10px] font-mono ${m.is_current ? 'font-bold text-brand-600' : 'text-ink-400'}`}>
                                        {m.month}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Commission ledger */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                    <div className="p-5 border-b border-ink-200">
                        <h2 className="text-base font-semibold">Commission Ledger</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">Most recent {ledger.length} transactions</p>
                    </div>

                    {ledger.length === 0 ? (
                        <div className="p-12 text-center text-[13px] text-ink-400">No commission records yet</div>
                    ) : (
                        <div className="overflow-x-auto"><table className="w-full min-w-[700px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                    <th className="font-semibold py-3 px-5">Date</th>
                                    <th className="font-semibold py-3 px-4">Property</th>
                                    <th className="font-semibold py-3 px-4">Type</th>
                                    <th className="font-semibold py-3 px-4 text-right">Gross</th>
                                    <th className="font-semibold py-3 px-4 text-right">Split</th>
                                    <th className="font-semibold py-3 px-4 text-right">Net</th>
                                    <th className="font-semibold py-3 px-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {ledger.map((row) => {
                                    const badge = STATUS_BADGE[row.status] ?? { cls: 'bg-ink-100 text-ink-600', label: row.status };
                                    return (
                                        <tr key={row.id} className="border-b border-ink-100 hover:bg-ink-50">
                                            <td className="py-3 px-5 text-ink-500 font-mono text-[12px]">{row.date}</td>
                                            <td className="py-3 px-4">
                                                <p className="font-medium truncate max-w-[200px]">{row.description}</p>
                                                {row.blocked_reason && (
                                                    <p className="text-[11px] text-danger">{row.blocked_reason}</p>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-ink-100 text-ink-600 font-semibold">
                                                    {row.type_label}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono">{fmtFull(row.gross)}</td>
                                            <td className="py-3 px-4 text-right font-mono text-ink-500">{row.split_pct}%</td>
                                            <td className="py-3 px-4 text-right font-mono font-semibold">{fmtFull(row.agent_net)}</td>
                                            <td className="py-3 px-4">
                                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${badge.cls}`}>
                                                    {badge.label}
                                                    {row.paid_at && <span className="font-normal ml-1">· {row.paid_at}</span>}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table></div>
                    )}
                </div>
            </div>
        </AgentLayout>
    );
}
