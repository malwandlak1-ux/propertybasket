import { Head, Link } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import ErrorBoundary from '@/Components/ErrorBoundary';
import { Card, Gauge, KpiCard, PageHeader, PillBars, StatusPill, btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
    if (n >= 1_000_000) return 'R ' + (n / 1_000_000).toFixed(1) + 'm';
    if (n >= 1_000) return 'R ' + Math.round(n / 1_000) + 'k';
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

function greet(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

function today(): string {
    return new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Agent = { id: number; name: string; initials: string; agency_name: string; ffc_number?: string };

type KPIs = {
    active_listings: number;
    open_leads: number;
    ytd_commission: number;
    conversion_rate: number;
};

type PipelineRow = { label: string; count: number; value: number; color: string };

type PipelineStats = { total_value: number; max_value: number; win_rate: number; avg_deal_size: number };

type ScheduleItem = {
    id: number;
    name: string;
    time: string;
    listing_title: string;
    listing_address: string;
    type: string;
};

type HotLead = { id: number; name: string; initials: string; status: string; deal_value: number };

type ListingRow = {
    id: number;
    title: string;
    location: string;
    listing_type: string;
    views: number;
    inquiries: number;
    viewings: number;
    days_on_market: number;
    price_label: string;
};

type Props = {
    agent: Agent;
    kpis: KPIs;
    pipeline_snapshot: PipelineRow[];
    pipeline_stats: PipelineStats;
    today_schedule: ScheduleItem[];
    hot_leads: HotLead[];
    listing_performance: ListingRow[];
};

// ── Hot lead tag ─────────────────────────────────────────────────────────────

const hotTag = (status: string) => {
    if (status === 'offer') return <span className="text-[10px] bg-danger/10 text-danger px-1.5 py-0.5 rounded-full font-semibold ml-auto">HOT</span>;
    if (status === 'viewing') return <span className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full font-semibold ml-auto">VIEWING</span>;
    return <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full font-semibold ml-auto">WARM</span>;
};

const typeLabel = (t: string) => {
    if (t === 'for_sale') return <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-success font-semibold">SALE</span>;
    if (t === 'long_term_rent') return <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-semibold">RENT</span>;
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-semibold">STAY</span>;
};

/// ── Page ─────────────────────────────────────────────────────────────────────

export default function AgentOverview({
    agent, kpis, pipeline_snapshot, pipeline_stats, today_schedule, hot_leads, listing_performance,
}: Props) {
    const totalDeals = pipeline_snapshot.reduce((a, b) => a + b.count, 0);
    const stage = (label: string) => pipeline_snapshot.find((r) => r.label === label)?.count ?? 0;
    const closed = stage('Closed');
    const inPlay = stage('Viewing') + stage('Offer');
    const early = stage('New Lead') + stage('Qualified');
    const closedPct = totalDeals > 0 ? Math.round((closed / totalDeals) * 100) : 0;
    const next = today_schedule[0];

    return (
        <AgentLayout crumb="Dashboard" agencyName={agent.agency_name}>
            <Head title="Agent Dashboard" />

            <div className="px-4 sm:px-7 py-6">
                <PageHeader
                    title={`${greet()}, ${agent.name.split(' ')[0]}`}
                    subtitle={
                        <>
                            {today()} · <span className="font-semibold text-ink-900">{today_schedule.length} viewings</span> today
                            {kpis.open_leads > 0 && <> and <span className="font-semibold text-ink-900">{kpis.open_leads} leads</span> in your pipeline</>}.
                        </>
                    }
                    actions={
                        <>
                            <Link href="/agent/listings/create" className={btnPrimary}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
                                Create Listing
                            </Link>
                            <Link href="/agent/pipeline?new=1" className={btnOutline}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>
                                New Lead
                            </Link>
                        </>
                    }
                />

                {/* KPI row — first tile is the accent hero */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                    <KpiCard hero label="Active Listings" value={kpis.active_listings} sub="+2 this week" href="/agent/listings" />
                    <KpiCard label="Open Leads" value={kpis.open_leads} sub="Active pipeline" href="/agent/pipeline" />
                    <KpiCard label="YTD Commission" value={fmtMoney(kpis.ytd_commission)} sub="Year to date" href="/agent/commission" />
                    <KpiCard label="Conversion Rate" value={kpis.conversion_rate + '%'} sub="Lead-to-close ratio" href="/agent/analytics" />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-4">
                    {/* Pipeline by stage — Fernly pill bars */}
                    <Card
                        className="xl:col-span-6"
                        title="Pipeline Analytics"
                        subtitle={`${totalDeals} active deals · ${fmtMoney(pipeline_stats.total_value)} potential value`}
                        action={<Link href="/agent/pipeline" className="text-[12px] font-semibold text-brand-700 hover:underline">View pipeline →</Link>}
                    >
                        <ErrorBoundary variant="section" label="pipeline chart">
                            <PillBars
                                data={pipeline_snapshot.map((r) => ({ label: r.label.replace(' Lead', ''), value: r.count }))}
                                peakLabel={(n) => `${n} ${n === 1 ? 'deal' : 'deals'}`}
                            />
                        </ErrorBoundary>
                    </Card>

                    {/* Today's schedule — Fernly reminder card */}
                    <Card className="xl:col-span-3 flex flex-col" bodyClassName="flex-1 flex flex-col" title="Today's Schedule">
                        {next ? (
                            <>
                                <p className="text-[20px] leading-snug font-semibold text-brand-700 tracking-tight">Viewing — {next.listing_title}</p>
                                <p className="text-[12.5px] text-ink-500 mt-2">Time : {next.time} SAST</p>
                                <p className="text-[12.5px] text-ink-500 truncate">{next.name} · {next.listing_address}</p>
                                {today_schedule.length > 1 && (
                                    <ul className="mt-3 space-y-1.5">
                                        {today_schedule.slice(1, 4).map((v) => (
                                            <li key={v.id} className="flex gap-2 text-[12px] text-ink-600">
                                                <span className="font-semibold tabular-nums w-11 shrink-0">{v.time}</span>
                                                <span className="truncate">{v.listing_title}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        ) : (
                            <>
                                <p className="text-[20px] leading-snug font-semibold text-brand-700 tracking-tight">No viewings today</p>
                                <p className="text-[12.5px] text-ink-500 mt-2">A good day to follow up on warm leads.</p>
                            </>
                        )}
                        <div className="flex-1 min-h-4" />
                        <Link href="/agent/viewings" className={btnPrimary + ' w-full mt-4'}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
                            Open viewings
                        </Link>
                    </Card>

                    {/* Hot leads — Fernly project list */}
                    <Card
                        className="xl:col-span-3 xl:row-span-2"
                        title="Hot Leads"
                        action={
                            <Link href="/agent/pipeline?new=1" className="inline-flex items-center gap-1 rounded-full border border-ink-900/70 px-3 py-1 text-[12px] font-semibold hover:bg-ink-900 hover:text-white transition">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>New
                            </Link>
                        }
                    >
                        {hot_leads.length === 0 ? (
                            <p className="py-8 text-center text-[13px] text-ink-400">No hot leads right now</p>
                        ) : (
                            <ul className="space-y-3.5">
                                {hot_leads.map((lead, i) => (
                                    <li key={lead.id} className="flex items-center gap-3">
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10.5px] font-bold shrink-0 ${['bg-brand-100 text-brand-800', 'bg-amber-100 text-amber-800', 'bg-sky-100 text-sky-800', 'bg-rose-100 text-rose-800'][i % 4]}`}>
                                            {lead.initials}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] font-semibold truncate">{lead.name}</p>
                                            <p className="text-[11px] text-ink-500">{fmtMoney(lead.deal_value)} value</p>
                                        </div>
                                        {hotTag(lead.status)}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    {/* Pipeline value by stage — Fernly team-collaboration rows */}
                    <Card
                        className="xl:col-span-5"
                        title="Pipeline Snapshot"
                        subtitle={`Win rate ${pipeline_stats.win_rate}% · avg. deal ${fmtMoney(pipeline_stats.avg_deal_size)}`}
                    >
                        <ul className="space-y-3">
                            {pipeline_snapshot.map((row) => (
                                <li key={row.label} className="flex items-center gap-3">
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${row.color === 'success' ? 'bg-success/10 text-success' : 'bg-brand-50 text-brand-700'}`}>
                                        {row.count}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-semibold">{row.label}</p>
                                        <p className="text-[11px] text-ink-500">{row.count} {row.count === 1 ? 'lead' : 'leads'} · <span className="font-semibold text-ink-700">{fmtMoney(row.value)}</span></p>
                                    </div>
                                    <StatusPill tone={row.color === 'success' ? 'success' : row.label === 'Offer' || row.label === 'Viewing' ? 'warning' : 'muted'}>
                                        {row.color === 'success' ? 'Won' : row.label === 'Offer' || row.label === 'Viewing' ? 'In progress' : 'Early'}
                                    </StatusPill>
                                </li>
                            ))}
                        </ul>
                    </Card>

                    {/* Deal progress gauge */}
                    <Card className="xl:col-span-4" title="Deal Progress">
                        <Gauge
                            centerValue={`${closedPct}%`}
                            centerLabel="Deals closed"
                            segments={[
                                { label: 'Closed', value: closed, tone: 'dark' },
                                { label: 'In progress', value: inPlay, tone: 'mid' },
                                { label: 'Early stage', value: early, tone: 'hatch' },
                            ]}
                        />
                    </Card>
                </div>

                {/* Listing performance */}
                <Card
                    title="Listing Performance"
                    subtitle="Your assigned properties"
                    action={<Link href="/agent/listings" className="text-[12px] font-semibold text-brand-700 hover:underline">All listings →</Link>}
                >
                    {listing_performance.length === 0 ? (
                        <div className="py-8 text-center text-[13px] text-ink-400">No listings assigned yet</div>
                    ) : (
                        <div className="overflow-x-auto"><table className="w-full min-w-[700px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200">
                                    <th className="font-semibold py-2">Property</th>
                                    <th className="font-semibold py-2">Type</th>
                                    <th className="font-semibold py-2 text-right">Views</th>
                                    <th className="font-semibold py-2 text-right">Inquiries</th>
                                    <th className="font-semibold py-2 text-right">Viewings</th>
                                    <th className="font-semibold py-2 text-right">Days on Market</th>
                                    <th className="font-semibold py-2 text-right">Price</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {listing_performance.map((l) => (
                                    <tr key={l.id} className="border-b border-ink-100 hover:bg-ink-50">
                                        <td className="py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-300 shrink-0" />
                                                <div>
                                                    <p className="font-medium">{l.title}</p>
                                                    <p className="text-[11px] text-ink-500">{l.location}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{typeLabel(l.listing_type)}</td>
                                        <td className="text-right tabular-nums">{l.views.toLocaleString('en-ZA')}</td>
                                        <td className="text-right tabular-nums">{l.inquiries}</td>
                                        <td className="text-right tabular-nums">{l.viewings}</td>
                                        <td className="text-right tabular-nums">{l.days_on_market}</td>
                                        <td className="text-right tabular-nums font-semibold">{l.price_label}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table></div>
                    )}
                </Card>
            </div>
        </AgentLayout>
    );
}
