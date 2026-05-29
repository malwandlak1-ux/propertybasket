import { FormEvent, useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import TenantLayout from '@/Layouts/TenantLayout';
import { Spinner } from '@/Components/Skeleton';

type Props = {
    tenant: { id: number; name: string };
    lease: { address: string; suburb: string | null; city: string | null; monthly_rent: number };
    profile: { name: string; email: string; phone: string | null };
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

const TABS = [
    { key: 'contact',  label: 'Contact details' },
    { key: 'password', label: 'Password' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const inputCls = 'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';
const labelCls = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

export default function TenantSettings({ tenant, lease, profile }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [tab, setTab] = useState<TabKey>('contact');

    return (
        <TenantLayout crumb="Settings" leaseAddress={lease.address}>
            <Head title="Settings" />

            <div className="px-8 py-7 max-w-4xl">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                    <p className="text-[14px] text-ink-500 mt-1">
                        Keep your contact details up to date — your landlord and agent use these to reach you.
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
                        {tab === 'contact' && <ContactPanel profile={profile} />}
                        {tab === 'password' && <PasswordPanel />}
                    </div>
                </div>
            </div>
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
        <form onSubmit={submit} className="bg-white rounded-xl border border-ink-200 shadow-soft p-6 space-y-4">
            <div>
                <h2 className="text-base font-bold">Contact details</h2>
                <p className="text-[12px] text-ink-500 mt-0.5">How your landlord, agent, and Property Basket reach you.</p>
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

            <div>
                <label className={labelCls}>Phone</label>
                <input value={data.phone} onChange={(e) => setData('phone', e.target.value)} placeholder="+27 82 555 1234" className={inputCls} />
                {errors.phone && <p className="text-[11px] text-danger mt-1">{errors.phone}</p>}
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={! isDirty || processing}
                    className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-40 inline-flex items-center gap-2 font-semibold"
                >
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
    return (
        <form onSubmit={submit} className="bg-white rounded-xl border border-ink-200 shadow-soft p-6 space-y-4">
            <div>
                <h2 className="text-base font-bold">Change password</h2>
                <p className="text-[12px] text-ink-500 mt-0.5">Use at least 8 characters. You'll stay signed in on this device.</p>
            </div>

            <div>
                <label className={labelCls}>Current password *</label>
                <input type="password" value={data.current_password} onChange={(e) => setData('current_password', e.target.value)} required className={inputCls} />
                {errors.current_password && <p className="text-[11px] text-danger mt-1">{errors.current_password}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>New password *</label>
                    <input type="password" value={data.password} onChange={(e) => setData('password', e.target.value)} required minLength={8} className={inputCls} />
                    {errors.password && <p className="text-[11px] text-danger mt-1">{errors.password}</p>}
                </div>
                <div>
                    <label className={labelCls}>Confirm new password *</label>
                    <input type="password" value={data.password_confirmation} onChange={(e) => setData('password_confirmation', e.target.value)} required minLength={8} className={inputCls} />
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={processing || ! data.current_password || ! data.password || data.password !== data.password_confirmation}
                    className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-40 inline-flex items-center gap-2 font-semibold"
                >
                    {processing && <Spinner size={13} />}
                    {processing ? 'Saving…' : 'Change password'}
                </button>
            </div>
        </form>
    );
}
