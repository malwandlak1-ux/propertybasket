import { useState } from 'react';
import { Head } from '@inertiajs/react';
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
    'from-emerald-400 to-emerald-600',
    'from-rose-400 to-rose-600',
    'from-violet-400 to-violet-600',
    'from-sky-400 to-sky-600',
    'from-amber-400 to-amber-600',
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

export default function LandlordTenants({ landlord, tenants, invitable_listings, pending_invites }: Props) {
    const [inviteOpen, setInviteOpen] = useState(false);
    const canInvite = pending_invites.length > 0 || invitable_listings.length > 0;
    return (
        <LandlordLayout crumb="Tenants" section="People">
            <Head title="My Tenants" />

            <div className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">My Tenants</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {tenants.length} active lease{tenants.length !== 1 ? 's' : ''} across your portfolio
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setInviteOpen(true)}
                        disabled={! canInvite}
                        title={canInvite
                            ? (pending_invites.length > 0
                                ? `${pending_invites.length} tenant${pending_invites.length === 1 ? '' : 's'} pending portal acceptance`
                                : 'Invite a tenant to one of your rentals')
                            : 'You need an active lease or an available rental to invite a tenant'}
                        className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:bg-ink-200 disabled:text-ink-500 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>
                        Invite Tenant
                        {pending_invites.length > 0 && (
                            <span className="text-[10px] font-bold bg-warning text-white px-1.5 py-0.5 rounded-full">
                                {pending_invites.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Info banner */}
                <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <svg className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                    <p className="text-[12px] text-ink-700">
                        Tenants can only create an account after you invite them — and invites are only available once a lease is active.
                        This keeps the portal secure and lease-gated.
                    </p>
                </div>

                {tenants.length === 0 ? (
                    <div className="bg-white rounded-xl border border-ink-200 p-12 text-center shadow-soft">
                        <div className="w-16 h-16 mx-auto rounded-full bg-ink-100 flex items-center justify-center mb-4">
                            <svg className="w-7 h-7 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        </div>
                        <h2 className="text-lg font-bold">No active leases yet</h2>
                        <p className="text-[13px] text-ink-500 mt-2">Add a property and create a lease to see tenants here.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                        <div className="p-5 border-b border-ink-200">
                            <h2 className="text-base font-semibold">Active Leases</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">Tenants currently leasing your properties</p>
                        </div>

                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                    <th className="font-semibold px-5 py-3">Tenant</th>
                                    <th className="font-semibold py-3">Property</th>
                                    <th className="font-semibold py-3">Lease Term</th>
                                    <th className="font-semibold py-3 text-right">Rent</th>
                                    <th className="font-semibold py-3">Portal</th>
                                    <th className="font-semibold py-3">Rent Status</th>
                                    <th className="font-semibold py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {tenants.map((t) => (
                                    <tr key={t.lease_id} className="border-b border-ink-100 hover:bg-ink-50 transition">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(t.tenant_id)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
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
                                        <td className="py-4 font-mono text-[12px] text-ink-600">
                                            {t.lease_start} – {t.lease_end}
                                        </td>
                                        <td className="py-4 text-right font-mono font-semibold">
                                            {fmtMoney(t.monthly_rent)}
                                        </td>
                                        <td className="py-4">
                                            <PortalBadge status={t.portal_status} />
                                        </td>
                                        <td className="py-4">
                                            <PayBadge status={t.pay_status} />
                                        </td>
                                        <td className="py-4 pr-5">
                                            <a
                                                href="/landlord/messages"
                                                className="text-[11px] text-brand-600 font-semibold hover:underline"
                                            >
                                                Message →
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
