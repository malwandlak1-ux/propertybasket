import { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import CrmTabs from '@/Components/Crm/CrmTabs';
import { FlashBanners } from '@/Components/Dashboard/Charts';
import WaShell, { ChatList, WaThread, initials } from '@/Components/Crm/WaShell';
import { Catalogue, CatalogueIcon } from '@/Components/Crm/WaCatalogues';
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

export default function Chat({ agent, phone, display, prospect, window_open_until, messages, panel, profile, threads, catalogues }: {
    agent: { agency_name: string };
    phone: string;
    display: string;
    prospect: { id: number; owner: string; unit: string | null; scheme: string | null; scheme_id: number; opted_out: boolean } | null;
    window_open_until: string | null;
    messages: Msg[];
    panel: Panel | null;
    profile: Profile;
    threads: WaThread[];
    catalogues: Catalogue[];
}) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const { data, setData, post, processing, reset, errors, progress } = useForm<{ phone: string; body: string; attachment: File | null; voice: boolean; catalogue_id: number | null }>({ phone, body: '', attachment: null, voice: false, catalogue_id: null });
    const [catOpen, setCatOpen] = useState(false);
    const chosen = catalogues.find((c) => c.id === data.catalogue_id) ?? null;
    const end = useRef<HTMLDivElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
    // Owner record: a side column on wide screens (open by default), a drawer on smaller ones.
    const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1536px)').matches);
    const [panelOpen, setPanelOpen] = useState(wide);
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1536px)');
        const on = () => setWide(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);

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
            setData((d) => ({ ...d, attachment: v.file, voice: v.voice, catalogue_id: null }));
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
        setData((d) => ({ ...d, attachment: safeUploadFile(f), voice: false, catalogue_id: null })); // filenames with ' " ; are blocked by the host firewall (403)
    }
    function clearFile() {
        setData((d) => ({ ...d, attachment: null, voice: false, catalogue_id: null }));
        if (fileInput.current) fileInput.current.value = '';
    }
    useEffect(() => {
        const toBottom = () => { const box = end.current?.parentElement; if (box) box.scrollTop = box.scrollHeight; };
        toBottom();
        const t = window.setTimeout(toBottom, 300); // again once images/side panel have laid out
        return () => window.clearTimeout(t);
    }, [messages.length]);

    const canSend = !processing && !recording && !preparing && (!!data.body.trim() || !!data.attachment || !!data.catalogue_id);

    function send(e?: { preventDefault(): void }) {
        e?.preventDefault();
        post('/agent/crm/whatsapp/chat', {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => { reset('body', 'attachment', 'voice', 'catalogue_id'); if (fileInput.current) fileInput.current.value = ''; },
        });
    }

    const name = prospect?.owner ?? display;

    return (
        <AgentLayout crumb="CRM · WhatsApp" agencyName={agent.agency_name}>
            <Head title={name} />
            <div className="px-4 sm:px-7 py-6">
                <CrmTabs base="/agent/crm" active="whatsapp" />
                <FlashBanners flash={flash} />

                <WaShell active="chats" badges={{ chats: threads.filter((t) => t.open).length }}>
                    <ChatList threads={threads} activePhone={phone} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter}
                        className="hidden lg:flex w-[290px] xl:w-[330px] shrink-0" />

                    <section className="flex-1 min-w-0 flex flex-col">
                        {/* Conversation header */}
                        <div className="h-16 shrink-0 px-3 sm:px-4 bg-[#F0F2F5] border-b border-ink-200 flex items-center gap-3">
                            <Link href="/agent/crm/whatsapp" className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center text-ink-600 hover:bg-ink-900/5" aria-label="Back to chats">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
                            </Link>
                            <button type="button" onClick={() => setPanelOpen((o) => !o)} className="flex items-center gap-3 min-w-0 flex-1 text-left" title={panel ? 'Owner record' : undefined}>
                                <span className="w-10 h-10 rounded-full bg-[#DFE5E7] text-ink-600 text-[13px] font-bold flex items-center justify-center shrink-0">{initials(name)}</span>
                                <span className="min-w-0">
                                    <span className="block text-[15px] font-semibold text-ink-900 truncate">{name}</span>
                                    <span className="block text-[12px] text-ink-500 truncate">
                                        {display}
                                        {prospect?.scheme && <> · {prospect.scheme}{prospect.unit ? ` unit ${prospect.unit}` : ''}</>}
                                    </span>
                                </span>
                            </button>
                            {prospect && (
                                <Link href={`/agent/crm/farming?scheme=${prospect.scheme_id}`} className="hidden sm:inline-flex text-[12px] font-semibold text-ink-600 hover:text-brand-700 px-2">Farming list</Link>
                            )}
                            <button type="button" onClick={() => setPanelOpen((o) => !o)}
                                className={`w-9 h-9 rounded-full flex items-center justify-center ${panelOpen ? 'bg-ink-900/10 text-ink-900' : 'text-ink-600 hover:bg-ink-900/5'}`}
                                aria-label="Owner record" title="Owner record">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
                            </button>
                        </div>

                        {prospect?.opted_out && <div className="px-4 py-2 bg-danger/10 border-b border-danger/30 text-danger text-[12.5px]">This owner replied STOP. They won’t get campaign messages again.</div>}

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto bg-[#EFEAE2] px-3 sm:px-[6%] py-4 space-y-2">
                            {messages.map((m) => (
                                <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] sm:max-w-[65%] rounded-lg px-2.5 pt-1.5 pb-1 shadow-sm ${m.direction === 'out' ? 'bg-[#D9FDD3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                                        {m.campaign && <p className="text-[10.5px] font-semibold text-[#008069] mb-0.5">Campaign · {m.campaign}</p>}
                                        {m.media && <Attachment media={m.media} />}
                                        {m.body && <p className="text-[13.5px] whitespace-pre-line leading-snug text-[#111B21]">{m.body}</p>}
                                        <p className="text-[10.5px] text-ink-500 text-right mt-0.5 flex items-center justify-end gap-1">
                                            {m.at}
                                            {m.direction === 'out' && <Ticks status={m.status} />}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div ref={end} />
                        </div>

                        {/* Composer */}
                        <form onSubmit={send} className="shrink-0 px-3 py-2.5 bg-[#F0F2F5] border-t border-ink-200">
                            {window_open_until ? (
                                <>
                                    {data.attachment && data.voice && previewUrl && (
                                        <div className="mb-2 flex flex-wrap items-center gap-2 bg-[#D9FDD3] border border-ink-200 rounded-xl pl-3 pr-1.5 py-1.5 text-[12.5px] max-w-full">
                                            <span aria-hidden>🎤</span>
                                            <span className="font-semibold">Voice note · {fmtClock(voiceSeconds)}</span>
                                            <audio src={previewUrl} controls preload="metadata" className="h-8 max-w-[15rem]" />
                                            <button type="button" onClick={clearFile} className="w-6 h-6 rounded-full hover:bg-black/10 text-ink-500" aria-label="Discard voice note" title="Discard">×</button>
                                            {voiceSeconds > INLINE_VOICE_SECONDS && <span className="basis-full text-[11px] text-ink-500">Over ~2½ min: the owner will tap to download it instead of it playing straight away.</span>}
                                        </div>
                                    )}
                                    {chosen && (
                                        <div className="mb-2 inline-flex items-center gap-2 bg-white border border-ink-200 rounded-xl pl-2 pr-1.5 py-1.5 text-[12.5px] max-w-full">
                                            <CatalogueIcon c={chosen} className="w-7 h-7" />
                                            <span className="font-semibold truncate max-w-[16rem]">{chosen.title}</span>
                                            <span className="text-ink-500 hidden sm:inline">catalogue</span>
                                            <button type="button" onClick={clearFile} className="w-6 h-6 rounded-full hover:bg-ink-200 text-ink-500" aria-label="Remove catalogue">×</button>
                                        </div>
                                    )}
                                    {data.attachment && !data.voice && (
                                        <div className="mb-2 inline-flex items-center gap-2 bg-white border border-ink-200 rounded-xl pl-3 pr-1.5 py-1.5 text-[12.5px] max-w-full">
                                            <span aria-hidden>{data.attachment.type.startsWith('image/') ? '🖼️' : data.attachment.type.startsWith('video/') ? '🎬' : data.attachment.type.startsWith('audio/') ? '🎵' : '📄'}</span>
                                            <span className="font-semibold truncate max-w-[16rem]">{data.attachment.name}</span>
                                            <span className="text-ink-500">{fmtSize(data.attachment.size)}</span>
                                            <button type="button" onClick={clearFile} className="w-6 h-6 rounded-full hover:bg-ink-200 text-ink-500" aria-label="Remove attachment">×</button>
                                        </div>
                                    )}
                                    <div className="flex gap-1.5 items-end">
                                        <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                                        <button type="button" onClick={() => fileInput.current?.click()} disabled={processing || recording}
                                            className="w-10 h-10 shrink-0 rounded-full hover:bg-ink-900/5 flex items-center justify-center text-ink-600"
                                            title="Attach a photo, video, voice note or document" aria-label="Attach a file">
                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                                        </button>
                                        <div className="relative shrink-0">
                                            <button type="button" onClick={() => setCatOpen((o) => !o)} disabled={processing || recording}
                                                className={`w-10 h-10 rounded-full flex items-center justify-center text-ink-600 ${catOpen ? 'bg-ink-900/10' : 'hover:bg-ink-900/5'}`}
                                                title="Send a catalogue" aria-label="Send a catalogue" aria-expanded={catOpen}>
                                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5h-5A1.5 1.5 0 0 1 4 17V5.5ZM20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 0 20 17V5.5Z" /></svg>
                                            </button>
                                            {catOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-30" onClick={() => setCatOpen(false)} />
                                                    <div className="absolute bottom-12 left-0 z-40 w-[min(20rem,80vw)] bg-white rounded-2xl shadow-lift border border-ink-200 overflow-hidden">
                                                        <p className="px-4 pt-3 pb-2 text-[12px] font-semibold text-ink-500">Send a catalogue</p>
                                                        {catalogues.length === 0 ? (
                                                            <p className="px-4 pb-4 text-[12.5px] text-ink-500">
                                                                No catalogues yet. <Link href="/agent/crm/whatsapp?section=catalogues" className="font-semibold text-brand-700 hover:underline">Upload one</Link>
                                                            </p>
                                                        ) : (
                                                            <ul className="max-h-72 overflow-y-auto pb-1.5">
                                                                {catalogues.map((c) => (
                                                                    <li key={c.id}>
                                                                        <button type="button"
                                                                            onClick={() => { setData((d) => ({ ...d, catalogue_id: c.id, attachment: null, voice: false })); if (fileInput.current) fileInput.current.value = ''; setCatOpen(false); }}
                                                                            className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-ink-50">
                                                                            <CatalogueIcon c={c} className="w-9 h-9" />
                                                                            <span className="min-w-0">
                                                                                <span className="block text-[13px] font-semibold truncate">{c.title}</span>
                                                                                <span className="block text-[11px] text-ink-500 truncate">{c.name}</span>
                                                                            </span>
                                                                        </button>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {recording ? (
                                            <div className="flex-1 flex items-center gap-3 bg-white border border-danger/30 rounded-xl px-3.5 py-2 min-h-[2.75rem]" role="status" aria-live="polite">
                                                <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse" aria-hidden />
                                                <span className="text-[13px] font-semibold text-danger tabular-nums">Recording {fmtClock(recSeconds)}</span>
                                                {recSeconds > INLINE_VOICE_SECONDS && <span className="text-[11px] text-ink-500 hidden sm:inline">Long notes download instead of playing straight away</span>}
                                                <span className="flex-1" />
                                                <button type="button" onClick={cancelRecording} className="text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 px-2 py-1">Cancel</button>
                                                <button type="button" onClick={stopRecording} className="text-[12.5px] font-semibold text-white bg-danger hover:bg-danger/90 rounded-lg px-3 py-1.5">Stop</button>
                                            </div>
                                        ) : (
                                            <textarea value={data.body} onChange={(e) => setData('body', e.target.value)} rows={1} maxLength={4000}
                                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canSend) send(e); } }}
                                                placeholder={data.voice ? 'Add a message to send after the voice note (optional)' : data.attachment || data.catalogue_id ? 'Add a caption (optional)' : 'Type a message'}
                                                className="flex-1 bg-white rounded-xl px-3.5 py-2.5 text-[14px] focus:outline-none resize-none max-h-32 min-h-[2.75rem]" />
                                        )}
                                        {canSend || processing ? (
                                            <button type="submit" disabled={!canSend || processing}
                                                className="w-10 h-10 shrink-0 rounded-full bg-[#00A884] hover:bg-[#008069] text-white flex items-center justify-center disabled:opacity-60"
                                                aria-label="Send" title="Send">
                                                {processing ? (progress ? <span className="text-[10px] font-bold">{progress.percentage}%</span> : <Spinner size={14} />) : (
                                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" /></svg>
                                                )}
                                            </button>
                                        ) : voiceSupported && !recording ? (
                                            <button type="button" onClick={startRecording} disabled={preparing}
                                                className="w-10 h-10 shrink-0 rounded-full hover:bg-ink-900/5 flex items-center justify-center text-ink-600 disabled:opacity-50"
                                                title="Record a voice note" aria-label="Record a voice note">
                                                {preparing ? <Spinner size={16} /> : (
                                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8" /></svg>
                                                )}
                                            </button>
                                        ) : null}
                                    </div>
                                    {(fileError || errors.attachment || errors.body) && (
                                        <p className="text-[11.5px] text-danger mt-1.5">{fileError || errors.attachment || errors.body}</p>
                                    )}
                                    <p className="text-[10.5px] text-ink-400 mt-1 px-1">You can reply freely until {window_open_until}.</p>
                                </>
                            ) : (
                                <p className="text-[12.5px] text-ink-500 px-1 py-1.5">
                                    WhatsApp only allows free replies within 24 hours of the owner’s last message. To reach them again, include them in a template campaign.
                                </p>
                            )}
                        </form>
                    </section>

                    {/* The owner's farming record: log a contact, send to pipeline, edit details. Side column on wide screens. */}
                    {panelOpen && wide && (
                        <aside className="w-[360px] shrink-0 border-l border-ink-200 bg-[#F7F8FA] overflow-y-auto p-3">
                            <OwnerPanel panel={panel} profile={profile} inline />
                        </aside>
                    )}
                </WaShell>
            </div>
            {panelOpen && !wide && (panel ? (
                <ProspectDrawer
                    key={JSON.stringify(panel.prospect) + panel.history.length}
                    prospect={panel.prospect}
                    scheme={panel.scheme}
                    suburb={panel.suburb}
                    history={panel.history}
                    editable
                    profile={profile}
                    onClose={() => setPanelOpen(false)}
                />
            ) : (
                <div className="fixed inset-0 z-40 bg-ink-900/40 flex items-end sm:items-center justify-center p-4" onClick={() => setPanelOpen(false)}>
                    <div className="bg-white rounded-2xl p-5 max-w-sm text-[12.5px] text-ink-600" onClick={(e) => e.stopPropagation()}>
                        <OwnerPanel panel={null} profile={profile} />
                    </div>
                </div>
            ))}
        </AgentLayout>
    );
}

function OwnerPanel({ panel, profile, inline = false }: { panel: Panel | null; profile: Profile; inline?: boolean }) {
    if (!panel) {
        return (
            <div className={`${inline ? 'bg-white rounded-2xl border border-dashed border-ink-200 p-5' : ''} text-[12.5px] text-ink-500`}>
                This number isn’t linked to an owner in your farming lists. Add it to an owner’s Phone 1 or Phone 2 under CRM → Farming to log contacts from here.
            </div>
        );
    }
    return (
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
    );
}

function Ticks({ status }: { status: string }) {
    if (status === 'failed') return <span className="text-danger font-semibold">failed</span>;
    const double = status === 'delivered' || status === 'read';
    return (
        <svg className={`w-4 h-3 ${status === 'read' ? 'text-[#53BDEB]' : 'text-ink-400'}`} viewBox="0 0 18 12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-label={status}>
            <path d={double ? 'M1 6.5 4.5 10 11 2M7 9l1 1 6.5-8' : 'M3 6.5 6.5 10 13 2'} />
        </svg>
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
