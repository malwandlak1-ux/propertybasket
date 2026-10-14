import { FormEvent } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { AuthSplitCard, IconInput, solidPillCls, useAuthColors } from '@/Components/Auth/AuthKit';

type Props = { email: string; token: string };

export default function ResetPassword({ email, token }: Props) {
    const { accent, gradient } = useAuthColors();
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
        <AuthSplitCard
            panelTitle="Almost there!"
            panelBody="Choose a new password, then sign in with your fresh details."
            panelAction={{ label: 'Sign in', href: '/login' }}
        >
            <Head title="Reset password" />
            <div className="max-w-[360px] w-full mx-auto">
                <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight text-center leading-tight" style={{ color: accent }}>
                    Set a new password
                </h1>
                <p className="text-[13px] text-ink-500 text-center mt-3">For {email || 'your account'}.</p>

                <form onSubmit={submit} className="mt-7 space-y-3.5">
                    <IconInput icon="mail" accent={accent} type="email" placeholder="Email" autoComplete="email" required
                        value={data.email} onChange={(e) => setData('email', e.target.value)} error={errors.email} />
                    <IconInput icon="lock" accent={accent} type="password" placeholder="New password (8+ characters)" autoComplete="new-password" required
                        value={data.password} onChange={(e) => setData('password', e.target.value)} error={errors.password} />
                    <IconInput icon="lock" accent={accent} type="password" placeholder="Confirm new password" autoComplete="new-password" required
                        value={data.password_confirmation} onChange={(e) => setData('password_confirmation', e.target.value)} error={errors.password_confirmation} />
                    <div className="pt-4 flex justify-center">
                        <button type="submit" disabled={processing} className={solidPillCls} style={{ background: gradient }}>
                            {processing ? 'Saving…' : 'Reset password'}
                        </button>
                    </div>
                </form>

                <p className="md:hidden text-center text-[13px] text-ink-500 mt-8">
                    <Link href="/login" className="font-semibold hover:underline" style={{ color: accent }}>Back to sign in</Link>
                </p>
            </div>
        </AuthSplitCard>
    );
}
