import { useRef, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';
import { PageHeader, btnPrimary } from '@/Components/Dashboard/Charts';
import LandlordLayout from '@/Layouts/LandlordLayout';
import LandlordInviteTenantModal, { InvitableListing, PendingInvite } from '@/Components/LandlordInviteTenantModal';

type Tenant = {
    lease_id: number;
    tenant_id: number;
    tenant_name: string;
    tenant_email: string;
    tenant_initials: string;
    property: string;
    property_title: string;
    lease_start: string;
    lease_end: string;
    monthly_rent: number;
    pay_status: 'paid' | 'due' | 'overdue' | 'no_payment';
    portal_status: 'active' | 'pending';
    days_to_expiry: number | null;
    lease_status: string;
    has_agreement: boolean;
    debit_order_day: number | null;
};

type Props = {
    landlord: { id: number; name: string };
    tenants: Tenant[];
    invitable_listings: InvitableListing[];
    pending_invites: PendingInvite[];
};

function fmtMoney(n: number) {
    return `R ${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

const AVATAR_COLORS = [
    'bg-brand-100 text-brand-800',
    'bg-emerald-100 text-emerald-800',
    'bg-sky-100 text-sky-800',
    'bg-amber-100 text-amber-800',
    'bg-rose-100 text-rose-800',
];
function avatarColor(id: number) {
    return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function PayBadge({ status }: { status: Tenant['pay_status'] }) {
    const cfg: Record<string, { label: string; cls: string }> = {
        paid:       { label: 'PAID',       cls: 'bg-success/15 text-success' },
        due:        { label: 'DUE',        cls: 'bg-warning/15 text-warning' },
        overdue:    { label: 'OVERDUE',    cls: 'bg-danger/15 text-danger' },
        no_payment: { label: 'PENDING',    cls: 'bg-ink-100 text-ink-500' },
    };
    const c = cfg[status] ?? cfg.no_payment;
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${c.cls}`}>{c.label}</span>;
}

function PortalBadge({ status }: { status: Tenant['portal_status'] }) {
    return status === 'active'
        ? <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-success/15 text-success">ACTIVE</span>
        : <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-ink-100 text-ink-500">PENDING</span>;
}

/**
 * Signed lease agreement for one lease: upload (PDF/JPG/PNG ≤ 10 MB), view,
 * replace or remove. Stored privately; the tenant sees it on their Lease page.
 */
function AgreementCell({ leaseId, hasAgreement }: { leaseId: number; hasAgreement: boolean }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);

    function upload(file: File) {
        setBusy(true);
        router.post(`/landlord/leases/${leaseId}/agreement`, { agreement: file }, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => {
                setBusy(false);
                if (fileRef.current) fileRef.current.value = '';
            },
        });
    }

    function remove() {
        if (!confirm('Remove the uploaded lease agreement for this tenant?')) return;
        router.delete(`/landlord/leases/${leaseId}/agreement`, { preserveScroll: true });
    }

    return (
        <div className="flex items-center gap-2 whitespace-nowrap">
            <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            {hasAgreement ? (
                <>
                    <a
                        href={`/landlord/leases/${leaseId}/agreement`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full hover:bg-success/15"
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/></svg>
                        View
                    </a>
                    <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="text-[11.5px] font-semibold text-brand-700 hover:underline disabled:opacity-50">
                        {busy ? 'Uploading…' : 'Replace'}
                    </button>
                    <button type="button" onClick={remove} className="text-[11.5px] text-ink-400 hover:text-danger" title="Remove agreement">✕</button>
                </>
            ) : (
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold border border-ink-900/70 bg-white/60 rounded-full px-3 py-1 hover:bg-white disabled:opacity-60"
                >
                    {busy ? <><Spinner size={12} />Uploading…</> : (
                        <>
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                            Upload
                        </>
                    )}
                </button>
            )}
        </div>
    );
}

