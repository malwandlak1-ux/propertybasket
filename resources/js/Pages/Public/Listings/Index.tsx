import { FormEvent } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';
import ListingCard, { ListingCardData } from '@/Components/ListingCard';

type Filters = {
    listing_type?: string;
    suburb?: string;
    city?: string;
    bedrooms?: number | string;
    price_min?: number | string;
    price_max?: number | string;
};

type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    links: { url: string | null; label: string; active: boolean }[];
    from: number | null;
    to: number | null;
    total: number;
};

type Props = {
    listings: Paginated<ListingCardData>;
    filters: Filters;
};

const LISTING_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: 'Any type' },
    { value: 'for_sale', label: 'For sale' },
    { value: 'long_term_rent', label: 'For rent' },
];

export default function Index({ listings, filters }: Props) {
    function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const payload: Record<string, string> = {};
        form.forEach((v, k) => {
            const s = String(v).trim();
            if (s !== '') payload[k] = s;
        });
        router.get('/properties', payload, { preserveState: true, preserveScroll: true });
    }

    return (
        <PublicLayout>
            <Head title="Browse properties" />
            <section className="max-w-7xl mx-auto px-6 py-10">
                <div className="flex items-end justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Browse properties</h1>
                        <p className="text-ink-500 mt-1 text-[14px]">
                            {listings.total} listing{listings.total === 1 ? '' : 's'} match your filters
                        </p>
                    </div>
                </div>

                <form
                    onSubmit={submit}
                    className="mt-6 bg-white border border-ink-200 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-6 gap-3"
                >
                    <select
                        name="listing_type"
                        defaultValue={filters.listing_type ?? ''}
                        className="md:col-span-2 bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px]"
                    >
                        {LISTING_TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    <input
                        name="suburb"
                        defaultValue={filters.suburb ?? ''}
                        placeholder="Suburb"
                        className="bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px]"
                    />
                    <input
                        name="city"
                        defaultValue={filters.city ?? ''}
                        placeholder="City"
                        className="bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px]"
                    />
                    <input
                        name="bedrooms"
                        defaultValue={filters.bedrooms ?? ''}
                        type="number"
                        min={0}
                        placeholder="Min beds"
                        className="bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px]"
                    />
                    <div className="flex gap-2 md:col-span-1">
                        <input
                            name="price_min"
                            defaultValue={filters.price_min ?? ''}
                            type="number"
                            min={0}
                            placeholder="Min R"
                            className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px]"
                        />
                        <input
                            name="price_max"
                            defaultValue={filters.price_max ?? ''}
                            type="number"
                            min={0}
                            placeholder="Max R"
                            className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px]"
                        />
                    </div>
                    <button
                        type="submit"
                        className="md:col-span-6 lg:col-span-1 py-2.5 bg-ink-900 hover:bg-ink-800 text-white rounded-lg text-[14px] font-semibold transition"
                    >
                        Apply filters
                    </button>
                </form>

                {listings.data.length === 0 ? (
                    <div className="mt-8 bg-white rounded-2xl border border-ink-200 p-12 text-center text-ink-500">
                        No listings match those filters. Try widening your search.
                    </div>
                ) : (
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {listings.data.map((l) => (
                            <ListingCard key={l.slug} listing={l} />
                        ))}
                    </div>
                )}

                {listings.last_page > 1 && (
                    <div className="mt-10 flex flex-wrap gap-1.5 justify-center">
                        {listings.links.map((link, idx) => (
                            <Link
                                key={idx}
                                href={link.url ?? '#'}
                                preserveScroll
                                preserveState
                                disabled={!link.url}
                                className={
                                    'px-3 py-1.5 rounded-md text-[13px] font-medium border transition ' +
                                    (link.active
                                        ? 'bg-ink-900 text-white border-ink-900'
                                        : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400 ' +
                                          (link.url ? '' : 'opacity-40 pointer-events-none'))
                                }
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ))}
                    </div>
                )}
            </section>
        </PublicLayout>
    );
}
