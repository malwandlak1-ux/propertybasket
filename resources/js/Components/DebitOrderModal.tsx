/**
 * DebitOrderModal — opens from the Tenant Overview "Set up debit order" button.
 * Captures bank details + monthly debit day. Submitting any new mandate
 * automatically supersedes the existing active one.
 */
import { FormEvent, useState } from 'react';
import { router } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';

type Existing = {
    bank_name: string;
    account_holder: string;
    account_number_masked: string;
    branch_code: string;
    account_type: 'cheque' | 'current' | 'savings';
    debit_day: number;
    signed_at: string | null;
} | null;

type Props = {
    /** Currently-active mandate, if any. Used to render a status card + "Cancel" button. */
    existing: Existing;
    /** Tenant name — pre-fills account holder for new mandates. */
    tenantName: string;
    onClose: () => void;
};

const SA_BANKS = [
    'ABSA Bank',
    'Capitec Bank',
    'Discovery Bank',
    'First National Bank (FNB)',
    'Investec',
    'Nedbank',
    'Standard Bank',
    'TymeBank',
    'African Bank',
    'Bidvest Bank',
];

const inputCls = 'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';
const labelCls = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

export default function DebitOrderModal({ existing, tenantName, onClose }: Props) {
    const [data, setData] = useState({
        bank_name:      '',
        account_holder: tenantName,
        account_number: '',
        branch_code:    '',
        account_type:   'cheque' as 'cheque' | 'current' | 'savings',
        debit_day:      1,
    });
    const [errors, setErrors]         = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    function set<K extends keyof typeof data>(key: K, value: (typeof data)[K]) {
        setData((d) => ({ ...d, [key]: value }));
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        setProcessing(true);
        router.post('/tenant/debit-order', data, {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onError:   (errs) => setErrors(errs as Record<string, string>),
            onFinish:  () => setProcessing(false),
        });
    }

    function cancelExisting() {
        if (! confirm('Cancel your active debit order? You can set up a new one any time.')) return;
        setCancelling(true);
        router.post('/tenant/debit-order/cancel', {}, {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onFinish:  () => setCancelling(false),
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
                className="bg-white rounded-xl shadow-lift max-w-lg w-full p-6 max-h-[92vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-bold">{existing ? 'Update debit order' : 'Set up debit order'}</h2>
                        <p className="text-[13px] text-ink-500 mt-1">
                            Authorise us to debit your bank account for rent each month. You can cancel any time.
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

                {/* Existing mandate summary */}
                {existing && (
                    <div className="bg-success/10 border border-success/30 rounded-lg p-4 mb-4 text-[13px]">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-bold text-success">Active mandate</p>
                                <p className="text-ink-700 mt-1">
                                    {existing.bank_name} · {existing.account_number_masked} · {existing.account_type}
                                </p>
                                <p className="text-ink-500 text-[12px] mt-0.5">
                                    Holder: {existing.account_holder} · Debits day {existing.debit_day} each month
                                </p>
                                {existing.signed_at && (
                                    <p className="text-ink-400 text-[11px] mt-1">Signed {existing.signed_at}</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={cancelExisting}
                                disabled={cancelling}
                                className="px-3 py-1.5 text-[11px] border border-danger/40 text-danger rounded-md hover:bg-danger/10 disabled:opacity-50 font-semibold whitespace-nowrap"
                            >
                                {cancelling ? 'Cancelling…' : 'Cancel mandate'}
                            </button>
                        </div>
                    </div>
                )}

                <form onSubmit={submit} className="space-y-4">
                    <p className="text-[12px] text-ink-500">
                        {existing
                            ? 'Submitting below will replace the current mandate.'
                            : 'Capture the bank account you want us to debit.'}
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Bank *</label>
                            <select value={data.bank_name} onChange={(e) => set('bank_name', e.target.value)} required className={inputCls}>
                                <option value="">Select a bank…</option>
                                {SA_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                            </select>
                            {errors.bank_name && <p className="text-[11px] text-danger mt-1">{errors.bank_name}</p>}
                        </div>
                        <div>
                            <label className={labelCls}>Account type *</label>
                            <select value={data.account_type} onChange={(e) => set('account_type', e.target.value as typeof data.account_type)} required className={inputCls}>
                                <option value="cheque">Cheque</option>
                                <option value="current">Current</option>
                                <option value="savings">Savings</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Account holder *</label>
                        <input value={data.account_holder} onChange={(e) => set('account_holder', e.target.value)} required className={inputCls} />
                        {errors.account_holder && <p className="text-[11px] text-danger mt-1">{errors.account_holder}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Account number *</label>
                            <input
                                value={data.account_number}
                                onChange={(e) => set('account_number', e.target.value.replace(/\D/g, ''))}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="e.g. 6210 4123 456"
                                required
                                className={inputCls}
                            />
                            {errors.account_number && <p className="text-[11px] text-danger mt-1">{errors.account_number}</p>}
                        </div>
                        <div>
                            <label className={labelCls}>Branch code *</label>
                            <input
                                value={data.branch_code}
                                onChange={(e) => set('branch_code', e.target.value.replace(/\D/g, ''))}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="e.g. 250655"
                                required
                                className={inputCls}
                            />
                            {errors.branch_code && <p className="text-[11px] text-danger mt-1">{errors.branch_code}</p>}
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Debit day of month *</label>
                        <select
                            value={data.debit_day}
                            onChange={(e) => set('debit_day', Number(e.target.value))}
                            required
                            className={inputCls}
                        >
                            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                                <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of the month</option>
                            ))}
                        </select>
                        <p className="text-[11px] text-ink-500 mt-1">Capped at 28 so February doesn't skip a debit.</p>
                    </div>

                    <div className="bg-ink-50/60 border border-ink-200 rounded-lg p-3 text-[11px] text-ink-600 leading-relaxed">
                        By submitting you authorise Property Basket to debit your account on the chosen day each month for the
                        rent amount on your active lease. You may cancel this mandate at any time.
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing || ! data.bank_name || ! data.account_number || ! data.branch_code}
                            className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 font-semibold transition"
                        >
                            {processing && <Spinner size={13} />}
                            {processing ? 'Saving…' : existing ? 'Replace mandate' : 'Authorise debit order'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
