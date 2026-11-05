import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import CrmTabs from '@/Components/Crm/CrmTabs';
import { FlashBanners, PageHeader, btnPrimary } from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';
import { safeUploadFile } from '@/lib/safeUpload';
import { canRecordVoice, startVoiceNote, type VoiceSession } from '@/lib/voiceNote';
import ProspectDrawer from '@/Components/Crm/ProspectDrawer';
import type { Activity, Profile, Prospect, Scheme, Suburb } from '@/Components/Crm/constants';

type Media = { url: string; name: string | null; kind: string };
type Msg = { id: number; direction: 'in' | 'out'; body: string | null; media: Media | null; status: string; campaign: string | null; at: string | null };

/** What WhatsApp accepts on a reply (mirrors the server's validation). */
const ACCEPT = '.jpg,.jpeg,.png,.mp4,.3gp,.mp3,.ogg,.opus,.aac,.m4a,.amr,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';
const MAX_VOICE_SECONDS = 5 * 60;
const INLINE_VOICE_SECONDS = 150; // ~512 KB at 24 kbit/s — longer notes still send, but the owner taps to download

function fmtClock(sec: number) {
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
const MAX_BYTES = 16 * 1024 * 1024;

function fmtSize(b: number) {
    return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

type Panel = { prospect: Prospect; scheme: Scheme; suburb: Suburb; history: Activity[] };

export default function Chat({ agent, phone, display, prospect, window_open_until, messages, panel, profile }: {
    agent: { agency_name: string };
    phone: string;
    display: string;
    prospect: { id: number; owner: string; unit: string | null; scheme: string | null; scheme_id: number; opted_out: boolean } | null;
    window_open_until: string | null;
    messages: Msg[];
    panel: Panel | null;
    profile: Profile;
}) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const { data, setData, post, processing, reset, errors, progress } = useForm<{ phone: string; body: string; attachment: File | null; voice: boolean }>({ phone, body: '', attachment: null, voice: false });
    const end = useRef<HTMLDivElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const [fileError, setFileError] = useState<string | null>(null);

    // Voice notes: record → preview → send (goes as a WhatsApp voice note).
    const voiceSupported = canRecordVoice();
    const session = useRef<VoiceSession | null>(null);
    const [recording, setRecording] = useState(false);
    const [recSeconds, setRecSeconds] = useState(0);
    const [voiceSeconds, setVoiceSeconds] = useState(0);
    const [preparing, setPreparing] = useState(false);
    const previewUrl = useMemo(() => (data.voice && data.attachment ? URL.createObjectURL(data.attachment) : null), [data.voice, data.attachment]);
    useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

    async function startRecording() {
        setFileError(null);
        try {
            session.current = await startVoiceNote();
            setRecSeconds(0);
            setRecording(true);
        } catch (e) {
            setFileError((e as Error).message);
        }
    }
    async function stopRecording() {
        const s = session.current;
        session.current = null;
        setRecording(false);
        if (!s) return;
        setPreparing(true);
        try {
            const v = await s.stop();
            if (v.file.size > MAX_BYTES) { setFileError('That voice note is too long (16 MB max).'); return; }
            setVoiceSeconds(v.seconds);
            setData((d) => ({ ...d, attachment: v.file, voice: v.voice }));
            if (fileInput.current) fileInput.current.value = '';
        } catch (e) {
            setFileError((e as Error).message);
        } finally {
            setPreparing(false);
        }
    }
    function cancelRecording() {
        session.current?.cancel();
        session.current = null;
        setRecording(false);
    }
    useEffect(() => {
        if (!recording) return;
        const t = window.setInterval(() => setRecSeconds((n) => n + 1), 1000);
        return () => window.clearInterval(t);
    }, [recording]);
    useEffect(() => { if (recording && recSeconds >= MAX_VOICE_SECONDS) stopRecording(); }, [recording, recSeconds]);
    useEffect(() => () => session.current?.cancel(), []); // leaving the page stops the mic

    function pickFile(f: File | undefined) {
        setFileError(null);
        if (!f) return;
        if (f.size > MAX_BYTES) { setFileError('Attachments can be up to 16 MB.'); return; }
        setData((d) => ({ ...d, attachment: safeUploadFile(f), voice: false })); // filenames with ' " ; are blocked by the host firewall (403)
    }
    function clearFile() {
        setData((d) => ({ ...d, attachment: null, voice: false }));
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
            onSuccess: () => { reset('body', 'attachment', 'voice'); if (fileInput.current) fileInput.current.value = ''; },
        });
    }

    return (
        <AgentLayout crumb="CRM · WhatsApp" agencyName={agent.agency_name}>
            <Head title={prospect?.owner ?? display} />
            <div className="px-4 sm:px-7 py-6">
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

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <section className="lg:col-span-7 bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden pb-rise">
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
                                {data.attachment && data.voice && previewUrl && (
                                    <div className="mb-2 flex flex-wrap items-center gap-2 bg-[#DCF8C6] border border-ink-200 rounded-xl pl-3 pr-1.5 py-1.5 text-[12.5px] max-w-full">
                                        <span aria-hidden>🎤</span>
                                        <span className="font-semibold">Voice note · {fmtClock(voiceSeconds)}</span>
                                        <audio src={previewUrl} controls preload="metadata" className="h-8 max-w-[15rem]" />
                                        <button type="button" onClick={clearFile} className="w-6 h-6 rounded-full hover:bg-black/10 text-ink-500" aria-label="Discard voice note" title="Discard">×</button>
                                        {voiceSeconds > INLINE_VOICE_SECONDS && <span className="basis-full text-[11px] text-ink-500">Over ~2½ min: the owner will tap to download it instead of it playing straight away.</span>}
                                    </div>
                                )}
                                {data.attachment && !data.voice && (
                                    <div className="mb-2 inline-flex items-center gap-2 bg-ink-50 border border-ink-200 rounded-xl pl-3 pr-1.5 py-1.5 text-[12.5px] max-w-full">
                                        <span aria-hidden>{data.attachment.type.startsWith('image/') ? '🖼️' : data.attachment.type.startsWith('video/') ? '🎬' : data.attachment.type.startsWith('audio/') ? '🎵' : '📄'}</span>
                                        <span className="font-semibold truncate max-w-[16rem]">{data.attachment.name}</span>
                                        <span className="text-ink-500">{fmtSize(data.attachment.size)}</span>
                                        <button type="button" onClick={clearFile} className="w-6 h-6 rounded-full hover:bg-ink-200 text-ink-500" aria-label="Remove attachment">×</button>
                                    </div>
                                )}
                                <div className="flex gap-2 items-end">
                                    <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                                    <button type="button" onClick={() => fileInput.current?.click()} disabled={processing || recording}
                                        className="w-11 h-11 shrink-0 rounded-full border border-ink-200 bg-white hover:bg-ink-50 flex items-center justify-center text-ink-600"
                                        title="Attach a photo, video, voice note or document" aria-label="Attach a file">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                                    </button>
                                    {voiceSupported && !recording && (
                                        <button type="button" onClick={startRecording} disabled={processing || preparing}
                                            className="w-11 h-11 shrink-0 rounded-full border border-ink-200 bg-white hover:bg-ink-50 flex items-center justify-center text-ink-600 disabled:opacity-50"
                                            title="Record a voice note" aria-label="Record a voice note">
                                            {preparing ? <Spinner size={16} /> : (
                                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8" /></svg>
                                            )}
                                        </button>
                                    )}
                                    {recording ? (
                                        <div className="flex-1 flex items-center gap-3 bg-danger/5 border border-danger/30 rounded-xl px-3.5 py-2.5 min-h-[3.25rem]" role="status" aria-live="polite">
                                            <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse" aria-hidden />
                                            <span className="text-[13px] font-semibold text-danger tabular-nums">Recording {fmtClock(recSeconds)}</span>
                                            {recSeconds > INLINE_VOICE_SECONDS && <span className="text-[11px] text-ink-500 hidden sm:inline">Long notes download instead of playing straight away</span>}
                                            <span className="flex-1" />
                                            <button type="button" onClick={cancelRecording} className="text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 px-2 py-1">Cancel</button>
                                            <button type="button" onClick={stopRecording} className="text-[12.5px] font-semibold text-white bg-danger hover:bg-danger/90 rounded-lg px-3 py-1.5">Stop</button>
                                        </div>
                                    ) : (
                                        <textarea value={data.body} onChange={(e) => setData('body', e.target.value)} rows={2} maxLength={4000}
                                            placeholder={data.voice ? 'Add a message to send after the voice note (optional)…' : data.attachment ? 'Add a caption (optional)…' : 'Type a reply…'}
                                            className="flex-1 bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 resize-none" />
                                    )}
                                    <button type="submit" disabled={processing || recording || preparing || (!data.body.trim() && !data.attachment)} className={btnPrimary}>
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

                {/* The owner's farming record beside the chat: log a contact, send to pipeline, edit details. */}
                <div className="lg:col-span-5">
                    {panel ? (
                        <ProspectDrawer
                            key={JSON.stringify(panel.prospect) + panel.history.length}
                            inline
                            prospect={panel.prospect}
                            scheme={panel.scheme}
                            suburb={panel.suburb}
                            history={panel.history}
                            editable
                            profile={profile}
                            onClose={() => {}}
                        />
                    ) : (
                        <div className="bg-white rounded-2xl border border-dashed border-ink-200 p-5 text-[12.5px] text-ink-500">
                            This number isn’t linked to an owner in your farming lists. Add it to an owner’s Phone 1 or Phone 2 under CRM → Farming to log contacts from here.
                        </div>
                    )}
                </div>
                </div>
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
        return <VoicePlayer media={media} />;
    }
    return (
        <a href={`${media.url}?download=1`} className="mb-1 flex items-center gap-2.5 bg-black/5 hover:bg-black/10 rounded-xl px-3 py-2 text-[12.5px]">
            <span className="text-lg" aria-hidden>📄</span>
            <span className="font-semibold truncate max-w-[14rem]">{media.name ?? 'Document'}</span>
            <span className="text-brand-700 font-semibold shrink-0">Download</span>
        </a>
    );
}

/** Voice note / audio bubble. Falls back to a download link if this browser can't play the format. */
function VoicePlayer({ media }: { media: Media }) {
    const [failed, setFailed] = useState(false);
    return (
        <div className="mb-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-500 mb-1"><span aria-hidden>🎤</span>Voice note</div>
            {!failed && <audio src={media.url} controls preload="metadata" onError={() => setFailed(true)} className="max-w-full w-64 h-10" />}
            {failed && <p className="text-[12px] text-ink-600 mb-1">This browser can’t play this voice note here.</p>}
            <a href={`${media.url}?download=1`} className="text-[11px] font-semibold text-brand-700 hover:underline">Download</a>
        </div>
    );
}
