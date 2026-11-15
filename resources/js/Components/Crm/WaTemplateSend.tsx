import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, router, usePage } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';

export type ChatTemplate = {
    id: number; name: string; language: string; category: string; body: string | null; footer: string | null;
    params: string[]; prefill: Record<string, string>;
};
export type OwnerField = { key: string; label: string; value: string };
export type SendHours = { open_now: boolean; next_open: string; weekdays: string; saturday: string };

const input = 'w-full bg-white border border-ink-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100';

function render(body: string, values: Record<string, string>) {
    return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => values[k]?.trim() ? values[k] : `{{${k}}}`);
}

/**
 * Shown in a chat once the 24-hour reply window has closed: WhatsApp then only
 * allows approved templates, so the agent picks one, fills its blanks and sends
 * it to this owner alone. No campaign needed.
 */
export default function TemplateSend({ phone, templates, fields, hours, optedOut }: {
    phone: string; templates: ChatTemplate[]; fields: OwnerField[]; hours: SendHours; optedOut: boolean;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="flex flex-wrap items-center gap-3 px-1 py-1">
            <p className="flex-1 min-w-[14rem] text-[12.5px] text-ink-600">
                <b className="text-ink-800">The 24-hour reply window has closed.</b> WhatsApp only allows an approved template now. When the owner replies, you can chat freely again.
            </p>
            <button type="button" onClick={() => setOpen(true)} disabled={optedOut}
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#00A884] hover:bg-[#008069] text-white text-[13px] font-semibold disabled:opacity-50"
                title={optedOut ? 'This owner replied STOP' : undefined}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M9 13h6M9 17h4" /></svg>
                Send a template
            </button>
            {/* Portalled: the chat composer is a <form>, and Enter in a blank must not submit it. */}
            {open && createPortal(<TemplateModal phone={phone} templates={templates} fields={fields} hours={hours} onClose={() => setOpen(false)} />, document.body)}
        </div>
    );
}

