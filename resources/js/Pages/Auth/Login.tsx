import { FormEvent } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AuthLayout from '@/Layouts/AuthLayout';
import FormField from '@/Components/FormField';

export default function Login() {
    const { flash } = usePage<{ flash?: { success?: string } }>().props;
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/login');
    }

    return (
        <AuthLayout
            heading={<>Your all-inclusive<br />property portal.</>}
            subheading="Manage listings, leads, tenants, maintenance and payments — one platform for agencies, landlords, agents, tenants and contractors."
        >
            <Head title="Sign in" />
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-[14px] text-ink-500 mt-1">Sign in to your dashboard</p>

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
                <FormField
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    autoComplete="current-password"
                    required
                    rightLabel={
                        <Link href="/forgot-password" className="text-[12px] text-brand-600 font-medium hover:underline">
                            Forgot?
                        </Link>
                    }
                />
                <label className="flex items-center gap-2 text-[13px] text-ink-700">
                    <input
                        type="checkbox"
                        className="rounded border-ink-300"
                        checked={data.remember}
                        onChange={(e) => setData('remember', e.target.checked)}
                    />
                    Remember me for 30 days
                </label>
                <button
                    type="submit"
                    disabled={processing}
                    className="w-full py-2.5 bg-ink-900 hover:bg-brand-500 disabled:opacity-60 text-white rounded-lg text-[14px] font-semibold transition"
                >
                    {processing ? 'Signing in…' : 'Sign in'}
                </button>
            </form>

            <p className="text-center text-[13px] text-ink-500 mt-6">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-brand-600 font-semibold hover:underline">
                    Create one
                </Link>
            </p>
        </AuthLayout>
    );
}
