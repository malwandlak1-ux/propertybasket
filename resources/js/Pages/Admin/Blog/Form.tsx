import { FormEvent, useRef, useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Spinner } from '@/Components/Skeleton';

type Tag = { id: number; name: string; slug: string; color: string };

type Post = {
    id: number;
    slug: string;
    title: string;
    excerpt: string | null;
    body: string;
    cover_image: string | null;
    status: 'draft' | 'published';
    published_at: string | null;
    view_count: number;
    tags: Tag[];
};

type Props = {
    post: Post | null;
    allTags: Tag[];
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

const labelCls = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';
const inputCls = 'w-full bg-white border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';

export default function AdminBlogForm({ post, allTags }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const isEdit = !!post;

    const { data, setData, post: submit, processing, errors } = useForm<{
        title: string;
        excerpt: string;
        body: string;
        status: 'draft' | 'published';
        tags: string[];
        cover: File | null;
        remove_cover: boolean;
    }>({
        title:        post?.title ?? '',
        excerpt:      post?.excerpt ?? '',
        body:         post?.body ?? '',
        status:       post?.status ?? 'draft',
        tags:         post?.tags?.map((t) => t.name) ?? [],
        cover:        null,
        remove_cover: false,
    });

    const [tagInput, setTagInput] = useState('');
    const [coverPreview, setCoverPreview] = useState<string | null>(post?.cover_image ?? null);
    const coverRef = useRef<HTMLInputElement>(null);

    function addTag(name: string) {
        const v = name.trim();
        if (! v) return;
        if (data.tags.includes(v)) { setTagInput(''); return; }
        setData('tags', [...data.tags, v]);
        setTagInput('');
    }

    function removeTag(name: string) {
        setData('tags', data.tags.filter((t) => t !== name));
    }

    function onCoverPicked(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0] ?? null;
        setData('cover', file);
        setData('remove_cover', false);
        if (file) {
            const url = URL.createObjectURL(file);
            setCoverPreview(url);
        }
    }

    function clearCover() {
        setData('cover', null);
        setData('remove_cover', true);
        setCoverPreview(null);
        if (coverRef.current) coverRef.current.value = '';
    }

    function save(e: FormEvent) {
        e.preventDefault();
        const url = isEdit ? `/admin/blog/${post!.id}` : '/admin/blog';
        submit(url, { forceFormData: true });
    }

    function publishToggle(targetStatus: 'draft' | 'published') {
        setData('status', targetStatus);
        // submit after state update flushes
        setTimeout(() => {
            const url = isEdit ? `/admin/blog/${post!.id}` : '/admin/blog';
            submit(url, { forceFormData: true });
        }, 0);
    }

    function deletePost() {
        if (! post) return;
        if (! confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
        router.delete(`/admin/blog/${post.id}`);
    }

    return (
        <AdminLayout crumb={isEdit ? `Edit · ${post!.title}` : 'New post'} section="Blog">
            <Head title={isEdit ? `Edit · ${post!.title}` : 'New post'} />

            <form onSubmit={save} className="px-4 sm:px-8 py-7 max-w-5xl">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <Link href="/admin/blog" className="text-[12px] font-semibold text-brand-700 hover:underline">
                            ← All posts
                        </Link>
                        <span className="text-ink-300">/</span>
                        <h1 className="text-xl font-bold tracking-tight">{isEdit ? 'Edit post' : 'New post'}</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        {isEdit && post!.status === 'published' && (
                            <Link
                                href={`/advice/${post!.slug}`}
                                target="_blank"
                                className="px-3 py-2 text-[12px] font-semibold border border-ink-200 rounded-lg hover:border-ink-400 text-ink-700"
                            >
                                View on site
                            </Link>
                        )}
                        {isEdit && (
                            <button
                                type="button"
                                onClick={deletePost}
                                className="px-3 py-2 text-[12px] font-semibold text-danger hover:bg-danger/10 rounded-lg"
                            >
                                Delete
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => publishToggle('draft')}
                            disabled={processing}
                            className="px-4 py-2 text-[13px] font-semibold border border-ink-200 rounded-lg hover:border-ink-400 text-ink-700"
                        >
                            Save draft
                        </button>
                        <button
                            type="button"
                            onClick={() => publishToggle('published')}
                            disabled={processing}
                            className="px-4 py-2 text-[13px] bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold inline-flex items-center gap-2"
                        >
                            {processing && <Spinner size={13} />}
                            {data.status === 'published' && isEdit ? 'Save & republish' : 'Publish'}
                        </button>
                    </div>
                </div>

                {flash?.success && (
                    <div className="mb-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="mb-4 rounded-lg bg-danger/10 border border-danger/30 text-danger px-4 py-3 text-[13px]">
                        {flash.error}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main column */}
                    <div className="lg:col-span-2 space-y-5">
                        <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-6 space-y-4">
                            <div>
                                <label className={labelCls}>Title *</label>
                                <input
                                    value={data.title}
                                    onChange={(e) => setData('title', e.target.value)}
                                    required
                                    placeholder="Working title…"
                                    className={inputCls + ' text-[18px] font-semibold'}
                                />
                                {errors.title && <p className="text-[11px] text-danger mt-1">{errors.title}</p>}
                            </div>

                            <div>
                                <label className={labelCls}>Excerpt</label>
                                <textarea
                                    value={data.excerpt}
                                    onChange={(e) => setData('excerpt', e.target.value)}
                                    rows={2}
                                    maxLength={400}
                                    placeholder="1-2 sentences that summarise the article — shown on listing cards and meta descriptions."
                                    className={inputCls}
                                />
                                <p className="text-[11px] text-ink-400 mt-1">{data.excerpt.length} / 400</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-6 space-y-3">
                            <div className="flex items-end justify-between">
                                <label className={labelCls + ' mb-0'}>Body *</label>
                                <p className="text-[11px] text-ink-400">HTML allowed — &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;a&gt;, &lt;blockquote&gt;, &lt;img&gt;, &lt;code&gt;</p>
                            </div>
                            <textarea
                                value={data.body}
                                onChange={(e) => setData('body', e.target.value)}
                                required
                                rows={20}
                                placeholder={"<p>Open with a hook…</p>\n<h2>Section heading</h2>\n<p>…</p>"}
                                className={inputCls + ' font-mono text-[13px] leading-relaxed'}
                            />
                            {errors.body && <p className="text-[11px] text-danger">{errors.body}</p>}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-1 space-y-5">
                        {/* Status */}
                        <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5">
                            <h2 className="text-[13px] font-bold mb-3">Status</h2>
                            <div className="flex items-center gap-2">
                                <span className={
                                    'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ' +
                                    (data.status === 'published'
                                        ? 'bg-success/15 text-success'
                                        : 'bg-ink-100 text-ink-600')
                                }>
                                    {data.status}
                                </span>
                                {isEdit && post!.published_at && (
                                    <span className="text-[11px] text-ink-500">
                                        Published {new Date(post!.published_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                )}
                            </div>
                            {isEdit && (
                                <p className="text-[11px] text-ink-500 mt-3 leading-relaxed">
                                    Slug: <code className="bg-ink-100 px-1 py-0.5 rounded text-[10px]">{post!.slug}</code>
                                </p>
                            )}
                        </div>

                        {/* Tags */}
                        <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5">
                            <h2 className="text-[13px] font-bold mb-3">Tags</h2>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {data.tags.map((t) => (
                                    <span
                                        key={t}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-ink-100 text-ink-700"
                                    >
                                        {t}
                                        <button
                                            type="button"
                                            onClick={() => removeTag(t)}
                                            className="text-ink-500 hover:text-danger"
                                            aria-label={`Remove ${t}`}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                                {data.tags.length === 0 && (
                                    <p className="text-[12px] text-ink-400">No tags yet.</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ',') {
                                            e.preventDefault();
                                            addTag(tagInput);
                                        }
                                    }}
                                    placeholder="Add a tag…"
                                    className={inputCls}
                                />
                                <button
                                    type="button"
                                    onClick={() => addTag(tagInput)}
                                    className="px-3 py-2 text-[13px] bg-ink-100 text-ink-700 rounded-lg hover:bg-ink-200 font-semibold shrink-0"
                                >
                                    Add
                                </button>
                            </div>
                            {allTags.length > 0 && (
                                <>
                                    <p className="text-[11px] text-ink-400 mt-3 mb-1.5">Existing tags — click to reuse:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {allTags
                                            .filter((t) => ! data.tags.includes(t.name))
                                            .map((t) => (
                                                <button
                                                    type="button"
                                                    key={t.id}
                                                    onClick={() => addTag(t.name)}
                                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full border hover:bg-ink-50"
                                                    style={{ color: t.color, borderColor: `${t.color}55` }}
                                                >
                                                    {t.name}
                                                </button>
                                            ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Cover image */}
                        <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5">
                            <h2 className="text-[13px] font-bold mb-3">Cover image</h2>
                            {coverPreview ? (
                                <div className="relative rounded-lg overflow-hidden border border-ink-200 mb-3">
                                    <img src={coverPreview} alt="cover preview" className="w-full h-32 object-cover" />
                                    <button
                                        type="button"
                                        onClick={clearCover}
                                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 text-danger flex items-center justify-center font-bold shadow"
                                        aria-label="Remove cover"
                                    >
                                        ×
                                    </button>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-ink-200 rounded-lg p-6 text-center text-[12px] text-ink-500 mb-3">
                                    No cover image. The post will fall back to a placeholder.
                                </div>
                            )}
                            <label
                                htmlFor="blog-cover-input"
                                className="inline-flex items-center gap-2 px-3 py-2 text-[12px] rounded-lg bg-ink-900 text-white hover:bg-ink-800 font-semibold cursor-pointer"
                            >
                                {coverPreview ? 'Replace…' : 'Upload image'}
                            </label>
                            <input
                                id="blog-cover-input"
                                ref={coverRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={onCoverPicked}
                                className="hidden"
                            />
                            {errors.cover && <p className="text-[11px] text-danger mt-2">{errors.cover}</p>}
                        </div>
                    </div>
                </div>
            </form>
        </AdminLayout>
    );
}
