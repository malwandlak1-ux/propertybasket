import { FormEvent, useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';
import { Spinner } from '@/Components/Skeleton';
import AppearanceSettings from '@/Components/Dashboard/AppearanceSettings';
import { PageHeader } from '@/Components/Dashboard/Charts';
import Icon, { IconName } from '@/Components/Dashboard/Icon';

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

const TABS: { key: 'profile' | 'banking' | 'appearance'; label: string; hint: string; icon: IconName }[] = [
    { key: 'profile',    label: 'Profile',    hint: 'Name, contact details and ID', icon: 'user' },
    { key: 'banking',    label: 'Banking',    hint: 'Account that receives rent', icon: 'wallet' },
    { key: 'appearance', label: 'Appearance', hint: 'Dashboard colour and logo', icon: 'eye' },
];
type TabKey = (typeof TABS)[number]['key'];

const inputCls = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[14px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition';
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

    const initials = profile.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const bankState = {
        verified:       { label: 'Banking verified', cls: 'bg-success/20 text-white' },
        pending_review: { label: 'Banking pending review', cls: 'bg-warning/30 text-white' },
        missing:        { label: 'No banking on file', cls: 'bg-danger/40 text-white' },
    }[banking.state];

    return (
        <LandlordLayout crumb="Settings">
            <Head title="Settings" />

            <section className="px-4 sm:px-7 py-6 max-w-6xl">
                <PageHeader title="Settings" subtitle="Your contact details and the bank account that receives rent and funds contractor payments." />

                {flash?.success && (
                    <div className="mb-4 rounded-2xl bg-success/10 border border-success/30 text-success px-5 py-3 text-[13px] font-medium">{flash.success}</div>
                )}
                {flash?.error && (
                    <div className="mb-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger px-5 py-3 text-[13px] font-medium">{flash.error}</div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <aside className="lg:col-span-4 space-y-4">
                        <div className="pb-swirl rounded-2xl p-5 text-white shadow-lift pb-rise">
                            <div className="flex items-center gap-3">
                                <span className="w-12 h-12 rounded-full bg-white/15 ring-1 ring-white/25 flex items-center justify-center text-[15px] font-bold">{initials}</span>
                                <div className="min-w-0">
                                    <p className="text-[15px] font-semibold truncate">{profile.name}</p>
                                    <p className="text-[12px] text-white/75 truncate">{profile.email}</p>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/15 flex flex-wrap items-center gap-2 text-[12px] text-white/80">
                                <span className={`px-2.5 py-1 rounded-full font-semibold text-[11px] ${bankState.cls}`}>{bankState.label}</span>
                                {profile.phone && <span className="flex items-center gap-1.5"><Icon name="phone" />{profile.phone}</span>}
                            </div>
                        </div>

                        <nav className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-2">
                            {TABS.map((t) => {
                                const on = tab === t.key;
                                return (
                                    <button
                                        type="button"
                                        key={t.key}
                                        onClick={() => setTab(t.key)}
                                        className={'w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl transition ' + (on ? 'bg-brand-50' : 'hover:bg-ink-50')}
                                    >
                                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${on ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-500'}`}>
                                            <Icon name={t.icon} className="w-4 h-4" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className={`block text-[13.5px] font-semibold ${on ? 'text-brand-800' : 'text-ink-800'}`}>{t.label}</span>
                                            <span className="block text-[11.5px] text-ink-500 truncate">{t.hint}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                    <div className="lg:col-span-8 space-y-4">
                        {tab === 'appearance' && <AppearanceSettings />}
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
        <form onSubmit={submit} className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 pb-rise space-y-4">
            <div>
                <h2 className="text-[18px] font-semibold tracking-tight">Profile</h2>
                <p className="text-[12px] text-ink-500 mt-0.5">How tenants, contractors and the platform reach you.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="px-4 py-2.5 text-[13px] bg-brand-700 text-white rounded-full hover:bg-brand-800 disabled:opacity-40 inline-flex items-center gap-2 font-semibold shadow-soft"
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

            <form onSubmit={submit} className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 pb-rise space-y-4">
                <div>
                    <h2 className="text-[18px] font-semibold tracking-tight">Bank account</h2>
                    <p className="text-[12px] text-ink-500 mt-0.5">
                        This is the account that will receive rent from your tenants and fund maintenance contractor payouts.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        className="px-4 py-2.5 text-[13px] bg-brand-700 text-white rounded-full hover:bg-brand-800 disabled:opacity-40 inline-flex items-center gap-2 font-semibold shadow-soft"
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
