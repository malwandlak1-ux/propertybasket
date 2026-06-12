import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import InviteTenantModal from '@/Components/InviteTenantModal';

type Listing = {
    id: number;
    title: string;
    address: string;
    listing_type: string;
    status: string;
    price_label: string;
    days_on_market: number;
    views: number;
    inquiries: number;
    viewings: number;
    color_class: string;
    primary_image: string | null;
    edit_url: string;
    monthly_rent: number | null;
    can_invite_tenant: boolean;
    can_reactivate: boolean;
    can_mark_sold: boolean;
    sale_price: number | null;
};

type InvitableListing = { id: number; label: string; monthly_rent: number | null };

type Counts = { all: number; sale: number; rent: number; stay: number };

type Props = {
    agent: { id: number; name: string; agency_name: string };
    listings: Listing[];
    counts: Counts;
    type_filter: string;
    invitable_listings: InvitableListing[];
};

const STATUS_BADGE: Record<string, string> = {
    available:  'bg-success text-white',
    draft:      'bg-warning text-white',
    leased:     'bg-sky-600 text-white',
    rented:     'bg-sky-600 text-white',
    sold:       'bg-ink-700 text-white',
    archived:   'bg-ink-300 text-ink-700',
    inactive:   'bg-ink-300 text-ink-700',
};

const TYPE_BADGE: Record<string, string> = {
    for_sale:        'FOR SALE',
    long_term_rent:  'FOR RENT',
    short_term_stay: 'SHORT-STAY',
};

