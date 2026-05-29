/**
 * NewQuoteModal — opens from the Quotes page "New Quote" button.
 * Picks an assigned job, adds line items, and posts to POST /contractor/quotes.
 * Subtotal + VAT + total update live; submit-as-draft is also supported.
 */
import { FormEvent, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';

export type QuotableJob = {
    id: number;
    title: string;
    property: string;
    tenant: string;
    status: string;
    urgency: string | null;
    has_quote: boolean;
};

type Props = {
    jobs: QuotableJob[];
    vatRegistered: boolean;
    vatRate: number;
    onClose: () => void;
};

type Line = { label: string; qty: string; unit_price: string };

const inputCls = 'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';
const labelCls = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

function fmtMoney(n: number) {
    return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function plusDaysIso(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function NewQuoteModal({ jobs, vatRegistered, vatRate, onClose }: Props) {
    const [jobId, setJobId]         = useState('');
    const [lines, setLines]         = useState<Line[]>([{ label: '', qty: '1', unit_price: '' }]);
    const [notes, setNotes]         = useState('');
    const [validUntil, setValidUntil] = useState(plusDaysIso(14));
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors]       = useState<Record<string, string>>({});

    const { subtotal, vatAmount, total } = useMemo(() => {
        const sub = lines.reduce((acc, l) => {
            const q = parseFloat(l.qty) || 0;
            const p = parseFloat(l.unit_price) || 0;
            return acc + q * p;
        }, 0);
        const vat = vatRegistered ? +(sub * (vatRate / 100)).toFixed(2) : 0;
        return { subtotal: +sub.toFixed(2), vatAmount: vat, total: +(sub + vat).toFixed(2) };
    }, [lines, vatRegistered, vatRate]);

    function updateLine(i: number, patch: Partial<Line>) {
        setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
    }
    function addLine() {
        setLines((ls) => [...ls, { label: '', qty: '1', unit_price: '' }]);
    }
    function removeLine(i: number) {
        setLines((ls) => ls.filter((_, idx) => idx !== i));
    }

    function submit(e: FormEvent, status: 'draft' | 'sent') {
        e.preventDefault();
        if (! jobId) return;
        const payload = {
            maintenance_request_id: Number(jobId),
            status,
            valid_until: validUntil || null,
            notes: notes || null,
            line_items: lines
                .filter((l) => l.label.trim() !== '' || l.unit_price !== '')
                .map((l) => ({
                    label:      l.label,
                    qty:        Number(l.qty) || 0,
                    unit_price: Number(l.unit_price) || 0,
                })),
        };
        setProcessing(true);
        router.post('/contractor/quotes', payload as never, {
            onSuccess: () => onClose(),
            onError:   (errs) => setErrors(errs as Record<string, string>),
            onFinish:  () => setProcessing(false),
        });
    }

    const canSubmit = !! jobId
        && lines.length > 0
        && lines.every((l) => l.label.trim() !== '' && Number(l.qty) > 0 && Number(l.unit_price) >= 0);

    const selectedJob = jobs.find((j) => String(j.id) === jobId);
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
                        <h2 className="text-lg font-bold">New quote</h2>
                        <p className="text-[13px] text-ink-500 mt-1">
                            Quote one of your active jobs. Subtotal + {vatRegistered ? 'VAT' : 'no VAT'} are calculated automatically.
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="text-ink-400 hover:text-ink-900 text-2xl leading-none -mt-1 -mr-1 p-1"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {noJobs ? (
                    <div className="bg-ink-50 border border-ink-200 rounded-lg p-5 text-[13px] text-ink-600">
                        <p className="font-semibold">No jobs to quote on</p>
                        <p className="text-[12px] mt-1">You haven't been assigned any maintenance jobs in an active state yet.</p>
                    </div>
                ) : (
                    <form className="space-y-4" onSubmit={(e) => submit(e, 'sent')}>
                        {/* Job picker */}
                        <div>
                            <label className={labelCls}>Job *</label>
                            <select
                                value={jobId}
                                onChange={(e) => setJobId(e.target.value)}
                                required
                                className={inputCls}
                            >
                                <option value="">Select an assigned job…</option>
                                {jobs.map((j) => (
                                    <option key={j.id} value={j.id} disabled={j.has_quote}>
                                        {j.title} · {j.property}{j.has_quote ? ' (quoted)' : ''}
                                    </option>
                                ))}
                            </select>
                            {errors.maintenance_request_id && <p className="text-[11px] text-danger mt-1">{errors.maintenance_request_id}</p>}
                            {selectedJob && (
                                <p className="text-[11px] text-ink-500 mt-1">
                                    Tenant: {selectedJob.tenant} · Status: {selectedJob.status}
                                    {selectedJob.urgency && ` · ${selectedJob.urgency}`}
                                </p>
                            )}
                        </div>

                        {/* Line items */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className={labelCls + ' mb-0'}>Line items ({lines.length})</label>
                                <button type="button" onClick={addLine} className="text-[12px] text-brand-600 hover:text-brand-700 font-semibold">
                                    + Add line
                                </button>
                            </div>
                            <div className="space-y-2">
                                {lines.map((line, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-2 items-start">
                                        <div className="col-span-6">
                                            <input
                                                value={line.label}
                                                onChange={(e) => updateLine(i, { label: e.target.value })}
                                                placeholder="Description"
                                                required
                                                className={inputCls}
                                            />
                                            {errors[`line_items.${i}.label`] && <p className="text-[11px] text-danger mt-0.5">{errors[`line_items.${i}.label`]}</p>}
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                value={line.qty}
                                                onChange={(e) => updateLine(i, { qty: e.target.value })}
                                                placeholder="Qty"
                                                required
                                                className={inputCls + ' text-right font-mono'}
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={line.unit_price}
                                                onChange={(e) => updateLine(i, { unit_price: e.target.value })}
                                                placeholder="Unit price (R)"
                                                required
                                                className={inputCls + ' text-right font-mono'}
                                            />
                                        </div>
                                        <div className="col-span-1 pt-2 text-right">
                                            {lines.length > 1 && (
                                                <button type="button" onClick={() => removeLine(i)}
                                                    className="text-ink-400 hover:text-danger p-1" aria-label="Remove line">
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Valid until</label>
                                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
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
                                    <span>Total</span>
                                    <span className="font-mono">{fmtMoney(total)}</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Notes (optional)</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Anything the client should know — exclusions, timing, materials…"
                                className={inputCls + ' resize-none'}
                            />
                        </div>

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
                                {processing ? 'Sending…' : 'Send quote'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
