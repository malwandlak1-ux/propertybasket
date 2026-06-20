import { Head, Link } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import ErrorBoundary from '@/Components/ErrorBoundary';

type Signup = {
    id: number;
    name: string;
    email: string;
    role: string;
    role_label: string;
    created_at: string;
    initials: string;
};

type GrowthPoint = { label: string; agencies: number; landlords: number; contractors: number };
type HealthItem = { name: string; status: 'healthy' | 'warning' | 'down'; detail: string };

type Props = {
    kpis: {
        mrr: number;
        agency_accounts: number;
        agencies: number;
        landlords: number;
        contractors: number;
        end_users: number;
        agents: number;
        tenants: number;
        listings: number;
        gmv_ytd: number;
        new_this_month: number;
    };
    recent_signups: Signup[];
    growth: GrowthPoint[];
    health: HealthItem[];
};

function fmtMoney(n: number) {
    if (n >= 1_000_000) return `R ${(n / 1_000_000).toFixed(1)}m`;
    if (n >= 1_000)     return `R ${(n / 1_000).toFixed(0)}k`;
    return `R ${n.toLocaleString('en-ZA')}`;
}

function fmtNum(n: number) {
    return n.toLocaleString('en-ZA');
}

const ROLE_COLOR: Record<string, string> = {
    super_admin:  'bg-ink-900 text-white',
    agency_admin: 'bg-brand-50 text-brand-700',
    agent:        'bg-violet-50 text-violet-700',
    landlord:     'bg-sky-50 text-sky-700',
    tenant:       'bg-emerald-50 text-emerald-700',
    contractor:   'bg-amber-50 text-amber-700',
};

function ChartBar({ point, max }: { point: GrowthPoint; max: number }) {
    const h = (v: number) => `${Math.max((v / Math.max(max, 1)) * 100, 2)}%`;
    return (
        <div className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center gap-0.5 h-48">
                <div className="bg-brand-500 rounded-t w-3.5 transition-all" style={{ height: h(point.agencies) }} title={`Agencies: ${point.agencies}`} />
                <div className="bg-sky-400 rounded-t w-3.5 transition-all" style={{ height: h(point.landlords) }} title={`Landlords: ${point.landlords}`} />
                <div className="bg-success rounded-t w-3.5 transition-all" style={{ height: h(point.contractors) }} title={`Contractors: ${point.contractors}`} />
            </div>
            <span className="text-[10px] text-ink-500">{point.label}</span>
        </div>
    );
}

