import { FormEvent, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import SiteLayout, { Eyebrow, useTemplate } from '@/Layouts/SiteLayout';
import PropertyCard, { SiteListing } from '@/Components/Site/PropertyCard';

type Paginated = {
    data: SiteListing[];
    links: { url: string | null; label: string; active: boolean }[];
    total: number;
};

type Filters = { listing_type?: string; property_type?: string; q?: string; bedrooms?: number | string };

const TYPES = [
    { value: '', label: 'All' },
    { value: 'for_sale', label: 'For sale' },
    { value: 'long_term_rent', label: 'To rent' },
    { value: 'short_term_stay', label: 'Short stay' },
];

export default function SiteListings({ listings, filters }: { listings: Paginated; filters: Filters }) {
    const t = useTemplate();
    const [q, setQ] = useState(filters.q ?? '');

    function apply(next: Filters) {
        const merged = { ...filters, ...next };
        const clean = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== '' && v !== undefined && v !== null));
        router.get('/properties', clean, { preserveState: true, preserveScroll: true, replace: true });
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        apply({ q });
    }

    const heading =
        filters.listing_type === 'for_sale' ? 'Properties for sale'
        : filters.listing_type === 'long_term_rent' ? 'Properties to rent'
        : filters.listing_type === 'short_term_stay' ? 'Short stays'
        : 'All properties';

    return (
        <SiteLayout>
            <Head title={heading} />

            <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-12 pb-20">
                <Eyebrow>Properties</Eyebrow>
                <h1 className={`mt-4 text-[40px] sm:text-[54px] leading-none ${t.heading}`}>{heading}</h1>
                <p className="text-ink-500 mt-1">{listings.total} propert{listings.total === 1 ? 'y' : 'ies'} available</p>

                <div className="mt-6 flex flex-col lg:flex-row gap-3 lg:items-center">
                    <div className="flex flex-wrap gap-2">
                        {TYPES.map((ty) => (
                            <button
                                key={ty.value}
                                type="button"
                                onClick={() => apply({ listing_type: ty.value })}
                                className={`px-3.5 py-2 rounded-full text-[13px] font-medium border transition ${
                                    (filters.listing_type ?? '') === ty.value ? 'bg-ink-900 border-ink-900 text-white' : 'bg-white border-ink-200 hover:border-ink-900'
                                }`}
                            >
                                {ty.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2 lg:ml-auto">
                        <select
                            value={filters.property_type ?? ''}
                            onChange={(e) => apply({ property_type: e.target.value })}
                            className="rounded-full border border-ink-200 bg-white text-[13px] py-2 pl-3.5 pr-3 outline-none"
                        >
                            <option value="">Any type</option>
                            {['house', 'apartment', 'townhouse', 'commercial', 'land'].map((p) => (
                                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                            ))}
                        </select>
                        <select
                            value={String(filters.bedrooms ?? '')}
                            onChange={(e) => apply({ bedrooms: e.target.value })}
                            className="rounded-full border border-ink-200 bg-white text-[13px] py-2 pl-3.5 pr-3 outline-none"
                        >
                            <option value="">Any beds</option>
                            {[1, 2, 3, 4, 5].map((b) => <option key={b} value={b}>{b}+ beds</option>)}
                        </select>
                        <form onSubmit={submit} className="flex">
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Suburb or keyword"
                                className="rounded-l-full border border-r-0 border-ink-200 bg-white text-[13px] py-2 px-3.5 w-44 outline-none"
                            />
                            <button className="rounded-r-full bg-ink-900 text-white text-[13px] px-4 hover:bg-brand-600">Go</button>
                        </form>
                    </div>
                </div>

                {listings.data.length === 0 ? (
                    <div className="mt-16 text-center text-ink-500">
                        <p>No properties match your search right now.</p>
                        <Link href="/contact" className="inline-block mt-3 text-brand-600 font-semibold">Tell us what you're looking for →</Link>
                    </div>
                ) : (
                    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {listings.data.map((l) => <PropertyCard key={l.id} listing={l} />)}
                    </div>
                )}

                {listings.links.length > 3 && (
                    <nav className="mt-10 flex flex-wrap justify-center gap-1">
                        {listings.links.map((link, i) =>
                            link.url ? (
                                <Link
                                    key={i}
                                    href={link.url}
                                    preserveScroll
                                    className={`min-w-9 px-3 py-2 rounded-lg text-[13px] text-center ${link.active ? 'bg-ink-900 text-white' : 'hover:bg-ink-100'}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ) : (
                                <span key={i} className="min-w-9 px-3 py-2 text-[13px] text-ink-300" dangerouslySetInnerHTML={{ __html: link.label }} />
                            ),
                        )}
                    </nav>
                )}
            </section>
        </SiteLayout>
    );
}
