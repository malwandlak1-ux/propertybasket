import { FormEvent, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';

type Tag = { id: number; name: string; slug: string; color: string };

type Author = { id: number; name: string };

type Post = {
    id: number;
    slug: string;
    title: string;
    excerpt: string | null;
    cover_image: string | null;
    published_at: string | null;
    view_count: number;
    author: Author | null;
    tags: Tag[];
};

type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    links: Array<{ url: string | null; label: string; active: boolean }>;
};

type Props = {
    posts: Paginated<Post>;
    tags: Tag[];
    filters: { tag?: string; q?: string };
    featured: Post | null;
};

function formatDate(iso: string | null): string {
    if (! iso) return '';
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function TagChip({ tag, active }: { tag: Tag; active?: boolean }) {
    return (
        <Link
            href={`/advice?tag=${encodeURIComponent(tag.slug)}`}
            className={
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition border ' +
                (active
                    ? 'text-white border-transparent'
                    : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400')
            }
            style={active ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
        >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? '#ffffff' : tag.color }} />
            {tag.name}
        </Link>
    );
}

function PostCard({ post }: { post: Post }) {
    return (
        <Link
            href={`/advice/${post.slug}`}
            className="bg-white border border-ink-200 rounded-2xl overflow-hidden shadow-soft hover:shadow-lift transition flex flex-col"
        >
            <div className="aspect-[16/9] bg-ink-100 overflow-hidden">
                {post.cover_image ? (
                    <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-ink-400 text-[12px]">No image</div>
                )}
            </div>
            <div className="p-5 flex-1 flex flex-col">
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {post.tags.slice(0, 3).map((t) => (
                        <span key={t.id} className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.color }}>
                            {t.name}
                        </span>
                    ))}
                </div>
                <h3 className="text-[17px] font-bold leading-snug text-ink-900">{post.title}</h3>
                {post.excerpt && <p className="mt-2 text-[13px] text-ink-500 leading-relaxed line-clamp-3">{post.excerpt}</p>}
                <div className="mt-auto pt-4 flex items-center justify-between text-[11px] text-ink-500">
                    <span>{post.author?.name ?? 'Property Basket'}</span>
                    <span>{formatDate(post.published_at)}</span>
                </div>
            </div>
        </Link>
    );
}

export default function AdviceIndex({ posts, tags, filters, featured }: Props) {
    const [q, setQ] = useState(filters.q ?? '');

    function submitSearch(e: FormEvent) {
        e.preventDefault();
        const params: Record<string, string> = {};
        if (q)          params.q   = q;
        if (filters.tag) params.tag = filters.tag;
        router.get('/advice', params, { preserveScroll: true });
    }

    return (
        <PublicLayout>
            <Head title="Advice — Property Basket" />

            {/* Hero */}
            <section
                className="relative text-white"
                style={{
                    background:
                        'radial-gradient(at 20% 20%, rgba(91,61,245,0.45) 0, transparent 50%),' +
                        'radial-gradient(at 80% 0%, rgba(74,46,224,0.40) 0, transparent 50%),' +
                        '#0B0B0F',
                }}
            >
                <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
                    <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur px-3 py-1 text-[11px] font-semibold uppercase tracking-wider">
                        Property Advice
                    </span>
                    <h1 className="mt-5 text-4xl lg:text-5xl font-bold tracking-tight max-w-3xl leading-tight">
                        Guides, tips and insights for the South African property market
                    </h1>
                    <p className="mt-4 text-white/70 text-[16px] max-w-2xl">
                        Straight-talking advice for tenants, landlords, agents and contractors — written by people who know the local market.
                    </p>

                    <form onSubmit={submitSearch} className="mt-8 max-w-xl flex gap-2">
                        <input
                            type="search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search articles…"
                            className="flex-1 bg-white/95 text-ink-900 placeholder:text-ink-400 rounded-lg px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-white/30"
                        />
                        <button
                            type="submit"
                            className="px-5 py-2.5 bg-white text-ink-900 rounded-lg font-semibold text-[13px] hover:bg-ink-100 transition"
                        >
                            Search
                        </button>
                    </form>
                </div>
            </section>

            <section className="max-w-7xl mx-auto px-6 py-12">
                {/* Tag chips */}
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-8">
                        <Link
                            href="/advice"
                            className={
                                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition border ' +
                                (! filters.tag
                                    ? 'bg-ink-900 text-white border-ink-900'
                                    : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400')
                            }
                        >
                            All
                        </Link>
                        {tags.map((t) => (
                            <TagChip key={t.id} tag={t} active={filters.tag === t.slug} />
                        ))}
                    </div>
                )}

                {/* Featured post */}
                {featured && ! filters.tag && ! filters.q && (
                    <Link
                        href={`/advice/${featured.slug}`}
                        className="block bg-white rounded-2xl overflow-hidden border border-ink-200 shadow-soft hover:shadow-lift transition grid md:grid-cols-2 mb-10"
                    >
                        <div className="aspect-[16/10] md:aspect-auto bg-ink-100">
                            {featured.cover_image
                                ? <img src={featured.cover_image} alt={featured.title} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-ink-400">Featured</div>
                            }
                        </div>
                        <div className="p-8 md:p-10 flex flex-col justify-center">
                            <p className="text-[11px] font-bold text-brand-700 uppercase tracking-widest mb-3">Featured</p>
                            <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">{featured.title}</h2>
                            {featured.excerpt && <p className="mt-3 text-[14px] text-ink-600 leading-relaxed">{featured.excerpt}</p>}
                            <div className="mt-5 flex flex-wrap gap-2">
                                {featured.tags.slice(0, 3).map((t) => (
                                    <span key={t.id} className="text-[10px] font-bold uppercase tracking-wider" style={{ color: t.color }}>
                                        {t.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </Link>
                )}

                {/* Posts grid */}
                {posts.data.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-ink-200 p-12 text-center text-ink-500">
                        <p>No articles yet{filters.tag ? ' in this category' : ''}.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {posts.data.map((p) => <PostCard key={p.id} post={p} />)}
                    </div>
                )}

                {/* Pagination */}
                {posts.last_page > 1 && (
                    <div className="mt-10 flex flex-wrap justify-center gap-1">
                        {posts.links.map((l, i) => (
                            <Link
                                key={i}
                                href={l.url ?? '#'}
                                preserveScroll
                                className={
                                    'px-3 py-1.5 rounded-md text-[12px] font-semibold transition ' +
                                    (l.active
                                        ? 'bg-ink-900 text-white'
                                        : l.url
                                            ? 'bg-white border border-ink-200 text-ink-700 hover:border-ink-400'
                                            : 'text-ink-400 cursor-not-allowed')
                                }
                                dangerouslySetInnerHTML={{ __html: l.label }}
                            />
                        ))}
                    </div>
                )}
            </section>
        </PublicLayout>
    );
}
