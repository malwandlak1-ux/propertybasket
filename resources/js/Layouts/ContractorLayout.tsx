import { ReactNode, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AppLogo from '@/Components/AppLogo';
import NotificationBell, { NotificationItem } from '@/Components/NotificationBell';

type SharedProps = {
    auth?: { user?: { id: number; name: string; role: string } | null };
    notifications?: { unread_count: number; recent: NotificationItem[] } | null;
};

type Props = {
    children: ReactNode;
    crumb?: string;
    section?: string;
    business?: string;
    counts?: {
        requests?: number;
        active_jobs?: number;
        messages?: number;
    };
};

type NavItem = {
    label: string;
    href?: string;
    icon: ReactNode;
    badge?: { text: string | number; tone: 'brand' | 'danger' | 'warning' | 'neutral' };
    indicator?: 'warning' | 'danger';
};

const I = {
    dashboard: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
    requests:  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    jobs:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
    quotes:    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M9 13h6M9 17h4"/></svg>,
    invoices:  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 16h6"/></svg>,
    finance:   <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 6-6"/></svg>,
    messages:  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.7a8.5 8.5 0 0 1 16.1-3.8z"/></svg>,
    settings:  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
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
            {item.indicator && (
                <span className={
                    'w-1.5 h-1.5 rounded-full ml-auto ' +
                    (item.indicator === 'danger' ? 'bg-danger' : 'bg-warning')
                } />
            )}
        </>
    );

    return item.href
        ? <Link href={item.href} className={cls}>{inner}</Link>
        : <span className={`${cls} cursor-not-allowed opacity-50`} title="Coming soon">{inner}</span>;
}

function Section({ label, className = '' }: { label: string; className?: string }) {
    return <p className={`px-3 text-[10px] font-semibold text-ink-400 tracking-[0.12em] mb-2 ${className}`}>{label}</p>;
}

export default function ContractorLayout({ children, crumb = 'Dashboard', section = 'My Workspace', business, counts }: Props) {
    const { auth, notifications } = usePage<SharedProps>().props;
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const isActive = (p: string) => p === '/contractor' ? path === p : path.startsWith(p);
    const [navOpen, setNavOpen] = useState(false);

    const initials = (auth?.user?.name ?? 'C')
        .split(' ').map((s) => s[0]).slice(0, 2).join('');

    const numberBadge = (n?: number, tone: NavItem['badge'] extends infer T ? (T extends { tone: infer X } ? X : never) : never = 'danger'): NavItem['badge'] =>
        n != null && n > 0 ? { text: n, tone } : undefined;

    const workspace: NavItem[] = [
        { label: 'Dashboard',    href: '/contractor',          icon: I.dashboard },
        { label: 'Job Requests', href: '/contractor/requests', icon: I.requests, badge: numberBadge(counts?.requests, 'danger') },
        { label: 'Active Jobs',  href: '/contractor/jobs',     icon: I.jobs,     badge: numberBadge(counts?.active_jobs, 'brand') },
    ];

    const billing: NavItem[] = [
        { label: 'Quotes',   href: '/contractor/quotes',   icon: I.quotes, indicator: 'warning' },
        { label: 'Invoices', href: '/contractor/invoices', icon: I.invoices },
        { label: 'Finance',  href: '/contractor/finance',  icon: I.finance },
    ];

    const profile: NavItem[] = [
        { label: 'Messages', href: '/contractor/messages', icon: I.messages, badge: numberBadge(counts?.messages, 'danger') },
    ];

    const account: NavItem[] = [
        { label: 'Settings', href: '/contractor/settings', icon: I.settings },
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
            <aside
                className={
                    'fixed lg:static inset-y-0 left-0 z-50 w-[240px] shrink-0 bg-white border-r border-ink-200 flex flex-col transition-transform duration-200 ' +
                    (navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
                }
                onClick={() => setNavOpen(false)}
            >
                <div className="px-5 pt-5 pb-6">
                    <AppLogo height={19} />
                </div>

                <nav className="px-3 flex-1 overflow-y-auto">
                    <Section label="WORKSPACE" />
                    {workspace.map((i) => <NavLink key={i.label} item={i} active={!!i.href && isActive(i.href)} />)}

                    <Section label="BILLING" className="mt-6" />
                    {billing.map((i) => <NavLink key={i.label} item={i} active={!!i.href && isActive(i.href)} />)}

                    <Section label="PROFILE" className="mt-6" />
                    {profile.map((i) => <NavLink key={i.label} item={i} active={!!i.href && isActive(i.href)} />)}

                    <Section label="ACCOUNT" className="mt-6" />
                    {account.map((i) => <NavLink key={i.label} item={i} active={!!i.href && isActive(i.href)} />)}
                </nav>

                <button onClick={() => router.post('/logout')} className="border-t border-ink-200 p-3 text-left">
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-ink-100">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold truncate">{auth?.user?.name ?? 'Contractor'}</p>
                            <p className="text-[11px] text-ink-400 truncate">{business ?? 'Contractor · Sign out →'}</p>
                        </div>
                    </div>
                </button>
            </aside>

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
                            <input className="w-full bg-ink-50 border border-ink-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition" placeholder="Search jobs, agencies, invoices…"/>
                        </div>
                    </div>
                    <div className="flex-1 md:hidden" />
                    <NotificationBell notifications={notifications ?? null} />
                </header>
                {children}
            </main>
        </div>
    );
}
