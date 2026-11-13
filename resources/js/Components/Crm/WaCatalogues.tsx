import { FormEvent, useRef, useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import { btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';
import { safeUploadFile } from '@/lib/safeUpload';

export type Catalogue = {
    id: number; title: string; description: string | null; name: string; kind: 'image' | 'video' | 'document';
    size: number; url: string; sent_count: number; last_sent: string | null; added: string | null;
};

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.mp4,.doc,.docx,.ppt,.pptx,.xls,.xlsx';
const MAX = 16 * 1024 * 1024;
const input = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100';
const label = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

export function fmtSize(b: number) {
    return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export function CatalogueIcon({ c, className = 'w-10 h-10' }: { c: Pick<Catalogue, 'kind' | 'name'>; className?: string }) {
    const ext = (c.name.split('.').pop() ?? '').toUpperCase().slice(0, 4);
    const tone = c.kind === 'image' ? 'bg-sky-100 text-sky-700' : c.kind === 'video' ? 'bg-violet-100 text-violet-700' : ext === 'PDF' ? 'bg-danger/10 text-danger' : 'bg-brand-50 text-brand-700';
    return <span className={`${className} rounded-xl ${tone} text-[10px] font-bold flex items-center justify-center shrink-0`}>{ext || 'FILE'}</span>;
}

/** The Catalogues section on the WhatsApp rail: upload once, send in any chat. */
export default function CatalogueLibrary({ catalogues }: { catalogues: Catalogue[] }) {
    const [adding, setAdding] = useState(catalogues.length === 0);
    const fileInput = useRef<HTMLInputElement>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const { data, setData, post, processing, errors, reset, progress } = useForm<{ title: string; description: string; file: File | null }>({ title: '', description: '', file: null });

    function pick(f: File | undefined) {
        setFileError(null);
        if (!f) return;
        if (f.size > MAX) { setFileError('Catalogues can be up to 16 MB.'); return; }
        setData((d) => ({ ...d, file: safeUploadFile(f), title: d.title || f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') }));
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agent/crm/whatsapp/catalogues', {
            forceFormData: true, preserveScroll: true, preserveState: true,
            onSuccess: () => { reset(); if (fileInput.current) fileInput.current.value = ''; setAdding(false); },
        });
    }

    function remove(c: Catalogue) {
        if (!confirm(`Remove “${c.title}” from your catalogues? Chats where you already sent it keep their copy.`)) return;
        router.delete(`/agent/crm/whatsapp/catalogues/${c.id}`, { preserveScroll: true, preserveState: true });
    }

    return (
        <div className="space-y-4">
            {adding ? (
                <form onSubmit={submit} className="max-w-2xl rounded-2xl border border-ink-200/60 bg-white p-5 space-y-4">
                    <div>
                        <h3 className="text-[15px] font-semibold">Upload a catalogue</h3>
                        <p className="text-[12px] text-ink-500 mt-0.5">Brochures, listing catalogues, price lists, development packs. PDF, Office files, JPG/PNG or MP4, up to 16 MB.</p>
                    </div>
                    <div>
                        <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
                        <button type="button" onClick={() => fileInput.current?.click()}
                            className="w-full rounded-2xl border-2 border-dashed border-ink-200 hover:border-brand-300 hover:bg-brand-50/40 px-4 py-6 text-center transition">
                            {data.file ? (
                                <span className="inline-flex items-center gap-3 text-left">
                                    <CatalogueIcon c={{ kind: data.file.type.startsWith('image/') ? 'image' : data.file.type.startsWith('video/') ? 'video' : 'document', name: data.file.name }} />
                                    <span>
                                        <span className="block text-[13px] font-semibold text-ink-800 break-all">{data.file.name}</span>
                                        <span className="block text-[11.5px] text-ink-500">{fmtSize(data.file.size)} · click to change</span>
                                    </span>
                                </span>
                            ) : (
                                <span className="text-[13px] text-ink-600"><b className="text-brand-700">Choose a file</b> to upload</span>
                            )}
                        </button>
                        {(fileError || errors.file) && <p className="text-[11px] text-danger mt-1">{fileError || errors.file}</p>}
                    </div>
                    <div>
                        <label className={label}>Title *</label>
                        <input value={data.title} onChange={(e) => setData('title', e.target.value)} maxLength={120} placeholder="e.g. Sunnyside rentals – November" className={input} />
                        {errors.title && <p className="text-[11px] text-danger mt-1">{errors.title}</p>}
                    </div>
                    <div>
                        <label className={label}>Note (only you see this)</label>
                        <input value={data.description} onChange={(e) => setData('description', e.target.value)} maxLength={500} placeholder="What’s in it / who it’s for" className={input} />
                    </div>
                    <div className="flex justify-end gap-2">
                        {catalogues.length > 0 && <button type="button" onClick={() => setAdding(false)} className={btnOutline}>Cancel</button>}
                        <button type="submit" disabled={processing || !data.file} className={btnPrimary}>
                            {processing && <Spinner size={13} />}{processing && progress ? `${progress.percentage}%` : 'Upload'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="flex justify-between items-center gap-3">
                    <p className="text-[12.5px] text-ink-500">Send any of these in a chat with the <b>catalogue</b> button next to the paperclip.</p>
                    <button type="button" onClick={() => setAdding(true)} className={`${btnPrimary} !py-2 !text-[12.5px] shrink-0`}>+ Upload catalogue</button>
                </div>
            )}

            {catalogues.length > 0 && (
                <ul className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {catalogues.map((c) => (
                        <li key={c.id} className="rounded-2xl border border-ink-200/60 bg-white p-4 flex gap-3">
                            {c.kind === 'image'
                                ? <img src={c.url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0 bg-ink-100" loading="lazy" />
                                : <CatalogueIcon c={c} className="w-16 h-16" />}
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-[13.5px] truncate">{c.title}</p>
                                <p className="text-[11.5px] text-ink-500 truncate">{c.name} · {fmtSize(c.size)}</p>
                                {c.description && <p className="text-[12px] text-ink-600 mt-1 line-clamp-2">{c.description}</p>}
                                <p className="text-[11px] text-ink-400 mt-1">
                                    Added {c.added} · {c.sent_count ? `sent ${c.sent_count}× · last ${c.last_sent}` : 'not sent yet'}
                                </p>
                                <div className="flex gap-3 mt-2 text-[12px] font-semibold">
                                    <a href={c.url} target="_blank" rel="noopener" className="text-brand-700 hover:underline">View</a>
                                    <a href={`${c.url}?download=1`} className="text-ink-600 hover:text-ink-900">Download</a>
                                    <button type="button" onClick={() => remove(c)} className="text-ink-400 hover:text-danger ml-auto">Remove</button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
