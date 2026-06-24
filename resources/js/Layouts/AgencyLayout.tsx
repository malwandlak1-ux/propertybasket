import { ReactNode, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AppLogo from '@/Components/AppLogo';
import NotificationBell, { NotificationItem } from '@/Components/NotificationBell';
import SubscriptionBanner from '@/Components/SubscriptionBanner';

type SharedProps = {
    auth?: { user?: { id: number; name: string; role: string } | null };
    agency_ffc?: {
        state: 'missing' | 'expired' | 'expiring' | 'valid';
        days_left: number | null;
        expires_at: string | null;
    } | null;
    notifications?: {
        unread_count: number;
        recent: NotificationItem[];
    } | null;
};

type AgencyLayoutProps = {
    children: ReactNode;
    crumb?: string;
    agencyName?: string;
};

type NavItem = {
    label: string;
    href?: string;
    routeName?: string;
    icon: ReactNode;
    badge?: { text: string; tone: 'brand' | 'danger' | 'ink' };
    indicator?: 'warning' | 'success';
};

const ICON_DASHBOARD = (
    <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
);
const ICON_PIPELINE = (
    <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M3 7h4v13H3zM10 4h4v16h-4zM17 11h4v9h-4z" />
    </svg>
);
const ICON_LISTINGS = (
    <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M3 21V10l9-7 9 7v11H3z" />
        <path d="M9 21v-7h6v7" />
    </svg>
);
const ICON_MESSAGES = (
    <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.7a8.5 8.5 0 0 1 16.1-3.8z" />
    </svg>
);
const ICON_MAINTENANCE = (
    <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M14 6.5a2 2 0 1 0-4 0M9 12l-7 7 3 3 7-7M14 12l4-4 4 4-4 4z" />
    </svg>
);
const ICON_AGENTS = (
    <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
    </svg>
);
const ICON_TENANTS = (
    <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
    </svg>
);
const ICON_LANDLORDS = (
    <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="8" r="5" />
        <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
);
const ICON_CONTRACTORS = (
    <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M14 6.5a2 2 0 1 0-4 0M9 12l-7 7 3 3 7-7M14 12l4-4 4 4-4 4z" />
    </svg>
);
const ICON_COMMISSION = (
    <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
);
const ICON_REPORTS = (
    <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
);
const ICON_TRUST = (
    <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M2 10h20M6 14h.01M10 14h.01" />
    </svg>
);
const ICON_SETTINGS = (
    <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);
const ICON_BILLING = (
    <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
    </svg>
);

function NavItem({ item, active }: { item: NavItem; active: boolean }) {
    const classes =
        'nav-item flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] transition mb-0.5 ' +
        (active
            ? 'bg-ink-100 text-ink-900'
            : 'text-ink-500 hover:bg-ink-100');
    const inner = (
        <>
            <span className={active ? 'text-brand-600' : ''}>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge && (
                <span
                    className={
                        'text-[10px] px-1.5 py-0.5 rounded-full font-semibold ' +
                        (item.badge.tone === 'brand'
                            ? 'bg-brand-50 text-brand-700'
                            : item.badge.tone === 'danger'
                            ? 'bg-danger text-white'
                            : 'text-ink-500')
                    }
                >
                    {item.badge.text}
                </span>
            )}
            {item.indicator && (
                <span
                    className={
                        'w-1.5 h-1.5 rounded-full ' +
                        (item.indicator === 'warning' ? 'bg-warning' : 'bg-success')
                    }
                />
            )}
        </>
    );

    if (item.href) {
        return (
            <Link href={item.href} className={classes}>
                {inner}
            </Link>
        );
    }
    return (
        <span className={classes + ' cursor-not-allowed opacity-60'} title="Coming soon">
            {inner}
        </span>
    );
}

