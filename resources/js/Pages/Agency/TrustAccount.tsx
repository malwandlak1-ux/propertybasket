import { FormEvent } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import { Spinner } from '@/Components/Skeleton';

type State = 'verified' | 'pending_review' | 'partial' | 'not_started';

type Props = {
    agency: { id: number; name: string };
    trust: {
        bank: string | null;
        account_number: string | null;
        branch_code: string | null;
        account_holder: string | null;
        account_type: 'cheque' | 'current' | 'savings' | null;
        auditor_name: string | null;
        auditor_practice_number: string | null;
        verified_at: string | null;
        state: State;
    };
    banks: string[];
};

const STATE_BANNER: Record<State, { cls: string; title: string; body: string }> = {
    verified: {
        cls:   'bg-success/10 border-success/30 text-success',
        title: 'Trust account verified',
        body:  'Your trust account is on record with the PPRA-compliant details.',
    },
    pending_review: {
        cls:   'bg-warning/10 border-warning/30 text-warning',
        title: 'Awaiting platform review',
        body:  'All required fields are captured. Platform admins typically verify within 2 business days.',
    },
    partial: {
        cls:   'bg-warning/10 border-warning/30 text-warning',
        title: 'Setup incomplete',
        body:  'Capture both bank account and auditor details below to complete trust account setup.',
    },
    not_started: {
        cls:   'bg-danger/10 border-danger/30 text-danger',
        title: 'Trust account not set up',
        body:  'The Property Practitioners Act requires a registered trust account before you can receive client money.',
    },
};

const inputCls = 'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';
const labelCls = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

