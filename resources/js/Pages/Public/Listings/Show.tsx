import { FormEvent, useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';
import FormField from '@/Components/FormField';
import MortgageCalculator from '@/Components/MortgageCalculator';
import ScheduleTour from '@/Components/ScheduleTour';

type ListingProps = {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    listing_type: 'for_sale' | 'long_term_rent' | 'short_term_stay';
    property_type: string;
    suburb: string | null;
    city: string | null;
    province: string | null;
    address: string | null;
    bedrooms: number | null;
    bathrooms: number | string | null;
    area_sqm: number | string | null;
    sale_price: number | string | null;
    monthly_rent: number | string | null;
    short_stay_nightly_price: number | string | null;
    short_stay_cleaning_fee: number | string | null;
    short_stay_max_guests: number | null;
    primary_image: string | null;
    gallery_images: string[] | null;
    amenities: string[] | { interior?: string[]; kitchen?: string[]; exterior?: string[] } | null;
    views_count: number;
    inquiries_count: number;
};

type Contact = {
    kind: 'agent' | 'landlord';
    name: string | null;
    email: string | null;
    phone: string | null;
    avatar: string | null;
    agency_name: string | null;
    agency_slug: string | null;
};

/** Amenities are stored as a flat array; tolerate the older keyed-object shape too. */
function flattenAmenities(
    amenities: ListingProps['amenities'],
): string[] {
    if (!amenities) return [];
    if (Array.isArray(amenities)) return amenities.filter(Boolean);
    return Object.values(amenities)
        .flat()
        .filter(Boolean) as string[];
}

function initials(name: string | null): string {
    if (!name) return '?';
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('');
}

type Props = { listing: ListingProps; contact: Contact };

type SharedProps = { flash?: { success?: string | null } };

function formatZar(value: number | string | null): string {
    if (value === null || value === undefined || value === '') return '—';
    const n = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(n)) return '—';
    return 'R ' + new Intl.NumberFormat('en-ZA').format(Math.round(n));
}

const LISTING_TYPE_LABELS = {
    for_sale: 'For sale',
    long_term_rent: 'For rent',
    short_term_stay: 'Short stay',
} as const;

