import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
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

type FlashProps = { flash?: { success?: string; error?: string } };

export default function AdminAgencies({ agencies, stats }: Props) {
    const { props } = usePage<FlashProps>();
    const flash = props.flash ?? {};
    const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

    // Show a toast whenever flash changes after a server action
    useEffect(() => {
        if (flash.success) {
            setToast({ tone: 'success', message: flash.success });
        } else if (flash.error) {
            setToast({ tone: 'error', message: flash.error });
        }
    }, [flash.success, flash.error]);

    // Auto-dismiss toast
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    const [openMenuId, setOpenMenuId] = useState<number | null>(null);

    return (
        <AdminLayout crumb="Agencies" section="Accounts">
            <Head title="Agencies" />

            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lift text-[13px] font-semibold ${
                    toast.tone === 'success' ? 'bg-success text-white' : 'bg-danger text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard label="Active" value={stats.active} tone="ink-900" />
                    <StatCard label="Pending" value={stats.pending} tone="warning" />
                    <StatCard label="Suspended" value={stats.suspended} tone="danger" />
                    <StatCard label="Total Agents" value={stats.total_agents} tone="ink-900" />
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-visible">
                    <div className="overflow-x-auto"><table className="w-full min-w-[700px]">
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
                                        <ActionMenu
                                            agency={a}
                                            isOpen={openMenuId === a.id}
                                            onToggle={() => setOpenMenuId(openMenuId === a.id ? null : a.id)}
                                            onClose={() => setOpenMenuId(null)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table></div>
                </div>
            </div>
        </AdminLayout>
    );
}

function ActionMenu({
    agency,
    isOpen,
    onToggle,
    onClose,
}: {
    agency: Agency;
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, onClose]);

    function go(url: string, opts: { confirmMsg?: string } = {}) {
        if (opts.confirmMsg && !window.confirm(opts.confirmMsg)) return;
        onClose();
        router.post(url, {}, { preserveScroll: true });
    }

    const isPending   = agency.status === 'pending';
    const isActive    = agency.status === 'active';
    const isSuspended = agency.status === 'suspended';

    return (
        <div ref={ref} className="relative inline-block">
            {isPending && (
                <button
                    onClick={() => go(`/admin/agencies/${agency.id}/approve`)}
                    className="text-[11px] px-2.5 py-1 bg-success text-white rounded font-semibold hover:bg-success/90 transition mr-1"
                >
                    Approve
                </button>
            )}

            <button
                onClick={onToggle}
                className="text-ink-400 hover:text-ink-900 px-2 transition"
                aria-haspopup="menu"
                aria-expanded={isOpen}
            >
                ⋯
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-ink-200 rounded-lg shadow-lift z-20 text-left">
                    <a
                        href={`/agencies/${agency.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-3 py-2 text-[12px] text-ink-700 hover:bg-ink-50 transition"
                        onClick={onClose}
                    >
                        View public profile ↗
                    </a>

                    <button
                        onClick={() => go(
                            `/admin/agencies/${agency.id}/verify-eaab`,
                            agency.eaab_verified
                                ? { confirmMsg: `Revoke EAAB verification for ${agency.name}?` }
                                : {}
                        )}
                        className="block w-full text-left px-3 py-2 text-[12px] text-ink-700 hover:bg-ink-50 transition"
                    >
                        {agency.eaab_verified ? 'Revoke EAAB verification' : 'Mark EAAB verified'}
                    </button>

                    <div className="border-t border-ink-100 my-1"></div>

                    {isPending && (
                        <button
                            onClick={() => go(`/admin/agencies/${agency.id}/approve`)}
                            className="block w-full text-left px-3 py-2 text-[12px] text-success font-semibold hover:bg-success/10 transition"
                        >
                            Approve agency
                        </button>
                    )}

                    {isSuspended && (
                        <button
                            onClick={() => go(`/admin/agencies/${agency.id}/reactivate`)}
                            className="block w-full text-left px-3 py-2 text-[12px] text-success font-semibold hover:bg-success/10 transition"
                        >
                            Reactivate
                        </button>
                    )}

                    {(isActive || isPending) && (
                        <button
                            onClick={() => go(
                                `/admin/agencies/${agency.id}/suspend`,
                                { confirmMsg: `Suspend ${agency.name}? Their agents won't be able to log in or list properties.` }
                            )}
                            className="block w-full text-left px-3 py-2 text-[12px] text-danger font-semibold hover:bg-danger/10 transition"
                        >
                            Suspend
                        </button>
                    )}
                </div>
            )}
        </div>
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
