import { ReactNode, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AppLogo from '@/Components/AppLogo';
import NotificationBell, { NotificationItem } from '@/Components/NotificationBell';
import SubscriptionBanner from '@/Components/SubscriptionBanner';

type SharedProps = {
    auth?: { user?: { id: number; name: string; role: string } | null };
    notifications?: {
        unread_count: number;
        recent: NotificationItem[];
    } | null;
};

type Props = {
    children: ReactNode;
    crumb?: string;
    section?: string;
    openMaint?: number;
    unreadMessages?: number;
};

type NavItem = {
    label: string;
    href?: string;
    icon: ReactNode;
    badge?: { text: string | number; tone: 'brand' | 'danger' | 'warning' };
    indicator?: 'warning';
};

const I = {
    dashboard:   <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
    properties:  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 21V10l9-7 9 7v11H3z"/><path d="M9 21v-7h6v7"/></svg>,
    maintenance: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 6.5a2 2 0 1 0-4 0M9 12l-7 7 3 3 7-7M14 12l4-4 4 4-4 4z"/></svg>,
    tenants:     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    messages:    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.7a8.5 8.5 0 0 1 16.1-3.8z"/></svg>,
    finance:     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 6-6"/></svg>,
    settings:    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    help:        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>,
};

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
    const cls =
        'flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] transition mb-0.5 ' +
        (active ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:bg-ink-100');

    const inner = (
        <>
            <span className={active ? 'text-brand-600' : ''}>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge && (
                <span className={
                    'text-[10px] px-1.5 py-0.5 rounded-full font-semibold ml-auto ' +
                    (item.badge.tone === 'brand' ? 'bg-brand-50 text-brand-700' :
                     item.badge.tone === 'danger' ? 'bg-danger text-white' :
                     'bg-warning/15 text-warning')
                }>
                    {item.badge.text}
                </span>
            )}
            {item.indicator === 'warning' && (
                <span className="w-1.5 h-1.5 rounded-full bg-warning ml-auto" />
            )}
        </>
    );

    if (item.href) {
        return <Link href={item.href} className={cls}>{inner}</Link>;
    }
    return <span className={`${cls} cursor-not-allowed opacity-50`} title="Coming soon">{inner}</span>;
}

function SectionLabel({ label, className = '' }: { label: string; className?: string }) {
    return (
        <p className={`px-3 text-[10px] font-semibold text-ink-400 tracking-[0.12em] mb-2 ${className}`}>
            {label}
        </p>
    );
}

