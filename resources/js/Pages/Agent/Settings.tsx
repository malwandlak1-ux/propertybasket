import { FormEvent, useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import { Spinner } from '@/Components/Skeleton';

type ChannelKey = string;

type Props = {
    agent: { id: number; name: string; agency_name: string };
    profile: {
        name: string;
        email: string;
        phone: string | null;
        avatar: string | null;
    };
    notifications: {
        channels: Record<ChannelKey, string>;
        values: Record<ChannelKey, boolean>;
    };
    banking: {
        bank_account_holder: string | null;
        bank_account_number: string | null;
        bank_code: string | null;
        paystack_recipient_code: string | null;
    };
};

type Tab = 'profile' | 'password' | 'notifications' | 'banking';

const TABS: { key: Tab; label: string }[] = [
    { key: 'profile',       label: 'Profile' },
    { key: 'password',      label: 'Password' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'banking',       label: 'Banking' },
];

const inputCls = 'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';

export default function AgentSettings({ agent, profile, notifications, banking }: Props) {
    const flash = (usePage().props as { flash?: { success?: string } }).flash;
    const [tab, setTab] = useState<Tab>('profile');

    return (
        <AgentLayout crumb="Settings" agencyName={agent.agency_name}>
            <Head title="Settings" />

            <div className="px-8 py-7 max-w-5xl">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                    <p className="text-[14px] text-ink-500 mt-1">Manage your profile, security, notification preferences, and payout details.</p>
                </div>

                {flash?.success && (
                    <div className="mb-5 bg-success/10 border border-success/30 text-success rounded-lg px-4 py-3 text-[13px]">
                        ✓ {flash.success}
                    </div>
                )}

                <div className="grid grid-cols-12 gap-6">
                    <aside className="col-span-12 md:col-span-3">
                        <nav className="bg-white border border-ink-200 rounded-xl shadow-soft p-2 space-y-1">
                            {TABS.map((t) => (
                                <button
                                    key={t.key}
                                    onClick={() => setTab(t.key)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition ${
                                        tab === t.key
                                            ? 'bg-ink-100 text-ink-900 font-semibold'
                                            : 'text-ink-500 hover:bg-ink-50'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </nav>
                    </aside>

                    <main className="col-span-12 md:col-span-9 space-y-5">
                        {tab === 'profile'       && <ProfileSection profile={profile} />}
                        {tab === 'password'      && <PasswordSection />}
                        {tab === 'notifications' && <NotificationsSection channels={notifications.channels} values={notifications.values} />}
                        {tab === 'banking'       && <BankingSection banking={banking} />}
                    </main>
                </div>
            </div>
        </AgentLayout>
    );
}

/* ───────── Profile ───────── */

function ProfileSection({ profile }: { profile: Props['profile'] }) {
    const { data, setData, post, processing, errors } = useForm<{
        name: string; email: string; phone: string; avatar: File | null;
    }>({
        name: profile.name,
        email: profile.email,
        phone: profile.phone ?? '',
        avatar: null,
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agent/settings/profile', { forceFormData: true });
    }

    return (
        <section className="bg-white rounded-xl border border-ink-200 shadow-soft p-6">
            <h2 className="text-base font-bold">Profile information</h2>
            <p className="text-[12.5px] text-ink-500 mb-5">Your name, contact details, and avatar.</p>

            <form onSubmit={submit} className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-ink-100 overflow-hidden flex items-center justify-center shrink-0">
                        {profile.avatar
                            ? <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                            : <span className="text-ink-400 text-[20px] font-bold">{profile.name?.[0]?.toUpperCase() ?? '?'}</span>}
                    </div>
                    <div className="flex-1">
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Avatar</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setData('avatar', e.target.files?.[0] ?? null)}
                            className="block w-full text-[13px] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[12px] file:font-semibold file:bg-ink-100 file:text-ink-700 hover:file:bg-ink-200"
                        />
                        {errors.avatar && <p className="text-[11px] text-danger mt-1">{errors.avatar}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Name *</label>
                        <input value={data.name} onChange={(e) => setData('name', e.target.value)} required className={inputCls} />
                        {errors.name && <p className="text-[11px] text-danger mt-1">{errors.name}</p>}
                    </div>
                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Phone</label>
                        <input value={data.phone} onChange={(e) => setData('phone', e.target.value)} placeholder="+27 82 555 1234" className={inputCls} />
                        {errors.phone && <p className="text-[11px] text-danger mt-1">{errors.phone}</p>}
                    </div>
                </div>

                <div>
                    <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Email *</label>
                    <input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} required className={inputCls} />
                    {errors.email && <p className="text-[11px] text-danger mt-1">{errors.email}</p>}
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={processing}
                        className="px-5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-60 inline-flex items-center gap-2 font-semibold transition"
                    >
                        {processing && <Spinner size={13} />}
                        {processing ? 'Saving…' : 'Save profile'}
                    </button>
                </div>
            </form>
        </section>
    );
}

/* ───────── Password ───────── */

function PasswordSection() {
    const { data, setData, post, processing, errors, reset } = useForm({
        current_password:      '',
        password:              '',
        password_confirmation: '',
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agent/settings/password', { onSuccess: () => reset() });
    }

    return (
        <section className="bg-white rounded-xl border border-ink-200 shadow-soft p-6">
            <h2 className="text-base font-bold">Change password</h2>
            <p className="text-[12.5px] text-ink-500 mb-5">Pick a strong password — at least 8 characters.</p>

            <form onSubmit={submit} className="space-y-4">
                <div>
                    <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Current password *</label>
                    <input type="password" value={data.current_password} onChange={(e) => setData('current_password', e.target.value)} required className={inputCls} />
                    {errors.current_password && <p className="text-[11px] text-danger mt-1">{errors.current_password}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">New password *</label>
                        <input type="password" value={data.password} onChange={(e) => setData('password', e.target.value)} required minLength={8} className={inputCls} />
                        {errors.password && <p className="text-[11px] text-danger mt-1">{errors.password}</p>}
                    </div>
                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Confirm new password *</label>
                        <input type="password" value={data.password_confirmation} onChange={(e) => setData('password_confirmation', e.target.value)} required className={inputCls} />
                    </div>
                </div>
                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={processing || ! data.current_password || data.password.length < 8 || data.password !== data.password_confirmation}
                        className="px-5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 font-semibold transition"
                    >
                        {processing && <Spinner size={13} />}
                        {processing ? 'Updating…' : 'Update password'}
                    </button>
                </div>
            </form>
        </section>
    );
}

/* ───────── Notifications ───────── */

function NotificationsSection({ channels, values }: { channels: Record<string, string>; values: Record<string, boolean> }) {
    const { data, setData, post, processing } = useForm<{ channels: Record<string, boolean> }>({
        channels: values,
    });

    function toggle(key: string, on: boolean) {
        setData('channels', { ...data.channels, [key]: on });
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agent/settings/notifications');
    }

    return (
        <section className="bg-white rounded-xl border border-ink-200 shadow-soft p-6">
            <h2 className="text-base font-bold">Notification preferences</h2>
            <p className="text-[12.5px] text-ink-500 mb-5">Choose which email alerts you'd like to receive.</p>

            <form onSubmit={submit} className="space-y-3">
                {Object.entries(channels).map(([key, label]) => {
                    const on = !! data.channels[key];
                    return (
                        <label key={key} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-ink-50/40 border border-ink-100 cursor-pointer hover:bg-ink-50">
                            <span className="text-[13px] font-medium">{label}</span>
                            <button
                                type="button"
                                onClick={() => toggle(key, !on)}
                                role="switch"
                                aria-checked={on}
                                className={`relative w-10 h-6 rounded-full transition-colors ${on ? 'bg-brand-500' : 'bg-ink-300'}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
                            </button>
                        </label>
                    );
                })}
                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={processing}
                        className="px-5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-60 inline-flex items-center gap-2 font-semibold transition"
                    >
                        {processing && <Spinner size={13} />}
                        {processing ? 'Saving…' : 'Save preferences'}
                    </button>
                </div>
            </form>
        </section>
    );
}

/* ───────── Banking ───────── */

function BankingSection({ banking }: { banking: Props['banking'] }) {
    const { data, setData, post, processing, errors } = useForm({
        bank_account_holder: banking.bank_account_holder ?? '',
        bank_account_number: banking.bank_account_number ?? '',
        bank_code:           banking.bank_code ?? '',
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agent/settings/banking');
    }

    return (
        <section className="bg-white rounded-xl border border-ink-200 shadow-soft p-6">
            <h2 className="text-base font-bold">Banking &amp; payouts</h2>
            <p className="text-[12.5px] text-ink-500 mb-5">Commission payouts route to this bank account via Paystack.</p>

            <form onSubmit={submit} className="space-y-4">
                <div>
                    <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Account holder *</label>
                    <input
                        value={data.bank_account_holder}
                        onChange={(e) => setData('bank_account_holder', e.target.value)}
                        required
                        placeholder="Name as it appears on the account"
                        className={inputCls}
                    />
                    {errors.bank_account_holder && <p className="text-[11px] text-danger mt-1">{errors.bank_account_holder}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Account number *</label>
                        <input
                            value={data.bank_account_number}
                            onChange={(e) => setData('bank_account_number', e.target.value)}
                            required
                            inputMode="numeric"
                            placeholder="e.g. 1234567890"
                            className={inputCls}
                        />
                        {errors.bank_account_number && <p className="text-[11px] text-danger mt-1">{errors.bank_account_number}</p>}
                    </div>
                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Bank *</label>
                        <select
                            value={data.bank_code}
                            onChange={(e) => setData('bank_code', e.target.value)}
                            required
                            className={inputCls}
                        >
                            <option value="">Select a bank…</option>
                            <option value="ABSA">ABSA</option>
                            <option value="CAPITEC">Capitec</option>
                            <option value="DISCOVERY">Discovery Bank</option>
                            <option value="FNB">FNB</option>
                            <option value="INVESTEC">Investec</option>
                            <option value="NEDBANK">Nedbank</option>
                            <option value="STANDARD_BANK">Standard Bank</option>
                            <option value="TYMEBANK">TymeBank</option>
                        </select>
                        {errors.bank_code && <p className="text-[11px] text-danger mt-1">{errors.bank_code}</p>}
                    </div>
                </div>

                {banking.paystack_recipient_code && (
                    <div className="bg-ink-50/40 border border-ink-100 rounded-lg p-3 text-[12px] text-ink-600">
                        <span className="font-semibold">Paystack recipient:</span> {banking.paystack_recipient_code}
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={processing}
                        className="px-5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-60 inline-flex items-center gap-2 font-semibold transition"
                    >
                        {processing && <Spinner size={13} />}
                        {processing ? 'Saving…' : 'Save banking details'}
                    </button>
                </div>
            </form>
        </section>
    );
}
