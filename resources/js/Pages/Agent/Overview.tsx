import { Head, Link } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';

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

// ── Sparkline (static SVG paths) ────────────────────────────────────────────

const Spark = ({ color }: { color: string }) => (
    <svg className="w-full h-8 mt-3" viewBox="0 0 100 30" preserveAspectRatio="none">
        <path d="M0,22 L15,18 L30,20 L45,12 L60,14 L75,8 L100,4" fill="none" stroke={color} strokeWidth="2" />
    </svg>
);

// ── Hot lead tag ─────────────────────────────────────────────────────────────

const hotTag = (status: string) => {
    if (status === 'offer') return <span className="text-[10px] bg-danger/10 text-danger px-1.5 py-0.5 rounded-full font-semibold ml-auto">HOT</span>;
    if (status === 'viewing') return <span className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full font-semibold ml-auto">VIEWING</span>;
    return <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full font-semibold ml-auto">WARM</span>;
};

const typeLabel = (t: string) => {
    if (t === 'for_sale') return <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-success font-semibold">SALE</span>;
    if (t === 'long_term_rent') return <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-semibold">RENT</span>;
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-brand-700 font-semibold">STAY</span>;
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AgentOverview({
    agent, kpis, pipeline_snapshot, pipeline_stats, today_schedule, hot_leads, listing_performance,
}: Props) {
    const maxValue = pipeline_stats.max_value || 1;

    const kpiCards = [
        {
            label: 'Active Listings', value: kpis.active_listings.toString(),
            sub: '+2 this week', subColor: 'text-success',
            iconBg: 'bg-brand-50', iconColor: 'text-brand-600',
            icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M3 21V10l9-7 9 7v11H3z" /></svg>,
            sparkColor: '#5B3DF5',
        },
        {
            label: 'Open Leads', value: kpis.open_leads.toString(),
            sub: 'Active pipeline', subColor: 'text-ink-500',
            iconBg: 'bg-amber-50', iconColor: 'text-warning',
            icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>,
            sparkColor: '#F59E0B',
        },
        {
            label: 'YTD Commission', value: fmtMoney(kpis.ytd_commission),
            sub: 'Year to date', subColor: 'text-success',
            iconBg: 'bg-emerald-50', iconColor: 'text-success',
            icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
            sparkColor: '#10B981',
        },
        {
            label: 'Conversion Rate', value: kpis.conversion_rate + '%',
            sub: 'Lead-to-close ratio', subColor: 'text-ink-500',
            iconBg: 'bg-violet-50', iconColor: 'text-brand-600',
            icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 6-6" /></svg>,
            sparkColor: '#5B3DF5',
        },
    ];

    return (
        <AgentLayout crumb="Dashboard" agencyName={agent.agency_name}>
            <Head title="Agent Dashboard" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                {/* Greeting */}
                <div className="flex flex-wrap items-end justify-between gap-3 mb-7">
                    <div>
                        <p className="text-[13px] text-ink-500">{today()}</p>
                        <h1 className="text-3xl font-bold tracking-tight mt-1">
                            {greet()}, {agent.name.split(' ')[0]} 👋
                        </h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            You have{' '}
                            <span className="font-semibold text-ink-900">{today_schedule.length} viewings</span> today
                            {kpis.open_leads > 0 && (
                                <> and <span className="font-semibold text-ink-900">{kpis.open_leads} leads</span> in your pipeline</>
                            )}.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/agent/pipeline?new=1"
                            className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 transition flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
                            New Lead
                        </Link>
                        <Link href="/agent/listings/create" className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition flex items-center gap-2">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
                            Create Listing
                        </Link>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {kpiCards.map((k) => (
                        <div key={k.label} className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">{k.label}</span>
                                <span className={`w-7 h-7 rounded-lg ${k.iconBg} flex items-center justify-center`}>
                                    <span className={k.iconColor}>{k.icon}</span>
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold">{k.value}</span>
                                <span className={`text-xs font-semibold ${k.subColor}`}>{k.sub}</span>
                            </div>
                            <Spark color={k.sparkColor} />
                        </div>
                    ))}
                </div>

                {/* Two-column body */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    {/* LEFT: Pipeline snapshot */}
                    <div className="col-span-2 bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-semibold">Pipeline Snapshot</h2>
                                <p className="text-xs text-ink-500 mt-0.5">
                                    {pipeline_snapshot.reduce((a, b) => a + b.count, 0)} active deals ·{' '}
                                    {fmtMoney(pipeline_stats.total_value)} potential value
                                </p>
                            </div>
                            <Link href="/agent/pipeline" className="text-[12px] font-medium text-brand-600 hover:underline">
                                View pipeline →
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {pipeline_snapshot.map((row) => {
                                const pct = row.color === 'success' ? 12.5 : Math.min(100, (row.value / maxValue) * 100);
                                const bg = row.color === 'success' ? 'bg-success' : 'bg-brand-500';
                                return (
                                    <div key={row.label} className="flex items-center gap-3">
                                        <span className="w-24 text-[12px] text-ink-500">{row.label}</span>
                                        <div className="flex-1 h-7 bg-ink-100 rounded-md overflow-hidden">
                                            {row.count > 0 && (
                                                <div
                                                    className={`h-full ${bg} flex items-center justify-end px-3 text-[11px] font-semibold text-white transition-all`}
                                                    style={{ width: `${Math.max(pct, 15)}%` }}
                                                >
                                                    {row.count} {row.count === 1 ? 'lead' : 'leads'}
                                                </div>
                                            )}
                                        </div>
                                        <span className="w-20 text-right text-[12px] font-mono">{fmtMoney(row.value)}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-5 pt-5 border-t border-ink-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-[11px] text-ink-500 uppercase tracking-wider">Total Deals</p>
                                <p className="text-xl font-bold mt-1">{pipeline_snapshot.reduce((a, b) => a + b.count, 0)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-ink-500 uppercase tracking-wider">Win Rate</p>
                                <p className="text-xl font-bold mt-1 text-success">{pipeline_stats.win_rate}%</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-ink-500 uppercase tracking-wider">Avg. Deal Size</p>
                                <p className="text-xl font-bold mt-1">{fmtMoney(pipeline_stats.avg_deal_size)}</p>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Today's schedule */}
                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-semibold">Today's Schedule</h2>
                            <Link href="/agent/viewings" className="text-[12px] font-medium text-brand-600 hover:underline">
                                All →
                            </Link>
                        </div>

                        {today_schedule.length === 0 ? (
                            <div className="py-8 text-center text-[13px] text-ink-400">No viewings today</div>
                        ) : (
                            <div className="space-y-3">
                                {today_schedule.map((item, idx) => (
                                    <div
                                        key={item.id}
                                        className={`flex gap-3 p-3 rounded-lg hover:bg-ink-50 ${idx === 0 ? 'border-l-2 border-brand-500 bg-brand-50/30' : ''}`}
                                    >
                                        <div className="text-center w-12 shrink-0">
                                            <p className="text-[10px] text-ink-500 uppercase font-semibold">{item.time}</p>
                                            <p className="text-[10px] text-ink-400">SAST</p>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-semibold truncate">Viewing — {item.listing_title}</p>
                                            <p className="text-[11px] text-ink-500 truncate">{item.name} · {item.listing_address}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {hot_leads.length > 0 && (
                            <div className="mt-5 pt-4 border-t border-ink-200">
                                <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold mb-2">Hot Leads</p>
                                <div className="space-y-2">
                                    {hot_leads.map((lead) => (
                                        <div key={lead.id} className="flex items-center justify-between p-2 rounded-md hover:bg-ink-50">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                                    {lead.initials}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[12px] font-semibold truncate">{lead.name}</p>
                                                    <p className="text-[10px] text-ink-500">{fmtMoney(lead.deal_value)} value</p>
                                                </div>
                                            </div>
                                            {hotTag(lead.status)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Listing performance */}
                <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-base font-semibold">Listing Performance</h2>
                            <p className="text-xs text-ink-500 mt-0.5">Your assigned properties</p>
                        </div>
                        <Link href="/agent/listings" className="text-[12px] font-medium text-brand-600 hover:underline">
                            All listings →
                        </Link>
                    </div>

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
                                                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 shrink-0" />
                                                <div>
                                                    <p className="font-medium">{l.title}</p>
                                                    <p className="text-[11px] text-ink-500">{l.location}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{typeLabel(l.listing_type)}</td>
                                        <td className="text-right font-mono">{l.views.toLocaleString('en-ZA')}</td>
                                        <td className="text-right font-mono">{l.inquiries}</td>
                                        <td className="text-right font-mono">{l.viewings}</td>
                                        <td className="text-right font-mono">{l.days_on_market}</td>
                                        <td className="text-right font-mono font-semibold">{l.price_label}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table></div>
                    )}
                </div>
            </div>
        </AgentLayout>
    );
}
