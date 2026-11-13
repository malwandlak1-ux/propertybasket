import { FormEvent, useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import SiteLayout, { Eyebrow, useTemplate } from '@/Layouts/SiteLayout';
import PropertyCard, { SiteListing } from '@/Components/Site/PropertyCard';
import MortgageCalculator from '@/Components/MortgageCalculator';
import ScheduleTour from '@/Components/ScheduleTour';
import { AgentAvatar } from '@/Components/Site/AgentCard';

type Listing = {
    id: number;
    title: string;
    description: string | null;
    listing_type: 'for_sale' | 'long_term_rent' | 'short_term_stay';
    property_type: string;
    suburb: string | null;
    city: string | null;
    province: string | null;
    bedrooms: number | null;
    bathrooms: number | string | null;
    area_sqm: number | string | null;
    sale_price: number | string | null;
    monthly_rent: number | string | null;
    short_stay_nightly_price: number | string | null;
    primary_image: string | null;
    gallery_images: string[] | null;
    amenities: string[] | Record<string, string[]> | null;
};

type Contact = { id: number | null; name: string; email: string | null; phone: string | null; avatar: string | null; slug: string | null };

type Props = { listing: Listing; contact: Contact; similar: SiteListing[] };

const zar = (v: number | string | null) =>
    v === null || v === '' || Number.isNaN(Number(v)) ? '—' : 'R ' + new Intl.NumberFormat('en-ZA').format(Math.round(Number(v)));

const TYPE_LABEL = { for_sale: 'For sale', long_term_rent: 'To rent', short_term_stay: 'Short stay' } as const;

export default function SiteListingShow({ listing, contact, similar }: Props) {
    const t = useTemplate();
    const gallery = Array.from(new Set([listing.primary_image, ...(listing.gallery_images ?? [])].filter(Boolean))) as string[];
    const [active, setActive] = useState(gallery[0] ?? null);
    const [sent, setSent] = useState(false);
    const amenities = ! listing.amenities ? [] : Array.isArray(listing.amenities) ? listing.amenities : Object.values(listing.amenities).flat();

    const form = useForm({
        listing_id: listing.id,
        agent_id: contact.id ?? '',
        name: '',
        email: '',
        phone: '',
        message: `Hi, I'd like more information about "${listing.title}".`,
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        form.post('/inquiries', { preserveScroll: true, onSuccess: () => { setSent(true); form.reset('name', 'email', 'phone'); } });
    }

    const price =
        listing.listing_type === 'for_sale' ? zar(listing.sale_price)
        : listing.listing_type === 'long_term_rent' ? `${zar(listing.monthly_rent)} / month`
        : `${zar(listing.short_stay_nightly_price)} / night`;

    return (
        <SiteLayout>
            <Head title={listing.title} />

            <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-6">
                <Link href="/properties" className="text-[13px] text-ink-500 hover:text-ink-900">← All properties</Link>
            </section>

            <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-4 pb-16 grid gap-10 lg:grid-cols-3">
                <div className="lg:col-span-2 min-w-0">
                    <div className={`overflow-hidden bg-ink-100 aspect-[16/10] ${t.card}`}>
                        {active ? <img src={active} alt={listing.title} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-ink-400">No image</div>}
                    </div>
                    {gallery.length > 1 && (
                        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                            {gallery.map((src) => (
                                <button key={src} type="button" onClick={() => setActive(src)} className={`w-24 shrink-0 aspect-[4/3] overflow-hidden rounded-lg border-2 ${src === active ? 'border-brand-500' : 'border-transparent'}`}>
                                    <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                                </button>
                            ))}
                        </div>
                    )}

                    <Eyebrow className="mt-8">{TYPE_LABEL[listing.listing_type]} · {listing.property_type}</Eyebrow>
                    <h1 className={`mt-4 text-[36px] sm:text-[48px] leading-[1.05] ${t.heading}`}>{listing.title}</h1>
                    <p className="mt-1 text-ink-500">{[listing.suburb, listing.city, listing.province].filter(Boolean).join(', ')}</p>
                    <p className="mt-4 text-[28px] font-semibold tracking-tight">{price}</p>

                    <div className="mt-6 flex flex-wrap gap-3">
                        {listing.bedrooms !== null && <Fact label="Bedrooms" value={listing.bedrooms} />}
                        {listing.bathrooms !== null && <Fact label="Bathrooms" value={listing.bathrooms} />}
                        {listing.area_sqm !== null && <Fact label="Floor size" value={`${listing.area_sqm} m²`} />}
                    </div>

                    {listing.description && (
                        <div className="mt-10">
                            <h2 className={`text-[28px] ${t.heading}`}>About this property</h2>
                            <p className="mt-3 text-ink-700 leading-relaxed whitespace-pre-line">{listing.description}</p>
                        </div>
                    )}

                    {amenities.length > 0 && (
                        <div className="mt-10">
                            <h2 className={`text-[28px] ${t.heading}`}>Features</h2>
                            <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[14px] text-ink-700">
                                {amenities.map((a) => (
                                    <li key={a} className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />{a}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {listing.listing_type !== 'short_term_stay' && <ScheduleTour listingId={listing.id} />}

                    {listing.listing_type === 'for_sale' && listing.sale_price && (
                        <div className="mt-10"><MortgageCalculator defaultTotal={Number(listing.sale_price)} /></div>
                    )}
                </div>

                <aside className="lg:sticky lg:top-28 self-start space-y-4">
                    <div className={`bg-white border border-ink-200 shadow-soft p-6 ${t.card}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-full overflow-hidden shrink-0">
                                <AgentAvatar agent={{ name: contact.name, avatar: contact.avatar }} className="w-full h-full text-[18px]" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[12px] text-ink-500">Listed by</p>
                                {contact.slug ? (
                                    <Link href={`/agents/${contact.slug}`} className="font-semibold hover:text-brand-600">{contact.name}</Link>
                                ) : (
                                    <p className="font-semibold">{contact.name}</p>
                                )}
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            {contact.phone && <a href={`tel:${contact.phone}`} className="text-center text-[13px] font-semibold py-2.5 rounded-lg bg-ink-900 text-white hover:bg-brand-600">Call</a>}
                            {contact.phone && <a href={`https://wa.me/${contact.phone.replace(/[^\d]/g, '').replace(/^0/, '27')}`} target="_blank" rel="noopener noreferrer" className="text-center text-[13px] font-semibold py-2.5 rounded-lg border border-ink-200 hover:border-brand-500">WhatsApp</a>}
                        </div>

                        <form onSubmit={submit} className="mt-5 space-y-3">
                            {sent && <p className="rounded-lg bg-success/10 text-success text-[13px] px-3 py-2">Thanks — your enquiry is on its way.</p>}
                            <Input placeholder="Your name" value={form.data.name} onChange={(v) => form.setData('name', v)} error={form.errors.name} required />
                            <Input placeholder="Email" type="email" value={form.data.email} onChange={(v) => form.setData('email', v)} error={form.errors.email} required />
                            <Input placeholder="Phone (optional)" value={form.data.phone} onChange={(v) => form.setData('phone', v)} error={form.errors.phone} />
                            <textarea
                                value={form.data.message}
                                onChange={(e) => form.setData('message', e.target.value)}
                                rows={4}
                                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-ink-900"
                            />
                            <button disabled={form.processing} className="w-full py-3 rounded-lg bg-ink-900 hover:bg-brand-600 disabled:opacity-60 text-white font-semibold text-[14px]">
                                {form.processing ? 'Sending…' : 'Send enquiry'}
                            </button>
                        </form>
                    </div>
                </aside>
            </section>

            {similar.length > 0 && (
                <section className="max-w-7xl mx-auto px-4 sm:px-8 pb-16">
                    <h2 className={`text-[34px] mb-8 ${t.heading}`}>You might also like</h2>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {similar.map((l) => <PropertyCard key={l.id} listing={l} />)}
                    </div>
                </section>
            )}
        </SiteLayout>
    );
}

function Fact({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="px-4 py-3 rounded-xl bg-white border border-black/[0.06] min-w-[110px]">
            <p className="text-[11px] uppercase tracking-wider text-ink-500">{label}</p>
            <p className="text-[18px] font-bold mt-0.5">{value}</p>
        </div>
    );
}

function Input({ value, onChange, error, ...rest }: { value: string; onChange: (v: string) => void; error?: string; placeholder: string; type?: string; required?: boolean }) {
    return (
        <div>
            <input value={value} onChange={(e) => onChange(e.target.value)} {...rest} className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-ink-900" />
            {error && <p className="text-danger text-[12px] mt-1">{error}</p>}
        </div>
    );
}
