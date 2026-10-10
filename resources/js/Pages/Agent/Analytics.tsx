import { Head, router } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import ErrorBoundary from '@/Components/ErrorBoundary';
import { useInertiaLoading } from '@/Hooks/useInertiaLoading';
import {
    AreaChart, Card, Donut, Heatmap, KpiCard, PageHeader, RankBars, Segmented, btnOutline,
} from '@/Components/Dashboard/Charts';

function fmtMoney(n: number): string {
    if (n >= 1_000_000) return 'R ' + (n / 1_000_000).toFixed(1) + 'm';
    if (n >= 1_000) return 'R ' + Math.round(n / 1_000) + 'k';
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

type FunnelRow = { label: string; count: number; pct: number };
type SourceRow = { source: string; count: number; pct: number };
type TrendRow  = { month: string; won: number; lost: number };
type Kpi = { value: number; prev: number; delta: number | null; spark: number[] };
type Range = '7' | '30' | '90';

type Props = {
    agent: { id: number; name: string; agency_name: string };
    range: number;
    labels: string[];
    series: { leads: number[]; leads_prev: number[] };
    kpis: { leads: Kpi; viewings: Kpi; closed: Kpi; revenue: Kpi };
    funnel: FunnelRow[];
    lead_sources: SourceRow[];
    top_listings: { label: string; sub: string; value: number }[];
    heatmap: number[][];
    trend: TrendRow[];
    max_trend: number;
    overall: { total_leads: number; conversion: number };
};

const RANGE_OPTIONS: { value: Range; label: string }[] = [
    { value: '7', label: '7D' },
    { value: '30', label: '30D' },
    { value: '90', label: '90D' },
];

export default function AgentAnalytics({
    agent, range, labels, series, kpis, funnel, lead_sources, top_listings, heatmap, trend, max_trend, overall,
}: Props) {
    const loading = useInertiaLoading();
    const vs = `vs previous ${range}d`;
    const delta = (k: Kpi) => k.delta === null ? undefined : { value: Math.abs(k.delta) + '%', up: k.delta >= 0, label: vs };

    const setRange = (r: Range) =>
        router.get('/agent/analytics', { range: r }, { preserveState: true, preserveScroll: true, replace: true });

    return (
        <AgentLayout crumb="Analytics" agencyName={agent.agency_name}>
            <Head title="Analytics" />

            <div className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Analytics"
                    subtitle={<>How your pipeline is moving — {overall.total_leads} leads all-time · {overall.conversion}% lifetime conversion.</>}
                    actions={
                        <>
                            <Segmented options={RANGE_OPTIONS} value={String(range) as Range} onChange={setRange} />
                            <a href={`/agent/analytics?range=${range}&export=csv`} className={btnOutline}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                Export CSV
                            </a>
                        </>
                    }
                />

                <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                    {/* KPI tiles with sparklines */}
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                        <KpiCard label="Leads received" value={kpis.leads.value} delta={delta(kpis.leads)} spark={kpis.leads.spark} />
                        <KpiCard label="Viewings booked" value={kpis.viewings.value} delta={delta(kpis.viewings)} spark={kpis.viewings.spark} />
                        <KpiCard label="Deals closed" value={kpis.closed.value} delta={delta(kpis.closed)} spark={kpis.closed.spark} />
                        <KpiCard label="Commission earned" value={fmtMoney(kpis.revenue.value)} delta={delta(kpis.revenue)} spark={kpis.revenue.spark} />
                    </div>

                    {/* Throughput + sources */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                        <Card
                            className="xl:col-span-2"
                            title="Lead throughput"
                            subtitle={`New leads per day, last ${range} days, against the previous period`}
                        >
                            <ErrorBoundary variant="section" label="throughput chart">
                                <AreaChart labels={labels} series={series.leads} previous={series.leads_prev} seriesLabel="This period" />
                            </ErrorBoundary>
                        </Card>

                        <Card title="Leads by source" subtitle={`Last ${range} days`}>
                            {lead_sources.length === 0 ? (
                                <p className="py-12 text-center text-[13px] text-ink-400">No leads in this period</p>
                            ) : (
                                <Donut
                                    segments={lead_sources.map((s) => ({ label: s.source, value: s.count, display: `${s.count} · ${s.pct}%` }))}
                                    centerValue={kpis.leads.value}
                                    centerLabel={`leads · ${range}d`}
                                />
                            )}
                        </Card>
                    </div>

                    {/* Activity + top listings */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                        <Card className="xl:col-span-2" title="Activity" subtitle="New leads and status changes per day, last 20 weeks">
                            <Heatmap weeks={heatmap} unit="lead updates" />
                        </Card>
                        <Card title="Top listings" subtitle={`By leads, last ${range} days`}>
                            <RankBars rows={top_listings} empty="No listing leads in this period" />
                        </Card>
                    </div>

                    {/* Funnel + win/loss */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card title="Conversion funnel" subtitle="Lead-to-close, all time">
                            <div className="space-y-3">
                                {funnel.map((row, idx) => (
                                    <div key={row.label}>
                                        <div className="flex items-center justify-between mb-1.5 text-[12.5px]">
                                            <span className="font-medium text-ink-700">{row.label}</span>
                                            <span className="text-ink-500 tabular-nums">{row.count} · <span className="font-semibold text-ink-900">{row.pct}%</span></span>
                                        </div>
                                        <div className="h-3 bg-ink-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${['bg-brand-800', 'bg-brand-700', 'bg-brand-600', 'bg-brand-400', 'bg-success'][idx] ?? 'bg-brand-500'}`}
                                                style={{ width: `${row.count > 0 ? Math.max(row.pct, 4) : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card
                            title="Win / loss"
                            subtitle="Last 6 months"
                            action={
                                <div className="flex items-center gap-3 text-[11.5px] text-ink-500">
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-700" />Won</span>
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full pb-hatch" />Lost</span>
                                </div>
                            }
                        >
                            <div className="flex items-end gap-3 sm:gap-5 h-44">
                                {trend.map((t, i) => (
                                    <div key={t.month} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                                        <div className="w-full flex items-end justify-center gap-1 h-36">
                                            <div className="pb-grow w-1/2 max-w-[22px] rounded-full bg-brand-700" title={`Won: ${t.won}`}
                                                style={{ height: `${Math.max((t.won / max_trend) * 100, t.won > 0 ? 8 : 3)}%`, animationDelay: `${i * 60}ms` }} />
                                            <div className="pb-grow w-1/2 max-w-[22px] rounded-full pb-hatch" title={`Lost: ${t.lost}`}
                                                style={{ height: `${Math.max((t.lost / max_trend) * 100, t.lost > 0 ? 8 : 3)}%`, animationDelay: `${i * 60 + 30}ms` }} />
                                        </div>
                                        <span className="text-[11px] text-ink-500">{t.month}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </AgentLayout>
    );
}
