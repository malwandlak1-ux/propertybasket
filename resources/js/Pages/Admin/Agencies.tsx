import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { PageHeader, SectionCard, SummaryStrip, selectCls, thRowCls } from '@/Components/Dashboard/Charts';

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
    trust: Trust;
};

type Trust = {
    status: 'none' | 'review' | 'verified';
    bank: string | null;
    holder: string | null;
    account_number: string | null;
    branch_code: string | null;
    account_type: string | null;
    auditor: string | null;
    auditor_number: string | null;
    verified_at: string | null;
    updated_at: string | null;
};

const TRUST_CFG: Record<Trust['status'], { label: string; cls: string }> = {
    none:     { label: 'NOT CAPTURED', cls: 'bg-ink-100 text-ink-500' },
    review:   { label: 'TO VERIFY',    cls: 'bg-warning/15 text-warning' },
    verified: { label: 'VERIFIED',     cls: 'bg-success/15 text-success' },
};

type Props = {
    agencies: Agency[];
    stats: { active: number; pending: number; suspended: number; total_agents: number; trust_review: number };
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
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');

    // Opened from the bell / email link: /admin/agencies?trust={id}
    const [trustId, setTrustId] = useState<number | null>(() => {
        const id = Number(new URLSearchParams(window.location.search).get('trust'));
        return Number.isFinite(id) && id > 0 ? id : null;
    });
    const trustAgency = agencies.find((a) => a.id === trustId) ?? null;

    const q = query.trim().toLowerCase();
    const shown = agencies.filter((a) =>
        (!q || [a.name, a.city ?? '', a.eaab_ffc_number ?? ''].some((v) => v.toLowerCase().includes(q)))
        && (status === 'all' || (status === 'trust_review' ? a.trust.status === 'review' : a.status === status)));

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

            <div className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Agencies"
                    subtitle={`${agencies.length} registered · ${stats.pending} pending approval${stats.trust_review ? ` · ${stats.trust_review} trust account${stats.trust_review === 1 ? '' : 's'} to verify` : ''}`}
                />

                <SummaryStrip
                    title="Agency Summary"
                    subtitle="Estate agencies on the platform"
                    cells={[
                        { label: 'Active', value: stats.active, sub: 'Trading on the platform', tone: 'success' },
                        { label: 'Pending', value: stats.pending, sub: 'Awaiting approval', tone: stats.pending > 0 ? 'warning' : 'muted' },
                        { label: 'Suspended', value: stats.suspended, sub: 'Access blocked', tone: stats.suspended > 0 ? 'danger' : 'muted' },
                        { label: 'Total Agents', value: stats.total_agents, sub: 'Across all agencies' },
                    ]}
                />

                <SectionCard
                    title="All Agencies"
                    subtitle={`${shown.length} of ${agencies.length} shown`}
                    flush
                    className="overflow-visible!"
                    action={
                        <div className="flex flex-wrap items-center gap-2">
                            <input value={query} onChange={(e) => setQuery(e.target.value)} className={`${selectCls} w-56`} placeholder="Search agencies…" />
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                                <option value="all">All statuses</option>
                                <option value="active">Active</option>
                                <option value="pending">Pending</option>
                                <option value="suspended">Suspended</option>
                                <option value="trust_review">Trust account to verify{stats.trust_review ? ` (${stats.trust_review})` : ''}</option>
                            </select>
                        </div>
                    }
                >
                    <div className="overflow-x-auto lg:overflow-visible"><table className="w-full min-w-[700px]">
                        <thead>
                            <tr className={thRowCls}>
                                <th className="font-semibold px-5 py-3">Agency</th>
                                <th className="font-semibold py-3">Plan</th>
                                <th className="font-semibold py-3 text-right">Agents</th>
                                <th className="font-semibold py-3 text-right">Listings</th>
                                <th className="font-semibold py-3">EAAB / FFC</th>
                                <th className="font-semibold py-3">Trust account</th>
                                <th className="font-semibold py-3">Status</th>
                                <th className="font-semibold py-3 text-right pr-5">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-[13px]">
                            {shown.length === 0 ? (
                                <tr><td colSpan={8} className="text-center text-[12px] text-ink-400 py-10">{agencies.length === 0 ? 'No agencies registered yet' : 'No agencies match your search'}</td></tr>
                            ) : shown.map((a) => (
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
                                        {a.trust.status === 'none' ? (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${TRUST_CFG.none.cls}`}>{TRUST_CFG.none.label}</span>
                                        ) : (
                                            <button type="button" onClick={() => setTrustId(a.id)} title="Review trust account details"
                                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold hover:ring-2 hover:ring-ink-900/10 ${TRUST_CFG[a.trust.status].cls}`}>
                                                {TRUST_CFG[a.trust.status].label} ›
                                            </button>
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
                                            onTrust={() => { setOpenMenuId(null); setTrustId(a.id); }}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table></div>
                </SectionCard>
            </div>
            {trustAgency && <TrustModal agency={trustAgency} onClose={() => {
                setTrustId(null);
                const u = new URL(window.location.href);
                if (u.searchParams.has('trust')) { u.searchParams.delete('trust'); window.history.replaceState(window.history.state, '', u.toString()); }
            }} />}
        </AdminLayout>
    );
}

function ActionMenu({
    agency,
    isOpen,
    onToggle,
    onClose,
    onTrust,
}: {
    agency: Agency;
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
    onTrust: () => void;
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

                    {agency.trust.status !== 'none' && (
                        <button onClick={onTrust} className="block w-full text-left px-3 py-2 text-[12px] text-ink-700 hover:bg-ink-50 transition">
                            {agency.trust.status === 'review' ? 'Review trust account' : 'View trust account'}
                        </button>
                    )}

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

/** Trust account details the agency captured, with Verify / Revoke. */
function TrustModal({ agency, onClose }: { agency: Agency; onClose: () => void }) {
    const t = agency.trust;
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    function act() {
        if (t.status === 'verified' && !window.confirm(`Revoke the trust account verification for ${agency.name}?`)) return;
        setBusy(true);
        router.post(`/admin/agencies/${agency.id}/verify-trust`, {}, { preserveScroll: true, onFinish: () => setBusy(false), onSuccess: onClose });
    }

    const rows: [string, string | null][] = [
        ['Bank', t.bank],
        ['Account holder', t.holder],
        ['Account number', t.account_number],
        ['Branch code', t.branch_code],
        ['Account type', t.account_type ? t.account_type[0].toUpperCase() + t.account_type.slice(1) : null],
        ['Auditor', t.auditor],
        ['IRBA practice no.', t.auditor_number],
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div role="dialog" aria-modal="true" aria-label={`${agency.name} trust account`} className="w-full max-w-md bg-white rounded-2xl shadow-lift p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <p className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold ${TRUST_CFG[t.status].cls}`}>{TRUST_CFG[t.status].label}</p>
                        <h2 className="text-lg font-bold mt-2">{agency.name}</h2>
                        <p className="text-[12px] text-ink-500">Trust account (Section 54 PPA){t.updated_at ? ` · last saved ${t.updated_at}` : ''}</p>
                    </div>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-full hover:bg-ink-100 text-ink-500" aria-label="Close">×</button>
                </div>
                <dl className="divide-y divide-ink-100 border border-ink-100 rounded-xl text-[13px] mb-4">
                    {rows.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                            <dt className="text-ink-500">{k}</dt>
                            <dd className="font-semibold text-right break-all">{v || '—'}</dd>
                        </div>
                    ))}
                </dl>
                {t.status === 'verified' ? (
                    <p className="text-[12px] text-ink-500 mb-4">Verified {t.verified_at}. The agency’s bank changes send it back for re-verification automatically.</p>
                ) : (
                    <p className="text-[12px] text-ink-500 mb-4">Check these against the agency’s bank confirmation letter and the auditor’s IRBA registration before verifying. The agency is notified once verified.</p>
                )}
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-ink-600 hover:bg-ink-100">Close</button>
                    <button type="button" onClick={act} disabled={busy}
                        className={`px-4 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-60 ${t.status === 'verified' ? 'bg-danger hover:bg-danger/90' : 'bg-success hover:bg-success/90'}`}>
                        {busy ? 'Saving…' : t.status === 'verified' ? 'Revoke verification' : 'Mark trust account verified'}
                    </button>
                </div>
            </div>
        </div>
    );
}
