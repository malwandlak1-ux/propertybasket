import { Link } from '@inertiajs/react';

export type ListingCardData = {
    slug: string;
    title: string;
    listing_type: 'for_sale' | 'long_term_rent' | 'short_term_stay';
    property_type: string;
    suburb: string | null;
    city: string | null;
    bedrooms: number | null;
    bathrooms: number | string | null;
    area_sqm: number | string | null;
    primary_image: string | null;
    sale_price: number | string | null;
    monthly_rent: number | string | null;
    short_stay_nightly_price: number | string | null;
};

const LISTING_TYPE_LABELS: Record<ListingCardData['listing_type'], string> = {
    for_sale: 'For sale',
    long_term_rent: 'For rent',
    short_term_stay: 'Short stay',
};

function formatZar(value: number | string | null): string {
    if (value === null || value === undefined) return '';
    const n = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(n)) return '';
    return 'R ' + new Intl.NumberFormat('en-ZA').format(Math.round(n));
}

function priceFor(l: ListingCardData): string {
    if (l.listing_type === 'for_sale') return formatZar(l.sale_price);
    if (l.listing_type === 'long_term_rent') return formatZar(l.monthly_rent) + ' / mo';
    return formatZar(l.short_stay_nightly_price) + ' / night';
}

export default function ListingCard({ listing }: { listing: ListingCardData }) {
    return (
        <Link
            href={`/properties/${listing.slug}`}
            className="group block bg-white rounded-2xl overflow-hidden shadow-card hover:shadow-lift transition border border-ink-200/60"
        >
            <div className="aspect-[4/3] bg-ink-100 relative overflow-hidden">
                {listing.primary_image ? (
                    <img
                        src={listing.primary_image}
                        alt={listing.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full grid place-items-center text-ink-400 text-sm">No image</div>
                )}
                <span className="absolute top-3 left-3 bg-white/95 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-700">
                    {LISTING_TYPE_LABELS[listing.listing_type]}
                </span>
            </div>
            <div className="p-5">
                <p className="text-[12px] text-ink-500 uppercase tracking-wider">
                    {[listing.suburb, listing.city].filter(Boolean).join(', ') || '—'}
                </p>
                <h3 className="mt-1 text-[15px] font-semibold leading-snug line-clamp-2">{listing.title}</h3>
                <div className="mt-3 flex items-center gap-3 text-[12px] text-ink-500">
                    {listing.bedrooms !== null && <span>{listing.bedrooms} bed</span>}
                    {listing.bathrooms !== null && <span>{listing.bathrooms} bath</span>}
                    {listing.area_sqm !== null && <span>{listing.area_sqm} m²</span>}
                </div>
                <p className="mt-3 text-[16px] font-bold text-brand-700">{priceFor(listing)}</p>
            </div>
        </Link>
    );
}
