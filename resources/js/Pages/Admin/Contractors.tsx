import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';

type Contractor = {
    id: number;
    user_id: number;
    name: string;
    business_name: string | null;
    email: string;
    specialities: string[];
    service_areas: string[];
    average_rating: number;
    total_reviews: number;
    total_jobs: number;
    docs: { cipc: boolean; tax: boolean; insurance: boolean };
    doc_status: string;
    status: string;
    joined: string | null;
    initials: string;
};

type Props = {
    contractors: Contractor[];
    stats: { total: number; verified: number; pending: number; total_jobs: number };
};

const DOC_CFG: Record<string, { label: string; cls: string }> = {
    all_verified:       { label: 'ALL VERIFIED',  cls: 'bg-success/15 text-success' },
    tax_pending:        { label: 'TAX PENDING',   cls: 'bg-warning/15 text-warning' },
    insurance_pending:  { label: 'INSURANCE PENDING', cls: 'bg-warning/15 text-warning' },
    cipc_pending:       { label: 'CIPC PENDING',  cls: 'bg-warning/15 text-warning' },
    pending:            { label: 'PENDING',       cls: 'bg-warning/15 text-warning' },
};

const STATUS_CFG: Record<string, string> = {
    active:    'bg-success/15 text-success',
    review:    'bg-warning/15 text-warning',
    pending:   'bg-warning/15 text-warning',
    suspended: 'bg-danger/15 text-danger',
};

const GRAD_COLORS = [
    'from-orange-400 to-orange-600',
    'from-amber-400 to-amber-600',
    'from-emerald-400 to-emerald-600',
    'from-sky-400 to-sky-600',
    'from-rose-400 to-rose-600',
];
function gradFor(id: number) {
    return GRAD_COLORS[id % GRAD_COLORS.length];
}

export default function AdminContractors({ contractors, stats }: Props) {
    return (
        <AdminLayout crumb="Contractors" section="Accounts">
            <Head title="Contractors" />

            <div className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Contractors</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {stats.total} registered · shared marketplace pool · {stats.pending} awaiting verification
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input className="text-[12px] bg-white border border-ink-200 rounded-md px-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-brand/20" placeholder="Search contractors..." />
                        <select className="text-[12px] bg-white border border-ink-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20">
                            <option>All specialities</option>
                            <option>Plumbing</option>
                            <option>Electrical</option>
                            <option>Garden</option>
                        </select>
                    </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <Stat label="Total" value={stats.total} />
                    <Stat label="All Verified" value={stats.verified} tone="success" />
                    <Stat label="Docs Pending" value={stats.pending} tone="warning" />
                    <Stat label="Total Jobs" value={stats.total_jobs} />
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                <th className="font-semibold px-5 py-3">Contractor</th>
                                <th className="font-semibold py-3">Speciality</th>
                                <th className="font-semibold py-3 text-right">Jobs</th>
                                <th className="font-semibold py-3 text-right">Rating</th>
                                <th className="font-semibold py-3">Docs (CIPC / Tax / Insurance)</th>
                                <th className="font-semibold py-3">Status</th>
                                <th className="font-semibold py-3 text-right pr-5">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-[13px]">
                            {contractors.length === 0 ? (
                                <tr><td colSpan={7} className="text-center text-[12px] text-ink-400 py-10">No contractors registered yet</td></tr>
                            ) : contractors.map((c) => (
                                <tr key={c.id} className="border-b border-ink-100 hover:bg-ink-50 transition">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradFor(c.user_id)} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
                                                {c.initials}
                                            </div>
                                            <div>
                                                <p className="font-semibold">{c.name}</p>
                                                <p className="text-[11px] text-ink-500 truncate max-w-[180px]">{c.business_name ?? c.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {(c.specialities ?? []).slice(0, 2).map((s) => (
                                                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 font-semibold capitalize">
                                                    {s}
                                                </span>
                                            ))}
                                            {c.specialities.length > 2 && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink-50 text-ink-500 font-semibold">+{c.specialities.length - 2}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 text-right font-mono">{c.total_jobs}</td>
                                    <td className="py-4 text-right font-mono">
                                        {c.average_rating > 0 ? (
                                            <>⭐ {c.average_rating.toFixed(1)}</>
                                        ) : (
                                            <span className="text-ink-400">—</span>
                                        )}
                                    </td>
                                    <td className="py-4">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${DOC_CFG[c.doc_status]?.cls ?? 'bg-ink-100 text-ink-700'}`}>
                                            {DOC_CFG[c.doc_status]?.label ?? 'PENDING'}
                                        </span>
                                    </td>
                                    <td className="py-4">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_CFG[c.status] ?? 'bg-ink-100 text-ink-700'}`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right pr-5">
                                        {c.status === 'review' || c.doc_status !== 'all_verified' ? (
                                            <button className="text-[11px] px-2.5 py-1 bg-success text-white rounded font-semibold hover:bg-success/90 transition">Verify</button>
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

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' }) {
    const cls = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-ink-900';
    return (
        <div className="bg-white rounded-xl border border-ink-200 p-4 shadow-soft">
            <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${cls}`}>{value}</p>
        </div>
    );
}
