import { ReactNode } from 'react';
import Shell, { ShellNavItem } from '@/Components/Dashboard/Shell';

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

type NavItem = ShellNavItem;

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

export default function ContractorLayout({ children, crumb = 'Dashboard', section = 'My Workspace', business, counts }: Props) {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const isActive = (p: string) => p === '/contractor' ? path === p : path.startsWith(p);


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
        <Shell
            sections={[
                { label: 'Menu', items: workspace },
                { label: 'Billing', items: billing },
                { label: 'Profile', items: profile },
                { label: 'Account', items: account },
            ]}
            isActive={isActive}
            crumb={crumb}
            crumbPrefix={section}
            accountSubtitle={business ?? 'Contractor'}
            searchPlaceholder="Search jobs, agencies, invoices…"
        >
            {children}
        </Shell>
    );
}
