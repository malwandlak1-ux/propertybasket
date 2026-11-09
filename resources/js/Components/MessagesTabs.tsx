import { Link } from '@inertiajs/react';

/** Chats | Email switch at the top of the Messages pages (agent + agency). */
export default function MessagesTabs({ base, active, unreadEmail = 0, className = '' }: { base: '/agent/messages' | '/agency/messages'; active: 'chats' | 'email'; unreadEmail?: number; className?: string }) {
    const tab = (on: boolean) =>
        `inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold transition ${on ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100'}`;

    return (
        <nav aria-label="Messages" className={`inline-flex gap-1 p-1 rounded-full bg-white border border-ink-200 ${className}`}>
            <Link href={base} className={tab(active === 'chats')} aria-current={active === 'chats' ? 'page' : undefined}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.7a8.5 8.5 0 0 1 16.1-3.8z" /></svg>
                Chats
            </Link>
            <Link href={`${base}/email`} className={tab(active === 'email')} aria-current={active === 'email' ? 'page' : undefined}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>
                Email
                {unreadEmail > 0 && <span className="ml-0.5 min-w-4 h-4 px-1 rounded-full bg-brand-500 text-white text-[9px] font-bold grid place-items-center">{unreadEmail}</span>}
            </Link>
        </nav>
    );
}
