import { FormEvent, useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AppLogo from '@/Components/AppLogo';
import { useBrand } from '@/Hooks/useEdition';

/**
 * Sign-in screen: a floating two-panel card. Form on the left, a gradient
 * welcome panel (with sign-up) on the right, in the site's brand colours.
 */
export default function Login() {
    const brand = useBrand();
    const { flash } = usePage<{ flash?: { success?: string; error?: string } }>().props;
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/login');
    }

    // Gradient ends + a solid accent for text, in the site's colours.
    const from = brand.custom ? brand.color : '#F98A45';
    const to = brand.custom ? (brand.color_alt ?? brand.color) : '#E15A12';
    const accent = brand.custom ? brand.color : '#E15A12';
    const panel = `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
    const ring = { ['--tw-ring-color' as string]: `${accent}55` };

    return (
        <div className="min-h-screen bg-[#EEF1F0] relative overflow-hidden flex items-center justify-center px-4 py-10">
            <Head title="Sign in" />

            {/* Background shapes */}
            <div aria-hidden className="absolute -top-24 right-[8%] w-[420px] h-[420px] opacity-90 hidden md:block"
                 style={{ background: '#E85D6A', clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }} />
            <div aria-hidden className="absolute -bottom-40 -left-32 w-[420px] h-[420px] rounded-full opacity-95 hidden md:block"
                 style={{ background: 'linear-gradient(135deg, #FFD54F, #F9B233)' }} />

            <div className="relative w-full max-w-[960px] bg-white rounded-2xl shadow-[0_30px_80px_-20px_rgba(15,23,42,0.25)] overflow-hidden grid md:grid-cols-[1.35fr_1fr]">
                {/* ── Sign-in form ──────────────────────────────────────── */}
                <div className="px-6 sm:px-12 py-8 sm:py-10 flex flex-col">
                    <AppLogo height={24} />

                    <div className="flex-1 flex flex-col justify-center max-w-[360px] w-full mx-auto py-8">
                        <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight text-center leading-tight" style={{ color: accent }}>
                            Sign in to {brand.name}
                        </h1>
                        <p className="text-[13px] text-ink-500 text-center mt-3">Use the email and password for your account</p>

                        {flash?.success && (
                            <div className="mt-5 rounded-lg bg-success/10 border border-success/30 text-success px-3.5 py-2.5 text-[13px]">{flash.success}</div>
                        )}
                        {flash?.error && (
                            <div className="mt-5 rounded-lg bg-danger/10 border border-danger/30 text-danger px-3.5 py-2.5 text-[13px]">{flash.error}</div>
                        )}

                        <form onSubmit={submit} className="mt-7 space-y-3.5">
                            <div>
                                <label className="flex items-center gap-3 bg-[#F4F8F7] rounded-lg px-4 h-12 focus-within:ring-2 transition" style={ring}>
                                    <svg className="w-4 h-4 text-ink-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
                                    <span className="sr-only">Email</span>
                                    <input
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        placeholder="Email"
                                        autoComplete="email"
                                        required
                                        className="flex-1 min-w-0 bg-transparent text-[14px] placeholder:text-ink-400 focus:outline-none"
                                    />
                                </label>
                                {errors.email && <p className="text-[12px] text-danger mt-1.5 px-1">{errors.email}</p>}
                            </div>

                            <div>
                                <label className="flex items-center gap-3 bg-[#F4F8F7] rounded-lg px-4 h-12 focus-within:ring-2 transition" style={ring}>
                                    <svg className="w-4 h-4 text-ink-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                                    <span className="sr-only">Password</span>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        placeholder="Password"
                                        autoComplete="current-password"
                                        required
                                        className="flex-1 min-w-0 bg-transparent text-[14px] placeholder:text-ink-400 focus:outline-none"
                                    />
                                    <button type="button" onClick={() => setShowPassword((s) => ! s)} className="text-[11px] font-semibold text-ink-400 hover:text-ink-700 uppercase tracking-wide">
                                        {showPassword ? 'Hide' : 'Show'}
                                    </button>
                                </label>
                                {errors.password && <p className="text-[12px] text-danger mt-1.5 px-1">{errors.password}</p>}
                            </div>

                            <label className="flex items-center justify-center gap-2 text-[12.5px] text-ink-600 pt-1">
                                <input
                                    type="checkbox"
                                    className="rounded border-ink-300"
                                    style={{ accentColor: accent }}
                                    checked={data.remember}
                                    onChange={(e) => setData('remember', e.target.checked)}
                                />
                                Keep me signed in for 30 days
                            </label>

                            <div className="text-center">
                                <Link href="/forgot-password" className="inline-block text-[13.5px] text-ink-800 border-b border-ink-300 pb-0.5 hover:border-ink-800">
                                    Forgot your password?
                                </Link>
                            </div>

                            <div className="pt-4 flex justify-center">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-[200px] h-12 rounded-full text-white text-[13px] font-semibold uppercase tracking-[0.18em] shadow-[0_10px_25px_-10px_rgba(0,0,0,0.35)] hover:brightness-105 active:scale-[0.99] disabled:opacity-60 transition"
                                    style={{ background: panel }}
                                >
                                    {processing ? 'Signing in…' : 'Sign in'}
                                </button>
                            </div>
                        </form>

                        {/* Small screens hide the welcome panel, so offer sign-up here. */}
                        <p className="md:hidden text-center text-[13px] text-ink-500 mt-8">
                            New here?{' '}
                            <Link href="/register" className="font-semibold hover:underline" style={{ color: accent }}>Create an account</Link>
                        </p>
                    </div>
                </div>

                {/* ── Welcome panel ─────────────────────────────────────── */}
                <div className="hidden md:flex relative items-center justify-center text-white text-center px-10 py-16 overflow-hidden" style={{ background: panel }}>
                    <span aria-hidden className="absolute top-[-40px] right-[-30px] w-[260px] h-[200px] bg-white/10" style={{ clipPath: 'polygon(0 30%, 100% 0, 100% 100%)' }} />
                    <span aria-hidden className="absolute top-[22%] left-[12%] w-14 h-14 bg-white/10 rotate-45 rounded-md" />
                    <span aria-hidden className="absolute top-[42%] left-[-24px] w-[90px] h-[90px] bg-white/10" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
                    <span aria-hidden className="absolute bottom-[26%] left-[42%] w-9 h-9 rounded-full bg-white/15" />
                    <span aria-hidden className="absolute bottom-[-20px] right-[16%] w-[110px] h-[110px] bg-white/10" style={{ clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />
                    <span aria-hidden className="absolute top-[30%] right-[18%] w-7 h-3 bg-white/15 rotate-12 rounded-sm" />

                    <div className="relative max-w-[280px]">
                        <h2 className="text-[34px] font-bold leading-tight tracking-tight">Hello, Friend!</h2>
                        <p className="text-[14px] text-white/85 mt-4 leading-relaxed">
                            {brand.custom
                                ? <>Got an invitation from {brand.name}? Use the link in your email to set up your account, or create one here.</>
                                : <>Enter your details and start managing your properties, rent and maintenance with us.</>}
                        </p>
                        <Link
                            href="/register"
                            className="inline-flex items-center justify-center mt-8 w-[200px] h-12 rounded-full border-2 border-white/85 text-[13px] font-semibold uppercase tracking-[0.18em] hover:bg-white hover:text-ink-900 transition"
                        >
                            Sign up
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
