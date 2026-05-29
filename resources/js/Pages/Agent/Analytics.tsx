import { Head } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';

function fmtMoney(n: number): string {
    if (n >= 1_000_000) return 'R ' + (n / 1_000_000).toFixed(1) + 'm';
    if (n >= 1_000) return 'R ' + Math.round(n / 1_000) + 'k';
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

type FunnelRow = { label: string; count: number; pct: number };
type SourceRow = { source: string; count: number; pct: number };
type TrendRow  = { month: string; won: number; lost: number };

type Props = {
    agent: { id: number; name: string; agency_name: string };
    funnel: FunnelRow[];
    lead_sources: SourceRow[];
    mtd: { leads: number; viewing: number; closed: number; revenue: number };
    trend: TrendRow[];
    max_trend: number;
    overall: { total_leads: number; conversion: number };
};

const FUNNEL_COLORS = ['bg-brand-500', 'bg-brand-400', 'bg-sky-500', 'bg-warning', 'bg-success'];
const SOURCE_COLORS = ['bg-brand-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];

export default function AgentAnalytics({ agent, funnel, lead_sources, mtd, trend, max_trend, overall }: Props) {
    return (
        <AgentLayout crumb="Analytics" agencyName={agent.agency_name}>
            <Head title="Analytics" />

            <div className="px-8 py-7">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
                    <p className="text-[14px] text-ink-500 mt-1">
                        {overall.total_leads} total leads · {overall.conversion}% lifetime conversion
                    </p>
                </div>

                {/* MTD KPIs */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'MTD Leads',   value: mtd.leads.toString(),   sub: 'This month',       color: 'text-brand-600' },
                        { label: 'MTD Viewings', value: mtd.viewing.toString(), sub: 'Scheduled',        color: 'text-sky-600' },
                        { label: 'MTD Closed',  value: mtd.closed.toString(),  sub: 'Won this month',   color: 'text-success' },
                        { label: 'MTD Revenue', value: fmtMoney(mtd.revenue),  sub: 'Commission earned', color: 'text-emerald-600' },
                    ].map((k) => (
                        <div key={k.label} className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold mb-2">{k.label}</p>
                            <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
                            <p className="text-[11px] text-ink-400 mt-1">{k.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Two-column: Funnel + Sources */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Conversion funnel */}
                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <h2 className="text-base font-semibold mb-1">Conversion Funnel</h2>
                        <p className="text-[12px] text-ink-500 mb-5">Lead-to-close breakdown</p>

                        <div className="space-y-3">
                            {funnel.map((row, idx) => (
                                <div key={row.label}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[12px] font-semibold text-ink-700">{row.label}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-ink-500">{row.count} leads</span>
                                            <span className="text-[11px] font-mono font-bold text-brand-600">{row.pct}%</span>
                                        </div>
                                    </div>
                                    <div className="h-7 bg-ink-100 rounded-md overflow-hidden">
                                        {row.count > 0 && (
                                            <div
                                                className={`h-full ${FUNNEL_COLORS[idx] ?? 'bg-brand-500'} flex items-center justify-end px-3 text-[11px] font-semibold text-white transition-all`}
                                                style={{ width: `${Math.max(row.pct, row.count > 0 ? 8 : 0)}%` }}
                                            >
                                                {row.count}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-5 pt-4 border-t border-ink-200 grid grid-cols-2 gap-4 text-center">
                            <div>
                                <p className="text-[11px] text-ink-500 uppercase tracking-wider">Total Leads</p>
                                <p className="text-xl font-bold mt-1">{overall.total_leads}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-ink-500 uppercase tracking-wider">Conversion</p>
                                <p className="text-xl font-bold mt-1 text-success">{overall.conversion}%</p>
                            </div>
                        </div>
                    </div>

                    {/* Lead sources */}
                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <h2 className="text-base font-semibold mb-1">Lead Sources</h2>
                        <p className="text-[12px] text-ink-500 mb-5">Where your leads come from</p>

                        {lead_sources.length === 0 ? (
                            <div className="py-8 text-center text-[13px] text-ink-400">No lead source data yet</div>
                        ) : (
                            <div className="space-y-4">
                                {lead_sources.map((src, idx) => (
                                    <div key={src.source}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2.5 h-2.5 rounded-full ${SOURCE_COLORS[idx] ?? 'bg-ink-400'}`} />
                                                <span className="text-[13px] font-medium">{src.source}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[12px] text-ink-500">{src.count}</span>
                                                <span className="text-[12px] font-semibold text-ink-700 w-10 text-right">{src.pct}%</span>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${SOURCE_COLORS[idx] ?? 'bg-ink-400'} rounded-full transition-all`}
                                                style={{ width: `${src.pct}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Donut placeholder */}
                        {lead_sources.length > 0 && (
                            <div className="mt-5 pt-4 border-t border-ink-200 text-center">
                                <p className="text-[11px] text-ink-400">Top source: <span className="font-semibold text-ink-700">{lead_sources[0]?.source}</span></p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Win/loss trend */}
                <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h2 className="text-base font-semibold">Win / Loss Trend</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">Last 6 months</p>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-ink-500">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm bg-success" />Won
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm bg-danger/40" />Lost
                            </span>
                        </div>
                    </div>

                    <div className="flex items-end gap-4 h-40">
                        {trend.map((t) => {
                            const totalH = t.won + t.lost;
                            const wonPct  = max_trend > 0 ? (t.won / max_trend) * 100 : 0;
                            const lostPct = max_trend > 0 ? (t.lost / max_trend) * 100 : 0;
                            return (
                                <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                                    <div className="w-full flex items-end gap-0.5 h-32">
                                        <div
                                            className="flex-1 bg-success rounded-t-sm transition-all"
                                            style={{ height: `${Math.max(wonPct, t.won > 0 ? 4 : 0)}%` }}
                                            title={`Won: ${t.won}`}
                                        />
                                        <div
                                            className="flex-1 bg-danger/40 rounded-t-sm transition-all"
                                            style={{ height: `${Math.max(lostPct, t.lost > 0 ? 4 : 0)}%` }}
                                            title={`Lost: ${t.lost}`}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-ink-400">{t.month}</span>
                                    {totalH > 0 && (
                                        <span className="text-[10px] text-ink-500">
                                            {t.won}/{totalH}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </AgentLayout>
    );
}
