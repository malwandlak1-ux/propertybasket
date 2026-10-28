import { FormEvent, useEffect, useRef, useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import CrmTabs from '@/Components/Crm/CrmTabs';
import { FlashBanners, PageHeader, btnPrimary } from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';
import { safeUploadFile } from '@/lib/safeUpload';

type Media = { url: string; name: string | null; kind: string };
type Msg = { id: number; direction: 'in' | 'out'; body: string | null; media: Media | null; status: string; campaign: string | null; at: string | null };

/** What WhatsApp accepts on a reply (mirrors the server's validation). */
const ACCEPT = '.jpg,.jpeg,.png,.mp4,.3gp,.mp3,.ogg,.aac,.m4a,.amr,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';
const MAX_BYTES = 16 * 1024 * 1024;

function fmtSize(b: number) {
    return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export default function Chat({ agent, phone, display, prospect, window_open_until, messages }: {
    agent: { agency_name: string };
    phone: string;
    display: string;
    prospect: { id: number; owner: string; unit: string | null; scheme: string | null; scheme_id: number; opted_out: boolean } | null;
    window_open_until: string | null;
    messages: Msg[];
}) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const { data, setData, post, processing, reset, errors, progress } = useForm<{ phone: string; body: string; attachment: File | null }>({ phone, body: '', attachment: null });
    const end = useRef<HTMLDivElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const [fileError, setFileError] = useState<string | null>(null);

    function pickFile(f: File | undefined) {
        setFileError(null);
        if (!f) return;
        if (f.size > MAX_BYTES) { setFileError('Attachments can be up to 16 MB.'); return; }
        setData('attachment', safeUploadFile(f)); // filenames with ' " ; are blocked by the host firewall (403)
    }
    function clearFile() {
        setData('attachment', null);
        if (fileInput.current) fileInput.current.value = '';
    }
    useEffect(() => {
        end.current?.scrollIntoView({ block: 'end' });
    }, [messages.length]);

    function send(e: FormEvent) {
        e.preventDefault();
        post('/agent/crm/whatsapp/chat', {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => { reset('body', 'attachment'); if (fileInput.current) fileInput.current.value = ''; },
        });
    }

    return (
        <AgentLayout crumb="CRM · WhatsApp" agencyName={agent.agency_name}>
            <Head title={prospect?.owner ?? display} />
            <div className="px-4 sm:px-7 py-6 max-w-4xl">
                <PageHeader
                    title={prospect?.owner ?? display}
                    subtitle={<>
                        <Link href="/agent/crm/whatsapp" className="font-semibold text-brand-700 hover:underline">← WhatsApp</Link> · {display}
                        {prospect && <> · <Link href={`/agent/crm/farming?scheme=${prospect.scheme_id}`} className="hover:text-brand-700">{prospect.scheme}{prospect.unit ? ` unit ${prospect.unit}` : ''}</Link></>}
                    </>}
                />
                <CrmTabs base="/agent/crm" active="whatsapp" />
                <FlashBanners flash={flash} />
                {prospect?.opted_out && <div className="mb-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger px-5 py-3 text-[13px]">This owner replied STOP. They won’t get campaign messages again.</div>}

                <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden pb-rise">
                    <div className="bg-[#E7DFD4] p-4 sm:p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
                        {messages.map((m) => (
                            <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm ${m.direction === 'out' ? 'bg-[#DCF8C6] rounded-tr-sm' : 'bg-white rounded-tl-sm'}`}>
                                    {m.campaign && <p className="text-[10.5px] font-semibold text-brand-700 mb-0.5">Campaign · {m.campaign}</p>}
                                    {m.media && <Attachment media={m.media} />}
                                    {m.body && <p className="text-[13px] whitespace-pre-line leading-relaxed">{m.body}</p>}
                                    <p className="text-[10.5px] text-ink-500 text-right mt-1">
                                        {m.at}{m.direction === 'out' && <> · {m.status === 'read' ? '✓✓ read' : m.status === 'delivered' ? '✓✓' : m.status === 'failed' ? 'failed' : '✓'}</>}
                                    </p>
                                </div>
                            </div>
                        ))}
                        <div ref={end} />
                    </div>
                    <form onSubmit={send} className="p-4 border-t border-ink-200">
                        {window_open_until ? (
                            <>
                                {data.attachment && (
                                    <div className="mb-2 inline-flex items-center gap-2 bg-ink-50 border border-ink-200 rounded-xl pl-3 pr-1.5 py-1.5 text-[12.5px] max-w-full">
                                        <span aria-hidden>{data.attachment.type.startsWith('image/') ? '🖼️' : data.attachment.type.startsWith('video/') ? '🎬' : data.attachment.type.startsWith('audio/') ? '🎵' : '📄'}</span>
                                        <span className="font-semibold truncate max-w-[16rem]">{data.attachment.name}</span>
                                        <span className="text-ink-500">{fmtSize(data.attachment.size)}</span>
                                        <button type="button" onClick={clearFile} className="w-6 h-6 rounded-full hover:bg-ink-200 text-ink-500" aria-label="Remove attachment">×</button>
                                    </div>
                                )}
                                <div className="flex gap-2 items-end">
                                    <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                                    <button type="button" onClick={() => fileInput.current?.click()} disabled={processing}
                                        className="w-11 h-11 shrink-0 rounded-full border border-ink-200 bg-white hover:bg-ink-50 flex items-center justify-center text-ink-600"
                                        title="Attach a photo, video, voice note or document" aria-label="Attach a file">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                                    </button>
                                    <textarea value={data.body} onChange={(e) => setData('body', e.target.value)} rows={2} maxLength={4000}
                                        placeholder={data.attachment ? 'Add a caption (optional)…' : 'Type a reply…'}
                                        className="flex-1 bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 resize-none" />
                                    <button type="submit" disabled={processing || (!data.body.trim() && !data.attachment)} className={btnPrimary}>
                                        {processing && <Spinner size={13} />}{processing && progress ? `${progress.percentage}%` : 'Send'}
                                    </button>
                                </div>
                                {(fileError || errors.attachment || errors.body) && (
                                    <p className="text-[11.5px] text-danger mt-1.5">{fileError || errors.attachment || errors.body}</p>
                                )}
                            </>
                        ) : (
                            <p className="text-[12.5px] text-ink-500">
                                WhatsApp only allows free replies within 24 hours of the owner’s last message. To reach them again, include them in a template campaign.
                            </p>
                        )}
                    </form>
                    {window_open_until && <p className="px-4 pb-3 -mt-2 text-[11px] text-ink-400">You can reply freely until {window_open_until}.</p>}
                </section>
            </div>
        </AgentLayout>
    );
}

function Attachment({ media }: { media: Media }) {
    if (media.kind === 'image') {
        return (
            <a href={media.url} target="_blank" rel="noopener" className="block mb-1">
                <img src={media.url} alt={media.name ?? 'Photo'} className="rounded-xl max-h-64 max-w-full object-cover" loading="lazy" />
            </a>
        );
    }
    if (media.kind === 'video') {
        return <video src={media.url} controls className="rounded-xl max-h-64 max-w-full mb-1" />;
    }
    if (media.kind === 'audio') {
        return <audio src={media.url} controls className="mb-1 max-w-full" />;
    }
    return (
        <a href={`${media.url}?download=1`} className="mb-1 flex items-center gap-2.5 bg-black/5 hover:bg-black/10 rounded-xl px-3 py-2 text-[12.5px]">
            <span className="text-lg" aria-hidden>📄</span>
            <span className="font-semibold truncate max-w-[14rem]">{media.name ?? 'Document'}</span>
            <span className="text-brand-700 font-semibold shrink-0">Download</span>
        </a>
    );
}