export default function Show({ listing, contact }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [activeImage, setActiveImage] = useState(listing.primary_image ?? listing.gallery_images?.[0] ?? null);
    const [submitted, setSubmitted] = useState(false);

    const form = useForm({
        listing_id: listing.id,
        name: '',
        email: '',
        phone: '',
        message: `Hi, I'd love to know more about "${listing.title}".`,
    });

    function submitInquiry(e: FormEvent) {
        e.preventDefault();
        form.post('/inquiries', {
            preserveScroll: true,
            onSuccess: () => {
                setSubmitted(true);
                form.reset('name', 'email', 'phone', 'message');
            },
        });
    }

    const gallery = [
        listing.primary_image,
        ...(listing.gallery_images ?? []),
    ].filter(Boolean) as string[];

    const amenities = flattenAmenities(listing.amenities);

    const priceLine =
        listing.listing_type === 'for_sale'
            ? formatZar(listing.sale_price)
            : listing.listing_type === 'long_term_rent'
            ? `${formatZar(listing.monthly_rent)} / month`
            : `${formatZar(listing.short_stay_nightly_price)} / night`;

    return (
        <PublicLayout>
            <Head title={listing.title} />

            <section className="max-w-7xl mx-auto px-6 pt-8 pb-4">
                <Link href="/properties" className="text-[13px] text-ink-500 hover:text-ink-900">
                    ← Back to listings
                </Link>
            </section>

            <section className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-10 pb-16">
                {/* Left: gallery + details */}
                <div className="lg:col-span-2">
                    <div className="rounded-2xl overflow-hidden bg-ink-100 aspect-[16/10]">
                        {activeImage ? (
                            <img src={activeImage} alt={listing.title} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full grid place-items-center text-ink-400">No image</div>
                        )}
                    </div>
                    {gallery.length > 1 && (
                        <div className="mt-3 grid grid-cols-4 gap-3">
                            {gallery.slice(0, 4).map((src) => (
                                <button
                                    key={src}
                                    type="button"
                                    onClick={() => setActiveImage(src)}
                                    className={
                                        'aspect-[4/3] rounded-lg overflow-hidden bg-ink-100 border ' +
                                        (src === activeImage ? 'border-brand' : 'border-ink-200')
                                    }
                                >
                                    <img src={src} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="mt-8 flex items-center gap-3">
                        <span className="inline-flex items-center rounded-full bg-brand-50 text-brand-700 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider">
                            {LISTING_TYPE_LABELS[listing.listing_type]}
                        </span>
                        <span className="text-[12px] text-ink-500 uppercase tracking-wider">
                            {listing.property_type}
                        </span>
                    </div>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight">{listing.title}</h1>
                    <p className="mt-1 text-ink-500">
                        {[listing.suburb, listing.city, listing.province].filter(Boolean).join(', ') || '—'}
                    </p>
                    <p className="mt-4 text-2xl font-bold text-brand-700">{priceLine}</p>
                    {listing.listing_type === 'short_term_stay' && listing.short_stay_cleaning_fee && (
                        <p className="text-[13px] text-ink-500 mt-1">
                            + {formatZar(listing.short_stay_cleaning_fee)} cleaning fee
                            {listing.short_stay_max_guests && ` · sleeps ${listing.short_stay_max_guests}`}
                        </p>
                    )}

                    <div className="mt-6 grid grid-cols-3 gap-4 max-w-md">
                        {listing.bedrooms !== null && (
                            <Stat label="Bedrooms" value={listing.bedrooms.toString()} />
                        )}
                        {listing.bathrooms !== null && (
                            <Stat label="Bathrooms" value={String(listing.bathrooms)} />
                        )}
                        {listing.area_sqm !== null && (
                            <Stat label="Size" value={`${listing.area_sqm} m²`} />
                        )}
                    </div>

                    {listing.description && (
                        <div className="mt-10">
                            <h2 className="text-[18px] font-bold">About this property</h2>
                            <p className="mt-3 text-ink-700 leading-relaxed whitespace-pre-line">
                                {listing.description}
                            </p>
                        </div>
                    )}

                    {amenities.length > 0 && (
                        <div className="mt-10">
                            <h2 className="text-[18px] font-bold">Amenities</h2>
                            <ul className="mt-4 grid sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-[14px] text-ink-700">
                                {amenities.map((item) => (
                                    <li key={item} className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {listing.listing_type === 'for_sale' && (
                        <MortgageCalculator defaultTotal={listing.sale_price} />
                    )}

                    <ScheduleTour listingId={listing.id} />

                    <p className="mt-10 text-[12px] text-ink-400">
                        {listing.views_count} view{listing.views_count === 1 ? '' : 's'} ·{' '}
                        {listing.inquiries_count} previous{' '}
                        {listing.inquiries_count === 1 ? 'inquiry' : 'inquiries'}
                    </p>
                </div>

                {/* Right: contact + inquiry */}
                <aside className="lg:sticky lg:top-24 self-start space-y-4">
                    <div className="bg-white border border-ink-200 rounded-2xl p-6 shadow-card">
                        <p className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">
                            {contact.kind === 'agent' ? 'Listed by agent' : 'Listed by landlord'}
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                            {contact.avatar ? (
                                <img
                                    src={contact.avatar}
                                    alt={contact.name ?? ''}
                                    className="w-11 h-11 rounded-full object-cover bg-ink-100 shrink-0"
                                />
                            ) : (
                                <span className="w-11 h-11 rounded-full bg-brand-50 text-brand-700 grid place-items-center text-[14px] font-bold shrink-0">
                                    {initials(contact.name)}
                                </span>
                            )}
                            <div className="min-w-0">
                                <p className="text-[16px] font-bold truncate">{contact.name ?? '—'}</p>
                                {contact.agency_name && (
                                    <Link
                                        href={`/agencies/${contact.agency_slug}`}
                                        className="block text-[13px] text-brand-700 hover:underline truncate"
                                    >
                                        {contact.agency_name}
                                    </Link>
                                )}
                            </div>
                        </div>
                        <div className="mt-4 space-y-1.5 text-[13px] text-ink-700">
                            {contact.email && (
                                <p>
                                    <span className="text-ink-500">Email</span> · {contact.email}
                                </p>
                            )}
                            {contact.phone && (
                                <p>
                                    <span className="text-ink-500">Phone</span> · {contact.phone}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="bg-white border border-ink-200 rounded-2xl p-6 shadow-card">
                        <h2 className="text-[16px] font-bold">Send an inquiry</h2>
                        <p className="text-[13px] text-ink-500 mt-1">
                            It goes straight to {contact.kind === 'agent' ? 'the agency' : contact.name ?? 'the landlord'}.
                        </p>

                        {(submitted || flash?.success) && (
                            <div className="mt-4 rounded-lg bg-success/10 border border-success/30 text-success px-3 py-2 text-[13px]">
                                {flash?.success ?? 'Inquiry sent — we’ll be in touch shortly.'}
                            </div>
                        )}

                        <form onSubmit={submitInquiry} className="mt-4 space-y-3">
                            <FormField
                                label="Name"
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                error={form.errors.name}
                                required
                            />
                            <FormField
                                label="Email"
                                type="email"
                                value={form.data.email}
                                onChange={(e) => form.setData('email', e.target.value)}
                                error={form.errors.email}
                                required
                            />
                            <FormField
                                label="Phone"
                                value={form.data.phone}
                                onChange={(e) => form.setData('phone', e.target.value)}
                                error={form.errors.phone}
                            />
                            <div>
                                <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">
                                    Message
                                </label>
                                <textarea
                                    value={form.data.message}
                                    onChange={(e) => form.setData('message', e.target.value)}
                                    rows={4}
                                    className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] focus:ring-2 focus:ring-brand/20 focus:border-brand transition outline-none"
                                />
                                {form.errors.message && (
                                    <p className="text-[11px] text-danger mt-1.5">{form.errors.message}</p>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={form.processing}
                                className="w-full py-2.5 bg-ink-900 hover:bg-ink-800 disabled:opacity-60 text-white rounded-lg text-[14px] font-semibold transition"
                            >
                                {form.processing ? 'Sending…' : 'Send inquiry'}
                            </button>
                        </form>
                        <p className="text-[11px] text-ink-400 mt-3">
                            POPIA: your details are only used to respond to this inquiry.
                        </p>
                    </div>
                </aside>
            </section>
        </PublicLayout>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-ink-50 rounded-xl px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">{label}</p>
            <p className="mt-1 text-[16px] font-bold">{value}</p>
        </div>
    );
}