export default function AgencyTrustAccount({ agency, trust, banks }: Props) {
    const { data, setData, patch, processing, errors } = useForm({
        trust_bank:                    trust.bank ?? '',
        trust_account_holder:          trust.account_holder ?? agency.name,
        trust_account_number:          trust.account_number ?? '',
        trust_branch_code:             trust.branch_code ?? '',
        trust_account_type:            trust.account_type ?? 'cheque',
        trust_auditor_name:            trust.auditor_name ?? '',
        trust_auditor_practice_number: trust.auditor_practice_number ?? '',
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        patch('/agency/trust-account');
    }

    const banner = STATE_BANNER[trust.state];
    const holderHint = data.trust_account_holder
        && ! /trust/i.test(data.trust_account_holder)
        && data.trust_account_holder.toLowerCase() !== agency.name.toLowerCase();

    return (
        <AgencyLayout crumb="Trust Account" agencyName={agency.name}>
            <Head title="Trust Account" />

            <div className="px-8 py-7 max-w-3xl">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Trust Account</h1>
                    <p className="text-[14px] text-ink-500 mt-1">
                        Set up the PPRA-registered trust account where client money (deposits, advance rent) is held.
                    </p>
                </div>

                {/* Status banner */}
                <div className={`border rounded-xl p-4 mb-6 ${banner.cls}`}>
                    <p className="font-bold text-[14px]">{banner.title}</p>
                    <p className="text-[13px] mt-1">{banner.body}</p>
                    {trust.state === 'verified' && trust.verified_at && (
                        <p className="text-[12px] mt-2 text-ink-600">Verified {trust.verified_at}</p>
                    )}
                </div>

                <form onSubmit={submit} className="space-y-5">
                    {/* Bank details */}
                    <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5 space-y-4">
                        <div>
                            <h2 className="text-[14px] font-bold">Bank account</h2>
                            <p className="text-[12px] text-ink-500">
                                Must be a dedicated trust account — not your operating account.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Bank *</label>
                                <select
                                    value={data.trust_bank}
                                    onChange={(e) => setData('trust_bank', e.target.value)}
                                    required
                                    className={inputCls}
                                >
                                    <option value="">Select a bank…</option>
                                    {banks.map((b) => <option key={b} value={b}>{b}</option>)}
                                </select>
                                {errors.trust_bank && <p className="text-[11px] text-danger mt-1">{errors.trust_bank}</p>}
                            </div>
                            <div>
                                <label className={labelCls}>Account type *</label>
                                <select
                                    value={data.trust_account_type}
                                    onChange={(e) => setData('trust_account_type', e.target.value as typeof data.trust_account_type)}
                                    required
                                    className={inputCls}
                                >
                                    <option value="cheque">Cheque</option>
                                    <option value="current">Current</option>
                                    <option value="savings">Savings</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Account holder name *</label>
                            <input
                                value={data.trust_account_holder}
                                onChange={(e) => setData('trust_account_holder', e.target.value)}
                                required
                                placeholder="e.g. Sandton Realty Trust Account"
                                className={inputCls}
                            />
                            {holderHint && (
                                <p className="text-[11px] text-warning mt-1">
                                    Tip: account holder should match your agency name or include the word "Trust".
                                </p>
                            )}
                            {errors.trust_account_holder && <p className="text-[11px] text-danger mt-1">{errors.trust_account_holder}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Account number *</label>
                                <input
                                    value={data.trust_account_number}
                                    onChange={(e) => setData('trust_account_number', e.target.value.replace(/\D/g, ''))}
                                    required
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="e.g. 6210 4123 456"
                                    className={inputCls}
                                />
                                {errors.trust_account_number && <p className="text-[11px] text-danger mt-1">{errors.trust_account_number}</p>}
                            </div>
                            <div>
                                <label className={labelCls}>Branch code *</label>
                                <input
                                    value={data.trust_branch_code}
                                    onChange={(e) => setData('trust_branch_code', e.target.value.replace(/\D/g, ''))}
                                    required
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="e.g. 250655"
                                    className={inputCls}
                                />
                                {errors.trust_branch_code && <p className="text-[11px] text-danger mt-1">{errors.trust_branch_code}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Auditor */}
                    <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5 space-y-4">
                        <div>
                            <h2 className="text-[14px] font-bold">Annual auditor</h2>
                            <p className="text-[12px] text-ink-500">
                                Section 54 requires an IRBA-registered auditor to audit the trust account annually.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Auditor firm name *</label>
                                <input
                                    value={data.trust_auditor_name}
                                    onChange={(e) => setData('trust_auditor_name', e.target.value)}
                                    required
                                    placeholder="e.g. KPMG Inc."
                                    className={inputCls}
                                />
                                {errors.trust_auditor_name && <p className="text-[11px] text-danger mt-1">{errors.trust_auditor_name}</p>}
                            </div>
                            <div>
                                <label className={labelCls}>IRBA practice number *</label>
                                <input
                                    value={data.trust_auditor_practice_number}
                                    onChange={(e) => setData('trust_auditor_practice_number', e.target.value)}
                                    required
                                    placeholder="e.g. 904887"
                                    className={inputCls}
                                />
                                {errors.trust_auditor_practice_number && <p className="text-[11px] text-danger mt-1">{errors.trust_auditor_practice_number}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <p className="text-[12px] text-ink-500">
                            Changes to bank details require platform re-verification.
                        </p>
                        <button
                            type="submit"
                            disabled={processing}
                            className="px-5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 font-semibold transition"
                        >
                            {processing && <Spinner size={13} />}
                            {processing ? 'Saving…' : 'Save trust account'}
                        </button>
                    </div>
                </form>

                {/* Compliance note */}
                <div className="mt-8 bg-ink-50/60 border border-ink-200 rounded-xl p-5 text-[12.5px] text-ink-600 leading-relaxed">
                    <p className="font-semibold text-ink-700 mb-1">Why this matters</p>
                    Sections 54 &amp; 55 of the Property Practitioners Act, 2019 require every practitioner who receives
                    client money to operate a trust account with a SARB-registered bank, audited annually by an
                    IRBA-registered auditor. The PPRA may suspend your FFC if these records can't be produced on demand.
                </div>
            </div>
        </AgencyLayout>
    );
}
