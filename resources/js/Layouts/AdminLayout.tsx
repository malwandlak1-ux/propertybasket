import { ReactNode } from 'react';
import Shell, { ShellNavItem } from '@/Components/Dashboard/Shell';
import { useEdition } from '@/Hooks/useEdition';

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

type NavItem = ShellNavItem;

const I = {
    overview:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
    agencies:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>,
    landlords:     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>,
    contractors:   <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 6.5a2 2 0 1 0-4 0M9 12l-7 7 3 3 7-7M14 12l4-4 4 4-4 4z"/></svg>,
    users:         <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    roles:         <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
    subscriptions: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
    transactions:  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 12a9 9 0 1 0 9-9M3 3v6h6M21 12a9 9 0 0 1-9 9m-9-9h6"/></svg>,
    promo:         <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/></svg>,
    announcements: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>,
    blog:          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>,
    settings:      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    help:          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>,
    system:        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
};

export default function AdminLayout({ children, crumb = 'Overview', section = 'Platform', counts }: Props) {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const isActive = (p: string) => p === '/admin' ? path === p : path.startsWith(p);


    const overview: NavItem[] = [
        { label: 'Overview', href: '/admin', icon: I.overview },
    ];

    const numberBadge = (n?: number): NavItem['badge'] =>
        n != null && n > 0 ? { text: n.toLocaleString('en-ZA'), tone: 'muted' } : undefined;

    const { agenciesEnabled } = useEdition();
    const accounts: NavItem[] = [
        ...(agenciesEnabled ? [{ label: 'Agencies', href: '/admin/agencies', icon: I.agencies, badge: numberBadge(counts?.agencies) }] : []),
        { label: 'Landlords',   href: '/admin/landlords',   icon: I.landlords,   badge: numberBadge(counts?.landlords) },
        { label: 'Contractors', href: '/admin/contractors', icon: I.contractors, badge: numberBadge(counts?.contractors) },
    ];

    const access: NavItem[] = [
        { label: 'User Management',     href: '/admin/users', icon: I.users },
        { label: 'Roles & Permissions', href: '/admin/roles', icon: I.roles },
    ];

    const financials: NavItem[] = [
        { label: 'Subscriptions', href: '/admin/subscriptions', icon: I.subscriptions },
        { label: 'Promo Codes',   href: '/admin/promo-codes',   icon: I.promo },
        { label: 'Transactions',  href: '/admin/transactions',  icon: I.transactions },
    ];

    const system: NavItem[] = [
        { label: 'Blog',             href: '/admin/blog',          icon: I.blog },
        { label: 'Announcements',    href: '/admin/announcements', icon: I.announcements },
        { label: 'Platform Settings',href: '/admin/settings',      icon: I.settings },
        { label: 'System Health',    href: '/admin/system',        icon: I.system, indicator: 'success' },
        { label: 'Help & Support',   href: '/admin/help',          icon: I.help },
    ];

    return (
        <Shell
            sections={[
                { label: 'Menu', items: overview },
                { label: 'Accounts', items: accounts },
                { label: 'Access', items: access },
                { label: 'Financials', items: financials },
                { label: 'System', items: system },
            ]}
            isActive={isActive}
            crumb={crumb}
            crumbPrefix={section}
            accountSubtitle="Super admin"
            searchPlaceholder="Search accounts, users, transactions…"
        >
            {children}
        </Shell>
    );
}
