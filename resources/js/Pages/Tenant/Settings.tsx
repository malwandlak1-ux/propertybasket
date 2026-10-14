import { FormEvent, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import TenantLayout from '@/Layouts/TenantLayout';
import { Spinner } from '@/Components/Skeleton';
import AppearanceSettings from '@/Components/Dashboard/AppearanceSettings';
import { PageHeader, btnPrimary } from '@/Components/Dashboard/Charts';
import Icon, { IconName } from '@/Components/Dashboard/Icon';

type Props = {
    tenant: { id: number; name: string };
    lease: { address: string; suburb: string | null; city: string | null; monthly_rent: number };
    profile: { name: string; email: string; phone: string | null };
    banking: {
        bank_name: string | null;
        bank_account_holder: string | null;
        bank_account_number: string | null;
        bank_branch_code: string | null;
        bank_account_type: 'cheque' | 'current' | 'savings' | null;
        complete: boolean;
    };
    debit_order: {
        bank_name: string;
        account_holder: string;
        account_masked: string;
        account_type: string;
        debit_day: number;
        signed_at: string | null;
        next_date: string;
        next_amount: number;
        simulated: boolean;
        collecting: boolean;
        collections: { id: number; date: string | null; period: string | null; amount: number; status: 'succeeded' | 'failed' | 'pending'; reason: string | null }[];
    } | null;
    managed_by: string | null;
    banks: string[];
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

const TABS: { key: 'contact' | 'banking' | 'debit' | 'password' | 'appearance'; label: string; hint: string; icon: IconName }[] = [
    { key: 'contact',    label: 'Contact details', hint: 'Name, email and phone', icon: 'user' },
    { key: 'banking',    label: 'Banking',         hint: 'Your bank account', icon: 'wallet' },
    { key: 'debit',      label: 'Debit order',     hint: 'Pay rent automatically', icon: 'calendar' },
    { key: 'password',   label: 'Password',        hint: 'Change your sign-in password', icon: 'pen' },
    { key: 'appearance', label: 'Appearance',      hint: 'Dashboard colour', icon: 'eye' },
];
type TabKey = (typeof TABS)[number]['key'];

const inputCls = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[14px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition';
const labelCls = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

export default function TenantSettings({ lease, profile, banking, debit_order, managed_by, banks }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [tab, setTab] = useState<TabKey>('contact');
    const initials = profile.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

    return (
        <TenantLayout crumb="Settings" leaseAddress={lease.address}>
            <Head title="Settings" />

            <section className="px-4 sm:px-7 py-6 max-w-6xl">
                <PageHeader title="Settings" subtitle="Keep your contact details up to date — your landlord uses these to reach you." />

                {flash?.success && (
                    <div className="mb-4 rounded-2xl bg-success/10 border border-success/30 text-success px-5 py-3 text-[13px] font-medium">{flash.success}</div>
                )}
                {flash?.error && (
                    <div className="mb-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger px-5 py-3 text-[13px] font-medium">{flash.error}</div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <aside className="lg:col-span-4 space-y-4">
                        {/* Profile summary */}
                        <div className="pb-swirl rounded-2xl p-5 text-white shadow-lift pb-rise">
                            <div className="flex items-center gap-3">
                                <span className="w-12 h-12 rounded-full bg-white/15 ring-1 ring-white/25 flex items-center justify-center text-[15px] font-bold">{initials}</span>
                                <div className="min-w-0">
                                    <p className="text-[15px] font-semibold truncate">{profile.name}</p>
                                    <p className="text-[12px] text-white/75 truncate">{profile.email}</p>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/15 text-[12px] text-white/80 space-y-1">
                                <p className="flex items-center gap-1.5"><Icon name="pin" />{lease.address}</p>
                                {profile.phone && <p className="flex items-center gap-1.5"><Icon name="phone" />{profile.phone}</p>}
                            </div>
                        </div>

                        {/* Section nav */}
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

                    <div className="lg:col-span-8">
                        {tab === 'appearance' && <AppearanceSettings />}
                        {tab === 'contact' && <ContactPanel profile={profile} />}
                        {tab === 'banking' && <BankingPanel banking={banking} banks={banks} hasDebitOrder={!! debit_order} />}
                        {tab === 'debit' && (
                            <DebitOrderPanel
                                banking={banking}
                                debitOrder={debit_order}
                                rent={lease.monthly_rent}
                                payee={managed_by}
                                onAddBanking={() => setTab('banking')}
                            />
                        )}
                        {tab === 'password' && <PasswordPanel />}
                    </div>
                </div>
            </section>
        </TenantLayout>
    );
}

function ContactPanel({ profile }: { profile: Props['profile'] }) {
    const { data, setData, patch, processing, errors, isDirty } = useForm({
        name:  profile.name,
        email: profile.email,
        phone: profile.phone ?? '',
    });
    function submit(e: FormEvent) {
        e.preventDefault();
        patch('/tenant/settings/profile', { preserveScroll: true });
    }
    return (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 space-y-5 pb-rise">
            <div>
                <h2 className="text-[18px] font-semibold tracking-tight">Contact details</h2>
                <p className="text-[13px] text-ink-500 mt-1">How your landlord reaches you.</p>
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

            <div>
                <label className={labelCls}>Phone</label>
                <input value={data.phone} onChange={(e) => setData('phone', e.target.value)} placeholder="+27 82 555 1234" className={inputCls} />
                {errors.phone && <p className="text-[11px] text-danger mt-1">{errors.phone}</p>}
            </div>

            <div className="flex justify-end pt-4 border-t border-ink-100">
                <button type="submit" disabled={! isDirty || processing} className={btnPrimary}>
                    {processing && <Spinner size={13} />}
                    {processing ? 'Saving…' : 'Save contact details'}
                </button>
            </div>
        </form>
    );
}

function PasswordPanel() {
    const { data, setData, patch, processing, errors, reset } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });
    function submit(e: FormEvent) {
        e.preventDefault();
        patch('/tenant/settings/password', {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    }
    const mismatch = data.password_confirmation.length > 0 && data.password !== data.password_confirmation;
    return (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 space-y-5 pb-rise">
            <div>
                <h2 className="text-[18px] font-semibold tracking-tight">Change password</h2>
                <p className="text-[13px] text-ink-500 mt-1">Use at least 8 characters. You'll stay signed in on this device.</p>
            </div>

            <div>
                <label className={labelCls}>Current password *</label>
                <input type="password" value={data.current_password} onChange={(e) => setData('current_password', e.target.value)} required className={inputCls} />
                {errors.current_password && <p className="text-[11px] text-danger mt-1">{errors.current_password}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>New password *</label>
                    <input type="password" value={data.password} onChange={(e) => setData('password', e.target.value)} required minLength={8} className={inputCls} />
                    {errors.password && <p className="text-[11px] text-danger mt-1">{errors.password}</p>}
                </div>
                <div>
                    <label className={labelCls}>Confirm new password *</label>
                    <input type="password" value={data.password_confirmation} onChange={(e) => setData('password_confirmation', e.target.value)} required minLength={8} className={inputCls} />
                    {mismatch && <p className="text-[11px] text-danger mt-1">Passwords don't match yet.</p>}
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-ink-100">
                <button
                    type="submit"
                    disabled={processing || ! data.current_password || ! data.password || data.password !== data.password_confirmation}
                    className={btnPrimary}
                >
                    {processing && <Spinner size={13} />}
                    {processing ? 'Saving…' : 'Change password'}
                </button>
            </div>
        </form>
    );
}

const fmtRand = (n: number) => `R ${Math.round(n).toLocaleString('en-ZA')}`;
const ordinal = (d: number) => d + ([11, 12, 13].includes(d % 100) ? 'th' : (['th', 'st', 'nd', 'rd'][d % 10] ?? 'th'));

function BankingPanel({ banking, banks, hasDebitOrder }: { banking: Props['banking']; banks: string[]; hasDebitOrder: boolean }) {
    const { data, setData, patch, processing, errors, isDirty } = useForm({
        bank_name:           banking.bank_name ?? '',
        bank_account_holder: banking.bank_account_holder ?? '',
        bank_account_number: banking.bank_account_number ?? '',
        bank_branch_code:    banking.bank_branch_code ?? '',
        bank_account_type:   banking.bank_account_type ?? 'cheque',
    });
    function submit(e: FormEvent) {
        e.preventDefault();
        patch('/tenant/settings/banking', { preserveScroll: true });
    }
    return (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 space-y-5 pb-rise">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-[18px] font-semibold tracking-tight">Banking details</h2>
                    <p className="text-[13px] text-ink-500 mt-1">The account your rent debit order runs from, and where a deposit refund is paid.</p>
                </div>
                <span className={`text-[10.5px] px-2.5 py-1 rounded-full font-semibold shrink-0 ${banking.complete ? 'bg-success/15 text-success' : 'bg-ink-100 text-ink-600'}`}>
                    {banking.complete ? 'On file' : 'Not added'}
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>Bank *</label>
                    <select value={data.bank_name} onChange={(e) => setData('bank_name', e.target.value)} required className={inputCls}>
                        <option value="">Choose your bank</option>
                        {banks.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                    {errors.bank_name && <p className="text-[11px] text-danger mt-1">{errors.bank_name}</p>}
                </div>
                <div>
                    <label className={labelCls}>Account holder *</label>
                    <input value={data.bank_account_holder} onChange={(e) => setData('bank_account_holder', e.target.value)} required className={inputCls} placeholder="As it appears on your bank account" />
                    {errors.bank_account_holder && <p className="text-[11px] text-danger mt-1">{errors.bank_account_holder}</p>}
                </div>
                <div>
                    <label className={labelCls}>Account number *</label>
                    <input inputMode="numeric" value={data.bank_account_number} onChange={(e) => setData('bank_account_number', e.target.value)} required className={inputCls + ' tabular-nums'} />
                    {errors.bank_account_number && <p className="text-[11px] text-danger mt-1">{errors.bank_account_number}</p>}
                </div>
                <div>
                    <label className={labelCls}>Branch code *</label>
                    <input inputMode="numeric" value={data.bank_branch_code} onChange={(e) => setData('bank_branch_code', e.target.value)} required className={inputCls + ' tabular-nums'} placeholder="e.g. 250655" />
                    {errors.bank_branch_code && <p className="text-[11px] text-danger mt-1">{errors.bank_branch_code}</p>}
                </div>
                <div>
                    <label className={labelCls}>Account type *</label>
                    <select value={data.bank_account_type} onChange={(e) => setData('bank_account_type', e.target.value as 'cheque' | 'current' | 'savings')} className={inputCls}>
                        <option value="cheque">Cheque</option>
                        <option value="current">Current</option>
                        <option value="savings">Savings</option>
                    </select>
                </div>
            </div>

            {hasDebitOrder && (
                <p className="text-[12px] text-ink-600 bg-ink-50 rounded-xl px-3.5 py-2.5">Your active debit order will switch to these details when you save, and your landlord will be told.</p>
            )}

            <div className="flex justify-end pt-4 border-t border-ink-100">
                <button type="submit" disabled={! isDirty || processing} className={btnPrimary}>
                    {processing && <Spinner size={13} />}
                    {processing ? 'Saving…' : 'Save banking details'}
                </button>
            </div>
        </form>
    );
}

function DebitOrderPanel({ banking, debitOrder, rent, payee, onAddBanking }: {
    banking: Props['banking'];
    debitOrder: Props['debit_order'];
    rent: number;
    payee: string | null;
    onAddBanking: () => void;
}) {
    const [day, setDay] = useState(String(debitOrder?.debit_day ?? 1));
    const [authorise, setAuthorise] = useState(false);
    const [busy, setBusy] = useState<'save' | 'cancel' | null>(null);
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const masked = banking.bank_account_number ? '•••• ' + banking.bank_account_number.slice(-4) : '';

    function activate(e: FormEvent) {
        e.preventDefault();
        setBusy('save');
        router.post('/tenant/debit-order', { debit_day: Number(day), authorise }, {
            preserveScroll: true,
            onSuccess: () => setAuthorise(false),
            onFinish: () => setBusy(null),
        });
    }
    function cancel() {
        if (! confirm('Cancel your rent debit order? You will need to pay rent yourself each month.')) return;
        setBusy('cancel');
        router.post('/tenant/debit-order/cancel', {}, { preserveScroll: true, onFinish: () => setBusy(null) });
    }

    return (
        <div className="space-y-4">
            {debitOrder && (
                <div className="pb-swirl rounded-2xl p-5 text-white shadow-lift pb-rise">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[13px] font-medium text-white/85">Debit order active</p>
                            <p className="text-[26px] font-semibold tracking-tight mt-2 leading-none">{ordinal(debitOrder.debit_day)} of each month</p>
                            <p className="text-[12px] text-white/80 mt-2">{debitOrder.bank_name} · {debitOrder.account_masked} · {debitOrder.account_type}</p>
                            {debitOrder.signed_at && <p className="text-[11.5px] text-white/70 mt-1">Authorised {debitOrder.signed_at}</p>}
                        </div>
                        <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Icon name="calendar" className="w-5 h-5" /></span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                        <span>{debitOrder.collecting ? <>Next collection <span className="font-semibold">{debitOrder.next_date}</span> · {fmtRand(debitOrder.next_amount)}</> : 'Automatic collection is not switched on yet.'}</span>
                        {debitOrder.simulated && <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-white/15 font-semibold">Test mode · no real money moves</span>}
                    </div>
                </div>
            )}

            {debitOrder && debitOrder.collections.length > 0 && (
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 pb-rise">
                    <h3 className="text-[14px] font-semibold tracking-tight mb-3">Recent collections</h3>
                    <div className="divide-y divide-ink-100">
                        {debitOrder.collections.map((c) => (
                            <div key={c.id} className="py-2.5 flex items-center justify-between gap-3 text-[12.5px]">
                                <div className="min-w-0">
                                    <p className="font-medium">{c.period ? `${c.period} rent` : 'Rent'}</p>
                                    <p className="text-[11px] text-ink-500">{c.date}{c.status === 'failed' && c.reason ? ` · ${c.reason}` : ''}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="tabular-nums font-semibold">{fmtRand(c.amount)}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${c.status === 'succeeded' ? 'bg-success/15 text-success' : c.status === 'failed' ? 'bg-danger/15 text-danger' : 'bg-ink-100 text-ink-600'}`}>
                                        {c.status === 'succeeded' ? 'COLLECTED' : c.status === 'failed' ? 'UNSUCCESSFUL' : 'PENDING'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <form onSubmit={activate} className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 space-y-5 pb-rise">
                <div>
                    <h2 className="text-[18px] font-semibold tracking-tight">{debitOrder ? 'Change your debit order' : 'Pay rent by debit order'}</h2>
                    <p className="text-[13px] text-ink-500 mt-1">
                        Your rent of <span className="font-semibold text-ink-800">{fmtRand(rent)}</span> is collected from your account each month{payee ? <> and paid to <span className="font-semibold text-ink-800">{payee}</span></> : null}.
                    </p>
                </div>

                {! banking.complete ? (
                    <div className="rounded-xl border border-dashed border-ink-200 p-5 text-center">
                        <p className="text-[13px] font-semibold">Add your banking details first</p>
                        <p className="text-[12px] text-ink-500 mt-1">The debit order runs from the account you save under Banking.</p>
                        <button type="button" onClick={onAddBanking} className={btnPrimary + ' mt-3'}>Add banking details</button>
                    </div>
                ) : (
                    <>
                        <div className="rounded-xl border border-ink-200/70 px-4 py-3 flex items-center gap-3">
                            <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Icon name="wallet" className="w-4 h-4" /></span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold truncate">{banking.bank_name} · {masked}</p>
                                <p className="text-[11.5px] text-ink-500 truncate">{banking.bank_account_holder} · {banking.bank_account_type} · branch {banking.bank_branch_code}</p>
                            </div>
                            <button type="button" onClick={onAddBanking} className="text-[12px] font-semibold text-brand-700 hover:underline shrink-0">Change</button>
                        </div>

                        <div className="max-w-xs">
                            <label className={labelCls}>Debit day</label>
                            <select value={day} onChange={(e) => setDay(e.target.value)} className={inputCls}>
                                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{ordinal(d)} of the month{d === 1 ? ' (rent due date)' : ''}</option>)}
                            </select>
                            {errors.debit_day && <p className="text-[11px] text-danger mt-1">{errors.debit_day}</p>}
                        </div>

                        <label className="flex items-start gap-3 text-[12.5px] text-ink-700 cursor-pointer">
                            <input type="checkbox" checked={authorise} onChange={(e) => setAuthorise(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--color-brand-600)]" />
                            <span>
                                I authorise {payee ?? 'my landlord'} to debit my account above with my monthly rent on the chosen day, until I cancel this
                                debit order here. I can cancel at any time.
                            </span>
                        </label>
                        {errors.authorise && <p className="text-[11px] text-danger -mt-3">{errors.authorise}</p>}

                        <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-ink-100">
                            {debitOrder && (
                                <button type="button" onClick={cancel} disabled={busy !== null} className="px-4 py-2.5 text-[13px] rounded-full border border-ink-200 font-semibold hover:bg-ink-50 disabled:opacity-50">
                                    {busy === 'cancel' ? 'Cancelling…' : 'Cancel debit order'}
                                </button>
                            )}
                            <button type="submit" disabled={! authorise || busy !== null} className={btnPrimary}>
                                {busy === 'save' && <Spinner size={13} />}
                                {debitOrder ? 'Update debit order' : 'Activate debit order'}
                            </button>
                        </div>
                    </>
                )}
            </form>
        </div>
    );
}
