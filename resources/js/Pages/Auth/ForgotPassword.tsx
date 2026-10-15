import { FormEvent } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AuthLayout from '@/Layouts/AuthLayout';
import FormField from '@/Components/FormField';

export default function ForgotPassword() {
    const { flash } = usePage<{ flash?: { success?: string } }>().props;
    const { data, setData, post, processing, errors } = useForm({ email: '' });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/forgot-password');
    }

    return (
        <AuthLayout
            heading={<>Reset your<br />password.</>}
            subheading="Enter the email on your account and we'll send you a secure link to set a new password."
        >
            <Head title="Forgot password" />
            <h2 className="text-2xl font-bold tracking-tight">Forgot your password?</h2>
            <p className="text-[14px] text-ink-500 mt-1">We'll email you a reset link.</p>

            {flash?.success && (
                <div className="mt-5 rounded-lg bg-success/10 border border-success/30 text-success px-3.5 py-2.5 text-[13px]">
                    {flash.success}
                </div>
            )}

            <form onSubmit={submit} className="space-y-4 mt-6">
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
                <button
                    type="submit"
                    disabled={processing}
                    className="w-full py-2.5 bg-ink-900 hover:bg-brand-500 disabled:opacity-60 text-white rounded-lg text-[14px] font-semibold transition"
                >
                    {processing ? 'Sending…' : 'Send reset link'}
                </button>
            </form>

            <p className="text-center text-[13px] text-ink-500 mt-6">
                Remembered it?{' '}
                <Link href="/login" className="text-brand-600 font-semibold hover:underline">
                    Back to sign in
                </Link>
            </p>
        </AuthLayout>
    );
}