export default function LandlordLayout({
    children,
    crumb = 'Dashboard',
    section = 'My Portfolio',
    openMaint = 0,
    unreadMessages = 0,
}: Props) {
    const { auth, notifications } = usePage<SharedProps>().props;
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const isActive = (p: string) => p === '/landlord' ? path === p : path.startsWith(p);
    const [navOpen, setNavOpen] = useState(false);

    const initials = (auth?.user?.name ?? 'L')
        .split(' ').map((s) => s[0]).slice(0, 2).join('');

    const workspace: NavItem[] = [
        { label: 'Dashboard',    href: '/landlord',             icon: I.dashboard },
        { label: 'Properties',   href: '/landlord/properties',  icon: I.properties },
        { label: 'Maintenance',  href: '/landlord/maintenance', icon: I.maintenance,
          badge: openMaint > 0 ? { text: openMaint, tone: 'danger' } : undefined },
    ];

    const people: NavItem[] = [
        { label: 'Tenants',  href: '/landlord/tenants',  icon: I.tenants },
        { label: 'Messages', href: '/landlord/messages', icon: I.messages,
          badge: unreadMessages > 0 ? { text: unreadMessages, tone: 'danger' } : undefined },
    ];

    const finance: NavItem[] = [
        { label: 'Finance', href: '/landlord/finance', icon: I.finance },
    ];

    const account: NavItem[] = [
        { label: 'Settings',      href: '/landlord/settings', icon: I.settings },
        { label: 'Help & Support', icon: I.help },
    ];

    return (
        <div className="flex min-h-screen bg-ink-50 text-ink-900">
            {navOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-ink-900/50 z-40"
                    onClick={() => setNavOpen(false)}
                    aria-hidden="true"
                />
            )}
            {/* ── Sidebar (drawer on mobile, fixed on lg+) ──────────────── */}
            <aside
                className={
                    'fixed lg:static inset-y-0 left-0 z-50 w-[240px] shrink-0 bg-white border-r border-ink-200 flex flex-col transition-transform duration-200 ' +
                    (navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
                }
                onClick={() => setNavOpen(false)}
            >
                <div className="px-5 pt-5 pb-6">
                    <AppLogo height={19} href="/" />
                </div>

                <nav className="px-3 flex-1 overflow-y-auto">
                    <SectionLabel label="WORKSPACE" />
                    {workspace.map((i) => (
                        <NavLink key={i.label} item={i} active={!!i.href && isActive(i.href)} />
                    ))}

                    <SectionLabel label="PEOPLE" className="mt-6" />
                    {people.map((i) => (
                        <NavLink key={i.label} item={i} active={!!i.href && isActive(i.href)} />
                    ))}

                    <SectionLabel label="FINANCE" className="mt-6" />
                    {finance.map((i) => (
                        <NavLink key={i.label} item={i} active={!!i.href && isActive(i.href)} />
                    ))}

                    <SectionLabel label="ACCOUNT" className="mt-6" />
                    {account.map((i) => (
                        <NavLink key={i.label} item={i} active={false} />
                    ))}
                </nav>

                {/* Upgrade prompt */}
                <div className="px-3 pb-2">
                    <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl p-4 text-white">
                        <p className="text-[12px] font-bold">Private Landlord Plan</p>
                        <p className="text-[10px] opacity-80 mt-1">Manage up to 5 properties independently.</p>
                        <button className="w-full mt-2 py-1.5 bg-white text-brand-700 text-[11px] rounded-md font-bold hover:bg-ink-100 transition">
                            Upgrade to Agency →
                        </button>
                    </div>
                </div>

                {/* User area */}
                <button
                    onClick={() => router.post('/logout')}
                    className="border-t border-ink-200 p-3 text-left"
                >
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-ink-100">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-bold text-sm">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold truncate">{auth?.user?.name ?? 'Landlord'}</p>
                            <p className="text-[11px] text-ink-400 truncate">Private Landlord · Sign out →</p>
                        </div>
                    </div>
                </button>
            </aside>

            {/* ── Main content ──────────────────────────────────────────── */}
            <main className="flex-1 min-w-0">
                <header className="h-16 border-b border-ink-200 bg-white flex items-center px-4 sm:px-8 gap-3 sm:gap-6 sticky top-0 z-30">
                    <button
                        className="lg:hidden -ml-1 p-2 rounded-lg hover:bg-ink-100 transition"
                        onClick={() => setNavOpen(true)}
                        aria-label="Open menu"
                    >
                        <svg className="w-5 h-5 text-ink-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M3 6h18M3 12h18M3 18h18"/>
                        </svg>
                    </button>
                    <div className="text-[13px] text-ink-500 truncate">
                        <span className="hidden sm:inline">{section}</span>
                        <span className="hidden sm:inline mx-2 text-ink-300">/</span>
                        <span className="text-ink-900 font-medium">{crumb}</span>
                    </div>
                    <div className="flex-1 max-w-xl mx-auto hidden md:block">
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                            <input
                                className="w-full bg-ink-50 border border-ink-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
                                placeholder="Search properties, tenants, requests…"
                            />
                        </div>
                    </div>
                    <div className="flex-1 md:hidden" />
                    <NotificationBell notifications={notifications ?? null} />
                </header>

                <SubscriptionBanner />

                {children}
            </main>
        </div>
    );
}
