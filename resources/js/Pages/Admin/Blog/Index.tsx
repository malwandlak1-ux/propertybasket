import { FormEvent, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useInertiaLoading } from '@/Hooks/useInertiaLoading';

type Tag = { id: number; name: string; slug: string; color: string };
type Author = { id: number; name: string };

type Post = {
    id: number;
    slug: string;
    title: string;
    excerpt: string | null;
    cover_image: string | null;
    status: 'draft' | 'published';
    published_at: string | null;
    view_count: number;
    updated_at: string;
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
    filter: string;
    q: string;
    counts: { all: number; published: number; draft: number };
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

const FILTERS: Array<{ key: string; label: string }> = [
    { key: 'all',       label: 'All' },
    { key: 'published', label: 'Published' },
    { key: 'draft',     label: 'Drafts' },
];

function formatDate(iso: string | null): string {
    if (! iso) return '—';
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A published post whose publish date is still in the future — hidden from the
    public site by BlogPost::published() until then. */
function isScheduled(p: Post): boolean {
    return p.status === 'published' && !! p.published_at && new Date(p.published_at).getTime() > Date.now();
}

export default function AdminBlogIndex({ posts, filter, q, counts }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const loading = useInertiaLoading();
    const [search, setSearch] = useState(q ?? '');

    function applyFilter(key: string) {
        router.get('/admin/blog', { filter: key, q: search || undefined }, { preserveState: true, preserveScroll: true });
    }

    function submitSearch(e: FormEvent) {
        e.preventDefault();
        router.get('/admin/blog', { filter, q: search || undefined }, { preserveState: true, preserveScroll: true });
    }

    function deletePost(p: Post) {
        if (! confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
        router.delete(`/admin/blog/${p.id}`, { preserveScroll: true });
    }

    return (
        <AdminLayout crumb="Blog" section="Content">
            <Head title="Blog · Admin" />

            <section className="px-4 sm:px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6 flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Blog</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Write and publish articles for the public Advice page. Tag posts to group them by topic.
                        </p>
                    </div>
                    <Link
                        href="/admin/blog/create"
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold text-[13px] transition inline-flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                            <path d="M12 5v14M5 12h14"/>
                        </svg>
                        New post
                    </Link>
                </div>

                {flash?.success && (
                    <div className="mb-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                        {flash.success}
                    </div>
                )}

                {/* Filter pills + search */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <div className="flex flex-wrap gap-1.5">
                        {FILTERS.map((f) => {
                            const count = (counts as Record<string, number>)[f.key] ?? 0;
                            const active = (filter || 'all') === f.key;
                            return (
                                <button
                                    type="button"
                                    key={f.key}
                                    onClick={() => applyFilter(f.key)}
                                    className={
                                        'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition inline-flex items-center gap-2 ' +
                                        (active ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 border border-ink-200 hover:border-ink-400')
                                    }
                                >
                                    {f.label}
                                    <span className={'text-[10px] px-1.5 py-0.5 rounded-full ' + (active ? 'bg-white/20' : 'bg-ink-100')}>{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    <form onSubmit={submitSearch} className="flex-1 min-w-[200px] flex gap-2">
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by title or excerpt…"
                            className="flex-1 bg-white border border-ink-200 rounded-lg px-3.5 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                        />
                        <button type="submit" className="px-4 py-2 bg-ink-900 text-white rounded-lg text-[13px] font-semibold hover:bg-brand-500 transition">
                            Search
                        </button>
                    </form>
                </div>

                {/* Posts table */}
                <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : ''}>
                    {posts.data.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-ink-200 p-12 text-center text-ink-500">
                            <p className="text-[14px]">No posts {filter && filter !== 'all' ? `in "${filter}"` : 'yet'}.</p>
                            <Link href="/admin/blog/create" className="inline-block mt-4 text-brand-700 font-semibold hover:underline text-[13px]">
                                Write the first one →
                            </Link>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-ink-200 shadow-soft overflow-hidden">
                            <div className="overflow-x-auto"><table className="w-full text-[13px] min-w-[700px]">
                                <thead className="bg-ink-50 text-ink-500 text-[11px] uppercase tracking-wider">
                                    <tr>
                                        <th className="text-left px-4 py-3 font-semibold">Title</th>
                                        <th className="text-left px-4 py-3 font-semibold">Status</th>
                                        <th className="text-left px-4 py-3 font-semibold">Tags</th>
                                        <th className="text-left px-4 py-3 font-semibold">Author</th>
                                        <th className="text-left px-4 py-3 font-semibold">Published</th>
                                        <th className="text-right px-4 py-3 font-semibold">Views</th>
                                        <th className="text-right px-4 py-3 font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ink-100">
                                    {posts.data.map((p) => (
                                        <tr key={p.id} className="hover:bg-ink-50/60 transition">
                                            <td className="px-4 py-3">
                                                <Link href={`/admin/blog/${p.id}/edit`} className="font-semibold text-ink-900 hover:text-brand-700">
                                                    {p.title}
                                                </Link>
                                                {p.excerpt && (
                                                    <p className="text-[11px] text-ink-500 mt-0.5 line-clamp-1 max-w-md">{p.excerpt}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={
                                                    'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ' +
                                                    (isScheduled(p)
                                                        ? 'bg-brand-100 text-brand-700'
                                                        : p.status === 'published'
                                                            ? 'bg-success/15 text-success'
                                                            : 'bg-ink-200 text-ink-600')
                                                }>
                                                    {isScheduled(p) ? 'scheduled' : p.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {p.tags.length === 0 && <span className="text-ink-400">—</span>}
                                                    {p.tags.map((t) => (
                                                        <span
                                                            key={t.id}
                                                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                                                            style={{ color: t.color, borderColor: `${t.color}55` }}
                                                        >
                                                            {t.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-ink-600">{p.author?.name ?? '—'}</td>
                                            <td className="px-4 py-3 text-ink-600">
                                                {isScheduled(p)
                                                    ? <span className="text-brand-700 font-semibold">Scheduled · {formatDate(p.published_at)}</span>
                                                    : formatDate(p.published_at)}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums text-ink-600">{p.view_count}</td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    {p.status === 'published' && ! isScheduled(p) && (
                                                        <Link
                                                            href={`/advice/${p.slug}`}
                                                            target="_blank"
                                                            className="px-2.5 py-1 rounded text-[11px] font-semibold border border-ink-200 hover:border-ink-400 text-ink-700"
                                                            title="View on site"
                                                        >
                                                            View
                                                        </Link>
                                                    )}
                                                    <Link
                                                        href={`/admin/blog/${p.id}/edit`}
                                                        className="px-2.5 py-1 rounded text-[11px] font-semibold bg-ink-900 text-white hover:bg-brand-500"
                                                    >
                                                        Edit
                                                    </Link>
                                                    <button
                                                        onClick={() => deletePost(p)}
                                                        className="px-2.5 py-1 rounded text-[11px] font-semibold text-danger hover:bg-danger/10"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table></div>
                        </div>
                    )}

                    {posts.last_page > 1 && (
                        <div className="mt-6 flex flex-wrap justify-center gap-1">
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
                </div>
            </section>
        </AdminLayout>
    );
}
