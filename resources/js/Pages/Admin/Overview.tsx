import { Head, Link } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import ErrorBoundary from '@/Components/ErrorBoundary';
import { btnOutline, btnPrimary, KpiCard as FernKpi, PageHeader, SectionCard } from '@/Components/Dashboard/Charts';

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
                <div className="pb-grow bg-brand-800 rounded-full w-3.5" style={{ height: h(point.agencies) }} title={`Agencies: ${point.agencies}`} />
                <div className="pb-grow bg-brand-500 rounded-full w-3.5" style={{ height: h(point.landlords) }} title={`Landlords: ${point.landlords}`} />
                <div className="pb-grow bg-brand-200 rounded-full w-3.5" style={{ height: h(point.contractors) }} title={`Contractors: ${point.contractors}`} />
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

            <div className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Platform Overview"
                    subtitle={
                        <>
                            {new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} ·{' '}
                            {fmtNum(kpis.agency_accounts)} business accounts · {fmtNum(kpis.end_users)} end users ·{' '}
                            {health.some((h) => h.status === 'down') ? (
                                <span className="font-semibold text-danger">service outage</span>
                            ) : health.some((h) => h.status === 'warning') ? (
                                <span className="font-semibold text-amber-700">partial degradation</span>
                            ) : (
                                <span className="font-semibold text-success">all systems operational</span>
                            )}
                        </>
                    }
                    actions={
                        <>
                        <Link href="/admin/announcements" className={btnOutline}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 11l18-5v12L3 14v-3z"/></svg>
                            New Announcement
                        </Link>
                        <a
                            href="/admin/overview.pdf"
                            download
                            title="Download a PDF snapshot of this overview"
                            className={btnPrimary}
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                            Export Report
                        </a>
                        </>
                    }
                />

                {/* ── KPI Grid ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <KpiCard hero
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-4 items-start">
                    <SectionCard
                        className="lg:col-span-2"
                        title="Platform Growth"
                        subtitle="New account signups · Last 6 months"
                        action={
                            <div className="flex flex-wrap items-center gap-3 text-[11px]">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-800"></span>Agencies</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-500"></span>Landlords</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-200"></span>Contractors</span>
                            </div>
                        }
                    >
                        <ErrorBoundary variant="section" label="growth chart">
                            <div className="flex items-end gap-4 h-52 px-2 overflow-x-auto">
                                {growth.map((p) => <ChartBar key={p.label} point={p} max={maxGrowth} />)}
                            </div>
                        </ErrorBoundary>
                    </SectionCard>

                    <SectionCard title="Recent Signups" subtitle="Newest accounts first">
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
                    </SectionCard>
                </div>

                {/* ── System status strip ──────────────────────────────── */}
                <SectionCard
                    title="System Status"
                    subtitle="Live health of platform services"
                    action={<Link href="/admin/system" className="text-[12px] text-brand-700 font-semibold hover:underline">System Health →</Link>}
                >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {health.map((h) => (
                        <div key={h.name} className="rounded-xl border border-ink-200/70 p-3.5 flex items-center gap-3">
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
                </SectionCard>
            </div>
        </AdminLayout>
    );
}

function KpiCard({ label, value, sub, subTone, hero, delta, deltaTone }: {
    label: string; value: string; sub: string;
    subTone?: 'warning' | 'danger'; hero?: boolean;
    delta?: string; deltaTone?: 'success' | 'danger';
    [legacy: string]: unknown;
}) {
    const subCls = hero ? '' : subTone === 'warning' ? 'text-warning' : subTone === 'danger' ? 'text-danger' : '';
    return (
        <FernKpi
            hero={hero}
            label={label}
            value={value}
            sub={
                <>
                    {delta && (
                        <span className={'font-semibold mr-1 ' + (hero ? 'text-white' : deltaTone === 'danger' ? 'text-danger' : 'text-success')}>{delta}</span>
                    )}
                    <span className={subCls}>{sub}</span>
                </>
            }
        />
    );
}