export default function AgentListings({ agent, listings, counts, type_filter, invitable_listings }: Props) {
    const [inviteOpen, setInviteOpen]               = useState(false);
    const [inviteListingId, setInviteListingId]     = useState<number | undefined>(undefined);
    const [reactivating, setReactivating]           = useState<number | null>(null);

    function openInvite(listingId?: number) {
        setInviteListingId(listingId);
        setInviteOpen(true);
    }

    function reactivate(listingId: number) {
        if (! confirm('Re-publish this listing on the public site? Any active lease will be marked terminated.')) return;
        setReactivating(listingId);
        router.post(`/agent/listings/${listingId}/reactivate`, {}, {
            onFinish: () => setReactivating(null),
        });
    }

    const [sellingId, setSellingId] = useState<number | null>(null);

    function markSold(l: Listing) {
        const input = prompt(
            `Record the final sale price for "${l.title}" (your commission is calculated from this).`,
            l.sale_price ? String(Math.round(l.sale_price)) : '',
        );
        if (input === null) return; // cancelled
        const price = Number(input.replace(/[^\d.]/g, ''));
        if (! price || price <= 0) { alert('Enter a valid sale price.'); return; }
        setSellingId(l.id);
        router.post(`/agent/listings/${l.id}/mark-sold`, { sale_price: price }, {
            onFinish: () => setSellingId(null),
        });
    }

    const filterTab = (key: string, label: string, count: number) => (
        <button
            key={key}
            onClick={() => router.get('/agent/listings', { type: key }, { preserveState: true, replace: true })}
            className={`text-[12px] px-3 py-1.5 rounded-full transition font-medium ${
                type_filter === key
                    ? 'bg-ink-900 text-white'
                    : 'bg-white border border-ink-200 hover:bg-ink-100 text-ink-700'
            }`}
        >
            {label} · {count}
        </button>
    );

    return (
        <AgentLayout crumb="Listings" agencyName={agent.agency_name}>
            <Head title="My Listings" />

            <div className="px-8 py-7">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">My Listings</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {counts.all} propert{counts.all === 1 ? 'y' : 'ies'} assigned to you
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/agent/listings/create" className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition flex items-center gap-2">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
                            New Listing
                        </Link>
                        <button
                            type="button"
                            onClick={() => openInvite()}
                            disabled={invitable_listings.length === 0}
                            title={invitable_listings.length === 0 ? 'No available rentals to invite a tenant to' : 'Invite a tenant to one of your rentals'}
                            className="px-3.5 py-2 text-[13px] bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:bg-ink-200 disabled:text-ink-500 disabled:cursor-not-allowed transition flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <path d="M20 8v6M23 11h-6" />
                            </svg>
                            Invite Tenant
                        </button>
                    </div>
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-2 mb-6">
                    {filterTab('all',  'All',        counts.all)}
                    {filterTab('sale', 'For Sale',   counts.sale)}
                    {filterTab('rent', 'For Rent',   counts.rent)}
                    {filterTab('stay', 'Short-stay', counts.stay)}
                </div>

                {listings.length === 0 ? (
                    <div className="bg-white rounded-xl border border-ink-200 p-16 text-center shadow-soft">
                        <div className="w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M3 21V10l9-7 9 7v11H3z" />
                            </svg>
                        </div>
                        <p className="text-[15px] font-semibold text-ink-700 mb-1">No listings here</p>
                        <p className="text-[13px] text-ink-500">Listings assigned to you will appear here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4">
                        {listings.map((l) => (
                            <div
                                key={l.id}
                                className="bg-white rounded-xl border border-ink-200 overflow-hidden shadow-soft hover:shadow-lift transition group"
                            >
                                <Link href={l.edit_url} className="block">
                                    <div className={`aspect-[4/3] relative overflow-hidden ${l.primary_image ? '' : `bg-gradient-to-br ${l.color_class}`}`}>
                                        {l.primary_image && (
                                            <img
                                                src={l.primary_image}
                                                alt={l.title}
                                                className="absolute inset-0 w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        )}
                                        <div className="absolute top-3 left-3 flex gap-1.5">
                                            <span className="text-[10px] bg-white/90 backdrop-blur px-2 py-1 rounded-md font-bold">
                                                {TYPE_BADGE[l.listing_type] ?? l.listing_type.toUpperCase()}
                                            </span>
                                            <span className={`text-[10px] px-2 py-1 rounded-md font-bold ${STATUS_BADGE[l.status] ?? 'bg-ink-200 text-ink-700'}`}>
                                                {l.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <span className="absolute top-3 right-3 text-[10px] bg-white/90 backdrop-blur px-2 py-1 rounded-md font-semibold opacity-0 group-hover:opacity-100 transition inline-flex items-center gap-1">
                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
                                            </svg>
                                            Edit
                                        </span>
                                    </div>

                                    <div className="p-4">
                                        <p className="text-[15px] font-bold mb-1 truncate">{l.title}</p>
                                        <p className="text-[12px] text-ink-500 mb-3 truncate">{l.address}</p>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xl font-bold">{l.price_label}</span>
                                            <span className="text-[11px] text-ink-500 font-mono">{l.days_on_market}d on market</span>
                                        </div>
                                        <div className="flex items-center justify-between pt-3 border-t border-ink-100 text-[11px] text-ink-500">
                                            <span>👁 {l.views.toLocaleString('en-ZA')}</span>
                                            <span>📩 {l.inquiries}</span>
                                            <span>📅 {l.viewings}</span>
                                        </div>
                                    </div>
                                </Link>

                                {(l.can_invite_tenant || l.can_reactivate || l.can_mark_sold) && (
                                    <div className="px-4 pb-4 -mt-1">
                                        {l.can_mark_sold && (
                                            <button
                                                type="button"
                                                disabled={sellingId === l.id}
                                                onClick={() => markSold(l)}
                                                className="w-full text-[12px] font-semibold px-3 py-2 bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-60 rounded-lg transition inline-flex items-center justify-center gap-1.5"
                                            >
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                    <path d="M20 6L9 17l-5-5" />
                                                </svg>
                                                {sellingId === l.id ? 'Recording…' : 'Mark as sold'}
                                            </button>
                                        )}
                                        {l.can_invite_tenant && (
                                            <button
                                                type="button"
                                                onClick={() => openInvite(l.id)}
                                                className="w-full text-[12px] font-semibold px-3 py-2 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg transition inline-flex items-center justify-center gap-1.5"
                                            >
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                    <circle cx="8.5" cy="7" r="4" />
                                                    <path d="M20 8v6M23 11h-6" />
                                                </svg>
                                                Invite tenant
                                            </button>
                                        )}
                                        {l.can_reactivate && (
                                            <button
                                                type="button"
                                                disabled={reactivating === l.id}
                                                onClick={() => reactivate(l.id)}
                                                className="w-full text-[12px] font-semibold px-3 py-2 bg-success/10 text-success hover:bg-success/20 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition inline-flex items-center justify-center gap-1.5"
                                            >
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
                                                </svg>
                                                {reactivating === l.id ? 'Reactivating…' : 'Reactivate listing'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {inviteOpen && (
                <InviteTenantModal
                    listings={invitable_listings}
                    initialListingId={inviteListingId}
                    onClose={() => setInviteOpen(false)}
                />
            )}
        </AgentLayout>
    );
}
