/**
 * NewLeadModal — opened from "New Lead" (Overview) or "Add Deal" (Pipeline).
 * Submits to POST /agent/pipeline/leads. Optionally pre-sets the pipeline column.
 */
import { FormEvent } from 'react';
import { useForm } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';

type Listing = { id: number; label: string; type: string };

type Props = {
    listings: Listing[];
    onClose: () => void;
    /** Pre-select a pipeline stage when called from a column's "+ Add deal" */
    initialStage?: 'new' | 'contacted' | 'qualified' | 'viewing' | 'offer';
};

const STAGE_OPTIONS = [
    { value: 'new',       label: 'New Lead' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'viewing',   label: 'Viewing' },
    { value: 'offer',     label: 'Offer' },
];

export default function NewLeadModal({ listings, onClose, initialStage = 'new' }: Props) {
    const { data, setData, post, processing, errors, reset } = useForm({
        listing_id:    '',
        name:          '',
        email:         '',
        phone:         '',
        message:       '',
        initial_stage: initialStage,
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agent/pipeline/leads', {
            onSuccess: () => {
                reset();
                onClose();
            },
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
                className="bg-white rounded-xl shadow-lift max-w-lg w-full p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-bold">Add a new lead</h2>
                        <p className="text-[13px] text-ink-500 mt-1">
                            Capture a prospect you spoke to off-platform.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-ink-400 hover:text-ink-900 text-2xl leading-none -mt-1 -mr-1 p-1"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Property of interest *</label>
                        <select
                            value={data.listing_id}
                            onChange={(e) => setData('listing_id', e.target.value)}
                            required
                            className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                        >
                            <option value="">Select a listing…</option>
                            {listings.map((l) => (
                                <option key={l.id} value={l.id}>{l.label}</option>
                            ))}
                        </select>
                        {errors.listing_id && <p className="text-[11px] text-danger mt-1">{errors.listing_id}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Full name *</label>
                            <input
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                required
                                placeholder="e.g. Tebogo Maseko"
                                className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            />
                            {errors.name && <p className="text-[11px] text-danger mt-1">{errors.name}</p>}
                        </div>
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Initial stage</label>
                            <select
                                value={data.initial_stage}
                                onChange={(e) => setData('initial_stage', e.target.value as typeof data.initial_stage)}
                                className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            >
                                {STAGE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Email *</label>
                            <input
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                required
                                placeholder="tebogo@example.com"
                                className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            />
                            {errors.email && <p className="text-[11px] text-danger mt-1">{errors.email}</p>}
                        </div>
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Phone</label>
                            <input
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
                                placeholder="+27 82 555 1234"
                                className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            />
                            {errors.phone && <p className="text-[11px] text-danger mt-1">{errors.phone}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Notes / message</label>
                        <textarea
                            value={data.message}
                            onChange={(e) => setData('message', e.target.value)}
                            placeholder="Anything they said you should remember (budget, timeline, requirements…)"
                            rows={3}
                            className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none"
                        />
                        {errors.message && <p className="text-[11px] text-danger mt-1">{errors.message}</p>}
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
                            type="submit"
                            disabled={processing || ! data.email || ! data.name || ! data.listing_id}
                            className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 font-semibold transition"
                        >
                            {processing && <Spinner size={13} />}
                            {processing ? 'Adding…' : 'Add to pipeline'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
