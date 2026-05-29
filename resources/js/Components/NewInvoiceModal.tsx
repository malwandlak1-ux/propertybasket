/**
 * NewInvoiceModal — opens from the Invoices page "New Invoice" button.
 *
 * Two modes, picked automatically from the selected job:
 *
 *  1. **Quoted job** — the original quote's line items render as a locked
 *     baseline (read-only). The contractor can add explicit "deviation items"
 *     for anything beyond what was quoted (extra parts, scope creep, etc.).
 *     The server computes the signed deviation against the quote and requires
 *     a note when totals differ.
 *
 *  2. **Un-quoted job** — free-form line items (the contractor builds the
 *     invoice from scratch). No deviation handling.
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';

type QuoteLine = { label: string; qty: number; unit_price: number; line_total?: number };

export type InvoiceableJob = {
    id: number;
    title: string;
    property: string;
    tenant: string;
    status: string;
    has_invoice: boolean;
    quote: {
        id: number;
        reference: string;
        status: string;
        subtotal: number;
        vat: number;
        total: number;
        line_items: QuoteLine[];
    } | null;
};

type Props = {
    jobs: InvoiceableJob[];
    vatRegistered: boolean;
    vatRate: number;
    onClose: () => void;
};

type EditableLine = { label: string; qty: string; unit_price: string };

const inputCls = 'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';
const labelCls = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

function fmtMoney(n: number) {
    return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function editableSubtotal(line: EditableLine): number {
    const q = parseFloat(line.qty) || 0;
    const p = parseFloat(line.unit_price) || 0;
    return q * p;
}

function quoteLineSubtotal(line: QuoteLine): number {
    return line.line_total ?? line.qty * line.unit_price;
}

export default function NewInvoiceModal({ jobs, vatRegistered, vatRate, onClose }: Props) {
    const [jobId, setJobId]               = useState('');
    const [freeformLines, setFreeformLines] = useState<EditableLine[]>([{ label: '', qty: '1', unit_price: '' }]);
    const [deviationLines, setDeviationLines] = useState<EditableLine[]>([]);
    const [deviationNotes, setNotes]      = useState('');
    const [processing, setProcessing]     = useState(false);
    const [errors, setErrors]             = useState<Record<string, string>>({});

    const selectedJob = jobs.find((j) => String(j.id) === jobId) ?? null;
    const quote       = selectedJob?.quote ?? null;

    // Selecting a new job → reset state appropriately
    useEffect(() => {
        if (! selectedJob) return;
        setDeviationLines([]);
        setNotes('');
        if (! selectedJob.quote) {
            setFreeformLines([{ label: '', qty: '1', unit_price: '' }]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobId]);

    // ── Totals ───────────────────────────────────────────────────────────
    const quoteSubtotal = quote
        ? quote.line_items.reduce((acc, l) => acc + quoteLineSubtotal(l), 0)
        : 0;

    const deviationSubtotal = deviationLines.reduce((acc, l) => acc + editableSubtotal(l), 0);

    const freeformSubtotal = freeformLines.reduce((acc, l) => acc + editableSubtotal(l), 0);

    const { subtotal, vatAmount, total, deviation, deviationPct } = useMemo(() => {
        const sub = quote ? quoteSubtotal + deviationSubtotal : freeformSubtotal;
        const vat = vatRegistered ? +(sub * (vatRate / 100)).toFixed(2) : 0;
        const tot = +(sub + vat).toFixed(2);
        const dev = quote ? +(tot - quote.total).toFixed(2) : 0;
        const pct = quote && quote.total > 0 ? +((dev / quote.total) * 100).toFixed(1) : 0;
        return { subtotal: +sub.toFixed(2), vatAmount: vat, total: tot, deviation: dev, deviationPct: pct };
    }, [quote, quoteSubtotal, deviationSubtotal, freeformSubtotal, vatRegistered, vatRate]);

    const hasDeviation = quote ? Math.abs(deviation) > 0.01 : false;

    // ── Line operations ──────────────────────────────────────────────────
    function updateDeviation(i: number, patch: Partial<EditableLine>) {
        setDeviationLines((ls) => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
    }
    function addDeviation() {
        setDeviationLines((ls) => [...ls, { label: '', qty: '1', unit_price: '' }]);
    }
    function removeDeviation(i: number) {
        setDeviationLines((ls) => ls.filter((_, idx) => idx !== i));
    }

    function updateFreeform(i: number, patch: Partial<EditableLine>) {
        setFreeformLines((ls) => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
    }
    function addFreeform() {
        setFreeformLines((ls) => [...ls, { label: '', qty: '1', unit_price: '' }]);
    }
    function removeFreeform(i: number) {
        setFreeformLines((ls) => ls.filter((_, idx) => idx !== i));
    }

    // ── Submit ───────────────────────────────────────────────────────────
    function submit(e: FormEvent, status: 'draft' | 'submitted') {
        e.preventDefault();
        if (! jobId) return;

        const allLines = quote
            ? [
                ...quote.line_items.map((l) => ({
                    label:      l.label,
                    qty:        l.qty,
                    unit_price: l.unit_price,
                })),
                ...deviationLines
                    .filter((l) => l.label.trim() !== '' || l.unit_price !== '')
                    .map((l) => ({
                        label:      l.label,
                        qty:        Number(l.qty) || 0,
                        unit_price: Number(l.unit_price) || 0,
                    })),
            ]
            : freeformLines
                .filter((l) => l.label.trim() !== '' || l.unit_price !== '')
                .map((l) => ({
                    label:      l.label,
                    qty:        Number(l.qty) || 0,
                    unit_price: Number(l.unit_price) || 0,
                }));

        const payload = {
            maintenance_request_id: Number(jobId),
            status,
            deviation_notes: deviationNotes || null,
            line_items: allLines,
        };

        setProcessing(true);
        router.post('/contractor/invoices', payload as never, {
            onSuccess: () => onClose(),
            onError:   (errs) => setErrors(errs as Record<string, string>),
            onFinish:  () => setProcessing(false),
        });
    }

    // ── Submit gate ──────────────────────────────────────────────────────
    const validFreeform = !! quote || freeformLines.every((l) =>
        l.label.trim() !== '' && Number(l.qty) > 0 && Number(l.unit_price) >= 0,
    );
    const validDeviationLines = deviationLines.every((l) =>
        l.label.trim() !== '' && Number(l.qty) > 0 && Number(l.unit_price) >= 0,
    );

    const canSubmit = !! jobId
        && (quote ? validDeviationLines : validFreeform)
        && (! hasDeviation || deviationNotes.trim().length > 0);

    const noJobs = jobs.length === 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-white rounded-xl shadow-lift max-w-2xl w-full p-6 max-h-[92vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-bold">New invoice</h2>
                        <p className="text-[13px] text-ink-500 mt-1">
                            Pick a completed job. If it was quoted, the quoted amount is locked in; add deviation items for anything extra.
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="text-ink-400 hover:text-ink-900 text-2xl leading-none -mt-1 -mr-1 p-1"
                        aria-label="Close">
                        ×
                    </button>
                </div>

                {noJobs ? (
                    <div className="bg-ink-50 border border-ink-200 rounded-lg p-5 text-[13px] text-ink-600">
                        <p className="font-semibold">No jobs to invoice</p>
                        <p className="text-[12px] mt-1">Complete a job (or mark it in-progress) and you'll be able to invoice it here.</p>
                    </div>
                ) : (
                    <form className="space-y-4" onSubmit={(e) => submit(e, 'submitted')}>
                        {/* Job picker */}
                        <div>
                            <label className={labelCls}>Job *</label>
                            <select
                                value={jobId}
                                onChange={(e) => setJobId(e.target.value)}
                                required
                                className={inputCls}
                            >
                                <option value="">Select a completed / active job…</option>
                                {jobs.map((j) => (
                                    <option key={j.id} value={j.id} disabled={j.has_invoice}>
                                        {j.title} · {j.property}{j.has_invoice ? ' (invoiced)' : ''}
                                    </option>
                                ))}
                            </select>
                            {errors.maintenance_request_id && <p className="text-[11px] text-danger mt-1">{errors.maintenance_request_id}</p>}
                            {selectedJob && (
                                <p className="text-[11px] text-ink-500 mt-1">
                                    Tenant: {selectedJob.tenant} · Status: {selectedJob.status}
                                </p>
                            )}
                        </div>

                        {/* Quoted job → locked baseline */}
                        {quote && (
                            <div className="bg-brand-50/40 border border-brand-100 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <p className="text-[12px] font-bold text-brand-700">Quoted on {quote.reference}</p>
                                        <p className="text-[11px] text-ink-500">Locked at the originally agreed amount.</p>
                                    </div>
                                    <span className="text-[14px] font-mono font-bold">{fmtMoney(quote.total)}</span>
                                </div>
                                <div className="space-y-1.5">
                                    {quote.line_items.map((line, i) => (
                                        <div key={i} className="grid grid-cols-12 gap-2 text-[12px]">
                                            <div className="col-span-7 text-ink-700">{line.label}</div>
                                            <div className="col-span-2 text-right font-mono text-ink-500">× {line.qty}</div>
                                            <div className="col-span-3 text-right font-mono">{fmtMoney(quoteLineSubtotal(line))}</div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-ink-500 mt-2">
                                    These items can't be edited — they're what the agency / landlord already approved on the quote.
                                </p>
                            </div>
                        )}

                        {/* Deviation items (only when quoted) */}
                        {quote && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <label className={labelCls + ' mb-0'}>Deviation items ({deviationLines.length})</label>
                                        <p className="text-[11px] text-ink-500">Add anything beyond the quote — extra parts, scope creep, additional labour.</p>
                                    </div>
                                    <button type="button" onClick={addDeviation} className="text-[12px] text-brand-600 hover:text-brand-700 font-semibold whitespace-nowrap">
                                        + Add deviation
                                    </button>
                                </div>
                                {deviationLines.length === 0 ? (
                                    <p className="text-[12px] text-ink-500 bg-ink-50 border border-dashed border-ink-200 rounded-lg p-3 text-center">
                                        No deviations — invoice will match the quote exactly.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {deviationLines.map((line, i) => (
                                            <div key={i} className="grid grid-cols-12 gap-2 items-start">
                                                <div className="col-span-6">
                                                    <input
                                                        value={line.label}
                                                        onChange={(e) => updateDeviation(i, { label: e.target.value })}
                                                        placeholder="Description" required
                                                        className={inputCls}
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <input
                                                        type="number" step="0.01" min="0.01"
                                                        value={line.qty}
                                                        onChange={(e) => updateDeviation(i, { qty: e.target.value })}
                                                        placeholder="Qty" required
                                                        className={inputCls + ' text-right font-mono'}
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <input
                                                        type="number" step="0.01" min="0"
                                                        value={line.unit_price}
                                                        onChange={(e) => updateDeviation(i, { unit_price: e.target.value })}
                                                        placeholder="Unit price (R)" required
                                                        className={inputCls + ' text-right font-mono'}
                                                    />
                                                </div>
                                                <div className="col-span-1 pt-2 text-right">
                                                    <button type="button" onClick={() => removeDeviation(i)}
                                                        className="text-ink-400 hover:text-danger p-1" aria-label="Remove deviation">×</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Free-form line items (only when no quote) */}
                        {! quote && selectedJob && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <label className={labelCls + ' mb-0'}>Line items ({freeformLines.length})</label>
                                        <p className="text-[11px] text-ink-500">No quote on this job — build the invoice from scratch.</p>
                                    </div>
                                    <button type="button" onClick={addFreeform} className="text-[12px] text-brand-600 hover:text-brand-700 font-semibold whitespace-nowrap">
                                        + Add line
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {freeformLines.map((line, i) => (
                                        <div key={i} className="grid grid-cols-12 gap-2 items-start">
                                            <div className="col-span-6">
                                                <input
                                                    value={line.label}
                                                    onChange={(e) => updateFreeform(i, { label: e.target.value })}
                                                    placeholder="Description" required
                                                    className={inputCls}
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="number" step="0.01" min="0.01"
                                                    value={line.qty}
                                                    onChange={(e) => updateFreeform(i, { qty: e.target.value })}
                                                    placeholder="Qty" required
                                                    className={inputCls + ' text-right font-mono'}
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input
                                                    type="number" step="0.01" min="0"
                                                    value={line.unit_price}
                                                    onChange={(e) => updateFreeform(i, { unit_price: e.target.value })}
                                                    placeholder="Unit price (R)" required
                                                    className={inputCls + ' text-right font-mono'}
                                                />
                                            </div>
                                            <div className="col-span-1 pt-2 text-right">
                                                {freeformLines.length > 1 && (
                                                    <button type="button" onClick={() => removeFreeform(i)}
                                                        className="text-ink-400 hover:text-danger p-1" aria-label="Remove line">×</button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Totals — only when a job is selected */}
                        {selectedJob && (
                            <div className={`rounded-lg p-3 border ${hasDeviation ? 'bg-warning/10 border-warning/30' : 'bg-ink-50 border-ink-200'}`}>
                                {quote && (
                                    <>
                                        <div className="flex justify-between text-[12px]">
                                            <span className="text-ink-500">Quoted (excl. VAT)</span>
                                            <span className="font-mono">{fmtMoney(quoteSubtotal)}</span>
                                        </div>
                                        {deviationLines.length > 0 && (
                                            <div className="flex justify-between text-[12px] mt-0.5">
                                                <span className="text-ink-500">Deviations (excl. VAT)</span>
                                                <span className="font-mono">{fmtMoney(deviationSubtotal)}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                                <div className="flex justify-between text-[12px] mt-0.5">
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
                                    <span>Invoice total</span>
                                    <span className="font-mono">{fmtMoney(total)}</span>
                                </div>

                                {quote && (
                                    <div className="mt-2 pt-2 border-t border-ink-200 space-y-0.5 text-[11px]">
                                        <div className="flex justify-between text-ink-500">
                                            <span>Original quote total</span>
                                            <span className="font-mono">{fmtMoney(quote.total)}</span>
                                        </div>
                                        {hasDeviation ? (
                                            <div className={`flex justify-between font-bold ${deviation > 0 ? 'text-danger' : 'text-success'}`}>
                                                <span>{deviation > 0 ? 'Over quote' : 'Under quote'}</span>
                                                <span className="font-mono">
                                                    {deviation > 0 ? '+' : ''}{fmtMoney(deviation)} ({deviation > 0 ? '+' : ''}{deviationPct}%)
                                                </span>
                                            </div>
                                        ) : (
                                            <p className="text-success font-semibold">Matches quote exactly.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Deviation notes — only when there's a quote */}
                        {quote && (
                            <div>
                                <label className={labelCls}>
                                    Deviation notes {hasDeviation ? '*' : '(optional)'}
                                </label>
                                <textarea
                                    value={deviationNotes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={3}
                                    placeholder={hasDeviation
                                        ? 'Explain each deviation item — stripped thread, extra travel, additional materials…'
                                        : 'Anything the agency or landlord should know.'}
                                    required={hasDeviation}
                                    className={inputCls + ' resize-none'}
                                />
                                {errors.deviation_notes && <p className="text-[11px] text-danger mt-1">{errors.deviation_notes}</p>}
                                {hasDeviation && ! deviationNotes && (
                                    <p className="text-[11px] text-warning mt-1">A note is required when the invoice differs from the quote.</p>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={! canSubmit || processing}
                                onClick={(e) => submit(e, 'draft')}
                                className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
                            >
                                Save as draft
                            </button>
                            <button
                                type="submit"
                                disabled={! canSubmit || processing}
                                className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 font-semibold transition"
                            >
                                {processing && <Spinner size={13} />}
                                {processing ? 'Submitting…' : 'Submit invoice'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
