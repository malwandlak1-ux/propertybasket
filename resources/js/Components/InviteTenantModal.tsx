/**
 * InviteTenantModal — opens from any "Invite Tenant" button (agent or landlord
 * dashboards). Picks an available rental, captures tenant + lease details, then
 * POSTs to {submitUrlBase}/{listing}/invite-tenant. The server creates/links
 * the tenant User, creates a Lease, flips the listing to status='leased', and
 * emails an invitation.
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';

type Listing = { id: number; label: string; monthly_rent: number | null };

type Props = {
    listings: Listing[];
    /** Pre-select a specific listing (e.g. opened from a card menu). */
    initialListingId?: number;
    /** URL prefix the modal posts to — `${submitUrlBase}/${id}/invite-tenant`. Defaults to /agent/listings. */
    submitUrlBase?: string;
    onClose: () => void;
};

function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function plus12Months(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    const next = new Date(y, m - 1, d);
    next.setFullYear(next.getFullYear() + 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

export default function InviteTenantModal({ listings, initialListingId, submitUrlBase = '/agent/listings', onClose }: Props) {
    const start = useMemo(() => todayIso(), []);
    const [listingId, setListingId] = useState(initialListingId ? String(initialListingId) : '');
    const [data, setData] = useState({
        tenant_name:    '',
        tenant_email:   '',
        tenant_phone:   '',
        start_date:     start,
        end_date:       plus12Months(start),
        monthly_rent:   '',
        deposit_amount: '',
    });
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors]         = useState<Record<string, string>>({});

    // Default monthly_rent from the selected listing.
    useEffect(() => {
        const id = Number(listingId);
        const l = listings.find((x) => x.id === id);
        if (l && l.monthly_rent !== null && ! data.monthly_rent) {
            setData((d) => ({ ...d, monthly_rent: String(l.monthly_rent) }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listingId]);

    function set<K extends keyof typeof data>(key: K, value: (typeof data)[K]) {
        setData((d) => ({ ...d, [key]: value }));
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        if (! listingId) return;
        setProcessing(true);
        router.post(`${submitUrlBase}/${listingId}/invite-tenant`, data, {
            onSuccess:  () => onClose(),
            onError:    (errs) => setErrors(errs as Record<string, string>),
            onFinish:   () => setProcessing(false),
        });
    }

    const noEligibleListings = listings.length === 0;

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
                            We'll create a lease, email an account invite, and pull the listing off the public site.
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="text-ink-400 hover:text-ink-900 text-2xl leading-none -mt-1 -mr-1 p-1"
                        aria-label="Close">
                        ×
                    </button>
                </div>

                {noEligibleListings ? (
                    <div className="bg-ink-50 border border-ink-200 rounded-lg p-4 text-[13px] text-ink-600">
                        You don't have any available rental listings. Create one first, then come back to invite a tenant.
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Property *</label>
                            <select
                                value={listingId}
                                onChange={(e) => setListingId(e.target.value)}
                                required
                                className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            >
                                <option value="">Select a rental listing…</option>
                                {listings.map((l) => (
                                    <option key={l.id} value={l.id}>{l.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Tenant name *</label>
                                <input
                                    value={data.tenant_name}
                                    onChange={(e) => set('tenant_name', e.target.value)}
                                    required
                                    placeholder="e.g. Tshepo Khumalo"
                                    className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                                />
                                {errors.tenant_name && <p className="text-[11px] text-danger mt-1">{errors.tenant_name}</p>}
                            </div>
                            <div>
                                <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Phone</label>
                                <input
                                    value={data.tenant_phone}
                                    onChange={(e) => set('tenant_phone', e.target.value)}
                                    placeholder="+27 82 555 1234"
                                    className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Tenant email *</label>
                            <input
                                type="email"
                                value={data.tenant_email}
                                onChange={(e) => set('tenant_email', e.target.value)}
                                required
                                placeholder="tshepo@example.com"
                                className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            />
                            {errors.tenant_email && <p className="text-[11px] text-danger mt-1">{errors.tenant_email}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Lease start *</label>
                                <input
                                    type="date"
                                    value={data.start_date}
                                    onChange={(e) => set('start_date', e.target.value)}
                                    required
                                    className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                                />
                            </div>
                            <div>
                                <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Lease end *</label>
                                <input
                                    type="date"
                                    value={data.end_date}
                                    onChange={(e) => set('end_date', e.target.value)}
                                    required
                                    className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                                />
                                {errors.end_date && <p className="text-[11px] text-danger mt-1">{errors.end_date}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Monthly rent (R) *</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={data.monthly_rent}
                                    onChange={(e) => set('monthly_rent', e.target.value)}
                                    required
                                    placeholder="e.g. 15000"
                                    className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                                />
                                {errors.monthly_rent && <p className="text-[11px] text-danger mt-1">{errors.monthly_rent}</p>}
                            </div>
                            <div>
                                <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Deposit (R)</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={data.deposit_amount}
                                    onChange={(e) => set('deposit_amount', e.target.value)}
                                    placeholder="e.g. 15000"
                                    className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={processing || ! listingId || ! data.tenant_email || ! data.tenant_name}
                                className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 font-semibold transition"
                            >
                                {processing && <Spinner size={13} />}
                                {processing ? 'Sending invite…' : 'Send tenant invite'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
