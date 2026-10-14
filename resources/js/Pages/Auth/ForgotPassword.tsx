import { FormEvent } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { AuthSplitCard, IconInput, solidPillCls, useAuthColors } from '@/Components/Auth/AuthKit';

export default function ForgotPassword() {
    const { accent, gradient } = useAuthColors();
    const { flash } = usePage<{ flash?: { success?: string } }>().props;
    const { data, setData, post, processing, errors } = useForm({ email: '' });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/forgot-password');
    }

    return (
        <AuthSplitCard
            panelTitle="Remembered it?"
            panelBody="Go back and sign in with your email and password."
            panelAction={{ label: 'Sign in', href: '/login' }}
        >
            <Head title="Forgot password" />
            <div className="max-w-[360px] w-full mx-auto">
                <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight text-center leading-tight" style={{ color: accent }}>
                    Forgot your password?
                </h1>
                <p className="text-[13px] text-ink-500 text-center mt-3">Enter the email on your account and we'll send you a link to set a new password.</p>

                {flash?.success && (
                    <div className="mt-5 rounded-lg bg-success/10 border border-success/30 text-success px-3.5 py-2.5 text-[13px]">{flash.success}</div>
                )}

                <form onSubmit={submit} className="mt-7 space-y-3.5">
                    <IconInput icon="mail" accent={accent} type="email" placeholder="Email" autoComplete="email" required
                        value={data.email} onChange={(e) => setData('email', e.target.value)} error={errors.email} />
                    <div className="pt-4 flex justify-center">
                        <button type="submit" disabled={processing} className={solidPillCls} style={{ background: gradient }}>
                            {processing ? 'Sending…' : 'Send link'}
                        </button>
                    </div>
                </form>

                <p className="md:hidden text-center text-[13px] text-ink-500 mt-8">
                    Remembered it? <Link href="/login" className="font-semibold hover:underline" style={{ color: accent }}>Sign in</Link>
                </p>
            </div>
        </AuthSplitCard>
    );
}
