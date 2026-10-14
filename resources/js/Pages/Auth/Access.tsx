import { FormEvent, useEffect, useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AppLogo from '@/Components/AppLogo';
import {
    AuthBackground, IconInput, PanelShapes, cardCls, outlinePillCls, solidPillCls, useAuthColors,
} from '@/Components/Auth/AuthKit';

type Mode = 'signin' | 'signup';
type RoleKey = 'agency' | 'landlord' | 'contractor';

type Props = { mode: Mode; roles?: RoleKey[] };

const ROLE_INFO: Record<RoleKey, { label: string; nameLabel: string; business: boolean; compliance?: string; complianceHint?: string }> = {
    landlord:   { label: 'Landlord',   nameLabel: 'Your name', business: false },
    contractor: { label: 'Contractor', nameLabel: 'Business name', business: true, compliance: 'CIPC registration number (optional)', complianceHint: 'Needed before you can receive payouts.' },
    agency:     { label: 'Estate agency', nameLabel: 'Agency name', business: true, compliance: 'EAAB FFC number', complianceHint: 'Required for estate agencies.' },
};

const EASE = 'cubic-bezier(.65,.05,.36,1)';

/**
 * Sign in and sign up on one sliding card (/login and /register). The
 * gradient panel slides across and the forms swap; the address bar follows
 * so a refresh or a failed submit lands on the same side.
 */
export default function Access({ mode: initialMode, roles }: Props) {
    const { accent, gradient, brand } = useAuthColors();
    const [mode, setMode] = useState<Mode>(initialMode);

    // A server round-trip (e.g. validation errors) can change the side.
    useEffect(() => setMode(initialMode), [initialMode]);

    function switchTo(next: Mode) {
        setMode(next);
        window.history.replaceState(window.history.state, '', next === 'signup' ? '/register' : '/login');
    }

    const signin = mode === 'signin';

    return (
        <AuthBackground>
            <Head title={signin ? 'Sign in' : 'Create account'} />

            {/* Desktop: sliding card */}
            <div className={`${cardCls} hidden md:grid grid-cols-[42fr_16fr_42fr] min-h-[600px]`}>
                {/* Sign-in form (left) */}
                <div
                    className="transition-all duration-700"
                    style={{ gridColumn: '1 / 3', gridRow: 1, transitionTimingFunction: EASE, opacity: signin ? 1 : 0, transform: signin ? 'translateX(0)' : 'translateX(-12%)', pointerEvents: signin ? 'auto' : 'none' }}
                    aria-hidden={! signin}
                >
                    <div className="h-full px-12 py-10 flex flex-col">
                        <AppLogo height={24} />
                        <div className="flex-1 flex items-center"><SignInForm accent={accent} gradient={gradient} brandName={brand.name} /></div>
                    </div>
                </div>

                {/* Sign-up form (right) */}
                <div
                    className="transition-all duration-700"
                    style={{ gridColumn: '2 / 4', gridRow: 1, transitionTimingFunction: EASE, opacity: signin ? 0 : 1, transform: signin ? 'translateX(12%)' : 'translateX(0)', pointerEvents: signin ? 'none' : 'auto' }}
                    aria-hidden={signin}
                >
                    <div className="h-full px-12 py-10 flex">
                        <div className="m-auto w-full"><SignUpForm accent={accent} gradient={gradient} roles={roles} /></div>
                    </div>
                </div>

                {/* Sliding gradient panel */}
                <div
                    className="absolute inset-y-0 w-[42%] overflow-hidden text-white z-10 transition-[left] duration-700"
                    style={{ left: signin ? '58%' : '0%', background: gradient, transitionTimingFunction: EASE }}
                >
                    <PanelShapes />

                    <div className="absolute top-8 left-8 transition-opacity duration-500" style={{ opacity: signin ? 0 : 1 }}>
                        <AppLogo height={22} variant="white" />
                    </div>

                    <PanelMessage visible={signin}
                        title="Hello, Friend!"
                        body={brand.custom
                            ? <>Got an invitation from {brand.name}? Use the link in your email, or create an account here.</>
                            : <>Enter your details and start managing your properties, rent and maintenance with us.</>}
                        action="Sign up" onAction={() => switchTo('signup')} />
                    <PanelMessage visible={! signin}
                        title="Welcome Back!"
                        body={<>To keep connected with us, please sign in with your personal info.</>}
                        action="Sign in" onAction={() => switchTo('signin')} />
                </div>
            </div>

            {/* Small screens: one form at a time, no panel */}
            <div className={`${cardCls} md:hidden px-6 py-8`}>
                <AppLogo height={24} />
                <div className="mt-6">
                    {signin
                        ? <SignInForm accent={accent} gradient={gradient} brandName={brand.name} />
                        : <SignUpForm accent={accent} gradient={gradient} roles={roles} />}
                </div>
                <p className="text-center text-[13px] text-ink-500 mt-8">
                    {signin ? 'New here? ' : 'Already have an account? '}
                    <button type="button" onClick={() => switchTo(signin ? 'signup' : 'signin')} className="font-semibold hover:underline" style={{ color: accent }}>
                        {signin ? 'Create an account' : 'Sign in'}
                    </button>
                </p>
            </div>
        </AuthBackground>
    );
}

function PanelMessage({ visible, title, body, action, onAction }: {
    visible: boolean; title: string; body: React.ReactNode; action: string; onAction: () => void;
}) {
    return (
        <div
            className="absolute inset-0 flex items-center justify-center text-center px-10 transition-all duration-700"
            style={{ transitionTimingFunction: EASE, opacity: visible ? 1 : 0, transform: visible ? 'translateX(0)' : 'translateX(8%)', pointerEvents: visible ? 'auto' : 'none' }}
            aria-hidden={! visible}
        >
            <div className="max-w-[290px]">
                <h2 className="text-[34px] font-bold leading-tight tracking-tight">{title}</h2>
                <p className="text-[14px] text-white/85 mt-4 leading-relaxed">{body}</p>
                <button type="button" onClick={onAction} className={`${outlinePillCls} mt-8`} tabIndex={visible ? 0 : -1}>
                    {action}
                </button>
            </div>
        </div>
    );
}

function SignInForm({ accent, gradient, brandName }: { accent: string; gradient: string; brandName: string }) {
    const { flash } = usePage<{ flash?: { success?: string; error?: string } }>().props;
    const [show, setShow] = useState(false);
    const { data, setData, post, processing, errors } = useForm({ email: '', password: '', remember: false });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/login');
    }

    return (
        <div className="max-w-[360px] w-full mx-auto">
            <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight text-center leading-tight" style={{ color: accent }}>
                Sign in to {brandName}
            </h1>
            <p className="text-[13px] text-ink-500 text-center mt-3">Use the email and password for your account</p>

            {flash?.success && <div className="mt-5 rounded-lg bg-success/10 border border-success/30 text-success px-3.5 py-2.5 text-[13px]">{flash.success}</div>}
            {flash?.error && <div className="mt-5 rounded-lg bg-danger/10 border border-danger/30 text-danger px-3.5 py-2.5 text-[13px]">{flash.error}</div>}

            <form onSubmit={submit} className="mt-7 space-y-3.5">
                <IconInput icon="mail" accent={accent} type="email" placeholder="Email" autoComplete="email" required
                    value={data.email} onChange={(e) => setData('email', e.target.value)} error={errors.email} />
                <IconInput icon="lock" accent={accent} type={show ? 'text' : 'password'} placeholder="Password" autoComplete="current-password" required
                    value={data.password} onChange={(e) => setData('password', e.target.value)} error={errors.password}
                    trailing={<button type="button" onClick={() => setShow((s) => ! s)} className="text-[11px] font-semibold text-ink-400 hover:text-ink-700 uppercase tracking-wide">{show ? 'Hide' : 'Show'}</button>} />

                <label className="flex items-center justify-center gap-2 text-[12.5px] text-ink-600 pt-1">
                    <input type="checkbox" className="rounded border-ink-300" style={{ accentColor: accent }}
                        checked={data.remember} onChange={(e) => setData('remember', e.target.checked)} />
                    Keep me signed in for 30 days
                </label>
                <div className="text-center">
                    <Link href="/forgot-password" className="inline-block text-[13.5px] text-ink-800 border-b border-ink-300 pb-0.5 hover:border-ink-800">
                        Forgot your password?
                    </Link>
                </div>
                <div className="pt-4 flex justify-center">
                    <button type="submit" disabled={processing} className={solidPillCls} style={{ background: gradient }}>
                        {processing ? 'Signing in…' : 'Sign in'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function SignUpForm({ accent, gradient, roles }: { accent: string; gradient: string; roles?: RoleKey[] }) {
    const available = (['landlord', 'contractor', 'agency'] as RoleKey[]).filter((r) => ! roles || roles.includes(r));
    const { data, setData, post, processing, errors } = useForm({
        role: (available.length === 1 ? available[0] : '') as RoleKey | '',
        business_name: '',
        name: '',
        phone: '',
        email: '',
        password: '',
        password_confirmation: '',
        compliance_number: '',
        terms_accepted: false,
    });
    const info = data.role ? ROLE_INFO[data.role] : null;

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/register');
    }

    return (
        <div className="max-w-[380px] w-full mx-auto">
            <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight text-center leading-tight" style={{ color: accent }}>Create Account</h1>
            <p className="text-[13px] text-ink-500 text-center mt-3">Tell us who you are, then use your email to register</p>

            <form onSubmit={submit} className="mt-6 space-y-3">
                <div className="flex justify-center gap-1.5 flex-wrap" role="radiogroup" aria-label="Account type">
                    {available.map((r) => {
                        const on = data.role === r;
                        return (
                            <button key={r} type="button" role="radio" aria-checked={on} onClick={() => setData('role', r)}
                                className={`px-4 py-2 rounded-full text-[12.5px] font-semibold border transition ${on ? 'text-white border-transparent' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}
                                style={on ? { background: gradient } : undefined}>
                                {ROLE_INFO[r].label}
                            </button>
                        );
                    })}
                </div>
                {errors.role && <p className="text-[12px] text-danger text-center">{errors.role}</p>}
                <p className="text-[11.5px] text-ink-400 text-center">Tenant or agent? Use the invitation link you were emailed.</p>

                {info?.business && (
                    <IconInput icon="briefcase" accent={accent} placeholder={info.nameLabel} required
                        value={data.business_name} onChange={(e) => setData('business_name', e.target.value)} error={errors.business_name} />
                )}
                <IconInput icon="user" accent={accent} placeholder="Name" autoComplete="name" required
                    value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} />
                <IconInput icon="mail" accent={accent} type="email" placeholder="Email" autoComplete="email" required
                    value={data.email} onChange={(e) => setData('email', e.target.value)} error={errors.email} />
                <IconInput icon="phone" accent={accent} placeholder="Phone (optional)" autoComplete="tel"
                    value={data.phone} onChange={(e) => setData('phone', e.target.value)} error={errors.phone} />
                <IconInput icon="lock" accent={accent} type="password" placeholder="Password (8+ characters)" autoComplete="new-password" required
                    value={data.password} onChange={(e) => setData('password', e.target.value)} error={errors.password} />
                <IconInput icon="lock" accent={accent} type="password" placeholder="Confirm password" autoComplete="new-password" required
                    value={data.password_confirmation} onChange={(e) => setData('password_confirmation', e.target.value)} />
                {info?.compliance && (
                    <div>
                        <IconInput icon="badge" accent={accent} placeholder={info.compliance} required={data.role === 'agency'}
                            value={data.compliance_number} onChange={(e) => setData('compliance_number', e.target.value)} error={errors.compliance_number} />
                        <p className="text-[11px] text-ink-400 mt-1 px-1">{info.complianceHint}</p>
                    </div>
                )}

                <label className="flex items-start justify-center gap-2 text-[12px] text-ink-600 pt-1">
                    <input type="checkbox" className="rounded border-ink-300 mt-0.5" style={{ accentColor: accent }}
                        checked={data.terms_accepted} onChange={(e) => setData('terms_accepted', e.target.checked)} />
                    <span>I agree to the <a href="/terms-and-conditions" target="_blank" rel="noopener" className="font-semibold" style={{ color: accent }}>Terms</a> and <a href="/privacy-policy" target="_blank" rel="noopener" className="font-semibold" style={{ color: accent }}>POPIA privacy policy</a></span>
                </label>
                {errors.terms_accepted && <p className="text-[12px] text-danger text-center">{errors.terms_accepted}</p>}

                <div className="pt-3 flex justify-center">
                    <button type="submit" disabled={processing} className={solidPillCls} style={{ background: gradient }}>
                        {processing ? 'Creating…' : 'Sign up'}
                    </button>
                </div>
            </form>
        </div>
    );
}
