import { FormEvent, ReactNode } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AuthLayout from '@/Layouts/AuthLayout';
import FormField from '@/Components/FormField';

type RoleKey = 'agency' | 'landlord' | 'contractor';

type RoleConfig = {
    key: RoleKey;
    title: string;
    description: string;
    iconBg: string;
    iconColor: string;
    icon: ReactNode;
    nameLabel: string;
    needsBusinessName: boolean;
    complianceLabel?: string;
    complianceHint?: string;
};

const ROLES: RoleConfig[] = [
    {
        key: 'agency',
        title: 'Estate Agency',
        description: 'Manage agents, listings, leads & payouts',
        iconBg: 'bg-brand-50',
        iconColor: 'text-brand-600',
        icon: <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />,
        nameLabel: 'Agency name',
        needsBusinessName: true,
        complianceLabel: 'EAAB FFC Number',
        complianceHint: 'Required for estate agencies under the EAAB.',
    },
    {
        key: 'landlord',
        title: 'Private Landlord',
        description: 'Self-manage up to 5 properties',
        iconBg: 'bg-sky-50',
        iconColor: 'text-sky-600',
        icon: (
            <>
                <circle cx="12" cy="8" r="5" />
                <path d="M20 21a8 8 0 0 0-16 0" />
            </>
        ),
        nameLabel: 'Your name',
        needsBusinessName: false,
    },
    {
        key: 'contractor',
        title: 'Maintenance Contractor',
        description: 'Get jobs from agencies & landlords',
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        icon: <path d="M14 6.5a2 2 0 1 0-4 0M9 12l-7 7 3 3 7-7M14 12l4-4 4 4-4 4z" />,
        nameLabel: 'Business name',
        needsBusinessName: true,
        complianceLabel: 'CIPC Registration Number',
        complianceHint: 'Optional now — required before you can receive payouts.',
    },
];

export default function Register() {
    const { data, setData, post, processing, errors } = useForm({
        role: '' as RoleKey | '',
        business_name: '',
        name: '',
        phone: '',
        email: '',
        password: '',
        password_confirmation: '',
        compliance_number: '',
        terms_accepted: false,
    });

    const selected = ROLES.find((r) => r.key === data.role);

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/register');
    }

    return (
        <AuthLayout
            heading={<>Start managing<br />properties the<br />right way.</>}
            bullets={[
                { label: 'Free 14-day trial, no card needed' },
                { label: 'Listings sync to propertybasket.co.za' },
                { label: 'Paystack payments built in' },
                { label: 'Access the contractor marketplace' },
            ]}
        >
            <Head title="Create your account" />
            <h2 className="text-2xl font-bold tracking-tight">Create your account</h2>
            <p className="text-[14px] text-ink-500 mt-1">First, tell us who you are</p>

            <form onSubmit={submit}>
                <div className="space-y-2.5 mt-6">
                    {ROLES.map((role) => {
                        const isSelected = data.role === role.key;
                        return (
                            <button
                                type="button"
                                key={role.key}
                                onClick={() => setData('role', role.key)}
                                className={
                                    'w-full text-left cursor-pointer block border rounded-xl p-4 transition ' +
                                    (isSelected
                                        ? 'border-brand bg-brand-50'
                                        : 'border-ink-200 hover:border-ink-300')
                                }
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg ${role.iconBg} flex items-center justify-center shrink-0`}>
                                        <svg className={`w-5 h-5 ${role.iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                            {role.icon}
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[14px] font-bold">{role.title}</p>
                                        <p className="text-[12px] text-ink-500">{role.description}</p>
                                    </div>
                                    {isSelected && (
                                        <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                                            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                                                <path d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}

                    <div className="block border border-dashed border-ink-200 rounded-xl p-4 opacity-60">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-ink-100 flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <rect x="2" y="5" width="20" height="14" rx="2" />
                                    <path d="M2 8l10 6 10-6" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-[14px] font-bold text-ink-500">Agent or Tenant?</p>
                                <p className="text-[12px] text-ink-400">
                                    Invite-only — ask your agency/landlord to invite you
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                {errors.role && <p className="text-[11px] text-danger mt-2">{errors.role}</p>}

                {selected && (
                    <div className="mt-5 space-y-4 border-t border-ink-200 pt-5">
                        {selected.needsBusinessName && (
                            <FormField
                                label={selected.nameLabel}
                                placeholder={selected.key === 'agency' ? 'e.g. Sandton Realty' : 'e.g. JH Plumbing'}
                                value={data.business_name}
                                onChange={(e) => setData('business_name', e.target.value)}
                                error={errors.business_name}
                                required
                            />
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <FormField
                                label="Your name"
                                placeholder="Full name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                error={errors.name}
                                autoComplete="name"
                                required
                            />
                            <FormField
                                label="Phone"
                                placeholder="+27 …"
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
                                error={errors.phone}
                                autoComplete="tel"
                            />
                        </div>

                        <FormField
                            label="Email"
                            type="email"
                            placeholder="you@example.com"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            error={errors.email}
                            autoComplete="email"
                            required
                        />

                        <FormField
                            label="Password"
                            type="password"
                            placeholder="At least 8 characters"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            error={errors.password}
                            autoComplete="new-password"
                            required
                        />

                        <FormField
                            label="Confirm password"
                            type="password"
                            placeholder="Re-enter password"
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            autoComplete="new-password"
                            required
                        />

                        {selected.complianceLabel && (
                            <div className="bg-brand-50 border border-brand-100 rounded-lg p-3">
                                <FormField
                                    label={selected.complianceLabel}
                                    placeholder="Compliance number"
                                    value={data.compliance_number}
                                    onChange={(e) => setData('compliance_number', e.target.value)}
                                    error={errors.compliance_number}
                                    hint={selected.complianceHint}
                                    className="bg-white"
                                    required={selected.key === 'agency'}
                                />
                            </div>
                        )}

                        <label className="flex items-start gap-2 text-[12px] text-ink-700">
                            <input
                                type="checkbox"
                                className="rounded border-ink-300 mt-0.5"
                                checked={data.terms_accepted}
                                onChange={(e) => setData('terms_accepted', e.target.checked)}
                            />
                            I agree to the{' '}
                            <a href="#" className="text-brand-600 font-semibold">Terms</a> and{' '}
                            <a href="#" className="text-brand-600 font-semibold">POPIA privacy policy</a>
                        </label>
                        {errors.terms_accepted && (
                            <p className="text-[11px] text-danger">{errors.terms_accepted}</p>
                        )}

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full py-2.5 bg-ink-900 hover:bg-ink-800 disabled:opacity-60 text-white rounded-lg text-[14px] font-semibold transition"
                        >
                            {processing ? 'Creating account…' : 'Create account & start free trial'}
                        </button>
                    </div>
                )}
            </form>

            <p className="text-center text-[13px] text-ink-500 mt-6">
                Already have an account?{' '}
                <Link href="/login" className="text-brand-600 font-semibold hover:underline">
                    Sign in
                </Link>
            </p>
        </AuthLayout>
    );
}
