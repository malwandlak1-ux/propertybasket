import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';

type Agency = {
    id: number;
    name: string;
    slug: string;
    city: string;
    created_at: string | null;
    plan: string;
    agents_count: number;
    listings_count: number;
    eaab_ffc_number: string | null;
    eaab_verified: boolean;
    vat_registered: boolean;
    status: string;
    initials: string;
};

type Props = {
    agencies: Agency[];
    stats: { active: number; pending: number; suspended: number; total_agents: number };
};

const PLAN_CFG: Record<string, string> = {
    starter:    'bg-ink-100 text-ink-700',
    growth:     'bg-brand-50 text-brand-700',
    enterprise: 'bg-brand-100 text-brand-700',
};

const STATUS_CFG: Record<string, string> = {
    active:    'bg-success/15 text-success',
    pending:   'bg-warning/15 text-warning',
    suspended: 'bg-danger/15 text-danger',
};

const GRAD_COLORS = [
    'from-brand-500 to-brand-700',
    'from-sky-500 to-sky-700',
    'from-amber-500 to-amber-700',
    'from-emerald-500 to-emerald-700',
    'from-rose-500 to-rose-700',
    'from-violet-500 to-violet-700',
];

function gradFor(id: number) {
    return GRAD_COLORS[id % GRAD_COLORS.length];
}

export default function AdminAgencies({ agencies, stats }: Props) {
    return (
        <AdminLayout crumb="Agencies" section="Accounts">
            <Head title="Agencies" />

            <div className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Agencies</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {agencies.length} registered · {stats.pending} pending approval
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input className="text-[12px] bg-white border border-ink-200 rounded-md px-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" placeholder="Search agencies..." />
                        <select className="text-[12px] bg-white border border-ink-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20">
                            <option>All statuses</option>
                            <option>Active</option>
                            <option>Pending</option>
                            <option>Suspended</option>
                        </select>
                    </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <StatCard label="Active" value={stats.active} tone="ink-900" />
                    <StatCard label="Pending" value={stats.pending} tone="warning" />
                    <StatCard label="Suspended" value={stats.suspended} tone="danger" />
                    <StatCard label="Total Agents" value={stats.total_agents} tone="ink-900" />
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                <th className="font-semibold px-5 py-3">Agency</th>
                                <th className="font-semibold py-3">Plan</th>
                                <th className="font-semibold py-3 text-right">Agents</th>
                                <th className="font-semibold py-3 text-right">Listings</th>
                                <th className="font-semibold py-3">EAAB / FFC</th>
                                <th className="font-semibold py-3">Status</th>
                                <th className="font-semibold py-3 text-right pr-5">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-[13px]">
                            {agencies.length === 0 ? (
                                <tr><td colSpan={7} className="text-center text-[12px] text-ink-400 py-10">No agencies registered yet</td></tr>
                            ) : agencies.map((a) => (
                                <tr key={a.id} className={`border-b border-ink-100 hover:bg-ink-50 transition ${a.status === 'suspended' ? 'opacity-70' : ''}`}>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradFor(a.id)} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
                                                {a.initials}
                                            </div>
                                            <div>
                                                <p className="font-semibold">{a.name}</p>
                                                <p className="text-[11px] text-ink-500">{a.city} · joined {a.created_at ?? '—'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4">
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold capitalize ${PLAN_CFG[a.plan] ?? 'bg-ink-100 text-ink-700'}`}>
                                            {a.plan}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right font-mono">{a.agents_count}</td>
                                    <td className="py-4 text-right font-mono">{a.listings_count}</td>
                                    <td className="py-4">
                                        {a.eaab_verified ? (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">VERIFIED</span>
                                        ) : (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-danger/15 text-danger font-bold">UNVERIFIED</span>
                                        )}
                                    </td>
                                    <td className="py-4">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_CFG[a.status] ?? 'bg-ink-100 text-ink-700'}`}>
                                            {a.status}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right pr-5">
                                        {a.status === 'pending' ? (
                                            <button className="text-[11px] px-2.5 py-1 bg-success text-white rounded font-semibold hover:bg-success/90 transition">Approve</button>
                                        ) : (
                                            <button className="text-ink-400 hover:text-ink-900 px-2 transition">⋯</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AdminLayout>
    );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'ink-900' | 'warning' | 'danger' | 'success' }) {
    const colorClass = tone === 'warning' ? 'text-warning' :
                       tone === 'danger'  ? 'text-danger' :
                       tone === 'success' ? 'text-success' :
                                            'text-ink-900';
    return (
        <div className="bg-white rounded-xl border border-ink-200 p-4 shadow-soft">
            <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
        </div>
    );
}
