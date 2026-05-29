import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';

type Landlord = {
    id: number;
    user_id: number;
    name: string;
    email: string;
    phone: string | null;
    property_count: number;
    active_leases: number;
    fica_verified: boolean;
    subscription: string;
    at_cap: boolean;
    joined: string | null;
    initials: string;
};

type Props = {
    landlords: Landlord[];
    stats: { total: number; verified: number; at_cap: number; properties: number };
};

const GRAD_COLORS = [
    'from-sky-400 to-sky-600',
    'from-emerald-400 to-emerald-600',
    'from-rose-400 to-rose-600',
    'from-amber-400 to-amber-600',
    'from-violet-400 to-violet-600',
];
function gradFor(id: number) {
    return GRAD_COLORS[id % GRAD_COLORS.length];
}

export default function AdminLandlords({ landlords, stats }: Props) {
    return (
        <AdminLayout crumb="Landlords" section="Accounts">
            <Head title="Landlords" />

            <div className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Landlords</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {stats.total} registered private landlords · {stats.properties} properties managed
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input className="text-[12px] bg-white border border-ink-200 rounded-md px-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-brand/20" placeholder="Search landlords..." />
                        <select className="text-[12px] bg-white border border-ink-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20">
                            <option>All</option>
                            <option>At property cap</option>
                            <option>FICA verified</option>
                        </select>
                    </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <Stat label="Total" value={stats.total} />
                    <Stat label="FICA Verified" value={stats.verified} tone="success" />
                    <Stat label="At Cap (5)" value={stats.at_cap} tone="warning" />
                    <Stat label="Properties" value={stats.properties} />
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                <th className="font-semibold px-5 py-3">Landlord</th>
                                <th className="font-semibold py-3">Subscription</th>
                                <th className="font-semibold py-3 text-right">Properties</th>
                                <th className="font-semibold py-3 text-right">Active Leases</th>
                                <th className="font-semibold py-3">FICA</th>
                                <th className="font-semibold py-3">Joined</th>
                                <th className="font-semibold py-3 text-right pr-5">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-[13px]">
                            {landlords.length === 0 ? (
                                <tr><td colSpan={7} className="text-center text-[12px] text-ink-400 py-10">No landlords registered yet</td></tr>
                            ) : landlords.map((l) => (
                                <tr key={l.id} className="border-b border-ink-100 hover:bg-ink-50 transition">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradFor(l.user_id)} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
                                                {l.initials}
                                            </div>
                                            <div>
                                                <p className="font-semibold">{l.name}</p>
                                                <p className="text-[11px] text-ink-500">{l.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4">
                                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 font-semibold capitalize">
                                            {l.subscription}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right">
                                        <span className="font-mono">{l.property_count}</span>
                                        {l.at_cap && (
                                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-bold">CAP</span>
                                        )}
                                    </td>
                                    <td className="py-4 text-right font-mono">{l.active_leases}</td>
                                    <td className="py-4">
                                        {l.fica_verified ? (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">VERIFIED</span>
                                        ) : (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-bold">PENDING</span>
                                        )}
                                    </td>
                                    <td className="py-4 text-[12px] text-ink-500">{l.joined ?? '—'}</td>
                                    <td className="py-4 text-right pr-5">
                                        <button className="text-ink-400 hover:text-ink-900 px-2 transition">⋯</button>
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
