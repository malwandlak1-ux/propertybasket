import { Link } from '@inertiajs/react';
import type { ListingCardData } from '@/Components/ListingCard';
import { useTemplate } from '@/Layouts/SiteLayout';

/**
 * Agency-website listing card. Portal: status label + price over the photo,
 * then title, area and a stats row. Minimal: price first under the photo.
 */

export type SiteListing = ListingCardData & { id: number; province?: string | null };

const TYPE_LABEL = { for_sale: 'For sale', long_term_rent: 'For rent', short_term_stay: 'Short stay' } as const;

export function zar(v: number | string | null | undefined): string {
    if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return 'POA';
    return 'R ' + new Intl.NumberFormat('en-ZA').format(Math.round(Number(v))).replace(/,/g, ' ');
}

export function priceOf(l: ListingCardData): string {
    if (l.listing_type === 'for_sale') return zar(l.sale_price);
    if (l.listing_type === 'long_term_rent') return `${zar(l.monthly_rent)} /mo`;
    return `${zar(l.short_stay_nightly_price)} /night`;
}

const Icon = ({ d }: { d: string }) => (
    <svg className="w-4 h-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path d={d} /></svg>
);

function Stats({ listing }: { listing: SiteListing }) {
    return (
        <div className="flex items-center gap-5 text-[13px] text-ink-700">
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
    );
}

export default function PropertyCard({ listing }: { listing: SiteListing }) {
    const t = useTemplate();
    // Portal and Showcase put the price over the photo; Minimal lists it first below.
    const portal = t.key !== 'minimal';
    const place = [listing.suburb, listing.city].filter(Boolean).join(', ');

    return (
        <Link
            href={`/properties/${listing.slug}`}
            className={`group block bg-white overflow-hidden border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_14px_34px_-14px_rgba(0,0,0,0.25)] transition ${t.card}`}
        >
            <div className="aspect-[4/3] bg-ink-100 relative overflow-hidden">
                {listing.primary_image ? (
                    <img src={listing.primary_image} alt={listing.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full grid place-items-center text-ink-400 text-sm">No image</div>
                )}
                <span className={`absolute top-3 left-3 text-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${portal ? 'bg-brand-500 rounded-sm' : 'bg-ink-900'}`}>
                    {TYPE_LABEL[listing.listing_type]}
                </span>
                {portal && (
                    <>
                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 to-transparent" />
                        <p className="absolute bottom-3 left-4 text-white text-[20px] font-medium">{priceOf(listing)}</p>
                    </>
                )}
            </div>
            <div className="p-5">
                {portal ? (
                    <>
                        <p className={`text-[16px] leading-snug line-clamp-1 group-hover:text-brand-600 ${t.key === 'showcase' ? 'font-bold text-ink-900' : 'font-medium'}`}>{listing.title}</p>
                        <p className="mt-1 text-[13px] text-ink-500 line-clamp-1">{place || '—'}</p>
                        <div className="mt-4"><Stats listing={listing} /></div>
                        <div className="mt-4 pt-3 border-t border-ink-100 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                            {listing.property_type}
                        </div>
                    </>
                ) : (
                    <>
                        <p className="text-[20px] font-semibold tracking-tight">{priceOf(listing)}</p>
                        <p className="mt-1 text-[15px] font-medium text-ink-800">{listing.suburb || listing.title}</p>
                        <p className="text-[13px] text-ink-500">{listing.city || ''}</p>
                        <div className="mt-4 pt-4 border-t border-ink-100"><Stats listing={listing} /></div>
                    </>
                )}
            </div>
        </Link>
    );
}
