/**
 * RequestDetailsModal — full job detail viewer opened from a request card.
 * Shows description, photos, property + tenant details and surfaces the
 * primary action for the job's current stage (quote it, schedule it, decline,
 * or just close).
 */
import { FormEvent, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';

export type RequestStage =
    | 'marketplace'
    | 'needs_quote'
    | 'awaiting_approval'
    | 'quote_accepted'
    | 'quote_rejected';

export type RequestDetails = {
    id: number;
    kind: 'assigned' | 'marketplace';
    title: string;
    description: string | null;
    category: string;
    urgency: string;
    property: string;
    property_title: string | null;
    address: string | null;
    tenant: string;
    tenant_email: string | null;
    tenant_phone: string | null;
    preferred: string | null;
    time_slot: string | null;
    photos: string[];
    photo_count: number;
    created: string | null;
    stage: RequestStage;
    my_quote: {
        id: number;
        reference: string;
        status: string;
        subtotal: number;
        vat: number;
        total: number;
        sent_at: string | null;
        expires_at: string | null;
    } | null;
};

type Props = {
    req: RequestDetails;
    vatRegistered: boolean;
    vatRate: number;
    onClose: () => void;
};

type Line = { label: string; qty: string; unit_price: string };

const inputCls = 'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';

function fmtMoney(n: number) {
    return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STAGE_BADGE: Record<RequestStage, { cls: string; label: string }> = {
    marketplace:       { cls: 'bg-brand-50 text-brand-700',     label: 'Marketplace' },
    needs_quote:       { cls: 'bg-warning/15 text-warning',     label: 'Needs quote' },
    awaiting_approval: { cls: 'bg-amber-50 text-amber-700',     label: 'Awaiting agency approval' },
    quote_accepted:    { cls: 'bg-success/15 text-success',     label: 'Quote accepted — ready to schedule' },
    quote_rejected:    { cls: 'bg-danger/15 text-danger',       label: 'Quote rejected — re-quote needed' },
};

export default function RequestDetailsModal({ req, vatRegistered, vatRate, onClose }: Props) {
    const [view, setView]     = useState<'details' | 'quote'>('details');
    const [lightbox, setLightbox] = useState<string | null>(null);
    const [busy, setBusy]     = useState(false);

    function claim() {
        if (! confirm('Claim this job? You\'ll need to submit a quote next for agency approval.')) return;
        setBusy(true);
        router.post(`/contractor/requests/${req.id}/accept`, {}, {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onFinish: () => setBusy(false),
        });
    }
    function decline() {
        if (! confirm('Return this job to the marketplace?')) return;
        setBusy(true);
        router.post(`/contractor/requests/${req.id}/decline`, {}, {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onFinish: () => setBusy(false),
        });
    }
    function schedule() {
        if (! confirm('Schedule this job? It will move to "In Progress" on your Jobs board.')) return;
        setBusy(true);
        router.post(`/contractor/requests/${req.id}/accept`, {}, {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onFinish: () => setBusy(false),
        });
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-white rounded-xl shadow-lift max-w-3xl w-full p-6 max-h-[92vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                req.urgency === 'emergency' ? 'bg-danger text-white' :
                                req.urgency === 'high'      ? 'bg-warning/15 text-warning' :
                                req.urgency === 'medium'    ? 'bg-amber-50 text-amber-700' :
                                'bg-ink-100 text-ink-600'
                            }`}>{req.urgency}</span>
                            <span className="text-[10px] text-ink-500 uppercase font-semibold">{req.category}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STAGE_BADGE[req.stage].cls}`}>
                                {STAGE_BADGE[req.stage].label}
                            </span>
                        </div>
                        <h2 className="text-lg font-bold">{req.title}</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">Logged {req.created}</p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="text-ink-400 hover:text-ink-900 text-2xl leading-none -mt-1 -mr-1 p-1"
                        aria-label="Close">×</button>
                </div>

                {view === 'details' ? (
                    <>
                        {/* Description */}
                        {req.description && (
                            <div className="mb-4 p-3 bg-ink-50 rounded-lg border border-ink-100 text-[13px] text-ink-700 whitespace-pre-line">
                                {req.description}
                            </div>
                        )}

                        {/* Meta grid */}
                        <div className="grid grid-cols-2 gap-3 mb-4 text-[12px]">
                            <Meta label="Property" value={req.property_title ?? req.property} sub={req.address} />
                            <Meta label="Tenant" value={req.tenant} sub={req.tenant_email} />
                            <Meta label="Preferred date" value={req.preferred ?? 'No preference'} sub={req.time_slot} />
                            <Meta label="Tenant phone" value={req.tenant_phone ?? '—'} />
                        </div>

                        {/* Photos */}
                        <div className="mb-4">
                            <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold mb-2">
                                Photos ({req.photo_count})
                            </p>
                            {req.photos.length === 0 ? (
                                <p className="text-[12px] text-ink-500 bg-ink-50 border border-dashed border-ink-200 rounded-lg p-4 text-center">
                                    The tenant didn't attach any photos.
                                </p>
                            ) : (
                                <div className="grid grid-cols-3 gap-2">
                                    {req.photos.map((src, i) => (
                                        <button
                                            type="button"
                                            key={i}
                                            onClick={() => setLightbox(src)}
                                            className="aspect-square bg-ink-100 rounded-lg overflow-hidden border border-ink-200 hover:opacity-90 transition"
                                        >
                                            <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Existing quote summary */}
                        {req.my_quote && (
                            <div className={`rounded-lg p-3 mb-4 border ${
                                req.my_quote.status === 'accepted' ? 'bg-success/10 border-success/30' :
                                req.my_quote.status === 'rejected' ? 'bg-danger/10 border-danger/30' :
                                'bg-amber-50/60 border-amber-200'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[12px] font-bold">{req.my_quote.reference} · {req.my_quote.status.toUpperCase()}</p>
                                        <p className="text-[11px] text-ink-500">
                                            Sent {req.my_quote.sent_at} · Expires {req.my_quote.expires_at}
                                        </p>
                                    </div>
                                    <p className="text-[16px] font-mono font-bold">{fmtMoney(req.my_quote.total)}</p>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 justify-end pt-4 border-t border-ink-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100"
                            >
                                Close
                            </button>

                            {req.stage === 'marketplace' && (
                                <button
                                    type="button"
                                    onClick={claim}
                                    disabled={busy}
                                    className="px-4 py-2 text-[13px] bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-60 font-semibold"
                                >
                                    {busy ? 'Claiming…' : 'Claim job'}
                                </button>
                            )}

                            {req.stage === 'needs_quote' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={decline}
                                        disabled={busy}
                                        className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 disabled:opacity-60"
                                    >
                                        Decline
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setView('quote')}
                                        disabled={busy}
                                        className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 disabled:opacity-60 font-semibold"
                                    >
                                        Submit quote →
                                    </button>
                                </>
                            )}

                            {req.stage === 'awaiting_approval' && (
                                <div className="flex-1 text-[12px] text-ink-500 text-right pr-2 pt-2">
                                    Waiting on the agency to approve {req.my_quote?.reference}. We'll notify you.
                                </div>
                            )}

                            {req.stage === 'quote_accepted' && (
                                <button
                                    type="button"
                                    onClick={schedule}
                                    disabled={busy}
                                    className="px-4 py-2 text-[13px] bg-success text-white rounded-lg hover:bg-success/90 disabled:opacity-60 font-semibold"
                                >
                                    {busy ? 'Scheduling…' : 'Schedule job'}
                                </button>
                            )}

                            {req.stage === 'quote_rejected' && (
                                <button
                                    type="button"
                                    onClick={() => setView('quote')}
                                    disabled={busy}
                                    className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 disabled:opacity-60 font-semibold"
                                >
                                    Re-submit quote →
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <QuoteForm
                        requestId={req.id}
                        vatRegistered={vatRegistered}
                        vatRate={vatRate}
                        onBack={() => setView('details')}
                        onSuccess={() => onClose()}
                    />
                )}
            </div>

            {/* Photo lightbox */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/90 p-4"
                    onClick={() => setLightbox(null)}
                >
                    <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg" />
                </div>
            )}
        </div>
    );
}

function Meta({ label, value, sub }: { label: string; value: string | null; sub?: string | null }) {
    return (
        <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">{label}</p>
            <p className="font-semibold mt-0.5">{value ?? '—'}</p>
            {sub && <p className="text-[11px] text-ink-500">{sub}</p>}
        </div>
    );
}

function QuoteForm({
    requestId,
    vatRegistered,
    vatRate,
    onBack,
    onSuccess,
}: {
    requestId: number;
    vatRegistered: boolean;
    vatRate: number;
    onBack: () => void;
    onSuccess: () => void;
}) {
    const [lines, setLines] = useState<Line[]>([{ label: '', qty: '1', unit_price: '' }]);
    const [notes, setNotes] = useState('');
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const { subtotal, vatAmount, total } = useMemo(() => {
        const sub = lines.reduce((acc, l) => {
            const q = parseFloat(l.qty) || 0;
            const p = parseFloat(l.unit_price) || 0;
            return acc + q * p;
        }, 0);
        const vat = vatRegistered ? +(sub * (vatRate / 100)).toFixed(2) : 0;
        return { subtotal: +sub.toFixed(2), vatAmount: vat, total: +(sub + vat).toFixed(2) };
    }, [lines, vatRegistered, vatRate]);

    const canSubmit = lines.every((l) =>
        l.label.trim() !== '' && Number(l.qty) > 0 && Number(l.unit_price) >= 0,
    );

    function updateLine(i: number, patch: Partial<Line>) {
        setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
    }
    function addLine() {
        setLines((ls) => [...ls, { label: '', qty: '1', unit_price: '' }]);
    }
    function removeLine(i: number) {
        setLines((ls) => ls.filter((_, idx) => idx !== i));
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        setProcessing(true);
        router.post('/contractor/quotes', {
            maintenance_request_id: requestId,
            status: 'sent',
            notes: notes || null,
            line_items: lines.map((l) => ({
                label:      l.label,
                qty:        Number(l.qty) || 0,
                unit_price: Number(l.unit_price) || 0,
            })),
        } as never, {
            preserveScroll: true,
            onSuccess: () => onSuccess(),
            onError:   (errs) => setErrors(errs as Record<string, string>),
            onFinish:  () => setProcessing(false),
        });
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            <button type="button" onClick={onBack} className="text-[12px] text-ink-500 hover:text-ink-900">
                ← Back to job details
            </button>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[12px] font-semibold text-ink-700">Line items ({lines.length})</p>
                    <button type="button" onClick={addLine} className="text-[12px] text-brand-600 hover:text-brand-700 font-semibold">+ Add line</button>
                </div>
                <div className="space-y-2">
                    {lines.map((line, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-start">
                            <div className="col-span-6">
                                <input
                                    value={line.label}
                                    onChange={(e) => updateLine(i, { label: e.target.value })}
                                    placeholder="Description" required className={inputCls}
                                />
                            </div>
                            <div className="col-span-2">
                                <input type="number" step="0.01" min="0.01" value={line.qty}
                                    onChange={(e) => updateLine(i, { qty: e.target.value })}
                                    placeholder="Qty" required
                                    className={inputCls + ' text-right font-mono'} />
                            </div>
                            <div className="col-span-3">
                                <input type="number" step="0.01" min="0" value={line.unit_price}
                                    onChange={(e) => updateLine(i, { unit_price: e.target.value })}
                                    placeholder="Unit price (R)" required
                                    className={inputCls + ' text-right font-mono'} />
                            </div>
                            <div className="col-span-1 pt-2 text-right">
                                {lines.length > 1 && (
                                    <button type="button" onClick={() => removeLine(i)} className="text-ink-400 hover:text-danger p-1">×</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-ink-50 rounded-lg p-3">
                <div className="flex justify-between text-[12px]">
                    <span className="text-ink-500">Subtotal</span>
                    <span className="font-mono">{fmtMoney(subtotal)}</span>
                </div>
                {vatRegistered && (
                    <div className="flex justify-between text-[12px] mt-0.5">
                        <span className="text-ink-500">VAT ({vatRate}%)</span>
                        <span className="font-mono">{fmtMoney(vatAmount)}</span>
                    </div>
                )}
                <div className="flex justify-between text-[14px] font-bold mt-1 pt-1 border-t border-ink-200">
                    <span>Quote total</span>
                    <span className="font-mono">{fmtMoney(total)}</span>
                </div>
            </div>

            <div>
                <p className="text-[12px] font-semibold text-ink-700 mb-1.5">Notes (optional)</p>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                    placeholder="Exclusions, materials, timing…"
                    className={inputCls + ' resize-none'} />
            </div>

            <p className="text-[11px] text-ink-500">
                Submitting will send the quote for agency approval. You can only schedule the job once they accept it.
            </p>

            <div className="flex justify-end gap-2">
                <button type="button" onClick={onBack} className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100">
                    Cancel
                </button>
                <button type="submit" disabled={! canSubmit || processing}
                    className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 font-semibold">
                    {processing && <Spinner size={13} />}
                    {processing ? 'Sending…' : 'Send quote'}
                </button>
            </div>

            {Object.keys(errors).length > 0 && (
                <div className="text-[11px] text-danger">
                    {Object.values(errors).join(' · ')}
                </div>
            )}
        </form>
    );
}
