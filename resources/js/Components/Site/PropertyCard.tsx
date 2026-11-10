import { Link } from '@inertiajs/react';
import type { ListingCardData } from '@/Components/ListingCard';
import { useTemplate } from '@/Layouts/SiteLayout';

/** Agency-website listing card: photo, price first, suburb, then a quiet stats row. */

export type SiteListing = ListingCardData & { id: number; province?: string | null };

const TYPE_LABEL = { for_sale: 'For sale', long_term_rent: 'To rent', short_term_stay: 'Short stay' } as const;

export function zar(v: number | string | null | undefined): string {
    if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return 'POA';
    return 'R ' + new Intl.NumberFormat('en-ZA').format(Math.round(Number(v))).replace(/,/g, ' ');
}

export function priceOf(l: ListingCardData): string {
    if (l.listing_type === 'for_sale') return zar(l.sale_price);
    if (l.listing_type === 'long_term_rent') return `${zar(l.monthly_rent)} pm`;
    return `${zar(l.short_stay_nightly_price)} / night`;
}

const Icon = ({ d }: { d: string }) => (
    <svg className="w-4 h-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path d={d} /></svg>
);

export default function PropertyCard({ listing }: { listing: SiteListing }) {
    const t = useTemplate();

    return (
        <Link
            href={`/properties/${listing.slug}`}
            className={`group block bg-white overflow-hidden border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)] transition ${t.card}`}
        >
            <div className="aspect-[4/3] bg-ink-100 relative overflow-hidden">
                {listing.primary_image ? (
                    <img src={listing.primary_image} alt={listing.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full grid place-items-center text-ink-400 text-sm">No image</div>
                )}
                <span className="absolute top-3 left-3 bg-ink-900/85 text-white rounded-md px-2.5 py-1 text-[11px] font-medium">
                    {TYPE_LABEL[listing.listing_type]}
                </span>
            </div>
            <div className="p-5">
                <p className="text-[20px] font-semibold tracking-tight">{priceOf(listing)}</p>
                <p className="mt-1 text-[15px] font-medium text-ink-800">{listing.suburb || listing.title}</p>
                <p className="text-[13px] text-ink-500">{listing.city || listing.province || ''}</p>
                <div className="mt-4 pt-4 border-t border-ink-100 flex items-center gap-5 text-[13px] text-ink-700">
                    {listing.bedrooms !== null && (
                        <span className="inline-flex items-center gap-1.5" title="Bedrooms"><Icon d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M3 18v2M21 18v2M6 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />{listing.bedrooms}</span>
                    )}
                    {listing.bathrooms !== null && (
                        <span className="inline-flex items-center gap-1.5" title="Bathrooms"><Icon d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3zM6 12V5a2 2 0 0 1 3.5-1.3M7 19l-1 2M17 19l1 2" />{Number(listing.bathrooms)}</span>
                    )}
                    {listing.area_sqm !== null && (
                        <span className="inline-flex items-center gap-1.5" title="Floor size"><Icon d="M4 4h16v16H4zM4 9h5V4M15 20v-5h5" />{Math.round(Number(listing.area_sqm))} m²</span>
                    )}
                </div>
            </div>
        </Link>
    );
}
