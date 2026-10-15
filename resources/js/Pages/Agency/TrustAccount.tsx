import { FormEvent } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import { Spinner } from '@/Components/Skeleton';
import { PageHeader, SectionCard, SummaryStrip, btnPrimary } from '@/Components/Dashboard/Charts';

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

const STATE_LABEL: Record<State, string> = {
    verified: 'Verified',
    pending_review: 'In review',
    partial: 'Incomplete',
    not_started: 'Not set up',
};
const STATE_TONE: Record<State, 'success' | 'warning' | 'danger'> = {
    verified: 'success',
    pending_review: 'warning',
    partial: 'warning',
    not_started: 'danger',
};

const inputCls = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[14px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition';
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

            <div className="px-4 sm:px-7 py-6 max-w-6xl">
                <PageHeader
                    title="Trust Account"
                    subtitle="The PPRA-registered trust account where client money (deposits, advance rent) is held"
                />

                <SummaryStrip
                    title="Trust Account Status"
                    subtitle={banner.title}
                    cells={[
                        { label: 'Status', value: STATE_LABEL[trust.state], sub: trust.state === 'verified' && trust.verified_at ? `Verified ${trust.verified_at}` : banner.body, tone: STATE_TONE[trust.state] },
                        { label: 'Bank', value: trust.bank ?? '—', sub: trust.account_type ? `${trust.account_type.charAt(0).toUpperCase()}${trust.account_type.slice(1)} account` : 'Not captured', tone: 'muted' },
                        { label: 'Account', value: trust.account_number ? `•••• ${trust.account_number.slice(-4)}` : '—', sub: trust.branch_code ? `Branch ${trust.branch_code}` : 'Not captured', tone: 'muted' },
                        { label: 'Auditor', value: trust.auditor_name ?? '—', sub: trust.auditor_practice_number ? `IRBA ${trust.auditor_practice_number}` : 'Not captured', tone: 'muted' },
                    ]}
                />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <form onSubmit={submit} className="lg:col-span-8">
                    {/* Bank details */}
                    <SectionCard title="Bank Account" subtitle="Must be a dedicated trust account, not your operating account">
                    <div className="space-y-4">

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    </SectionCard>

                    {/* Auditor */}
                    <SectionCard title="Annual Auditor" subtitle="Section 54 requires an IRBA-registered auditor to audit the trust account annually">
                    <div className="space-y-4">

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    </SectionCard>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[12px] text-ink-500">
                            Changes to bank details require platform re-verification.
                        </p>
                        <button type="submit" disabled={processing} className={btnPrimary}>
                            {processing && <Spinner size={13} />}
                            {processing ? 'Saving…' : 'Save trust account'}
                        </button>
                    </div>
                </form>

                <aside className="lg:col-span-4 space-y-4">
                    <div className="pb-swirl rounded-2xl p-5 text-white shadow-lift pb-rise">
                        <p className="text-[13px] font-medium">{banner.title}</p>
                        <p className="text-[12.5px] text-white/85 mt-2 leading-relaxed">{banner.body}</p>
                        {trust.state === 'verified' && trust.verified_at && (
                            <p className="text-[12px] text-white/75 mt-3">Verified {trust.verified_at}</p>
                        )}
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 text-[12.5px] text-ink-600 leading-relaxed pb-rise">
                        <p className="text-base font-semibold text-ink-900 mb-2">Why this matters</p>
                        Sections 54 &amp; 55 of the Property Practitioners Act, 2019 require every practitioner who receives
                        client money to operate a trust account with a SARB-registered bank, audited annually by an
                        IRBA-registered auditor. The PPRA may suspend your FFC if these records can't be produced on demand.
                    </div>
                </aside>
                </div>
            </div>
        </AgencyLayout>
    );
}
