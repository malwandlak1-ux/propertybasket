import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
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

type FlashProps = { flash?: { success?: string; error?: string } };

export default function AdminContractors({ contractors, stats }: Props) {
    const { props } = usePage<FlashProps>();
    const flash = props.flash ?? {};
    const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);

    useEffect(() => {
        if (flash.success) setToast({ tone: 'success', message: flash.success });
        else if (flash.error) setToast({ tone: 'error', message: flash.error });
    }, [flash.success, flash.error]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    return (
        <AdminLayout crumb="Contractors" section="Accounts">
            <Head title="Contractors" />

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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Stat label="Total" value={stats.total} />
                    <Stat label="All Verified" value={stats.verified} tone="success" />
                    <Stat label="Docs Pending" value={stats.pending} tone="warning" />
                    <Stat label="Total Jobs" value={stats.total_jobs} />
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-visible">
                    <div className="overflow-x-auto"><table className="w-full min-w-[700px]">
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
                                <tr key={c.id} className={`border-b border-ink-100 hover:bg-ink-50 transition ${c.status === 'suspended' ? 'opacity-70' : ''}`}>
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
                                        <DocChips docs={c.docs} docStatus={c.doc_status} />
                                    </td>
                                    <td className="py-4">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_CFG[c.status] ?? 'bg-ink-100 text-ink-700'}`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right pr-5">
                                        <ActionMenu
                                            contractor={c}
                                            isOpen={openMenuId === c.id}
                                            onToggle={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
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

function DocChips({ docs, docStatus }: { docs: Contractor['docs']; docStatus: string }) {
    // Compact summary chip + per-doc tick/cross row underneath
    return (
        <div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${DOC_CFG[docStatus]?.cls ?? 'bg-ink-100 text-ink-700'}`}>
                {DOC_CFG[docStatus]?.label ?? 'PENDING'}
            </span>
            <div className="flex gap-2 mt-1 text-[10px] font-mono text-ink-500">
                <span title="CIPC">{docs.cipc ? '✓' : '✗'} CIPC</span>
                <span title="Tax clearance">{docs.tax ? '✓' : '✗'} Tax</span>
                <span title="Insurance">{docs.insurance ? '✓' : '✗'} Ins</span>
            </div>
        </div>
    );
}

function ActionMenu({
    contractor,
    isOpen,
    onToggle,
    onClose,
}: {
    contractor: Contractor;
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, onClose]);

    function verify(doc: 'cipc' | 'tax' | 'insurance' | 'all', confirmMsg?: string) {
        if (confirmMsg && !window.confirm(confirmMsg)) return;
        onClose();
        router.post(
            `/admin/contractors/${contractor.id}/verify`,
            { doc },
            { preserveScroll: true }
        );
    }

    function statusAction(action: 'activate' | 'suspend', confirmMsg?: string) {
        if (confirmMsg && !window.confirm(confirmMsg)) return;
        onClose();
        router.post(`/admin/contractors/${contractor.id}/${action}`, {}, { preserveScroll: true });
    }

    const allDocsVerified = contractor.doc_status === 'all_verified';
    const isPending       = contractor.status === 'pending';
    const isActive        = contractor.status === 'active';
    const isSuspended     = contractor.status === 'suspended';

    return (
        <div ref={ref} className="relative inline-block">
            {/* Inline Verify-all shortcut when there's missing docs */}
            {!allDocsVerified && (
                <button
                    onClick={() => verify('all')}
                    className="text-[11px] px-2.5 py-1 bg-success text-white rounded font-semibold hover:bg-success/90 transition mr-1"
                    title="Mark CIPC, Tax and Insurance all verified"
                >
                    Verify
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
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-ink-200 rounded-lg shadow-lift z-20 text-left">
                    <a
                        href={`mailto:${contractor.email}`}
                        className="block px-3 py-2 text-[12px] text-ink-700 hover:bg-ink-50 transition"
                        onClick={onClose}
                    >
                        Email contractor
                    </a>

                    <div className="border-t border-ink-100 my-1"></div>

                    <p className="px-3 pt-1 text-[10px] uppercase text-ink-400 font-semibold tracking-wider">Documents</p>

                    <DocToggleRow
                        label="CIPC"
                        verified={contractor.docs.cipc}
                        onClick={() => verify('cipc', contractor.docs.cipc ? `Revoke CIPC verification for ${contractor.name}?` : undefined)}
                    />
                    <DocToggleRow
                        label="Tax clearance"
                        verified={contractor.docs.tax}
                        onClick={() => verify('tax', contractor.docs.tax ? `Revoke Tax clearance verification for ${contractor.name}?` : undefined)}
                    />
                    <DocToggleRow
                        label="Insurance"
                        verified={contractor.docs.insurance}
                        onClick={() => verify('insurance', contractor.docs.insurance ? `Revoke Insurance verification for ${contractor.name}?` : undefined)}
                    />

                    {!allDocsVerified && (
                        <button
                            onClick={() => verify('all')}
                            className="block w-full text-left px-3 py-2 text-[12px] text-success font-semibold hover:bg-success/10 transition"
                        >
                            Mark all docs verified
                        </button>
                    )}

                    <div className="border-t border-ink-100 my-1"></div>

                    {(isPending || isSuspended) && (
                        <button
                            onClick={() => statusAction('activate')}
                            className="block w-full text-left px-3 py-2 text-[12px] text-success font-semibold hover:bg-success/10 transition"
                        >
                            {isPending ? 'Activate contractor' : 'Reactivate contractor'}
                        </button>
                    )}

                    {(isActive || isPending) && (
                        <button
                            onClick={() => statusAction(
                                'suspend',
                                `Suspend ${contractor.name}? They'll be removed from the marketplace and won't see new job requests.`
                            )}
                            className="block w-full text-left px-3 py-2 text-[12px] text-danger font-semibold hover:bg-danger/10 transition"
                        >
                            Suspend contractor
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function DocToggleRow({ label, verified, onClick }: { label: string; verified: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center justify-between w-full px-3 py-1.5 text-[12px] text-ink-700 hover:bg-ink-50 transition"
        >
            <span>{label}</span>
            <span className={`text-[10px] font-bold ${verified ? 'text-success' : 'text-ink-400'}`}>
                {verified ? '✓ verified' : '✗ pending'}
            </span>
        </button>
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
