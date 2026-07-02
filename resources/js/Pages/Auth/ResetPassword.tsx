import { FormEvent } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AuthLayout from '@/Layouts/AuthLayout';
import FormField from '@/Components/FormField';

type Props = { email: string; token: string };

export default function ResetPassword({ email, token }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/reset-password');
    }

    return (
        <AuthLayout
            heading={<>Choose a new<br />password.</>}
            subheading="Set a new password for your account, then sign in with your fresh credentials."
        >
            <Head title="Reset password" />
            <h2 className="text-2xl font-bold tracking-tight">Set a new password</h2>
            <p className="text-[14px] text-ink-500 mt-1">For {email || 'your account'}.</p>

            <form onSubmit={submit} className="space-y-4 mt-6">
                <FormField
                    label="Email"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    autoComplete="email"
                    required
                />
                <FormField
                    label="New password"
                    type="password"
                    placeholder="••••••••"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    autoComplete="new-password"
                    required
                />
                <FormField
                    label="Confirm new password"
                    type="password"
                    placeholder="••••••••"
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                    error={errors.password_confirmation}
                    autoComplete="new-password"
                    required
                />
                <button
                    type="submit"
                    disabled={processing}
                    className="w-full py-2.5 bg-ink-900 hover:bg-brand-500 disabled:opacity-60 text-white rounded-lg text-[14px] font-semibold transition"
                >
                    {processing ? 'Resetting…' : 'Reset password'}
                </button>
            </form>

            <p className="text-center text-[13px] text-ink-500 mt-6">
                <Link href="/login" className="text-brand-600 font-semibold hover:underline">
                    Back to sign in
                </Link>
            </p>
        </AuthLayout>
    );
}
