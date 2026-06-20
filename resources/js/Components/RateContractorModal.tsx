import { useState } from 'react';
import { router } from '@inertiajs/react';

/**
 * Star-rating modal for a completed maintenance job. Posts to
 * `${rateUrl}` ({ rating, comment }). Used by the tenant Maintenance page
 * and the agency MaintenanceBoard.
 */

type Props = {
    rateUrl: string;
    contractorName: string | null;
    jobTitle: string;
    onClose: () => void;
};

export default function RateContractorModal({ rateUrl, contractorName, jobTitle, onClose }: Props) {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState('');
    const [busy, setBusy] = useState(false);

    const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

    function submit() {
        if (rating === 0) return;
        setBusy(true);
        router.post(rateUrl, { rating, comment }, {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onFinish: () => setBusy(false),
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-card w-full max-w-md p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-[17px] font-bold">Rate the contractor</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">
                            {contractorName ?? 'Contractor'} · {jobTitle}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-ink-400 hover:text-ink-700 text-xl leading-none">×</button>
                </div>

                <div className="mt-5 flex flex-col items-center">
                    <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setRating(n)}
                                onMouseEnter={() => setHover(n)}
                                onMouseLeave={() => setHover(0)}
                                className="text-[32px] leading-none transition-transform hover:scale-110"
                                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                            >
                                <span className={(hover || rating) >= n ? 'text-warning' : 'text-ink-200'}>★</span>
                            </button>
                        ))}
                    </div>
                    <p className="text-[12px] text-ink-500 mt-1.5 h-4">
                        {LABELS[hover || rating]}
                    </p>
                </div>

                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="How was the workmanship, communication, and punctuality? (optional)"
                    className="mt-3 w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition resize-none"
                />

                <div className="mt-4 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 font-semibold">
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={busy || rating === 0}
                        className="px-5 py-2 text-[13px] bg-ink-900 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg font-semibold"
                    >
                        {busy ? 'Submitting…' : 'Submit rating'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Static star row for an already-submitted rating. */
export function StarRow({ rating }: { rating: number }) {
    return (
        <span className="inline-flex items-center gap-0.5 text-[14px] leading-none" title={`${rating}/5`}>
            {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={rating >= n ? 'text-warning' : 'text-ink-200'}>★</span>
            ))}
        </span>
    );
}
