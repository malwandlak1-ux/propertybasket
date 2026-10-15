import { FormEvent, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';
import { Spinner } from '@/Components/Skeleton';
import AppearanceSettings from '@/Components/Dashboard/AppearanceSettings';
import { PageHeader, btnPrimary } from '@/Components/Dashboard/Charts';
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
    penalties: Penalty[];
    api_keys: ApiKeyRow[];
    new_api_key: string | null;
    api_base_url: string;
};

type ApiKeyRow = { id: number; name: string; prefix: string; created_at: string | null; last_used_at: string | null; revoked: boolean };

type Penalty = {
    lease_id: number;
    property: string;
    tenant: string | null;
    monthly_rent: number;
    enabled: boolean;
    type: 'percent' | 'fixed';
    value: number;
    day: number;
    since: string | null;
    summary: string | null;
    applied: { id: number; period_label: string; late_fee: number; status: string; applied_at: string | null; can_waive: boolean }[];
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

const TABS: { key: 'profile' | 'banking' | 'penalties' | 'api' | 'appearance'; label: string; hint: string; icon: IconName }[] = [
    { key: 'profile',    label: 'Profile',    hint: 'Name, contact details and ID', icon: 'user' },
    { key: 'banking',    label: 'Banking',    hint: 'Account that receives rent', icon: 'wallet' },
    { key: 'penalties',  label: 'Late payment penalties', hint: 'Per property, as per the lease', icon: 'alert' },
    { key: 'api',        label: 'API access', hint: 'Connect another system', icon: 'file' },
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

export default function LandlordSettings({ landlord, profile, banking, banks, penalties, api_keys, new_api_key, api_base_url }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [tab, setTab] = useState<TabKey>(new_api_key ? 'api' : 'profile');

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
                        {tab === 'penalties' && <PenaltiesPanel penalties={penalties} />}
                        {tab === 'api' && <ApiAccessPanel keys={api_keys} newKey={new_api_key} baseUrl={api_base_url} />}
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

const fmtR = (n: number) => `R ${Math.round(n).toLocaleString('en-ZA')}`;
const ordinal = (d: number) => d + ([11, 12, 13].includes(d % 100) ? 'th' : (['th', 'st', 'nd', 'rd'][d % 10] ?? 'th'));

function PenaltiesPanel({ penalties }: { penalties: Penalty[] }) {
    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 pb-rise">
                <h2 className="text-[18px] font-semibold tracking-tight">Late payment penalties</h2>
                <p className="text-[13px] text-ink-500 mt-1">
                    Set the penalty agreed in each lease. If a month's rent is still unpaid after the cut-off day, the penalty is added to
                    that month automatically and shows on the tenant's payments and statement. Penalties count from the day you switch
                    them on, never for past months, and you can waive any penalty that is still unpaid.
                </p>
            </div>

            {penalties.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-ink-200 p-8 text-center text-[13px] text-ink-500">
                    No active leases yet. Penalties are set per property once a tenant's lease is captured.
                </div>
            ) : (
                penalties.map((p) => <PenaltyCard key={p.lease_id} p={p} />)
            )}
        </div>
    );
}

function PenaltyCard({ p }: { p: Penalty }) {
    const { data, setData, patch, processing, errors, isDirty } = useForm({
        enabled: p.enabled,
        type: p.type,
        value: p.value ? String(p.value) : '',
        day: String(p.day || 7),
    });
    const [waiving, setWaiving] = useState<number | null>(null);

    function submit(e: FormEvent) {
        e.preventDefault();
        patch(`/landlord/settings/penalties/${p.lease_id}`, { preserveScroll: true });
    }

    function waive(id: number) {
        if (! confirm('Waive this penalty? It will be removed from what the tenant owes.')) return;
        setWaiving(id);
        router.post(`/landlord/settings/penalties/charges/${id}/waive`, {}, { preserveScroll: true, onFinish: () => setWaiving(null) });
    }

    const value = parseFloat(data.value) || 0;
    const example = data.type === 'percent' ? (p.monthly_rent * value) / 100 : value;

    return (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 space-y-4 pb-rise">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[15px] font-semibold tracking-tight flex items-center gap-1.5 min-w-0"><Icon name="pin" /><span className="truncate" title={p.property}>{p.property}</span></p>
                    <p className="text-[12px] text-ink-500 mt-0.5">{p.tenant ?? 'No tenant yet'} · Rent {fmtR(p.monthly_rent)}/mo</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[12px] font-semibold ${data.enabled ? 'text-brand-700' : 'text-ink-500'}`}>{data.enabled ? 'On' : 'Off'}</span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={data.enabled}
                        aria-label="Apply late payment penalty"
                        onClick={() => setData('enabled', ! data.enabled)}
                        className={`relative w-11 h-6 rounded-full transition ${data.enabled ? 'bg-brand-600' : 'bg-ink-200'}`}
                    >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-soft transition-all ${data.enabled ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                </div>
            </div>

            {data.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div>
                        <label className={labelCls}>Penalty type</label>
                        <select value={data.type} onChange={(e) => setData('type', e.target.value as Penalty['type'])} className={inputCls}>
                            <option value="percent">Percentage of rent</option>
                            <option value="fixed">Fixed amount (R)</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>{data.type === 'percent' ? 'Percentage (%)' : 'Amount (R)'}</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            max={data.type === 'percent' ? 100 : undefined}
                            value={data.value}
                            onChange={(e) => setData('value', e.target.value)}
                            className={inputCls}
                            placeholder={data.type === 'percent' ? '10' : '500'}
                        />
                        {errors.value && <p className="text-[11px] text-danger mt-1">{errors.value}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Pay-by day</label>
                        <select value={data.day} onChange={(e) => setData('day', e.target.value)} className={inputCls}>
                            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{ordinal(d)} of the month</option>)}
                        </select>
                        {errors.day && <p className="text-[11px] text-danger mt-1">{errors.day}</p>}
                    </div>
                </div>
            )}

            {data.enabled && value > 0 && (
                <p className="text-[12.5px] text-ink-600 bg-ink-50 rounded-xl px-3.5 py-2.5">
                    If rent is not paid by the {ordinal(+data.day)}, <span className="font-semibold">{fmtR(example)}</span> is added to that month's rent.
                    {p.enabled && p.since && <> Active since {p.since}.</>}
                </p>
            )}

            {p.applied.length > 0 && (
                <div className="border-t border-ink-100 pt-3">
                    <p className="text-[12px] font-semibold text-ink-700 mb-2">Penalties charged</p>
                    <div className="space-y-1.5">
                        {p.applied.map((a) => (
                            <div key={a.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                                <span className="text-ink-700">{a.period_label}{a.applied_at && <span className="text-ink-400"> · {a.applied_at}</span>}</span>
                                <span className="flex items-center gap-2">
                                    <span className="font-semibold tabular-nums">{fmtR(a.late_fee)}</span>
                                    {a.status === 'paid' ? (
                                        <span className="text-[10.5px] px-2 py-0.5 rounded-full font-semibold bg-success/15 text-success">Paid</span>
                                    ) : a.can_waive && (
                                        <button type="button" onClick={() => waive(a.id)} disabled={waiving === a.id} className="text-[11.5px] font-semibold text-brand-700 hover:underline disabled:opacity-40">
                                            {waiving === a.id ? 'Waiving…' : 'Waive'}
                                        </button>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={! isDirty || processing}
                    className="px-4 py-2.5 text-[13px] bg-brand-700 text-white rounded-full hover:bg-brand-800 disabled:opacity-40 inline-flex items-center gap-2 font-semibold shadow-soft"
                >
                    {processing && <Spinner size={13} />}
                    {processing ? 'Saving…' : 'Save penalty'}
                </button>
            </div>
        </form>
    );
}

function ApiAccessPanel({ keys, newKey, baseUrl }: { keys: ApiKeyRow[]; newKey: string | null; baseUrl: string }) {
    const { data, setData, post, processing, errors, reset } = useForm({ name: '' });
    const [copied, setCopied] = useState<string | null>(null);
    const [revoking, setRevoking] = useState<number | null>(null);

    function copy(text: string, what: string) {
        navigator.clipboard?.writeText(text).then(() => {
            setCopied(what);
            setTimeout(() => setCopied(null), 1500);
        });
    }
    function create(e: FormEvent) {
        e.preventDefault();
        post('/landlord/settings/api-keys', { preserveScroll: true, onSuccess: () => reset() });
    }
    function revoke(k: ApiKeyRow) {
        if (! confirm(`Revoke "${k.name}"? Any system using it stops working immediately.`)) return;
        setRevoking(k.id);
        router.delete(`/landlord/settings/api-keys/${k.id}`, { preserveScroll: true, onFinish: () => setRevoking(null) });
    }

    const example = `curl -H "Authorization: Bearer ${newKey ?? 'pbk_your_key'}" \\\n  "${baseUrl}/statements/owner?range=12"`;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 pb-rise">
                <h2 className="text-[18px] font-semibold tracking-tight">API access</h2>
                <p className="text-[13px] text-ink-500 mt-1">
                    Let another system (for example your accounting software) pull your properties, leases and financial statements.
                    Keys are read-only and only see your own portfolio.
                </p>
                <div className="mt-4 rounded-xl bg-ink-50 border border-ink-200/70 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Base URL</p>
                        <p className="text-[13px] font-mono truncate">{baseUrl}</p>
                    </div>
                    <button type="button" onClick={() => copy(baseUrl, 'url')} className="text-[12px] font-semibold text-brand-700 hover:underline shrink-0">{copied === 'url' ? 'Copied' : 'Copy'}</button>
                </div>
            </div>

            {newKey && (
                <div className="rounded-2xl border-2 border-success/40 bg-success/5 p-5 pb-rise">
                    <p className="text-[14px] font-semibold text-success">Your new API key</p>
                    <p className="text-[12.5px] text-ink-600 mt-1">Copy it now and give it to the other system. For your security it will not be shown again.</p>
                    <div className="mt-3 flex items-center gap-2 bg-white rounded-xl border border-ink-200 px-4 py-3">
                        <code className="flex-1 min-w-0 text-[13px] font-mono break-all">{newKey}</code>
                        <button type="button" onClick={() => copy(newKey, 'key')} className={btnPrimary + ' shrink-0'}>{copied === 'key' ? 'Copied' : 'Copy key'}</button>
                    </div>
                </div>
            )}

            <form onSubmit={create} className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 pb-rise">
                <label className={labelCls}>New key name</label>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input value={data.name} onChange={(e) => setData('name', e.target.value)} required maxLength={80} className={inputCls} placeholder="e.g. Sage accounting sync" />
                    <button type="submit" disabled={processing || ! data.name.trim()} className={btnPrimary + ' shrink-0 justify-center'}>
                        {processing && <Spinner size={13} />}Create API key
                    </button>
                </div>
                {errors.name && <p className="text-[11px] text-danger mt-1">{errors.name}</p>}
            </form>

            <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden pb-rise">
                <div className="px-5 py-4 border-b border-ink-100">
                    <h3 className="text-[15px] font-semibold tracking-tight">Your keys</h3>
                </div>
                {keys.length === 0 ? (
                    <p className="p-6 text-center text-[13px] text-ink-500">No API keys yet.</p>
                ) : (
                    <div className="divide-y divide-ink-100">
                        {keys.map((k) => (
                            <div key={k.id} className={`px-5 py-3.5 flex flex-wrap items-center gap-3 ${k.revoked ? 'opacity-50' : ''}`}>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13.5px] font-semibold">{k.name}</p>
                                    <p className="text-[11.5px] text-ink-500 font-mono">{k.prefix}…</p>
                                </div>
                                <p className="text-[11.5px] text-ink-500">Created {k.created_at} · {k.last_used_at ? `last used ${k.last_used_at}` : 'never used'}</p>
                                {k.revoked ? (
                                    <span className="text-[10.5px] px-2 py-0.5 rounded-full font-bold bg-ink-100 text-ink-600">REVOKED</span>
                                ) : (
                                    <button type="button" onClick={() => revoke(k)} disabled={revoking === k.id} className="text-[12px] font-semibold text-danger hover:underline disabled:opacity-50">
                                        {revoking === k.id ? 'Revoking…' : 'Revoke'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 pb-rise">
                <h3 className="text-[15px] font-semibold tracking-tight">Quick start</h3>
                <p className="text-[12.5px] text-ink-500 mt-1">Send the key in the Authorization header. All amounts are in ZAR.</p>
                <pre className="mt-3 rounded-xl bg-ink-900 text-white/90 text-[12px] p-4 overflow-x-auto"><code>{example}</code></pre>
                <ul className="mt-3 text-[12.5px] text-ink-700 space-y-1">
                    <li><code className="font-mono text-[12px]">GET /properties</code> and <code className="font-mono text-[12px]">GET /leases</code></li>
                    <li><code className="font-mono text-[12px]">GET /statements/owner</code> (JSON), <code className="font-mono text-[12px]">/statements/owner.pdf</code>, <code className="font-mono text-[12px]">/statements/owner/monthly</code></li>
                    <li><code className="font-mono text-[12px]">GET /leases/{'{id}'}/statement</code> and <code className="font-mono text-[12px]">.pdf</code> for a tenant's account</li>
                    <li>Filters: <code className="font-mono text-[12px]">property</code>, <code className="font-mono text-[12px]">range</code> (3, 6, 12, lease), <code className="font-mono text-[12px]">month</code> (2026-09) or <code className="font-mono text-[12px]">from</code>/<code className="font-mono text-[12px]">to</code></li>
                </ul>
            </div>
        </div>
    );
}
