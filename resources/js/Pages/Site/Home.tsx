import { FormEvent, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import SiteLayout, { Eyebrow, useSite, useTemplate } from '@/Layouts/SiteLayout';
import PropertyCard, { SiteListing } from '@/Components/Site/PropertyCard';
import { AgentAvatar, SiteAgent } from '@/Components/Site/AgentCard';

type Props = {
    hero: { heading: string; image: string | null };
    featured: { for_sale: SiteListing[]; long_term_rent: SiteListing[] };
    counts: { for_sale: number; long_term_rent: number; short_term_stay: number };
    agents: SiteAgent[];
};

const BUDGETS = {
    for_sale: [
        { label: 'Any price', min: '', max: '' },
        { label: 'Under R1.5m', min: '', max: '1500000' },
        { label: 'R1.5m – R3m', min: '1500000', max: '3000000' },
        { label: 'R3m – R5m', min: '3000000', max: '5000000' },
        { label: 'R5m – R10m', min: '5000000', max: '10000000' },
        { label: 'R10m+', min: '10000000', max: '' },
    ],
    long_term_rent: [
        { label: 'Any price', min: '', max: '' },
        { label: 'Under R8 000 pm', min: '', max: '8000' },
        { label: 'R8 000 – R15 000 pm', min: '8000', max: '15000' },
        { label: 'R15 000 – R25 000 pm', min: '15000', max: '25000' },
        { label: 'R25 000+ pm', min: '25000', max: '' },
    ],
};

type Mode = keyof typeof BUDGETS;

export default function SiteHome({ hero, featured, counts, agents }: Props) {
    const site = useSite();
    const t = useTemplate();
    const [mode, setMode] = useState<Mode>('for_sale');
    const [q, setQ] = useState('');
    const [budget, setBudget] = useState(0);
    const [tab, setTab] = useState<Mode>(featured.for_sale.length || ! featured.long_term_rent.length ? 'for_sale' : 'long_term_rent');

    function search(e: FormEvent) {
        e.preventDefault();
        const b = BUDGETS[mode][budget] ?? BUDGETS[mode][0];
        router.get('/properties', Object.fromEntries(Object.entries({ listing_type: mode, q, price_min: b.min, price_max: b.max }).filter(([, v]) => v)));
    }

    const shown = featured[tab];
    // A photo collage only works with real headshots; otherwise use the hero photo.
    const withPhotos = agents.filter((a) => a.avatar);

    return (
        <SiteLayout>
            <Head title="" />

            {/* ── Hero ─────────────────────────────────────────────── */}
            <section className="relative isolate">
                {hero.image ? (
                    <img src={hero.image} alt="" className="absolute inset-0 -z-10 w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 -z-10 bg-[#1b1b1b]" />
                )}
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />

                <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-20 sm:pt-28 pb-10 text-white">
                    <Eyebrow light>{site.name} · Buy · Sell · Rent</Eyebrow>
                    <h1 className={`mt-6 text-[44px] sm:text-[68px] leading-[1.02] max-w-3xl ${t.heading}`}>{hero.heading}</h1>
                    {site.tagline && <p className="mt-5 text-[17px] sm:text-[19px] leading-relaxed text-white/85 max-w-xl">{site.tagline}</p>}

                    {/* Search card */}
                    <form onSubmit={search} className="mt-10 bg-white text-ink-900 rounded-2xl shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] p-4 sm:p-5 max-w-5xl">
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-ink-100">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500 hidden sm:inline">Find your place</span>
                                <div className="flex gap-1">
                                    {(['for_sale', 'long_term_rent'] as Mode[]).map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => { setMode(m); setBudget(0); }}
                                            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition ${mode === m ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100'}`}
                                        >
                                            {m === 'for_sale' ? 'Buy' : 'Rent'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <span className="text-[12px] text-ink-400 hidden md:inline">
                                {counts.for_sale} for sale · {counts.long_term_rent} to rent
                            </span>
                        </div>
                        <div className="pt-4 grid gap-3 md:grid-cols-[1.6fr_1fr_auto]">
                            <label className="block border border-ink-200 rounded-xl px-4 py-2.5 focus-within:border-ink-900">
                                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Location</span>
                                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suburb, area or city" className="w-full border-0 p-0 mt-0.5 text-[15px] focus:ring-0 placeholder:text-ink-400" />
                            </label>
                            <label className="block border border-ink-200 rounded-xl px-4 py-2.5 focus-within:border-ink-900">
                                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Budget</span>
                                <select value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full border-0 p-0 mt-0.5 text-[15px] focus:ring-0 bg-transparent">
                                    {BUDGETS[mode].map((b, i) => <option key={b.label} value={i}>{b.label}</option>)}
                                </select>
                            </label>
                            <button className="px-6 py-4 md:py-0 rounded-xl bg-ink-900 hover:bg-brand-600 text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition">
                                Search homes <span aria-hidden>↗</span>
                            </button>
                        </div>
                    </form>
                </div>
                <div className="h-16 sm:h-24" />
            </section>

            {/* ── Featured properties ─────────────────────────────── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-8 py-20">
                <div className="flex flex-wrap items-end justify-between gap-5 mb-10">
                    <div>
                        <Eyebrow>Featured</Eyebrow>
                        <h2 className={`mt-4 text-[36px] sm:text-[46px] leading-none ${t.heading}`}>Featured properties</h2>
                    </div>
                    <div className="flex items-center gap-5">
                        <div className="flex gap-1 bg-white border border-ink-200 rounded-full p-1">
                            {(['for_sale', 'long_term_rent'] as Mode[]).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setTab(m)}
                                    className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition ${tab === m ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900'}`}
                                >
                                    {m === 'for_sale' ? 'For sale' : 'To rent'}
                                </button>
                            ))}
                        </div>
                        <Link href={`/properties?listing_type=${tab}`} className="hidden sm:inline text-[14px] font-medium text-ink-800 hover:text-brand-600">
                            View all properties →
                        </Link>
                    </div>
                </div>

                {shown.length === 0 ? (
                    <p className="text-ink-500">New listings are on the way — <Link href="/contact" className="underline">get in touch</Link> and we'll let you know first.</p>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {shown.map((l) => <PropertyCard key={l.id} listing={l} />)}
                    </div>
                )}
                <Link href={`/properties?listing_type=${tab}`} className="sm:hidden inline-block mt-8 text-[14px] font-medium">View all properties →</Link>
            </section>

            {/* ── Our people (split panel) ─────────────────────────── */}
            {site.show_agents && (
                <section className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                    <div className={`${t.dark} px-6 sm:px-12 py-16 sm:py-24 flex flex-col justify-center`}>
                        <Eyebrow light>Our people</Eyebrow>
                        <h2 className={`mt-5 text-[38px] sm:text-[50px] leading-[1.02] ${t.heading}`}>Local knowledge.<br />Personal service.</h2>
                        <p className="mt-5 text-[16px] text-white/70 max-w-md leading-relaxed">
                            Thoughtful advice and a personal approach, from your first viewing to the day you get the keys.
                        </p>
                        <Link href="/agents" className="mt-8 text-[15px] font-medium text-white hover:text-brand-300">Meet our people →</Link>
                    </div>
                    <div className="relative min-h-[320px] bg-ink-200">
                        {withPhotos.length >= 3 ? (
                            <div className="absolute inset-0 grid grid-cols-2 sm:grid-cols-3 gap-px bg-black/10">
                                {withPhotos.slice(0, withPhotos.length >= 6 ? 6 : 3).map((a) => (
                                    <Link key={a.id} href={`/agents/${a.slug}`} className="relative group overflow-hidden">
                                        <AgentAvatar agent={a} className="w-full h-full" />
                                        <span className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent text-white text-[13px] font-medium opacity-0 group-hover:opacity-100 transition">
                                            {a.name}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        ) : hero.image ? (
                            <img src={hero.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        ) : withPhotos[0] ? (
                            <AgentAvatar agent={withPhotos[0]} className="absolute inset-0 w-full h-full" />
                        ) : null}
                    </div>
                </section>
            )}

            {/* ── Sell band ────────────────────────────────────────── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-8 py-20">
                <div className={`${t.dark} ${t.card} px-6 sm:px-12 py-10 sm:py-12 grid gap-6 md:grid-cols-[1fr_1.2fr_auto] md:items-center`}>
                    <h2 className={`text-[32px] sm:text-[40px] leading-none ${t.heading}`}>Thinking of selling?</h2>
                    <p className="text-[15px] text-white/70 leading-relaxed">
                        Get a professional valuation and honest advice from a team that knows your area.
                    </p>
                    <Link href="/contact?intent=sell" className={`justify-self-start px-6 py-3 bg-white text-ink-900 hover:bg-brand-500 hover:text-white text-[14px] font-semibold transition ${t.button}`}>
                        Book a valuation
                    </Link>
                </div>
            </section>
        </SiteLayout>
    );
}
