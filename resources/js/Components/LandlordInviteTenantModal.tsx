/**
 * LandlordInviteTenantModal — wraps the agent-side InviteTenantModal but adds
 * a "Pending invitations" panel up top so the landlord can re-send the portal
 * invitation email for any active lease whose tenant hasn't onboarded yet.
 *
 * Two modes:
 *  - Re-send (Pending Invitations): for tenants on active leases that haven't accepted.
 *  - New tenant: invite a tenant to an available rental (creates a Lease).
 */
import { useState } from 'react';
import { router } from '@inertiajs/react';
import InviteTenantModal from '@/Components/InviteTenantModal';
import { Spinner } from '@/Components/Skeleton';

export type InvitableListing = { id: number; label: string; monthly_rent: number | null };

export type PendingInvite = {
    lease_id: number;
    tenant_name: string;
    tenant_email: string;
    listing_title: string;
    listing_addr: string | null;
    lease_status: string;
};

type Props = {
    pendingInvites: PendingInvite[];
    invitableListings: InvitableListing[];
    onClose: () => void;
};

export default function LandlordInviteTenantModal({ pendingInvites, invitableListings, onClose }: Props) {
    const hasPending = pendingInvites.length > 0;
    const hasInvitable = invitableListings.length > 0;

    const [mode, setMode] = useState<'resend' | 'new'>(hasPending ? 'resend' : 'new');
    const [resending, setResending] = useState<number | null>(null);

    // If "new" mode is selected, hand off to the reusable agent-style modal
    if (mode === 'new') {
        return (
            <div>
                {hasPending && (
                    <div
                        className="fixed inset-0 z-40 flex items-start justify-center bg-ink-900/50 p-4 pt-12"
                        onClick={onClose}
                    >
                        {/* dimmer only — actual InviteTenantModal renders its own dialog */}
                    </div>
                )}
                <InviteTenantModal
                    listings={invitableListings}
                    submitUrlBase="/landlord/listings"
                    onClose={onClose}
                />
            </div>
        );
    }

    function resend(leaseId: number) {
        setResending(leaseId);
        router.post(`/landlord/leases/${leaseId}/resend-invite`, {}, {
            preserveScroll: true,
            onFinish: () => setResending(null),
        });
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-white rounded-xl shadow-lift max-w-lg w-full p-6 max-h-[92vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-bold">Invite a tenant</h2>
                        <p className="text-[13px] text-ink-500 mt-1">
                            Re-send portal invitations to tenants on your active leases, or invite a new tenant to a vacant rental.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-ink-400 hover:text-ink-900 text-2xl leading-none -mt-1 -mr-1 p-1"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Mode toggle */}
                <div className="flex items-center gap-1 mb-5 bg-ink-50 border border-ink-200 rounded-lg p-1">
                    <button
                        type="button"
                        onClick={() => setMode('resend')}
                        className={`flex-1 text-[12px] px-3 py-1.5 rounded-md font-semibold transition flex items-center justify-center gap-1.5 ${
                            mode === 'resend' ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-100'
                        }`}
                    >
                        Pending invites
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${mode === 'resend' ? 'bg-white/20' : 'bg-ink-100 text-ink-700'}`}>
                            {pendingInvites.length}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('new')}
                        disabled={! hasInvitable}
                        title={! hasInvitable ? 'No available rentals to invite a new tenant to' : ''}
                        className={`flex-1 text-[12px] px-3 py-1.5 rounded-md font-semibold transition flex items-center justify-center gap-1.5 ${
                            mode === 'new' ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                    >
                        New tenant
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${mode === 'new' ? 'bg-white/20' : 'bg-ink-100 text-ink-700'}`}>
                            {invitableListings.length}
                        </span>
                    </button>
                </div>

                {pendingInvites.length === 0 ? (
                    <div className="bg-ink-50 border border-ink-200 rounded-lg p-5 text-center text-[13px] text-ink-600">
                        <p className="font-semibold">No pending invitations</p>
                        <p className="text-[12px] mt-1">
                            Every tenant on your active leases has already onboarded. To invite a new tenant, switch to <strong>New tenant</strong>.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-[12px] text-ink-500 mb-1">
                            Tenants on your active leases who haven't accepted their portal invitation yet:
                        </p>
                        {pendingInvites.map((p) => (
                            <div key={p.lease_id} className="flex items-center gap-3 p-3 bg-ink-50/50 border border-ink-200 rounded-lg">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-semibold truncate">{p.tenant_name}</p>
                                    <p className="text-[11px] text-ink-500 truncate">{p.tenant_email}</p>
                                    <p className="text-[11px] text-ink-500 truncate mt-0.5">
                                        {p.listing_title}{p.listing_addr ? ` · ${p.listing_addr}` : ''}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => resend(p.lease_id)}
                                    disabled={resending === p.lease_id}
                                    className="px-3 py-1.5 text-[12px] bg-ink-900 text-white rounded-md hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5 font-semibold whitespace-nowrap"
                                >
                                    {resending === p.lease_id && <Spinner size={11} />}
                                    {resending === p.lease_id ? 'Sending…' : 'Send invite'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex justify-end pt-4 mt-4 border-t border-ink-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