export default function LandlordTenants({ landlord, tenants, invitable_listings, pending_invites }: Props) {
    const [inviteOpen, setInviteOpen] = useState(false);
    const { flash, errors } = usePage<{ flash?: { success?: string | null; error?: string | null }; errors: Record<string, string> }>().props;
    const canInvite = pending_invites.length > 0 || invitable_listings.length > 0;
    return (
        <LandlordLayout crumb="Tenants" section="People">
            <Head title="My Tenants" />

            <div className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="My Tenants"
                    subtitle={<>{tenants.length} active lease{tenants.length !== 1 ? 's' : ''} across your portfolio</>}
                    actions={
                        <button
                            type="button"
                            onClick={() => setInviteOpen(true)}
                            disabled={! canInvite}
                            title={canInvite
                                ? (pending_invites.length > 0
                                    ? `${pending_invites.length} tenant${pending_invites.length === 1 ? '' : 's'} pending portal acceptance`
                                    : 'Invite a tenant to one of your rentals')
                                : 'You need an available rental to invite a tenant'}
                            className={btnPrimary}
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>
                            Invite tenant
                            {pending_invites.length > 0 && (
                                <span className="text-[10px] font-bold bg-white text-brand-800 px-1.5 py-0.5 rounded-full">{pending_invites.length}</span>
                            )}
                        </button>
                    }
                />

                {flash?.success && (
                    <div className="mb-4 rounded-2xl bg-success/10 border border-success/30 text-success px-5 py-3 text-[13px] font-medium">{flash.success}</div>
                )}
                {(errors?.agreement || flash?.error) && (
                    <div className="mb-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger px-5 py-3 text-[13px] font-medium">{errors?.agreement ?? flash?.error}</div>
                )}

                {/* Summary tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="pb-swirl rounded-2xl p-5 text-white shadow-lift pb-rise">
                        <p className="text-[13px] font-medium">Active tenants</p>
                        <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{tenants.length}</p>
                        <p className="text-[12px] text-white/80 mt-2">{tenants.filter((t) => t.portal_status === 'active').length} using the tenant portal</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">Monthly rent</p>
                        <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{fmtMoney(tenants.reduce((sum, t) => sum + t.monthly_rent, 0))}</p>
                        <p className="text-[12px] text-ink-500 mt-2">Across all active leases</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">Paid this month</p>
                        <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">
                            {tenants.filter((t) => t.pay_status === 'paid').length}<span className="text-[16px] text-ink-400 font-medium"> / {tenants.length}</span>
                        </p>
                        <p className={`text-[12px] mt-2 ${tenants.some((t) => t.pay_status === 'overdue') ? 'text-danger' : 'text-ink-500'}`}>
                            {tenants.some((t) => t.pay_status === 'overdue') ? `${tenants.filter((t) => t.pay_status === 'overdue').length} overdue` : 'No overdue rent'}
                        </p>
                    </div>
                </div>

                {tenants.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-12 text-center shadow-soft">
                        <div className="w-16 h-16 mx-auto rounded-full bg-ink-100 flex items-center justify-center mb-4">
                            <svg className="w-7 h-7 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        </div>
                        <h2 className="text-lg font-bold">No active leases yet</h2>
                        <p className="text-[13px] text-ink-500 mt-2">Add a property and create a lease to see tenants here.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden">
                        <div className="p-5 border-b border-ink-200">
                            <h2 className="text-[16px] font-semibold tracking-tight">Active Leases</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">Tenants currently leasing your properties</p>
                        </div>

                        <div className="overflow-x-auto"><table className="w-full min-w-[1000px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50 whitespace-nowrap">
                                    <th className="font-semibold px-5 py-3">Tenant</th>
                                    <th className="font-semibold py-3">Property</th>
                                    <th className="font-semibold py-3">Lease Term</th>
                                    <th className="font-semibold py-3 text-right pr-6">Rent</th>
                                    <th className="font-semibold py-3">Portal</th>
                                    <th className="font-semibold py-3">Rent Status</th>
                                    <th className="font-semibold py-3 pr-4">Lease Agreement</th>
                                    <th className="font-semibold py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {tenants.map((t) => (
                                    <tr key={t.lease_id} className="border-b border-ink-100 hover:bg-ink-50 transition">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-full ${avatarColor(t.tenant_id)} flex items-center justify-center text-xs font-bold shrink-0`}>
                                                    {t.tenant_initials}
                                                </div>
                                                <div>
                                                    <p className="font-semibold">{t.tenant_name}</p>
                                                    <p className="text-[11px] text-ink-500">{t.tenant_email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <p className="font-medium">{t.property}</p>
                                            <p className="text-[11px] text-ink-400 truncate max-w-[180px]">{t.property_title.replace(/^Thandi - /, '')}</p>
                                        </td>
                                        <td className="py-4 text-[12px] text-ink-600 whitespace-nowrap pr-4">
                                            {t.lease_start} – {t.lease_end}
                                        </td>
                                        <td className="py-4 text-right tabular-nums font-semibold whitespace-nowrap pr-6">
                                            {fmtMoney(t.monthly_rent)}
                                        </td>
                                        <td className="py-4">
                                            <PortalBadge status={t.portal_status} />
                                        </td>
                                        <td className="py-4">
                                            <PayBadge status={t.pay_status} />
                                            {t.debit_order_day && (
                                                <p className="text-[10.5px] text-ink-500 mt-1 whitespace-nowrap">Debit order · day {t.debit_order_day}</p>
                                            )}
                                        </td>
                                        <td className="py-4 pr-4">
                                            <AgreementCell leaseId={t.lease_id} hasAgreement={t.has_agreement} />
                                        </td>
                                        <td className="py-4 pr-5">
                                            <a
                                                href="/landlord/messages"
                                                className="text-[12px] text-brand-700 font-semibold hover:underline whitespace-nowrap"
                                            >
                                                Message →
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table></div>
                    </div>
                )}
            </div>

            {inviteOpen && (
                <LandlordInviteTenantModal
                    pendingInvites={pending_invites}
                    invitableListings={invitable_listings}
                    onClose={() => setInviteOpen(false)}
                />
            )}
        </LandlordLayout>
    );
}
