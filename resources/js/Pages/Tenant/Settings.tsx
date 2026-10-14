import { FormEvent, useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import TenantLayout from '@/Layouts/TenantLayout';
import { Spinner } from '@/Components/Skeleton';
import AppearanceSettings from '@/Components/Dashboard/AppearanceSettings';
import { PageHeader, btnPrimary } from '@/Components/Dashboard/Charts';
import Icon, { IconName } from '@/Components/Dashboard/Icon';

type Props = {
    tenant: { id: number; name: string };
    lease: { address: string; suburb: string | null; city: string | null; monthly_rent: number };
    profile: { name: string; email: string; phone: string | null };
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

const TABS: { key: 'contact' | 'password' | 'appearance'; label: string; hint: string; icon: IconName }[] = [
    { key: 'contact',    label: 'Contact details', hint: 'Name, email and phone', icon: 'user' },
    { key: 'password',   label: 'Password',        hint: 'Change your sign-in password', icon: 'pen' },
    { key: 'appearance', label: 'Appearance',      hint: 'Dashboard colour', icon: 'eye' },
];
type TabKey = (typeof TABS)[number]['key'];

const inputCls = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[14px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition';
const labelCls = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

export default function TenantSettings({ lease, profile }: Props) {
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