function TemplateModal({ phone, templates, fields, hours, onClose }: {
    phone: string; templates: ChatTemplate[]; fields: OwnerField[]; hours: SendHours; onClose: () => void;
}) {
    const { errors, flash } = usePage<{ errors?: Record<string, string>; flash?: { error?: string | null } }>().props;
    const [templateId, setTemplateId] = useState<number | null>(templates[0]?.id ?? null);
    const t = templates.find((x) => x.id === templateId) ?? null;
    const [values, setValues] = useState<Record<string, string>>(t?.prefill ?? {});
    const [sending, setSending] = useState(false);
    const [tried, setTried] = useState(false);

    useEffect(() => { setValues({ ...(t?.prefill ?? {}) }); }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        const esc = (e: KeyboardEvent) => e.key === 'Escape' && !sending && onClose();
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [sending, onClose]);

    const missing = t ? t.params.filter((p) => !values[p]?.trim()) : [];
    const preview = useMemo(() => (t?.body ? render(t.body, values) : ''), [t, values]);
    const serverError = tried ? (flash?.error || Object.entries(errors ?? {}).find(([k]) => k.startsWith('variables') || k === 'template_id')?.[1]) : null;

    function send() {
        if (!t) return;
        setTried(true);
        setSending(true);
        router.post('/agent/crm/whatsapp/chat/template', { phone, template_id: t.id, variables: values }, {
            preserveScroll: true,
            onSuccess: (page) => { if (!(page.props as { flash?: { error?: string } }).flash?.error) onClose(); },
            onFinish: () => setSending(false),
        });
    }

    return (
        <div className="fixed inset-0 z-50 bg-ink-900/50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => !sending && onClose()}>
            <div role="dialog" aria-modal="true" aria-labelledby="tpl-title" onClick={(e) => e.stopPropagation()}
                className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-lift max-h-[94vh] overflow-y-auto pb-rise">
                <div className="px-6 pt-6 pb-3 flex items-start justify-between gap-3">
                    <div>
                        <h2 id="tpl-title" className="text-[20px] font-semibold">Send a template</h2>
                        <p className="text-[12.5px] text-ink-500 mt-0.5">Goes to this owner only. Meta bills it like a campaign message.</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={sending} aria-label="Close"
                        className="w-9 h-9 rounded-full border border-ink-200 flex items-center justify-center text-ink-500 hover:text-ink-900 shrink-0">✕</button>
                </div>

                {templates.length === 0 ? (
                    <div className="px-6 pb-6 text-[13px] text-ink-600">
                        You don’t have an approved template yet.{' '}
                        <Link href="/agent/crm/whatsapp?section=templates" className="font-semibold text-brand-700 hover:underline">Create one under Meta templates</Link>; Meta usually approves within minutes to a day.
                    </div>
                ) : (
                    <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-4 min-w-0">
                            <div>
                                <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Template</label>
                                <select value={templateId ?? ''} onChange={(e) => setTemplateId(Number(e.target.value))} className={input}>
                                    {templates.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.category}</option>)}
                                </select>
                            </div>
                            {t && t.params.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-[12px] font-semibold text-ink-700">Fill in the blanks</p>
                                    {t.params.map((p) => (
                                        <div key={p}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[11.5px] font-bold text-ink-500 tabular-nums">{`{{${p}}}`}</span>
                                                <select value="" onChange={(e) => { const f = fields.find((x) => x.key === e.target.value); if (f) setValues((v) => ({ ...v, [p]: f.value })); }}
                                                    className="ml-auto text-[11.5px] text-brand-700 font-semibold bg-transparent focus:outline-none cursor-pointer" aria-label={`Fill {{${p}}} from the owner’s record`}>
                                                    <option value="">Fill from…</option>
                                                    {fields.filter((f) => f.value).map((f) => <option key={f.key} value={f.key}>{f.label}: {f.value}</option>)}
                                                </select>
                                            </div>
                                            <input value={values[p] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))} maxLength={500}
                                                className={`${input} ${tried && !values[p]?.trim() ? '!border-danger' : ''}`} />
                                            {errors?.[`variables.${p}`] && <p className="text-[11px] text-danger mt-1">{errors[`variables.${p}`]}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-ink-700 mb-1.5">Preview</p>
                            <div className="rounded-2xl bg-[#EFEAE2] p-4 min-h-[10rem]">
                                <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-none bg-[#D9FDD3] px-3 py-2 shadow-sm">
                                    <p className="text-[13px] whitespace-pre-line leading-snug text-[#111B21]">{preview || '—'}</p>
                                    {t?.footer && <p className="text-[11px] text-ink-500 mt-1.5">{t.footer}</p>}
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-3">
                            {!hours.open_now && (
                                <p className="rounded-xl bg-warning/10 border border-warning/30 px-3.5 py-2.5 text-[12.5px] text-ink-700">
                                    Outside your sending hours (weekdays {hours.weekdays}, Saturdays {hours.saturday}). Next window: <b>{hours.next_open}</b>.
                                </p>
                            )}
                            {serverError && !sending && <p className="rounded-xl bg-danger/10 border border-danger/30 text-danger px-3.5 py-2.5 text-[12.5px]">{serverError}</p>}
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={onClose} disabled={sending} className="px-5 py-2.5 rounded-full text-[13px] font-semibold border border-ink-300 hover:bg-ink-50">Cancel</button>
                                <button type="button" onClick={send} disabled={!t || sending || missing.length > 0 || !hours.open_now}
                                    className="px-5 py-2.5 rounded-full bg-[#00A884] hover:bg-[#008069] text-white text-[13px] font-semibold disabled:opacity-50 inline-flex items-center gap-2"
                                    title={missing.length ? 'Fill in every blank first' : undefined}>
                                    {sending ? <><Spinner size={13} />Sending…</> : 'Send template'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
