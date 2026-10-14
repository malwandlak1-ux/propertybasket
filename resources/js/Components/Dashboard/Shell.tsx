import { ReactNode, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AppLogo from '@/Components/AppLogo';
import NotificationBell, { NotificationItem } from '@/Components/NotificationBell';

/**
 * Shell — the shared dashboard frame used by every role layout
 * (Admin / Agency / Agent / Contractor / Landlord / Tenant).
 *
 * Fernly-style calm workspace: a floating rounded sidebar, a pill header and a
 * rounded content panel on a soft neutral page. The `.pb-dash` class scopes
 * the dashboard tokens (radius, shadow, neutrals — see app.css) and
 * `data-accent` swaps the brand-* ramp for the user's Appearance choice.
 *
 * Layouts own their nav definitions + banners; the Shell owns the chrome.
 */

export type Accent = 'orange' | 'black' | 'blue' | 'green' | 'purple';

export type Appearance = {
    accent: Accent;
    logo_url: string | null;
    logo_inherited?: boolean;
    has_own_logo?: boolean;
    can_upload_logo?: boolean;
};

export type ShellNavItem = {
    label: string;
    href?: string;
    icon: ReactNode;
    badge?: { text: string | number; tone: 'brand' | 'danger' | 'warning' | 'muted' } | null;
    indicator?: 'danger' | 'warning' | 'success';
};

export type ShellSection = { label: string; items: ShellNavItem[] };

type SharedProps = {
    auth?: { user?: { id: number; name: string; email?: string; role: string } | null };
    notifications?: { unread_count: number; recent: NotificationItem[] } | null;
    appearance?: Appearance | null;
};

export function useAppearance(): Appearance {
    const { appearance } = usePage<SharedProps>().props;
    return appearance ?? { accent: 'orange', logo_url: null };
}

/** Sidebar mark: the user's uploaded logo, else the site logo (Property Basket or the client brand). */
export function BrandMark() {
    const { logo_url } = useAppearance();
    if (logo_url) {
        return (
            <Link href="/" aria-label="Home" className="inline-flex items-center">
                <img src={logo_url} alt="Logo" className="max-h-10 max-w-[184px] w-auto object-contain" />
            </Link>
        );
    }
    return <AppLogo height={22} href="/" />;
}

function NavLink({ item, active }: { item: ShellNavItem; active: boolean }) {
    const cls =
        'group relative flex items-center gap-3 pl-3 pr-2.5 py-2 rounded-xl text-[13.5px] transition mb-0.5 ' +
        (active
            ? 'text-ink-900 font-semibold bg-white shadow-soft'
            : 'text-ink-500 hover:text-ink-900 hover:bg-white/70');

    const inner = (
        <>
            {active && (
                <span aria-hidden className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-brand-500" />
            )}
            <span className={active ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-700'}>{item.icon}</span>
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge && (
                <span className={
                    'text-[10px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full font-semibold ' +
                    (item.badge.tone === 'brand' ? 'bg-brand-700 text-white' :
                     item.badge.tone === 'danger' ? 'bg-danger text-white' :
                     item.badge.tone === 'warning' ? 'bg-warning/15 text-warning' :
                     'bg-ink-100 text-ink-500')
                }>
                    {item.badge.text}
                </span>
            )}
            {item.indicator && (
                <span className={
                    'w-1.5 h-1.5 rounded-full ' +
                    (item.indicator === 'danger' ? 'bg-danger' : item.indicator === 'warning' ? 'bg-warning' : 'bg-success')
                } />
            )}
        </>
    );

    if (item.href) {
        return <Link href={item.href} className={cls} aria-current={active ? 'page' : undefined}>{inner}</Link>;
    }
    return <span className={cls + ' cursor-not-allowed opacity-50'} title="Coming soon">{inner}</span>;
}

type ShellProps = {
    sections: ShellSection[];
    isActive: (href: string) => boolean;
    crumb: string;
    crumbPrefix?: string;
    searchPlaceholder?: string;
    /** Second line on the sidebar account card (agency name, business…). */
    accountSubtitle?: string;
    headerActions?: ReactNode;
    /** Compliance / subscription banners rendered at the top of the panel. */
    banners?: ReactNode;
    children: ReactNode;
};

export default function Shell({
    sections, isActive, crumb, crumbPrefix, searchPlaceholder = 'Search…',
    accountSubtitle, headerActions, banners, children,
}: ShellProps) {
    const { auth, notifications } = usePage<SharedProps>().props;
    const { accent } = useAppearance();
    const [navOpen, setNavOpen] = useState(false);

    const name = auth?.user?.name ?? 'Property Basket';
    const initials = name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

    return (
        <div className="pb-dash flex min-h-screen text-ink-900 lg:p-3 lg:gap-3" data-accent={accent}>
            {navOpen && (
                <div className="lg:hidden fixed inset-0 bg-ink-900/50 z-40" onClick={() => setNavOpen(false)} aria-hidden="true" />
            )}

            <aside
                className={
                    'fixed lg:sticky inset-y-0 left-0 lg:top-3 z-50 w-[248px] shrink-0 bg-[var(--pb-panel)] lg:rounded-[26px] ' +
                    'lg:h-[calc(100vh-1.5rem)] flex flex-col transition-transform duration-200 ' +
                    (navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
                }
                onClick={() => setNavOpen(false)}
            >
                <div className="px-6 pt-6 pb-5">
                    <BrandMark />
                </div>

                <nav className="px-3 flex-1 overflow-y-auto pb-3">
                    {sections.map((s, idx) => (
                        <div key={s.label} className={idx > 0 ? 'mt-5' : ''}>
                            <p className="px-3 text-[10px] font-semibold text-ink-400 tracking-[0.14em] mb-2 uppercase">{s.label}</p>
                            {s.items.map((i) => (
                                <NavLink key={i.label} item={i} active={!!i.href && isActive(i.href)} />
                            ))}
                        </div>
                    ))}
                </nav>

                {/* Account card — accent hero with the swirl texture. */}
                <div className="p-3">
                    <div className="pb-swirl rounded-[20px] p-4 text-white">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-white/15 ring-1 ring-white/25 flex items-center justify-center text-[12px] font-bold">
                                {initials}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[13px] font-semibold truncate">{name}</p>
                                <p className="text-[11px] text-white/70 truncate">{accountSubtitle ?? auth?.user?.email ?? ''}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.post('/logout')}
                            className="mt-3 w-full rounded-full bg-white/95 text-brand-800 text-[12.5px] font-semibold py-2 hover:bg-white transition"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 min-w-0 flex flex-col lg:gap-3">
                <header className="h-16 bg-[var(--pb-panel)]/95 backdrop-blur lg:rounded-[22px] flex items-center px-3 sm:px-4 gap-3 sticky top-0 lg:top-3 z-30">
                    <button
                        className="lg:hidden p-2 rounded-xl hover:bg-white transition"
                        onClick={() => setNavOpen(true)}
                        aria-label="Open menu"
                    >
                        <svg className="w-5 h-5 text-ink-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M3 12h18M3 18h18" /></svg>
                    </button>

                    <div className="hidden md:block w-full max-w-[340px]">
                        <div className="relative">
                            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                            <input
                                className="w-full bg-white rounded-full pl-10 pr-16 py-2.5 text-[13px] shadow-soft border border-transparent focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition"
                                placeholder={searchPlaceholder}
                            />
                            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-ink-500 bg-ink-100 rounded-md px-1.5 py-0.5">Ctrl K</kbd>
                        </div>
                    </div>

                    <div className="text-[13px] text-ink-500 truncate min-w-0">
                        {crumbPrefix && <span className="hidden sm:inline">{crumbPrefix}<span className="mx-2 text-ink-300">/</span></span>}
                        <span className="text-ink-900 font-medium">{crumb}</span>
                    </div>

                    <div className="flex-1" />
                    {headerActions}
                    <NotificationBell notifications={notifications ?? null} />
                    <div className="hidden sm:flex items-center gap-2.5 pl-1">
                        <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[13px] font-bold">
                            {initials}
                        </div>
                        <div className="leading-tight max-w-[160px]">
                            <p className="text-[13px] font-semibold truncate">{name}</p>
                            <p className="text-[11px] text-ink-500 truncate">{auth?.user?.email}</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 bg-[var(--pb-panel)] lg:rounded-[26px] min-w-0">
                    {banners && <div className="overflow-hidden lg:rounded-t-[26px]">{banners}</div>}
                    {children}
                </div>
            </main>
        </div>
    );
}
