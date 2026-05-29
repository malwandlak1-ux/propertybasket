import { ReactNode, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AppLogo from '@/Components/AppLogo';

type SharedProps = {
    auth?: { user?: { id: number; name: string; role: string } | null };
};

type Props = {
    children: ReactNode;
    crumb?: string;
    section?: string;
    counts?: {
        agencies?: number;
        landlords?: number;
        contractors?: number;
    };
};

type NavItem = {
    label: string;
    href?: string;
    icon: ReactNode;
    badge?: { text: string | number; tone: 'brand' | 'danger' | 'warning' | 'neutral' };
    healthDot?: 'success' | 'warning' | 'danger';
};

const I = {
    overview:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
    agencies:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>,
    landlords:     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>,
    contractors:   <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 6.5a2 2 0 1 0-4 0M9 12l-7 7 3 3 7-7M14 12l4-4 4 4-4 4z"/></svg>,
    users:         <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    roles:         <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
    subscriptions: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
    transactions:  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 12a9 9 0 1 0 9-9M3 3v6h6M21 12a9 9 0 0 1-9 9m-9-9h6"/></svg>,
    announcements: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>,
    blog:          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>,
    settings:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    system:        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
};

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
    const cls = 'flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] transition mb-0.5 ' +
        (active ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:bg-ink-100');

    const inner = (
        <>
            <span className={active ? 'text-brand-600' : ''}>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge && (
                <span className={
                    'text-[10px] px-1.5 py-0.5 rounded-full font-semibold ml-auto ' +
                    (item.badge.tone === 'brand'   ? 'bg-brand-50 text-brand-700' :
                     item.badge.tone === 'danger'  ? 'bg-danger text-white' :
                     item.badge.tone === 'warning' ? 'bg-warning/15 text-warning' :
                     'bg-ink-100 text-ink-700')
                }>
                    {item.badge.text}
                </span>
            )}
            {item.healthDot && (
                <span className={
                    'w-1.5 h-1.5 rounded-full ml-auto animate-pulse ' +
                    (item.healthDot === 'success' ? 'bg-success' :
                     item.healthDot === 'warning' ? 'bg-warning' :
                     'bg-danger')
                } />
            )}
        </>
    );

    return item.href
        ? <Link href={item.href} className={cls}>{inner}</Link>
        : <span className={`${cls} cursor-not-allowed opacity-50`}>{inner}</span>;
}

function SectionLabel({ label, className = '' }: { label: string; className?: string }) {
    return (
        <p className={`px-3 text-[10px] font-semibold text-ink-400 tracking-[0.12em] mb-2 ${className}`}>
            {label}
        </p>
    );
}

export default function AdminLayout({ children, crumb = 'Overview', section = 'Platform', counts }: Props) {
    const { auth } = usePage<SharedProps>().props;
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const isActive = (p: string) => p === '/admin' ? path === p : path.startsWith(p);
    const [navOpen, setNavOpen] = useState(false);

    const initials = (auth?.user?.name ?? 'SA')
        .split(' ').map((s) => s[0]).slice(0, 2).join('');

    const overview: NavItem[] = [
        { label: 'Overview', href: '/admin', icon: I.overview },
    ];

    const numberBadge = (n?: number): NavItem['badge'] =>
        n != null && n > 0 ? { text: n.toLocaleString('en-ZA'), tone: 'neutral' } : undefined;

    const accounts: NavItem[] = [
        { label: 'Agencies',    href: '/admin/agencies',    icon: I.agencies,    badge: numberBadge(counts?.agencies) },
        { label: 'Landlords',   href: '/admin/landlords',   icon: I.landlords,   badge: numberBadge(counts?.landlords) },
        { label: 'Contractors', href: '/admin/contractors', icon: I.contractors, badge: numberBadge(counts?.contractors) },
    ];

    const access: NavItem[] = [
        { label: 'User Management',     href: '/admin/users', icon: I.users },
        { label: 'Roles & Permissions', href: '/admin/roles', icon: I.roles },
    ];

    const financials: NavItem[] = [
        { label: 'Subscriptions', href: '/admin/subscriptions', icon: I.subscriptions },
        { label: 'Transactions',  href: '/admin/transactions',  icon: I.transactions },
    ];

    const system: NavItem[] = [
        { label: 'Blog',             href: '/admin/blog',          icon: I.blog },
        { label: 'Announcements',    href: '/admin/announcements', icon: I.announcements },
        { label: 'Platform Settings',href: '/admin/settings',      icon: I.settings },
        { label: 'System Health',    href: '/admin/system',        icon: I.system, healthDot: 'success' },
    ];

    return (
        <div className="flex min-h-screen bg-ink-50 text-ink-900">
            {/* ── Mobile backdrop ───────────────────────────────────────── */}
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
                    'fixed lg:static inset-y-0 left-0 z-50 w-[248px] shrink-0 bg-white border-r border-ink-200 flex flex-col transition-transform duration-200 ' +
                    (navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
                }
                onClick={() => setNavOpen(false)}
            >
                <div className="px-5 pt-5 pb-4">
                    <AppLogo height={19} />
                    <p className="text-[10px] text-brand-600 font-semibold tracking-wide mt-1.5 ml-1">SUPER ADMIN</p>
                </div>

                <nav className="px-3 flex-1 overflow-y-auto">
                    {overview.map((i) => <NavLink key={i.label} item={i} active={!!i.href && isActive(i.href)} />)}

                    <SectionLabel label="ACCOUNTS" className="mt-5" />
                    {accounts.map((i) => <NavLink key={i.label} item={i} active={!!i.href && isActive(i.href)} />)}

                    <SectionLabel label="ACCESS" className="mt-5" />
                    {access.map((i) => <NavLink key={i.label} item={i} active={!!i.href && isActive(i.href)} />)}

                    <SectionLabel label="FINANCIALS" className="mt-5" />
                    {financials.map((i) => <NavLink key={i.label} item={i} active={!!i.href && isActive(i.href)} />)}

                    <SectionLabel label="SYSTEM" className="mt-5" />
                    {system.map((i) => <NavLink key={i.label} item={i} active={!!i.href && isActive(i.href)} />)}
                </nav>

                <button onClick={() => router.post('/logout')} className="border-t border-ink-200 p-3 text-left">
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-ink-100">
                        <div className="w-9 h-9 rounded-lg bg-ink-900 flex items-center justify-center text-white font-semibold text-sm">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold truncate">{auth?.user?.name ?? 'System Admin'}</p>
                            <p className="text-[11px] text-ink-400 truncate">Super Admin · Sign out →</p>
                        </div>
                    </div>
                </button>
            </aside>

            {/* ── Main ──────────────────────────────────────────────────── */}
            <main className="flex-1 min-w-0">
                <header className="h-16 border-b border-ink-200 bg-white flex items-center px-4 sm:px-8 gap-3 sm:gap-6 sticky top-0 z-30">
                    {/* Hamburger — mobile only */}
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
                            <input className="w-full bg-ink-50 border border-ink-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition" placeholder="Search accounts, users, transactions…"/>
                        </div>
                    </div>
                    <div className="flex-1 md:hidden" />
                    <button className="w-9 h-9 rounded-lg hover:bg-ink-100 flex items-center justify-center relative transition shrink-0" title="Notifications">
                        <svg className="w-4 h-4 text-ink-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>
                        <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-brand-500"/>
                    </button>
                </header>

                {children}
            </main>
        </div>
    );
}
