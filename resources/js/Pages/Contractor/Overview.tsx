import { Head, Link } from '@inertiajs/react';
import ContractorLayout from '@/Layouts/ContractorLayout';

type Props = {
    counts: { requests?: number; active_jobs?: number; messages?: number };
    contractor: {
        id: number;
        name: string;
        business_name: string | null;
        average_rating: number;
        total_reviews: number;
        total_jobs: number;
    };
    kpis: {
        active_jobs: number;
        open_requests: number;
        pending_quotes: number;
        month_earnings: number;
    };
    emergency: null | {
        id: number;
        title: string;
        property: string;
        address: string | null;
        agency: string;
        created: string | null;
    };
    jobs: Array<{
        id: number;
        title: string;
        property: string;
        tenant: string;
        urgency: string;
        category: string;
        status: string;
        preferred: string | null;
        time_slot: string | null;
    }>;
    expiring_quote: null | { id: number; title: string; total: number; expires: string | null };
    recent_invoices: Array<{ id: number; title: string; amount: number; status: string; when: string | null }>;
};

function fmtMoney(n: number) {
    if (n >= 1_000_000) return `R ${(n / 1_000_000).toFixed(1)}m`;
    if (n >= 1_000)     return `R ${(n / 1_000).toFixed(0)}k`;
    return `R ${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

const URGENCY_CFG: Record<string, string> = {
    emergency: 'bg-danger/15 text-danger',
    high:      'bg-warning/15 text-warning',
    medium:    'bg-amber-50 text-amber-700',
    low:       'bg-ink-100 text-ink-600',
};

const STATUS_CFG: Record<string, string> = {
    open:        'bg-warning/15 text-warning',
    in_progress: 'bg-brand-50 text-brand-700',
    completed:   'bg-success/15 text-success',
    paid:        'bg-emerald-100 text-emerald-700',
};

const INV_CFG: Record<string, string> = {
    draft:     'bg-ink-100 text-ink-600',
    submitted: 'bg-brand-50 text-brand-700',
    approved:  'bg-warning/15 text-warning',
    paid:      'bg-success/15 text-success',
    rejected:  'bg-danger/15 text-danger',
};

export default function ContractorOverview({ counts, contractor, kpis, emergency, jobs, expiring_quote, recent_invoices }: Props) {
    const firstName = contractor.name.split(' ')[0] || 'there';

    return (
        <ContractorLayout crumb="Dashboard" business={contractor.business_name ?? undefined} counts={counts}>
            <Head title="Contractor Dashboard" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-7">
                    <div>
                        <p className="text-[13px] text-ink-500">
                            {new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                        <h1 className="text-3xl font-bold tracking-tight mt-1">Welcome back, {firstName} 🔧</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            You have <span className="font-semibold text-ink-900">{kpis.active_jobs} active jobs</span>,{' '}
                            <span className="font-semibold text-ink-900">{kpis.open_requests} to commence</span>
                            {expiring_quote && <>, and <span className="font-semibold text-warning">1 quote expiring soon</span></>}.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/contractor/quotes" className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 flex items-center gap-2 transition">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                            New Quote
                        </Link>
                        <Link href="/contractor/invoices" className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 flex items-center gap-2 transition">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>
                            New Invoice
                        </Link>
                    </div>
                </div>

                {/* Emergency alert */}
                {emergency && (
                    <div className="bg-danger/5 border-2 border-danger rounded-xl p-4 mb-6 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-danger flex items-center justify-center text-white shrink-0 animate-pulse">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <path d="M12 9v4M12 17h.01"/>
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-[13px] font-bold text-danger">🚨 EMERGENCY · {emergency.created}</p>
                            <p className="text-[12px] text-ink-700 mt-0.5">
                                {emergency.agency} · {emergency.title} at {emergency.property} · 4-hour SLA
                            </p>
                        </div>
                        <Link href="/contractor/requests" className="px-3 py-2 text-[12px] bg-danger text-white rounded-md font-bold hover:bg-danger/90 transition">
                            View
                        </Link>
                    </div>
                )}

                {/* KPI Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Kpi label="Active Jobs"   value={kpis.active_jobs.toString()} sub="In progress + awaiting payment" iconColor="text-brand-600" iconBg="bg-brand-50"   icon={<circle cx="12" cy="12" r="10"/>} />
                    <Kpi label="To Commence"   value={kpis.open_requests.toString()} sub="Accepted, not started" iconColor="text-warning"   iconBg="bg-warning/15" icon={<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>} />
                    <Kpi label="Pending Quotes" value={kpis.pending_quotes.toString()} sub="Awaiting client response" iconColor="text-amber-600" iconBg="bg-amber-50"   icon={<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>} />
                    <Kpi label="Earned MTD"     value={fmtMoney(kpis.month_earnings)} sub="Gross from paid invoices" iconColor="text-success"   iconBg="bg-success/15" icon={<><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>} />
                </div>

                {/* 2-col: active jobs + side rail */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="col-span-2 bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-semibold">Active Jobs</h2>
                                <p className="text-xs text-ink-500 mt-0.5">Open + in-progress jobs assigned to you</p>
                            </div>
                            <Link href="/contractor/jobs" className="text-[12px] font-semibold text-brand-600 hover:underline">View all →</Link>
                        </div>

                        <div className="space-y-3">
                            {jobs.length === 0 ? (
                                <p className="text-[12px] text-ink-400 text-center py-8">No active jobs right now</p>
                            ) : jobs.map((j) => (
                                <div key={j.id} className="flex items-center gap-4 p-3 rounded-lg border border-ink-200 hover:shadow-soft transition">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${URGENCY_CFG[j.urgency] ?? 'bg-ink-100 text-ink-600'}`}>
                                                {j.urgency}
                                            </span>
                                            <span className="text-[9px] text-ink-500 uppercase font-semibold">{j.category}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${STATUS_CFG[j.status] ?? 'bg-ink-100 text-ink-600'}`}>
                                                {j.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p className="text-[13px] font-semibold truncate">{j.title}</p>
                                        <p className="text-[11px] text-ink-500 mt-0.5">{j.property} · {j.tenant}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[11px] text-ink-500">{j.preferred ?? 'No date'}</p>
                                        {j.time_slot && <p className="text-[10px] text-ink-400 mt-0.5">{j.time_slot}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Profile card */}
                        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <h2 className="text-base font-semibold mb-3">Your Reputation</h2>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl font-bold">{contractor.average_rating > 0 ? contractor.average_rating.toFixed(1) : '—'}</span>
                                <span className="text-warning text-lg">★★★★★</span>
                            </div>
                            <p className="text-[11px] text-ink-500">
                                {contractor.total_reviews} reviews · {contractor.total_jobs} jobs completed
                            </p>
                        </div>

                        {/* Quote expiring */}
                        {expiring_quote && (
                            <div className="bg-warning/5 border border-warning/30 rounded-xl p-4">
                                <p className="text-[11px] uppercase tracking-wider font-semibold text-warning mb-2">Quote Expiring</p>
                                <p className="text-[13px] font-semibold truncate">{expiring_quote.title}</p>
                                <p className="text-[11px] text-ink-500 mt-1">{fmtMoney(expiring_quote.total)} · expires {expiring_quote.expires}</p>
                                <Link href="/contractor/quotes" className="block mt-3 text-center text-[12px] py-1.5 bg-warning text-white rounded-md font-semibold hover:bg-warning/90 transition">
                                    Follow up
                                </Link>
                            </div>
                        )}

                        {/* Recent invoices */}
                        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <h2 className="text-base font-semibold mb-3">Recent Invoices</h2>
                            <div className="space-y-2">
                                {recent_invoices.length === 0 ? (
                                    <p className="text-[12px] text-ink-400 text-center py-4">No invoices yet</p>
                                ) : recent_invoices.map((inv) => (
                                    <div key={inv.id} className="flex items-center justify-between py-1.5 border-b border-ink-100 last:border-b-0">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[12px] font-semibold truncate">{inv.title}</p>
                                            <p className="text-[10px] text-ink-500">{inv.when}</p>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-[12px] font-mono font-semibold">{fmtMoney(inv.amount)}</p>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${INV_CFG[inv.status] ?? 'bg-ink-100 text-ink-600'}`}>
                                                {inv.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ContractorLayout>
    );
}

function Kpi({ label, value, sub, iconColor, iconBg, icon }: { label: string; value: string; sub: string; iconColor: string; iconBg: string; icon: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">{label}</span>
                <span className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center`}>
                    <svg className={`w-3.5 h-3.5 ${iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>{icon}</svg>
                </span>
            </div>
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-[11px] text-ink-500 mt-1">{sub}</p>
        </div>
    );
}
