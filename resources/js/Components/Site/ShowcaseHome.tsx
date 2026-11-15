import { FormEvent, ReactNode, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import { useSite, useTemplate } from '@/Layouts/SiteLayout';
import PropertyCard, { SiteListing } from '@/Components/Site/PropertyCard';

/**
 * Home page for the "showcase" template — a bright portal: light photo
 * hero with a highlighted headline and tabbed search card, feature strip,
 * handpicked listings, about split with stat card, navy stats bar,
 * lifestyle (property type) cards, "why us" card, top locations and a
 * rounded CTA band. Everything is driven by the agency's own data.
 */

type Tile = { type: string; label: string; count: number; image: string | null };
type Area = { suburb: string; city: string | null; count: number; image: string | null };

export type ShowcaseProps = {
    hero: { heading: string; image: string | null };
    featured: { for_sale: SiteListing[]; long_term_rent: SiteListing[] };
    counts: { for_sale: number; long_term_rent: number; short_term_stay: number };
    types: Tile[];
    areas: Area[];
    stats: { listings: number; agents: number; areas: number; types: number };
    about: string | null;
    images: { about: string | null; cta: string | null; why: string | null };
};

type Status = '' | 'for_sale' | 'long_term_rent';

const MAX_PRICE: Record<Status, { label: string; value: string }[]> = {
    '': [],
    for_sale: ['1000000', '1500000', '2000000', '3000000', '5000000', '10000000'].map((v) => ({ value: v, label: `R ${Number(v) / 1e6}m` })),
    long_term_rent: ['6000', '10000', '15000', '20000', '30000', '50000'].map((v) => ({ value: v, label: `R ${Number(v).toLocaleString('en-ZA').replace(/,/g, ' ')} pm` })),
};

/** "Where *great homes* meet…" → highlight the starred words; otherwise the agency name. */
function Highlight({ text, fallback }: { text: string; fallback?: string }) {
    if (text.includes('*')) {
        return <>{text.split('*').map((part, i) => (i % 2 ? <span key={i} className="text-brand-500">{part}</span> : part))}</>;
    }
    if (fallback && text.includes(fallback)) {
        const [a, ...b] = text.split(fallback);
        return <>{a}<span className="text-brand-500">{fallback}</span>{b.join(fallback)}</>;
    }
    return <>{text}</>;
}

function Eyebrow({ children, center = false }: { children: ReactNode; center?: boolean }) {
    return <p className={`text-[12px] font-bold uppercase tracking-[0.14em] text-brand-500 ${center ? 'text-center' : ''}`}>{children}</p>;
}

const I = {
    home: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    pin: 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    chat: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z',
    globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01',
    check: 'M20 6L9 17l-5-5',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
};

function Ico({ d, className = 'w-6 h-6' }: { d: string; className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

const sel = 'w-full appearance-none bg-white border border-ink-200 rounded-lg px-3 py-2.5 text-[14px] text-ink-800 outline-none focus:border-brand-500';

export default function ShowcaseHome({ hero, featured, counts, types, areas, stats, about, images }: ShowcaseProps) {
    const site = useSite();
    const t = useTemplate();

    const [status, setStatus] = useState<Status>('');
    const [ptype, setPtype] = useState('');
    const [area, setArea] = useState('');
    const [beds, setBeds] = useState('');
    const [max, setMax] = useState('');

    function search(e: FormEvent) {
        e.preventDefault();
        const q = { listing_type: status, property_type: ptype, q: area, bedrooms: beds, price_max: status ? max : '' };
        router.get('/properties', Object.fromEntries(Object.entries(q).filter(([, v]) => v)));
    }

    const mixed: SiteListing[] = [];
    for (let i = 0; i < 8; i++) {
        if (featured.for_sale[i]) mixed.push(featured.for_sale[i]);
        if (featured.long_term_rent[i]) mixed.push(featured.long_term_rent[i]);
    }
    const shown = mixed.slice(0, 8);
    // Each section uses the agency's own upload (Website → Images), else an automatic photo.
    const autoPhoto = hero.image ?? shown[0]?.primary_image ?? null;
    const aboutPhoto = images.about ?? autoPhoto;
    const ctaPhoto = images.cta ?? autoPhoto;
    const aboutText = (about ?? '').split(/\n\s*\n/)[0]
        || `${site.name} helps buyers, sellers, landlords and tenants with every step of their property journey.`;

    const features = [
        { icon: I.home, title: 'Wide range of properties', text: `${stats.listings} homes for sale and to rent, from apartments to family houses.` },
        { icon: I.users, title: 'Local experts', text: `${stats.agents || 'Our'} agent${stats.agents === 1 ? '' : 's'} who know these streets and what homes are worth.` },
        { icon: I.pin, title: 'Great locations', text: `Listings across ${stats.areas || 'many'} suburb${stats.areas === 1 ? '' : 's'}, close to everything that matters.` },
        { icon: I.chat, title: 'Personal support', text: 'One agent with you at every step, from first viewing to registration.' },
    ];

    return (
        <>
            {/* ── Hero ─────────────────────────────────────────────── */}
            <section className="relative isolate overflow-hidden bg-[#EAF2F8]">
                {hero.image && <img src={hero.image} alt="" className="absolute inset-0 -z-10 w-full h-full object-cover" />}
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white/95 via-white/70 to-white/0" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-10">
                    <div className="max-w-2xl">
                        <Eyebrow>Find your next property</Eyebrow>
                        <h1 className={`mt-4 text-[40px] sm:text-[60px] leading-[1.05] text-ink-900 ${t.heading}`}>
                            <Highlight text={hero.heading} fallback={site.name} />
                        </h1>
                        <p className="mt-5 text-[16px] sm:text-[18px] leading-relaxed text-ink-700 max-w-xl">
                            {site.tagline || `Discover homes for sale and to rent with ${site.name}.`}
                        </p>
                        <Link href="/properties" className={`inline-flex items-center gap-2 mt-8 px-6 py-3.5 bg-brand-500 hover:bg-brand-600 text-white text-[15px] font-semibold shadow-lg shadow-brand-500/25 transition ${t.button}`}>
                            Start exploring <span aria-hidden>→</span>
                        </Link>
                    </div>

                    <form onSubmit={search} className="mt-14 sm:mt-24">
                        <div className="flex">
                            {([['', 'All'], ['long_term_rent', 'For rent'], ['for_sale', 'For sale']] as [Status, string][]).map(([v, label], i) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => { setStatus(v); setMax(''); }}
                                    className={`px-6 sm:px-8 py-3 text-[14px] font-semibold transition ${i === 0 ? 'rounded-tl-xl' : ''} ${i === 2 ? 'rounded-tr-xl' : ''} ${
                                        status === v ? 'bg-white text-ink-900' : 'bg-[var(--site-accent)] text-white hover:opacity-90'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="bg-white rounded-b-xl rounded-tr-xl shadow-[0_20px_50px_-20px_rgba(15,42,68,0.35)] p-4 sm:p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
                            <Field label="Type">
                                <select value={ptype} onChange={(e) => setPtype(e.target.value)} className={sel}>
                                    <option value="">Any type</option>
                                    {['house', 'apartment', 'townhouse', 'commercial', 'land'].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                                </select>
                            </Field>
                            <Field label="Where">
                                <select value={area} onChange={(e) => setArea(e.target.value)} className={sel}>
                                    <option value="">Any area</option>
                                    {areas.map((a) => <option key={a.suburb} value={a.suburb}>{a.suburb}</option>)}
                                </select>
                            </Field>
                            <Field label="Rooms">
                                <select value={beds} onChange={(e) => setBeds(e.target.value)} className={sel}>
                                    <option value="">Bedrooms</option>
                                    {[1, 2, 3, 4, 5].map((b) => <option key={b} value={b}>{b}+</option>)}
                                </select>
                            </Field>
                            <Field label="Budget">
                                <select value={max} onChange={(e) => setMax(e.target.value)} disabled={! status} className={`${sel} disabled:bg-ink-50 disabled:text-ink-400`}>
                                    <option value="">{status ? 'Max price' : 'Choose rent or sale'}</option>
                                    {MAX_PRICE[status].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </Field>
                            <button className={`h-[46px] px-10 bg-brand-500 hover:bg-brand-600 text-white text-[15px] font-semibold transition ${t.button}`}>Search</button>
                        </div>
                    </form>
                </div>
            </section>

            {/* ── Feature strip ────────────────────────────────────── */}
            <section className="bg-white border-b border-ink-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    {features.map((f) => (
                        <div key={f.title} className="flex gap-4">
                            <span className="w-14 h-14 shrink-0 rounded-xl bg-brand-50 text-brand-600 grid place-items-center"><Ico d={f.icon} /></span>
                            <div>
                                <p className="text-[15px] font-bold text-ink-900">{f.title}</p>
                                <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{f.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Handpicked listings ──────────────────────────────── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
                <Eyebrow>Featured properties</Eyebrow>
                <h2 className={`mt-2 text-[32px] sm:text-[40px] leading-tight text-ink-900 ${t.heading}`}>Handpicked properties for you</h2>
                {shown.length === 0 ? (
                    <p className="mt-8 text-ink-500">New listings are on the way — <Link href="/contact" className="text-brand-600 underline">get in touch</Link> and we'll let you know first.</p>
                ) : (
                    <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {shown.map((l) => <PropertyCard key={l.id} listing={l} />)}
                    </div>
                )}
                <div className="mt-12 text-center">
                    <Link href="/properties" className={`inline-flex items-center gap-2 px-7 py-3.5 bg-brand-500 hover:bg-brand-600 text-white text-[15px] font-semibold transition ${t.button}`}>
                        View all properties <span aria-hidden>→</span>
                    </Link>
                </div>
            </section>

            {/* ── About split ──────────────────────────────────────── */}
            <section className="bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 grid gap-12 lg:grid-cols-2 lg:items-center">
                    <div>
                        <Eyebrow>About {site.name}</Eyebrow>
                        <h2 className={`mt-2 text-[32px] sm:text-[42px] leading-tight text-ink-900 ${t.heading}`}>
                            Making property <span className="text-brand-500">simpler</span>
                        </h2>
                        <p className="mt-5 text-[16px] leading-relaxed text-ink-600">{aboutText}</p>
                        <ul className="mt-6 space-y-3 text-[15px] text-ink-800">
                            {['Honest pricing advice and free valuations', `Listings on our website and the Property Basket portal`, 'Viewings, offers and paperwork handled for you', 'Rental management for landlords'].map((li) => (
                                <li key={li} className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-600 grid place-items-center"><Ico d={I.check} className="w-3.5 h-3.5" /></span>
                                    {li}
                                </li>
                            ))}
                        </ul>
                        <Link href="/about" className={`inline-flex items-center gap-2 mt-8 px-6 py-3.5 bg-brand-500 hover:bg-brand-600 text-white text-[15px] font-semibold transition ${t.button}`}>
                            Learn more about us <span aria-hidden>→</span>
                        </Link>
                    </div>
                    <div className="relative">
                        <div className="aspect-[5/4] rounded-2xl overflow-hidden bg-ink-100">
                            {aboutPhoto && <img src={aboutPhoto} alt="" loading="lazy" className="w-full h-full object-cover" />}
                        </div>
                        <div className="absolute -bottom-6 right-4 sm:right-8 bg-[var(--site-accent)] text-white rounded-2xl p-6 w-56 shadow-xl">
                            <Ico d={I.home} className="w-8 h-8 text-brand-300" />
                            <p className="mt-3 text-[36px] font-bold leading-none">{stats.listings}+</p>
                            <p className="mt-1 text-[14px] font-semibold">Active listings</p>
                            <p className="mt-2 text-[12px] text-white/70">Updated live — sold and rented homes come off straight away.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Stats bar ────────────────────────────────────────── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
                <div className="rounded-2xl bg-[var(--site-accent)] text-white px-6 sm:px-10 py-8 grid gap-6 grid-cols-2 lg:grid-cols-4">
                    {[
                        { icon: I.home, n: stats.listings, label: 'Properties listed' },
                        { icon: I.users, n: stats.agents, label: 'Local agents' },
                        { icon: I.pin, n: stats.areas, label: 'Suburbs covered' },
                        { icon: I.grid, n: stats.types, label: 'Property types' },
                    ].map((s) => (
                        <div key={s.label} className="flex items-center gap-4">
                            <Ico d={s.icon} className="w-10 h-10 text-white/80 shrink-0" />
                            <div>
                                <p className="text-[30px] font-bold leading-none">{s.n}+</p>
                                <p className="mt-1 text-[13px] text-white/75">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Lifestyle (property types) ───────────────────────── */}
            {types.length > 0 && (
                <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-20">
                    <Eyebrow>Explore by lifestyle</Eyebrow>
                    <h2 className={`mt-2 text-[32px] sm:text-[40px] leading-tight text-ink-900 ${t.heading}`}>Find a home that fits your lifestyle</h2>
                    <p className="mt-2 text-[16px] text-ink-500">Browse by how you want to live, not just where.</p>
                    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {types.map((ty) => (
                            <Link key={ty.type} href={`/properties?property_type=${ty.type}`} className="group flex items-center gap-4 bg-white rounded-xl p-3 border border-black/[0.05] hover:shadow-lg transition">
                                <span className="w-24 h-20 rounded-lg overflow-hidden bg-ink-100 shrink-0">
                                    {ty.image && <img src={ty.image} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />}
                                </span>
                                <span>
                                    <span className="block text-[16px] font-bold text-ink-900 group-hover:text-brand-600">{ty.label}</span>
                                    <span className="block text-[13px] text-ink-500">{ty.count} propert{ty.count === 1 ? 'y' : 'ies'}</span>
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Why choose us ────────────────────────────────────── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-20">
                <div className="bg-white rounded-2xl border-b-4 border-brand-500 shadow-[0_10px_40px_-20px_rgba(15,42,68,0.25)] p-8 sm:p-12 grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
                    <div>
                        <Eyebrow>Why choose {site.name}</Eyebrow>
                        <h2 className={`mt-2 text-[30px] sm:text-[38px] leading-tight text-ink-900 ${t.heading}`}>
                            Everything you need to buy, sell or <span className="text-brand-500">rent</span>
                        </h2>
                        <p className="mt-4 text-[15px] text-ink-500">From the first search to the day you get the keys, we make every step simpler.</p>
                    </div>
                    <div className="grid gap-8 sm:grid-cols-2">
                        {[
                            { icon: I.globe, title: 'Listed everywhere', text: 'Every home goes live on our website and the Property Basket portal at once.' },
                            { icon: I.search, title: 'Smart search', text: 'Filter by area, type, bedrooms and budget to find the right fit fast.' },
                            { icon: I.tag, title: 'Free valuations', text: 'Know what your property is worth before you sell or let it.' },
                            { icon: I.users, title: 'Local agents', text: 'A dedicated agent who answers the phone and knows the area.' },
                        ].map((f) => (
                            <div key={f.title} className="flex gap-4">
                                <Ico d={f.icon} className="w-9 h-9 text-ink-400 shrink-0" />
                                <div>
                                    <p className="text-[16px] font-bold text-ink-900">{f.title}</p>
                                    <p className="mt-1 text-[13.5px] text-ink-500 leading-relaxed">{f.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Top locations ────────────────────────────────────── */}
            {areas.length > 0 && (
                <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-20">
                    <Eyebrow center>Featured locations</Eyebrow>
                    <h2 className={`mt-2 text-center text-[32px] sm:text-[40px] leading-tight text-ink-900 ${t.heading}`}>Explore properties in top locations</h2>
                    <div className="mt-10 grid gap-5 grid-cols-2 lg:grid-cols-4">
                        {areas.slice(0, 4).map((a) => (
                            <Link key={a.suburb} href={`/properties?q=${encodeURIComponent(a.suburb)}`} className="group bg-white rounded-xl overflow-hidden border border-black/[0.05] hover:shadow-lg transition">
                                <span className="block aspect-[4/3] bg-ink-100 overflow-hidden">
                                    {a.image && <img src={a.image} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                                </span>
                                <span className="block text-center py-4">
                                    <span className="block text-[16px] font-bold text-ink-900">{a.suburb}</span>
                                    <span className="block text-[13px] text-ink-500">{a.count} propert{a.count === 1 ? 'y' : 'ies'}</span>
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* ── CTA band ─────────────────────────────────────────── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
                <div className="relative isolate overflow-hidden rounded-2xl bg-[var(--site-accent)] text-white px-8 sm:px-14 py-14">
                    {ctaPhoto && <img src={ctaPhoto} alt="" className="absolute inset-y-0 right-0 -z-10 w-full lg:w-2/3 h-full object-cover opacity-35 [mask-image:linear-gradient(to_right,transparent,black_45%)]" />}
                    <h2 className={`text-[32px] sm:text-[44px] leading-tight max-w-md ${t.heading}`}>Ready to find your dream home?</h2>
                    <p className="mt-4 text-[16px] text-white/80 max-w-md">
                        Browse {counts.for_sale + counts.long_term_rent} homes with {site.name}, or ask us to value and list yours.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link href="/properties" className={`inline-flex items-center gap-2 px-6 py-3.5 bg-brand-500 hover:bg-brand-600 text-white text-[15px] font-semibold transition ${t.button}`}>
                            Start exploring <span aria-hidden>→</span>
                        </Link>
                        <Link href="/contact?intent=sell" className={`inline-flex items-center px-6 py-3.5 border border-white/40 hover:bg-white hover:text-ink-900 text-[15px] font-semibold transition ${t.button}`}>
                            Get a valuation
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className="block text-[13px] font-bold text-ink-900 mb-1.5">{label}</span>
            {children}
        </label>
    );
}