export default function AgencyLayout({ children, crumb = 'Dashboard', agencyName }: AgencyLayoutProps) {
    const { auth, agency_ffc, notifications } = usePage<SharedProps>().props;
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const [navOpen, setNavOpen] = useState(false);

    const isActive = (path: string) => {
        if (path === '/agency') return currentPath === '/agency';
        return currentPath === path || currentPath.startsWith(path + '/');
    };

    const workspace: NavItem[] = [
        { label: 'Dashboard', href: '/agency', icon: ICON_DASHBOARD },
        { label: 'Pipeline', href: '/agency/pipeline', icon: ICON_PIPELINE },
        { label: 'Listings & Leads', href: '/agency/listings', icon: ICON_LISTINGS },
        { label: 'Team Messages', href: '/agency/messages', icon: ICON_MESSAGES },
        { label: 'Maintenance', href: '/agency/maintenance', icon: ICON_MAINTENANCE },
    ];
    const team: NavItem[] = [
        { label: 'Agents', href: '/agency/agents', icon: ICON_AGENTS },
        { label: 'Tenants', href: '/agency/tenants', icon: ICON_TENANTS },
        { label: 'Landlords', href: '/agency/landlords', icon: ICON_LANDLORDS },
        { label: 'Contractors', href: '/agency/contractors', icon: ICON_CONTRACTORS },
    ];
    const finance: NavItem[] = [
        { label: 'Commission & Payouts', href: '/agency/commissions', icon: ICON_COMMISSION, indicator: 'warning' },
        { label: 'Financial Reports', href: '/agency/reports', icon: ICON_REPORTS },
        { label: 'Trust Account', href: '/agency/trust-account', icon: ICON_TRUST },
    ];
    const complianceBadge: NavItem['badge'] = agency_ffc?.state === 'valid'
        ? { text: '✓', tone: 'brand' }
        : { text: '!', tone: 'danger' };
    const ICON_COMPLIANCE = (
        <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 12l2 2 4-4" />
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    );
    const account: NavItem[] = [
        { label: 'EAAB & Compliance', href: '/agency/compliance', icon: ICON_COMPLIANCE, badge: complianceBadge },
        { label: 'Settings', href: '/agency/settings', icon: ICON_SETTINGS },
        { label: 'Billing & Plan', href: '/agency/billing', icon: ICON_BILLING },
    ];

    function logout() {
        router.post('/logout');
    }

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
                    <AppLogo height={19} href="/" />
                </div>

                <nav className="px-3 flex-1 overflow-y-auto">
                    <SectionHeader>WORKSPACE</SectionHeader>
                    {workspace.map((i) => (
                        <NavItem key={i.label} item={i} active={!!i.href && isActive(i.href)} />
                    ))}
                    <SectionHeader className="mt-6">TEAM</SectionHeader>
                    {team.map((i) => (
                        <NavItem key={i.label} item={i} active={!!i.href && isActive(i.href)} />
                    ))}
                    <SectionHeader className="mt-6">FINANCE</SectionHeader>
                    {finance.map((i) => (
                        <NavItem key={i.label} item={i} active={!!i.href && isActive(i.href)} />
                    ))}
                    <SectionHeader className="mt-6">AGENCY ACCOUNT</SectionHeader>
                    {account.map((i) => (
                        <NavItem key={i.label} item={i} active={!!i.href && isActive(i.href)} />
                    ))}
                </nav>

                <button
                    onClick={logout}
                    className="border-t border-ink-200 p-3 text-left"
                >
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-ink-100 cursor-pointer">
                        <div className="w-9 h-9 rounded-lg bg-ink-900 flex items-center justify-center text-white font-bold text-sm">
                            {(auth?.user?.name ?? 'PB')
                                .split(' ')
                                .map((s) => s[0])
                                .slice(0, 2)
                                .join('')}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <p className="text-[13px] font-semibold truncate">
                                {auth?.user?.name ?? 'Property Basket'}
                            </p>
                            <p className="text-[11px] text-ink-400 truncate">Sign out →</p>
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
                        <span className="hidden sm:inline">{agencyName ?? 'My Agency'}</span>
                        <span className="hidden sm:inline mx-2 text-ink-300">/</span>
                        <span className="text-ink-900 font-medium">{crumb}</span>
                    </div>
                    <div className="flex-1 max-w-xl mx-auto hidden md:block">
                        <div className="relative">
                            <svg
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <circle cx="11" cy="11" r="8" />
                                <path d="M21 21l-4.35-4.35" />
                            </svg>
                            <input
                                className="w-full bg-ink-50 border border-ink-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
                                placeholder="Search agents, listings, deals..."
                            />
                        </div>
                    </div>
                    <div className="flex-1 md:hidden" />
                    <button className="w-9 h-9 rounded-lg hover:bg-ink-100 flex items-center justify-center transition shrink-0" title="Quick add">
                        <svg className="w-4 h-4 text-ink-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 8v8M8 12h8" />
                        </svg>
                    </button>
                    <NotificationBell notifications={notifications ?? null} />
                </header>

                {agency_ffc && agency_ffc.state !== 'valid' && (
                    <AgencyFfcBanner state={agency_ffc.state} daysLeft={agency_ffc.days_left} expiresAt={agency_ffc.expires_at} />
                )}

                <SubscriptionBanner />

                {children}
            </main>
        </div>
    );
}

function AgencyFfcBanner({ state, daysLeft, expiresAt }: { state: 'missing' | 'expired' | 'expiring'; daysLeft: number | null; expiresAt: string | null }) {
    const tone = state === 'expiring'
        ? 'bg-warning/10 border-warning/30 text-warning'
        : 'bg-danger/10 border-danger/30 text-danger';
    const message = state === 'missing'
        ? 'Upload the agency FFC certificate — listings on this agency are blocked until then.'
        : state === 'expired'
            ? `Agency FFC expired${expiresAt ? ' on ' + expiresAt : ''}. Listings are blocked across the agency until a current certificate is uploaded.`
            : `Agency FFC expires in ${daysLeft ?? 0} day${daysLeft === 1 ? '' : 's'}${expiresAt ? ' (' + expiresAt + ')' : ''}. Renew with the PPRA before it lapses.`;
    return (
        <div className={`border-b px-4 sm:px-8 py-3 text-[13px] flex items-center gap-3 ${tone}`}>
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="flex-1">{message}</span>
            <Link href="/agency/compliance" className="font-semibold underline whitespace-nowrap">Update FFC →</Link>
        </div>
    );
}

function SectionHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <p className={`px-3 text-[10px] font-semibold text-ink-400 tracking-[0.12em] mb-2 ${className}`}>
            {children}
        </p>
    );
}
