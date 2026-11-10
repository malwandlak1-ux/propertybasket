import { FormEvent, useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import SiteLayout, { SectionTitle, useSite, useTemplate } from '@/Layouts/SiteLayout';
import PropertyCard, { SiteListing } from '@/Components/Site/PropertyCard';
import { AgentAvatar, SiteAgent } from '@/Components/Site/AgentCard';

type Tile = { type: string; label: string; count: number; image: string | null };
type Area = { suburb: string; city: string | null; count: number; image: string | null };

type Props = {
    hero: { heading: string; image: string | null };
    featured: { for_sale: SiteListing[]; long_term_rent: SiteListing[] };
    counts: { for_sale: number; long_term_rent: number; short_term_stay: number };
    agents: SiteAgent[];
    types: Tile[];
    areas: Area[];
};

type Status = '' | 'for_sale' | 'long_term_rent';

const MAX_PRICE: Record<Status, { label: string; value: string }[]> = {
    '': [],
    for_sale: ['1000000', '1500000', '2000000', '3000000', '5000000', '10000000'].map((v) => ({ value: v, label: `R ${Number(v) / 1e6}m` })),
    long_term_rent: ['6000', '10000', '15000', '20000', '30000', '50000'].map((v) => ({ value: v, label: `R ${Number(v).toLocaleString('en-ZA').replace(/,/g, ' ')} pm` })),
};

const sel = 'w-full appearance-none bg-white border border-ink-200 rounded-md px-3 py-2.5 text-[14px] text-ink-800 outline-none focus:border-brand-500';

export default function SiteHome({ hero, featured, counts, agents, types, areas }: Props) {
    const site = useSite();
    const t = useTemplate();
    const portal = t.key === 'portal';

    // ── Search bar state ──
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

    // Featured: interleave sale + rent so both show.
    const mixed: SiteListing[] = [];
    for (let i = 0; i < 6; i++) {
        if (featured.for_sale[i]) mixed.push(featured.for_sale[i]);
        if (featured.long_term_rent[i]) mixed.push(featured.long_term_rent[i]);
    }
    const shown = mixed.slice(0, 6);

    const tabs: { value: Status; label: string }[] = [
        { value: '', label: 'All status' },
        { value: 'for_sale', label: 'For sale' },
        { value: 'long_term_rent', label: 'To rent' },
    ];

    return (
        <SiteLayout>
            <Head title="" />

            {/* ── Hero + tabbed search ─────────────────────────────── */}
            <section className={`relative isolate ${portal ? 'text-white' : 'text-ink-900 bg-white border-b border-ink-200'}`}>
                {portal && (
                    <>
                        {hero.image ? (
                            <img src={hero.image} alt="" className="absolute inset-0 -z-10 w-full h-full object-cover" />
                        ) : (
                            <div className="absolute inset-0 -z-10 bg-[var(--site-accent)]" />
                        )}
                        <div className="absolute inset-0 -z-10 bg-[color-mix(in_srgb,var(--site-accent)_55%,transparent)]" />
                    </>
                )}
                <div className={`max-w-6xl mx-auto px-4 sm:px-6 ${portal ? 'pt-24 sm:pt-36 pb-0 text-center' : 'pt-16 sm:pt-24 pb-14'}`}>
                    <h1 className={`text-[38px] sm:text-[54px] leading-[1.1] ${t.heading} ${portal ? 'max-w-3xl mx-auto' : 'max-w-3xl'}`}>{hero.heading}</h1>
                    {site.tagline && <p className={`mt-4 text-[17px] sm:text-[19px] leading-relaxed ${portal ? 'text-white/90 max-w-2xl mx-auto' : 'text-ink-500 max-w-xl'}`}>{site.tagline}</p>}

                    <form onSubmit={search} className={`${portal ? 'mt-12 sm:mt-20 translate-y-1/2 sm:translate-y-[45%]' : 'mt-10'} text-left`}>
                        <div className={`flex ${portal ? 'justify-center' : ''}`}>
                            {tabs.map((tb) => (
                                <button
                                    key={tb.label}
                                    type="button"
                                    onClick={() => { setStatus(tb.value); setMax(''); }}
                                    className={`px-4 sm:px-6 py-2.5 text-[14px] font-medium transition ${t.key === 'portal' ? 'rounded-t-md' : ''} ${
                                        status === tb.value ? 'bg-white text-brand-600' : portal ? 'bg-brand-500/90 text-white hover:bg-brand-500 ml-px' : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
                                    }`}
                                >
                                    {tb.label}
                                </button>
                            ))}
                        </div>
                        <div className={`bg-white text-ink-900 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.35)] p-4 sm:p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end ${portal ? 'rounded-md' : 'border border-ink-200'}`}>
                            <Labelled label="Looking for">
                                <select value={ptype} onChange={(e) => setPtype(e.target.value)} className={sel}>
                                    <option value="">Property type</option>
                                    {['house', 'apartment', 'townhouse', 'commercial', 'land'].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                                </select>
                            </Labelled>
                            <Labelled label="Location">
                                <select value={area} onChange={(e) => setArea(e.target.value)} className={sel}>
                                    <option value="">All areas</option>
                                    {areas.map((a) => <option key={a.suburb} value={a.suburb}>{a.suburb}</option>)}
                                </select>
                            </Labelled>
                            <Labelled label="Bedrooms">
                                <select value={beds} onChange={(e) => setBeds(e.target.value)} className={sel}>
                                    <option value="">Any</option>
                                    {[1, 2, 3, 4, 5].map((b) => <option key={b} value={b}>{b}+</option>)}
                                </select>
                            </Labelled>
                            <Labelled label="Your budget">
                                <select value={max} onChange={(e) => setMax(e.target.value)} disabled={! status} className={`${sel} disabled:bg-ink-50 disabled:text-ink-400`}>
                                    <option value="">{status ? 'Max. price' : 'Pick sale or rent'}</option>
                                    {MAX_PRICE[status].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </Labelled>
                            <button className={`h-[46px] px-8 bg-brand-500 hover:bg-brand-600 text-white text-[15px] font-medium transition ${t.button}`}>
                                Search
                            </button>
                        </div>
                    </form>
                </div>
            </section>

            {/* ── Featured listings ───────────────────────────────── */}
            <section className={`max-w-7xl mx-auto px-4 sm:px-6 ${portal ? 'pt-44 sm:pt-36' : 'pt-16'} pb-16`}>
                <SectionTitle title="Discover our featured listings" subtitle={`${counts.for_sale} for sale and ${counts.long_term_rent} to rent with ${site.name}`} />
                {shown.length === 0 ? (
                    <p className="text-center text-ink-500">New listings are on the way. <Link href="/contact" className="text-brand-600 underline">Get in touch</Link> and we'll let you know first.</p>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {shown.map((l) => <PropertyCard key={l.id} listing={l} />)}
                    </div>
                )}
                <div className="mt-10 text-center">
                    <Link href="/properties" className={`inline-flex px-7 py-3 border border-brand-500 text-brand-600 hover:bg-brand-500 hover:text-white text-[14px] font-medium transition ${t.button}`}>
                        View all properties
                    </Link>
                </div>
            </section>

            {/* ── Browse by type ──────────────────────────────────── */}
            {types.length > 0 && (
                <section className="bg-white">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid gap-8 lg:grid-cols-[280px_1fr] lg:items-center">
                        <div>
                            <h2 className={`text-[30px] sm:text-[36px] leading-tight ${t.heading}`}>Browse by property type</h2>
                            <p className="mt-3 text-[15px] text-ink-500">Houses, apartments, townhouses and more across the areas we cover.</p>
                            <span className="block mt-6 h-0.5 w-14 bg-brand-500" />
                        </div>
                        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
                            {types.slice(0, 6).map((tile) => (
                                <ImageTile
                                    key={tile.type}
                                    href={`/properties?property_type=${tile.type}`}
                                    image={tile.image}
                                    kicker={`${tile.count} propert${tile.count === 1 ? 'y' : 'ies'}`}
                                    title={tile.label}
                                />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ── Why us + lead form ──────────────────────────────── */}
            <WhyUsBand image={hero.image} />

            {/* ── Explore areas ───────────────────────────────────── */}
            {areas.length > 0 && (
                <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
                    <SectionTitle title="Explore areas" subtitle="Where our listings are right now" />
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                        {areas.map((a) => (
                            <ImageTile
                                key={a.suburb}
                                href={`/properties?q=${encodeURIComponent(a.suburb)}`}
                                image={a.image}
                                kicker={`${a.count} propert${a.count === 1 ? 'y' : 'ies'}`}
                                title={a.suburb}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* ── Meet our agents ─────────────────────────────────── */}
            {agents.length > 0 && (
                <section className="bg-white">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
                        <SectionTitle title="Meet our agents" subtitle="Local experts who know these streets" />
                        <div className="flex flex-wrap justify-center gap-6">
                            {agents.slice(0, 4).map((a) => (
                                <div key={a.id} className={`w-full sm:w-[calc(50%-12px)] lg:w-[calc(25%-18px)] text-center border border-ink-100 bg-white p-6 ${t.card}`}>
                                    <div className="w-24 h-24 mx-auto rounded-full overflow-hidden">
                                        <AgentAvatar agent={a} className="w-full h-full text-[24px]" />
                                    </div>
                                    <p className="mt-4 text-[17px] font-medium">{a.name}</p>
                                    <p className="text-[13px] text-ink-500">Agent, {site.name}</p>
                                    {a.bio && <p className="mt-3 text-[13px] text-ink-600 line-clamp-3">{a.bio}</p>}
                                    <Link href={`/agents/${a.slug}`} className="inline-block mt-4 text-[13px] font-medium text-brand-600 hover:text-brand-700">
                                        View profile
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </SiteLayout>
    );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-800 mb-1.5">{label}</span>
            {children}
        </label>
    );
}

function ImageTile({ href, image, kicker, title }: { href: string; image: string | null; kicker: string; title: string }) {
    const t = useTemplate();
    return (
        <Link href={href} className={`group relative block overflow-hidden bg-[var(--site-accent)] aspect-[4/3] ${t.card}`}>
            {image && <img src={image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
            <div className="absolute top-3 left-4 text-white">
                <p className="text-[12px] text-white/85">{kicker}</p>
                <p className="text-[19px] font-medium leading-tight">{title}</p>
            </div>
            <span className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white text-[11px] font-semibold uppercase tracking-wider">
                More details <span aria-hidden>▷</span>
            </span>
        </Link>
    );
}

function WhyUsBand({ image }: { image: string | null }) {
    const site = useSite();
    const t = useTemplate();
    const [sent, setSent] = useState(false);
    const form = useForm({ intent: 'general', name: '', email: '', phone: '', address: '', message: '' });

    function submit(e: FormEvent) {
        e.preventDefault();
        form.post('/contact', { preserveScroll: true, onSuccess: () => { setSent(true); form.reset('name', 'email', 'phone', 'address', 'message'); } });
    }

    const points = [
        { n: '01.', title: 'Local market knowledge', text: 'Accurate pricing and advice from agents who work these suburbs every day.' },
        { n: '02.', title: 'Every listing, everywhere', text: 'Your property goes live on our website and the Property Basket portal at once.' },
        { n: '03.', title: 'Personal service', text: 'One agent from first viewing to registration. No call centres, no hand-offs.' },
    ];
    const field = 'w-full bg-white border border-ink-200 rounded-md px-3 py-2.5 text-[14px] text-ink-900 outline-none focus:border-brand-500';

    return (
        <section className={`relative isolate overflow-hidden ${t.dark}`}>
            {image && t.key === 'portal' && <img src={image} alt="" className="absolute inset-0 -z-10 w-full h-full object-cover opacity-15" />}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid gap-12 lg:grid-cols-[1fr_400px] lg:items-center">
                <div className="grid gap-10 sm:grid-cols-2">
                    <h2 className={`text-[32px] sm:text-[38px] leading-tight sm:col-span-2 lg:col-span-1 ${t.heading}`}>Why {site.name} is the right choice</h2>
                    {points.map((p) => (
                        <div key={p.n}>
                            <p className="text-[34px] font-light">{p.n}</p>
                            <p className="mt-1 text-[20px] font-light leading-snug">{p.title}</p>
                            <p className="mt-3 text-[13.5px] text-white/65 leading-relaxed">{p.text}</p>
                            <span className="block mt-5 h-px w-12 bg-white/40" />
                        </div>
                    ))}
                </div>

                <form onSubmit={submit} className={`bg-white text-ink-900 p-6 sm:p-7 shadow-2xl ${t.card}`}>
                    <h3 className="text-[22px] font-normal">Real estate enquiry</h3>
                    <p className="text-[13.5px] text-ink-500 mt-1 mb-5">Tell us what you need and an agent will call you back.</p>
                    {sent && <p className="mb-4 rounded-md bg-success/10 text-success text-[13px] px-3 py-2">Thanks — we'll be in touch shortly.</p>}
                    <div className="grid gap-3">
                        <select value={form.data.intent} onChange={(e) => form.setData('intent', e.target.value)} className={field}>
                            <option value="general">I want to buy or rent</option>
                            <option value="sell">I want to sell</option>
                            <option value="let">I want to let my property</option>
                        </select>
                        <input required placeholder="Full name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} className={field} />
                        <div className="grid grid-cols-2 gap-3">
                            <input required type="email" placeholder="Email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} className={field} />
                            <input placeholder="Phone" value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} className={field} />
                        </div>
                        {form.data.intent !== 'general' && (
                            <input placeholder="Property address" value={form.data.address} onChange={(e) => form.setData('address', e.target.value)} className={field} />
                        )}
                        <textarea rows={3} placeholder="Message (optional)" value={form.data.message} onChange={(e) => form.setData('message', e.target.value)} className={field} />
                        {(form.errors.name || form.errors.email) && <p className="text-danger text-[12px]">{form.errors.name ?? form.errors.email}</p>}
                        <button disabled={form.processing} className={`w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-[15px] font-medium transition ${t.button}`}>
                            {form.processing ? 'Sending…' : 'Submit'}
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
}
