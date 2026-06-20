import { FormEvent } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AuthLayout from '@/Layouts/AuthLayout';
import FormField from '@/Components/FormField';

type InvitationProps = {
    invitation: {
        token: string;
        email: string;
        role: string;
        invited_by: { name: string } | null;
    };
};

const ROLE_LABEL: Record<string, string> = {
    agent: 'Agent',
    tenant: 'Tenant',
    landlord: 'Landlord',
    contractor: 'Contractor',
};

export default function AcceptInvite({ invitation }: InvitationProps) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        password: '',
        password_confirmation: '',
        terms_accepted: false,
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post(`/invite/${invitation.token}`);
    }

    const inviterName = invitation.invited_by?.name ?? 'Property Basket';
    const roleLabel = ROLE_LABEL[invitation.role] ?? invitation.role;

    return (
        <AuthLayout
            heading={<>You&apos;ve been<br />invited.</>}
            subheading="Set up your account to access your dashboard. It only takes a minute."
        >
            <Head title="Accept invitation" />
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-ink-900 flex items-center justify-center text-white font-bold text-sm">
                    PB
                </div>
                <div>
                    <p className="text-[13px] font-semibold">{inviterName}</p>
                    <p className="text-[11px] text-ink-500">
                        invited you to join as a{' '}
                        <span className="font-semibold text-brand-700">{roleLabel}</span>
                    </p>
                </div>
            </div>

            <h2 className="text-2xl font-bold tracking-tight">Set up your account</h2>
            <p className="text-[14px] text-ink-500 mt-1">
                For <span className="font-medium text-ink-900">{invitation.email}</span>
            </p>

            <form onSubmit={submit} className="space-y-4 mt-6">
                <FormField
                    label="Full name"
                    placeholder="Your name"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    error={errors.name}
                    autoComplete="name"
                    required
                />
                <FormField
                    label="Create password"
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
                <label className="flex items-start gap-2 text-[12px] text-ink-700">
                    <input
                        type="checkbox"
                        className="rounded border-ink-300 mt-0.5"
                        checked={data.terms_accepted}
                        onChange={(e) => setData('terms_accepted', e.target.checked)}
                    />
                    I agree to the{' '}
                    <a href="#" className="text-brand-600 font-semibold">Terms</a> &amp;{' '}
                    <a href="#" className="text-brand-600 font-semibold">POPIA policy</a>
                </label>
                {errors.terms_accepted && (
                    <p className="text-[11px] text-danger">{errors.terms_accepted}</p>
                )}
                <button
                    type="submit"
                    disabled={processing}
                    className="w-full py-2.5 bg-ink-900 hover:bg-brand-500 disabled:opacity-60 text-white rounded-lg text-[14px] font-semibold transition"
                >
                    {processing ? 'Activating…' : 'Activate my account'}
                </button>
            </form>

            <p className="text-center text-[13px] text-ink-500 mt-6">
                Wrong account?{' '}
                <Link href="/login" className="text-brand-600 font-semibold hover:underline">
                    Sign in instead
                </Link>
            </p>
        </AuthLayout>
    );
}