export default function AdminOverview({ kpis, recent_signups, growth, health }: Props) {
    const maxGrowth = Math.max(
        ...growth.flatMap((g) => [g.agencies, g.landlords, g.contractors]),
        1
    );

    return (
        <AdminLayout crumb="Overview">
            <Head title="Platform Overview" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-7">
                    <div>
                        <p className="text-[13px] text-ink-500">{new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <h1 className="text-3xl font-bold tracking-tight mt-1">Platform Overview</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {fmtNum(kpis.agency_accounts)} business accounts · {fmtNum(kpis.end_users)} end users ·{' '}
                            <span className="font-semibold text-success">all systems operational</span>
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href="/admin/announcements"
                            className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 transition flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 11l18-5v12L3 14v-3z"/></svg>
                            New Announcement
                        </Link>
                        <a
                            href="/admin/overview.pdf"
                            download
                            title="Download a PDF snapshot of this overview"
                            className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 transition flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                            Export Report
                        </a>
                    </div>
                </div>

                {/* ── KPI Grid ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KpiCard
                        label="MRR"
                        value={fmtMoney(kpis.mrr)}
                        sub="Monthly recurring revenue"
                        delta="↑ 12%"
                        deltaTone="success"
                        iconBg="bg-emerald-50"
                        iconColor="text-success"
                        icon={<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>}
                    />
                    <KpiCard
                        label="Business Accounts"
                        value={fmtNum(kpis.agency_accounts)}
                        sub={`${kpis.agencies} agencies · ${kpis.landlords} landlords · ${kpis.contractors} contractors`}
                        delta={`+${kpis.new_this_month} this mo`}
                        deltaTone="success"
                        iconBg="bg-brand-50"
                        iconColor="text-brand-600"
                        icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></>}
                    />
                    <KpiCard
                        label="End Users"
                        value={fmtNum(kpis.end_users)}
                        sub={`${kpis.agents} agents + ${kpis.tenants} tenants`}
                        iconBg="bg-violet-50"
                        iconColor="text-brand-600"
                        icon={<rect x="3" y="4" width="18" height="16" rx="2"/>}
                    />
                    <KpiCard
                        label="GMV Processed"
                        value={fmtMoney(kpis.gmv_ytd)}
                        sub="Rent + commissions YTD"
                        iconBg="bg-amber-50"
                        iconColor="text-warning"
                        icon={<><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 6-6"/></>}
                    />
                </div>

                {/* ── 2-col: growth chart + recent signups ─────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="col-span-2 bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-semibold">Platform Growth</h2>
                                <p className="text-xs text-ink-500 mt-0.5">New account signups · Last 6 months</p>
                            </div>
                            <div className="flex items-center gap-3 text-[11px]">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500"></span>Agencies</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-sky-400"></span>Landlords</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-success"></span>Contractors</span>
                            </div>
                        </div>
                        <ErrorBoundary variant="section" label="growth chart">
                            <div className="flex items-end gap-4 h-52 px-2 overflow-x-auto">
                                {growth.map((p) => <ChartBar key={p.label} point={p} max={maxGrowth} />)}
                            </div>
                        </ErrorBoundary>
                    </div>

                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <h2 className="text-base font-semibold mb-4">Recent Signups</h2>
                        <div className="space-y-3">
                            {recent_signups.length === 0 ? (
                                <p className="text-[12px] text-ink-400 text-center py-4">No signups yet</p>
                            ) : recent_signups.map((s) => (
                                <div key={s.id} className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${ROLE_COLOR[s.role] ?? 'bg-ink-100 text-ink-600'}`}>
                                        {s.initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-semibold truncate">{s.name}</p>
                                        <p className="text-[10px] text-ink-500">{s.role_label} · {s.created_at}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── System status strip ──────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {health.map((h) => (
                        <div key={h.name} className="bg-white rounded-xl border border-ink-200 p-4 shadow-soft flex items-center gap-3">
                            <div className={
                                'w-9 h-9 rounded-lg flex items-center justify-center ' +
                                (h.status === 'healthy' ? 'bg-success/15' :
                                 h.status === 'warning' ? 'bg-warning/15' :
                                 'bg-danger/15')
                            }>
                                <span className={
                                    'w-2.5 h-2.5 rounded-full animate-pulse ' +
                                    (h.status === 'healthy' ? 'bg-success' :
                                     h.status === 'warning' ? 'bg-warning' :
                                     'bg-danger')
                                } />
                            </div>
                            <div>
                                <p className="text-[12px] font-semibold">{h.name}</p>
                                <p className="text-[10px] text-ink-500">{h.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
}

function KpiCard({ label, value, sub, delta, deltaTone, iconBg, iconColor, icon }: {
    label: string; value: string; sub: string;
    delta?: string; deltaTone?: 'success' | 'danger';
    iconBg: string; iconColor: string; icon: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">{label}</span>
                <span className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center`}>
                    <svg className={`w-3.5 h-3.5 ${iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        {icon}
                    </svg>
                </span>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{value}</span>
                {delta && (
                    <span className={`text-xs font-semibold ${deltaTone === 'danger' ? 'text-danger' : 'text-success'}`}>
                        {delta}
                    </span>
                )}
            </div>
            <p className="text-[11px] text-ink-500 mt-1">{sub}</p>
        </div>
    );
}
