import { useEffect, useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import { PageHeader } from '@/Components/Dashboard/Charts';
import Icon from '@/Components/Dashboard/Icon';
import { useBrand } from '@/Hooks/useEdition';
import { Guide } from '@/help/types';

type Contact = { title: string; body: string; label: string; href: string };

/**
 * Searchable how-to guides for one role's dashboard (Help & Support).
 * Guides open in place; /help#guide-id opens and scrolls to one.
 */
export default function HelpCentre({ guides, intro, contact }: { guides: Guide[]; intro: string; contact: Contact }) {
    const brand = useBrand();
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<string>('All');
    const [open, setOpen] = useState<string | null>(null);

    const categories = useMemo(() => ['All', ...Array.from(new Set(guides.map((g) => g.category)))], [guides]);

    useEffect(() => {
        const id = window.location.hash.replace('#', '');
        if (id && guides.some((g) => g.id === id)) {
            setOpen(id);
            setTimeout(() => document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        }
    }, [guides]);

    const q = query.trim().toLowerCase();
    const shown = guides.filter((g) =>
        (category === 'All' || g.category === category)
        && (q === '' || [g.title, g.summary, ...g.steps, ...(g.tips ?? [])].join(' ').toLowerCase().includes(q)),
    );
    const grouped = shown.reduce<Record<string, Guide[]>>((acc, g) => {
        (acc[g.category] ??= []).push(g);
        return acc;
    }, {});

    function toggle(id: string) {
        setOpen((cur) => (cur === id ? null : id));
        history.replaceState(null, '', open === id ? window.location.pathname : `#${id}`);
    }

    return (
        <section className="px-4 sm:px-7 py-6 max-w-5xl">
            <PageHeader title="Help & Support" subtitle={intro} />

            <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-4 mb-4 space-y-3">
                <label className="flex items-center gap-2.5 bg-ink-50 border border-ink-200 rounded-xl px-3.5 py-2.5 focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100 transition">
                    <svg className="w-4 h-4 text-ink-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search the guides, e.g. statement, EFT, contractor"
                        className="flex-1 bg-transparent text-[14px] focus:outline-none"
                        aria-label="Search help"
                    />
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => setCategory(c)}
                            className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition ${category === c ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            {shown.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-ink-200 p-10 text-center text-[13px] text-ink-500">
                    No guides match "{query}". Try another word, or contact us below.
                </div>
            ) : (
                Object.entries(grouped).map(([cat, items]) => (
                    <div key={cat} className="mb-5">
                        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-2 px-1">{cat}</h2>
                        <div className="space-y-2">
                            {items.map((g) => {
                                const isOpen = open === g.id || q !== '';
                                return (
                                    <article key={g.id} id={`guide-${g.id}`} className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden scroll-mt-24">
                                        <button
                                            type="button"
                                            onClick={() => toggle(g.id)}
                                            aria-expanded={isOpen}
                                            className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-ink-50/60 transition"
                                        >
                                            <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Icon name="bulb" className="w-4 h-4" /></span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-[14.5px] font-semibold tracking-tight">{g.title}</span>
                                                <span className="block text-[12.5px] text-ink-500 mt-0.5">{g.summary}</span>
                                            </span>
                                            <svg className={`w-4 h-4 text-ink-400 mt-1 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg>
                                        </button>
                                        {isOpen && (
                                            <div className="px-5 pb-5 pl-[68px]">
                                                <ol className="space-y-2">
                                                    {g.steps.map((step, i) => (
                                                        <li key={i} className="flex gap-3 text-[13.5px] text-ink-800 leading-relaxed">
                                                            <span className="w-6 h-6 rounded-full bg-brand-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                                            <span>{step}</span>
                                                        </li>
                                                    ))}
                                                </ol>
                                                {g.tips && g.tips.length > 0 && (
                                                    <div className="mt-4 rounded-xl bg-ink-50 border border-ink-200/70 px-4 py-3 space-y-1">
                                                        {g.tips.map((t, i) => (
                                                            <p key={i} className="text-[12.5px] text-ink-600"><span className="font-semibold text-ink-800">Tip: </span>{t}</p>
                                                        ))}
                                                    </div>
                                                )}
                                                {g.link && (
                                                    <Link href={g.link.href} className="inline-flex items-center gap-1.5 mt-4 text-[13px] font-semibold text-brand-700 hover:underline">
                                                        {g.link.label} →
                                                    </Link>
                                                )}
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}

            <div className="pb-swirl rounded-2xl p-5 sm:p-6 text-white shadow-lift mt-6 flex flex-wrap items-center gap-4">
                <span className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Icon name="chat" className="w-5 h-5" /></span>
                <div className="flex-1 min-w-[220px]">
                    <p className="text-[15px] font-semibold">{contact.title}</p>
                    <p className="text-[12.5px] text-white/80 mt-0.5">{contact.body}</p>
                </div>
                {contact.href && contact.href !== '#' && (
                    <a href={contact.href} className="inline-flex items-center gap-2 rounded-full bg-white text-ink-900 px-4 py-2.5 text-[13px] font-semibold hover:bg-white/90">
                        {contact.label}
                    </a>
                )}
            </div>
            <p className="text-[11.5px] text-ink-400 mt-3 px-1">{brand.name}{brand.custom ? ' · powered by Property Basket' : ''}</p>
        </section>
    );
}
