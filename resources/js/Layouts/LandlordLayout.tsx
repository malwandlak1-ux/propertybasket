import { ReactNode } from 'react';
import Shell, { ShellNavItem } from '@/Components/Dashboard/Shell';
import SubscriptionBanner from '@/Components/SubscriptionBanner';

type Props = {
    children: ReactNode;
    crumb?: string;
    section?: string;
    openMaint?: number;
    unreadMessages?: number;
};

type NavItem = ShellNavItem;

const I = {
    dashboard:   <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
    properties:  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 21V10l9-7 9 7v11H3z"/><path d="M9 21v-7h6v7"/></svg>,
    maintenance: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 6.5a2 2 0 1 0-4 0M9 12l-7 7 3 3 7-7M14 12l4-4 4 4-4 4z"/></svg>,
    contractors: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4 2.5-2.5z"/></svg>,
    tenants:     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    messages:    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.7a8.5 8.5 0 0 1 16.1-3.8z"/></svg>,
    finance:     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 6-6"/></svg>,
    settings:    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    help:        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>,
};

export default function LandlordLayout({
    children,
    crumb = 'Dashboard',
    section = 'My Portfolio',
    openMaint = 0,
    unreadMessages = 0,
}: Props) {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const isActive = (p: string) => p === '/landlord' ? path === p : path.startsWith(p);


    const workspace: NavItem[] = [
        { label: 'Dashboard',    href: '/landlord',             icon: I.dashboard },
        { label: 'Properties',   href: '/landlord/properties',  icon: I.properties },
        { label: 'Maintenance',  href: '/landlord/maintenance', icon: I.maintenance,
          badge: openMaint > 0 ? { text: openMaint, tone: 'danger' } : undefined },
    ];

    const people: NavItem[] = [
        { label: 'Tenants',  href: '/landlord/tenants',  icon: I.tenants },
        { label: 'Contractors', href: '/landlord/contractors', icon: I.contractors },
        { label: 'Messages', href: '/landlord/messages', icon: I.messages,
          badge: unreadMessages > 0 ? { text: unreadMessages, tone: 'danger' } : undefined },
    ];

    const finance: NavItem[] = [
        { label: 'Finance', href: '/landlord/finance', icon: I.finance },
    ];

    const account: NavItem[] = [
        { label: 'Settings',      href: '/landlord/settings', icon: I.settings },
        { label: 'Help & Support', href: '/landlord/help', icon: I.help },
    ];

    return (
        <Shell
            sections={[
                { label: 'Menu', items: workspace },
                { label: 'People', items: people },
                { label: 'Finance', items: finance },
                { label: 'Account', items: account },
            ]}
            isActive={isActive}
            crumb={crumb}
            crumbPrefix={section}
            accountSubtitle={'Landlord'}
            searchPlaceholder="Search properties, tenants, requests…"
            banners={<SubscriptionBanner />}
        >
            {children}
        </Shell>
    );
}
