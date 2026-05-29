import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';

type Tag = { id: number; name: string; slug: string; color: string };

type Post = {
    id: number;
    slug: string;
    title: string;
    excerpt: string | null;
    body: string;
    cover_image: string | null;
    published_at: string | null;
    view_count: number;
    author: { id: number; name: string } | null;
    tags: Tag[];
};

type Props = {
    post: Post;
    related: Array<Pick<Post, 'id' | 'slug' | 'title' | 'excerpt' | 'cover_image' | 'published_at' | 'tags'>>;
};

function formatDate(iso: string | null): string {
    if (! iso) return '';
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdviceShow({ post, related }: Props) {
    return (
        <PublicLayout>
            <Head>
                <title>{`${post.title} — Property Basket`}</title>
                {post.excerpt && <meta name="description" content={post.excerpt} />}
            </Head>

            <article className="max-w-3xl mx-auto px-6 py-12">
                <Link href="/advice" className="text-[12px] font-semibold text-brand-700 hover:underline">
                    ← All articles
                </Link>

                <header className="mt-6">
                    <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.map((t) => (
                            <Link
                                key={t.id}
                                href={`/advice?tag=${encodeURIComponent(t.slug)}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-ink-200 hover:border-ink-400 transition"
                                style={{ color: t.color }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
                                {t.name}
                            </Link>
                        ))}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">{post.title}</h1>
                    {post.excerpt && <p className="mt-4 text-[17px] text-ink-600 leading-relaxed">{post.excerpt}</p>}
                    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500">
                        <span>By {post.author?.name ?? 'Property Basket'}</span>
                        <span className="text-ink-300">·</span>
                        <span>{formatDate(post.published_at)}</span>
                        <span className="text-ink-300">·</span>
                        <span>{post.view_count} {post.view_count === 1 ? 'view' : 'views'}</span>
                    </div>
                </header>

                {post.cover_image && (
                    <div className="mt-8 rounded-2xl overflow-hidden aspect-[16/9] bg-ink-100">
                        <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" />
                    </div>
                )}

                {/* Body: stored as HTML or plain text — render as raw HTML.
                    Admin form sanitises before save. */}
                <div
                    className="prose prose-ink max-w-none mt-10 text-[16px] leading-relaxed text-ink-800
                        [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4
                        [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-8 [&_h3]:mb-3
                        [&_p]:my-4
                        [&_ul]:my-4 [&_ul]:pl-6 [&_ul]:list-disc
                        [&_ol]:my-4 [&_ol]:pl-6 [&_ol]:list-decimal
                        [&_a]:text-brand-700 [&_a]:underline hover:[&_a]:text-brand-800
                        [&_blockquote]:border-l-4 [&_blockquote]:border-brand [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-600 [&_blockquote]:my-6
                        [&_img]:rounded-lg [&_img]:my-6
                        [&_code]:bg-ink-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[14px]"
                    dangerouslySetInnerHTML={{ __html: post.body }}
                />
            </article>

            {related.length > 0 && (
                <section className="max-w-7xl mx-auto px-6 pb-16">
                    <h2 className="text-xl font-bold tracking-tight mb-6">Related reading</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {related.map((r) => (
                            <Link
                                key={r.id}
                                href={`/advice/${r.slug}`}
                                className="bg-white border border-ink-200 rounded-2xl overflow-hidden shadow-soft hover:shadow-lift transition flex flex-col"
                            >
                                <div className="aspect-[16/9] bg-ink-100 overflow-hidden">
                                    {r.cover_image
                                        ? <img src={r.cover_image} alt={r.title} className="w-full h-full object-cover" />
                                        : <div className="w-full h-full flex items-center justify-center text-ink-400 text-[12px]">—</div>
                                    }
                                </div>
                                <div className="p-5">
                                    <h3 className="text-[15px] font-bold leading-snug">{r.title}</h3>
                                    {r.excerpt && <p className="mt-2 text-[12px] text-ink-500 leading-relaxed line-clamp-2">{r.excerpt}</p>}
                                    <p className="mt-3 text-[11px] text-ink-400">{formatDate(r.published_at)}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </PublicLayout>
    );
}
