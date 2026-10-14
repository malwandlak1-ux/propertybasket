import { ReactNode } from 'react';
import Shell, { ShellNavItem } from '@/Components/Dashboard/Shell';

type Props = {
    children: ReactNode;
    crumb?: string;
    section?: string;
    leaseAddress?: string;
};

type NavItem = ShellNavItem;

const I = {
    dashboard: <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
    lease:     <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>,
    payments:  <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 14h.01M10 14h.01"/></svg>,
    maint:     <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 6.5a2 2 0 1 0-4 0M9 12l-7 7 3 3 7-7M14 12l4-4 4 4-4 4z"/></svg>,
    docs:      <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4"/><path d="M21 12c0 1-1 11-9 11s-9-10-9-11V5l9-3 9 3z"/></svg>,
    messages:  <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.7a8.5 8.5 0 0 1 16.1-3.8z"/></svg>,
    settings:  <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    help:      <svg className="nav-icon w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>,
};

export default function TenantLayout({ children, crumb = 'Dashboard', section = 'My Home', leaseAddress }: Props) {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const isActive = (p: string) => p === '/tenant' ? path === p : path.startsWith(p);

    const home: NavItem[] = [
        { label: 'Dashboard',  href: '/tenant',           icon: I.dashboard },
        { label: 'My Lease',   href: '/tenant/lease',     icon: I.lease },
        { label: 'Documents',  href: '/tenant/documents', icon: I.docs },
    ];
    const payments: NavItem[] = [
        { label: 'Payments',   href: '/tenant/payments',  icon: I.payments, indicator: 'warning' },
    ];
    const property: NavItem[] = [
        { label: 'Maintenance',href: '/tenant/maintenance', icon: I.maint },
        { label: 'Messages',   href: '/tenant/messages',    icon: I.messages },
    ];
    const account: NavItem[] = [
        { label: 'Settings',      href: '/tenant/settings', icon: I.settings },
        { label: 'Help & Support',href: '/tenant/help', icon: I.help },
    ];


    return (
        <Shell
            sections={[
                { label: 'My home', items: home },
                { label: 'Payments', items: payments },
                { label: 'Property', items: property },
                { label: 'Account', items: account },
            ]}
            isActive={isActive}
            crumb={crumb}
            crumbPrefix={section}
            accountSubtitle={leaseAddress ?? 'Tenant'}
            searchPlaceholder="Search payments, requests, documents…"
        >
            {children}
        </Shell>
    );
}
