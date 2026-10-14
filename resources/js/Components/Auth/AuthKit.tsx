/**
 * Building blocks for the sign-in screens (Access = sign in / sign up,
 * Forgot / Reset password): a floating card on a soft background, icon
 * inputs on grey fields, pill buttons and a gradient panel with geometric
 * shapes, all in the site's brand colours.
 */
import { InputHTMLAttributes, ReactNode } from 'react';
import { Link } from '@inertiajs/react';
import AppLogo from '@/Components/AppLogo';
import { useBrand } from '@/Hooks/useEdition';

export function useAuthColors() {
    const brand = useBrand();
    const from = brand.custom ? brand.color : '#F98A45';
    const to = brand.custom ? (brand.color_alt ?? brand.color) : '#E15A12';

    return {
        brand,
        accent: brand.custom ? brand.color : '#E15A12',
        gradient: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
    };
}

/** Plain soft-grey page background behind the card. */
export function AuthBackground({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-[#EEF1F0] relative overflow-hidden flex items-center justify-center px-4 py-10">
            {children}
        </div>
    );
}

export const cardCls = 'relative w-full max-w-[960px] bg-white rounded-2xl shadow-[0_30px_80px_-20px_rgba(15,23,42,0.25)] overflow-hidden';

/** Translucent shapes laid over a gradient panel. */
export function PanelShapes() {
    return (
        <>
            <span aria-hidden className="absolute top-[-40px] right-[-30px] w-[260px] h-[200px] bg-white/10" style={{ clipPath: 'polygon(0 30%, 100% 0, 100% 100%)' }} />
            <span aria-hidden className="absolute top-[18%] left-[14%] w-14 h-14 bg-white/10 rotate-45 rounded-md" />
            <span aria-hidden className="absolute top-[44%] left-[-24px] w-[90px] h-[90px] bg-white/10" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
            <span aria-hidden className="absolute bottom-[24%] left-[44%] w-9 h-9 rounded-full bg-white/15" />
            <span aria-hidden className="absolute bottom-[-20px] right-[16%] w-[110px] h-[110px] bg-white/10" style={{ clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />
            <span aria-hidden className="absolute top-[30%] right-[18%] w-7 h-3 bg-white/15 rotate-12 rounded-sm" />
            <span aria-hidden className="absolute bottom-[10%] left-[10%] w-6 h-6 bg-white/10 rotate-45 rounded-sm" />
        </>
    );
}

const ICONS = {
    user:  <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    mail:  <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    lock:  <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    phone: <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></>,
    badge: <><circle cx="12" cy="9" r="5" /><path d="m8.5 13-1.5 8 5-3 5 3-1.5-8" /></>,
};

type IconInputProps = InputHTMLAttributes<HTMLInputElement> & {
    icon: keyof typeof ICONS;
    error?: string;
    accent: string;
    trailing?: ReactNode;
};

/** Grey field with a leading icon (label kept for screen readers). */
export function IconInput({ icon, error, accent, trailing, placeholder, ...input }: IconInputProps) {
    return (
        <div>
            <label className="flex items-center gap-3 bg-[#F4F8F7] rounded-lg px-4 h-12 focus-within:ring-2 transition" style={{ ['--tw-ring-color' as string]: `${accent}55` }}>
                <svg className="w-4 h-4 text-ink-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>{ICONS[icon]}</svg>
                <span className="sr-only">{placeholder}</span>
                <input {...input} placeholder={placeholder} className="flex-1 min-w-0 bg-transparent text-[14px] placeholder:text-ink-400 focus:outline-none" />
                {trailing}
            </label>
            {error && <p className="text-[12px] text-danger mt-1.5 px-1">{error}</p>}
        </div>
    );
}

/**
 * Static card with the gradient panel on the left and a form on the right
 * (forgot / reset password), matching the sign-up side of the sliding card.
 */
export function AuthSplitCard({ panelTitle, panelBody, panelAction, children }: {
    panelTitle: string;
    panelBody: ReactNode;
    panelAction: { label: string; href: string };
    children: ReactNode;
}) {
    const { gradient } = useAuthColors();

    return (
        <AuthBackground>
            <div className={`${cardCls} grid md:grid-cols-[1fr_1.35fr] md:min-h-[560px]`}>
                <div className="hidden md:flex relative items-center justify-center text-white text-center px-10 py-16 overflow-hidden" style={{ background: gradient }}>
                    <PanelShapes />
                    <div className="absolute top-8 left-8"><AppLogo height={22} variant="white" /></div>
                    <div className="relative max-w-[280px]">
                        <h2 className="text-[34px] font-bold leading-tight tracking-tight">{panelTitle}</h2>
                        <p className="text-[14px] text-white/85 mt-4 leading-relaxed">{panelBody}</p>
                        <Link href={panelAction.href} className={`${outlinePillCls} mt-8`}>{panelAction.label}</Link>
                    </div>
                </div>
                <div className="px-6 sm:px-12 py-8 sm:py-12 flex flex-col">
                    <div className="md:hidden"><AppLogo height={24} /></div>
                    <div className="flex-1 flex items-center">{children}</div>
                </div>
            </div>
        </AuthBackground>
    );
}

export const pillCls ='inline-flex items-center justify-center w-[200px] h-12 rounded-full text-[13px] font-semibold uppercase tracking-[0.18em] transition';
export const solidPillCls = `${pillCls} text-white shadow-[0_10px_25px_-10px_rgba(0,0,0,0.35)] hover:brightness-105 active:scale-[0.99] disabled:opacity-60`;
export const outlinePillCls = `${pillCls} border-2 border-white/85 text-white hover:bg-white hover:text-ink-900`;
