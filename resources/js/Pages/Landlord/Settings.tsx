import { FormEvent, useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';
import { Spinner } from '@/Components/Skeleton';

type BankingState = 'verified' | 'pending_review' | 'missing';

type Props = {
    landlord: { id: number; name: string };
    profile: {
        name: string;
        email: string;
        phone: string | null;
        id_number: string | null;
    };
    banking: {
        bank_name: string | null;
        bank_account_holder: string | null;
        bank_account_number: string | null;
        bank_branch_code: string | null;
        bank_account_type: 'cheque' | 'current' | 'savings' | null;
        verified_at: string | null;
        state: BankingState;
    };
    banks: string[];
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

const TABS = [
    { key: 'profile', label: 'Profile' },
    { key: 'banking', label: 'Banking' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const inputCls = 'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';
const labelCls = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

const STATE_BANNER: Record<BankingState, { cls: string; title: string; body: string }> = {
    verified: {
        cls:   'bg-success/10 border-success/30 text-success',
        title: 'Banking verified',
        body:  'Tenant rent will pay into this account. Maintenance contractor payouts will also be issued from it.',
    },
    pending_review: {
        cls:   'bg-warning/10 border-warning/30 text-warning',
        title: 'Awaiting platform verification',
        body:  'Your details are on file. Property Basket admins usually verify within 2 business days; payouts pause until then.',
    },
    missing: {
        cls:   'bg-danger/10 border-danger/30 text-danger',
        title: 'No banking details on file',
        body:  'Capture your account below so tenants can pay rent and so the platform can pay maintenance contractors on your behalf.',
    },
};

export default function LandlordSettings({ landlord, profile, banking, banks }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [tab, setTab] = useState<TabKey>('profile');

    return (
        <LandlordLayout crumb="Settings">
            <Head title="Settings" />

            <section className="px-8 py-7 max-w-4xl">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                    <p className="text-[14px] text-ink-500 mt-1">
                        Manage your contact details and the bank account that will receive rent and fund contractor payments.
                    </p>
                </div>

                {flash?.success && (
                    <div className="mb-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                        {flash.success}
                    </div>
                )}

                <div className="grid grid-cols-4 gap-6">
                    <aside className="space-y-1">
                        {TABS.map((t) => (
                            <button
                                type="button"
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={
                                    'w-full text-left px-3 py-2 rounded-lg text-[13px] font-semibold transition ' +
                                    (tab === t.key ? 'bg-ink-900 text-white' : 'hover:bg-ink-100 text-ink-700')
                                }
                            >
                                {t.label}
                            </button>
                        ))}
                    </aside>

                    <div className="col-span-3 space-y-6">
                        {tab === 'profile'  && <ProfilePanel profile={profile} />}
                        {tab === 'banking'  && <BankingPanel banking={banking} banks={banks} landlordName={landlord.name} />}
                    </div>
                </div>
            </section>
        </LandlordLayout>
    );
}

function ProfilePanel({ profile }: { profile: Props['profile'] }) {
    const { data, setData, patch, processing, errors, isDirty } = useForm({
        name:      profile.name,
        email:     profile.email,
        phone:     profile.phone ?? '',
        id_number: profile.id_number ?? '',
    });
    function submit(e: FormEvent) {
        e.preventDefault();
        patch('/landlord/settings/profile', { preserveScroll: true });
    }
    return (
        <form onSubmit={submit} className="bg-white rounded-xl border border-ink-200 shadow-soft p-6 space-y-4">
            <div>
                <h2 className="text-base font-bold">Profile</h2>
                <p className="text-[12px] text-ink-500 mt-0.5">How tenants, contractors and the platform reach you.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>Full name *</label>
                    <input value={data.name} onChange={(e) => setData('name', e.target.value)} required className={inputCls} />
                    {errors.name && <p className="text-[11px] text-danger mt-1">{errors.name}</p>}
                </div>
                <div>
                    <label className={labelCls}>Email *</label>
                    <input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} required className={inputCls} />
                    {errors.email && <p className="text-[11px] text-danger mt-1">{errors.email}</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>Phone</label>
                    <input value={data.phone} onChange={(e) => setData('phone', e.target.value)} placeholder="+27 82 555 1234" className={inputCls} />
                </div>
                <div>
                    <label className={labelCls}>SA ID number</label>
                    <input value={data.id_number} onChange={(e) => setData('id_number', e.target.value.replace(/\D/g, '').slice(0, 13))} inputMode="numeric" pattern="[0-9]*" placeholder="13 digits" className={inputCls} />
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={! isDirty || processing}
                    className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-40 inline-flex items-center gap-2 font-semibold"
                >
                    {processing && <Spinner size={13} />}
                    {processing ? 'Saving…' : 'Save profile'}
                </button>
            </div>
        </form>
    );
}

function BankingPanel({ banking, banks, landlordName }: { banking: Props['banking']; banks: string[]; landlordName: string }) {
    const { data, setData, patch, processing, errors, isDirty } = useForm({
        bank_name:           banking.bank_name ?? '',
        bank_account_holder: banking.bank_account_holder ?? landlordName,
        bank_account_number: banking.bank_account_number ?? '',
        bank_branch_code:    banking.bank_branch_code ?? '',
        bank_account_type:   banking.bank_account_type ?? 'cheque',
    });
    function submit(e: FormEvent) {
        e.preventDefault();
        patch('/landlord/settings/banking', { preserveScroll: true });
    }
    const banner = STATE_BANNER[banking.state];

    return (
        <div className="space-y-4">
            <div className={`border rounded-xl p-4 ${banner.cls}`}>
                <p className="font-bold text-[14px]">{banner.title}</p>
                <p className="text-[13px] mt-1">{banner.body}</p>
                {banking.state === 'verified' && banking.verified_at && (
                    <p className="text-[12px] mt-2 text-ink-600">Verified {banking.verified_at}</p>
                )}
            </div>

            <form onSubmit={submit} className="bg-white rounded-xl border border-ink-200 shadow-soft p-6 space-y-4">
                <div>
                    <h2 className="text-base font-bold">Bank account</h2>
                    <p className="text-[12px] text-ink-500 mt-0.5">
                        This is the account that will receive rent from your tenants and fund maintenance contractor payouts.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Bank *</label>
                        <select value={data.bank_name} onChange={(e) => setData('bank_name', e.target.value)} required className={inputCls}>
                            <option value="">Select a bank…</option>
                            {banks.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                        {errors.bank_name && <p className="text-[11px] text-danger mt-1">{errors.bank_name}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Account type *</label>
                        <select
                            value={data.bank_account_type}
                            onChange={(e) => setData('bank_account_type', e.target.value as typeof data.bank_account_type)}
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
                    <label className={labelCls}>Account holder *</label>
                    <input
                        value={data.bank_account_holder}
                        onChange={(e) => setData('bank_account_holder', e.target.value)}
                        required
                        placeholder="Must match the name on the bank account"
                        className={inputCls}
                    />
                    {errors.bank_account_holder && <p className="text-[11px] text-danger mt-1">{errors.bank_account_holder}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Account number *</label>
                        <input
                            value={data.bank_account_number}
                            onChange={(e) => setData('bank_account_number', e.target.value.replace(/\D/g, ''))}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="e.g. 6210 4123 456"
                            required
                            className={inputCls}
                        />
                        {errors.bank_account_number && <p className="text-[11px] text-danger mt-1">{errors.bank_account_number}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Branch code *</label>
                        <input
                            value={data.bank_branch_code}
                            onChange={(e) => setData('bank_branch_code', e.target.value.replace(/\D/g, ''))}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="e.g. 250655"
                            required
                            className={inputCls}
                        />
                        {errors.bank_branch_code && <p className="text-[11px] text-danger mt-1">{errors.bank_branch_code}</p>}
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <p className="text-[11px] text-ink-500">
                        Changing the account number, branch, bank or holder name will reset platform verification.
                    </p>
                    <button
                        type="submit"
                        disabled={! isDirty || processing}
                        className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-40 inline-flex items-center gap-2 font-semibold"
                    >
                        {processing && <Spinner size={13} />}
                        {processing ? 'Saving…' : 'Save banking'}
                    </button>
                </div>
            </form>

            <div className="bg-ink-50/60 border border-ink-200 rounded-xl p-5 text-[12.5px] text-ink-600 leading-relaxed">
                <p className="font-semibold text-ink-700 mb-1">How payments flow</p>
                Tenants pay rent through Paystack; cleared funds settle into this account. When you approve a maintenance
                invoice, the platform debits the same account and pays the contractor directly — no manual EFT required.
            </div>
        </div>
    );
}
