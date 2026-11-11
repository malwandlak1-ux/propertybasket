import { ReactNode } from 'react';
import { Link } from '@inertiajs/react';

export type WaSection = 'chats' | 'campaigns' | 'templates' | 'hours' | 'connection';

const BASE = '/agent/crm/whatsapp';

const ITEMS: { key: WaSection; label: string; icon: ReactNode }[] = [
    {
        key: 'chats', label: 'Chats',
        icon: <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.9-.9L3 20.5l1.5-4.6A8.2 8.2 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5ZM8 10h8M8 13.5h5" />,
    },
    {
        key: 'campaigns', label: 'Campaigns',
        icon: <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1ZM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />,
    },
    {
        key: 'templates', label: 'Meta templates',
        icon: <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M9 13h6M9 17h4" />,
    },
    {
        key: 'hours', label: 'Sending hours',
        icon: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2" />,
    },
    {
        key: 'connection', label: 'Connection',
        icon: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
    },
];

export function waHref(section: WaSection) {
    return section === 'chats' ? BASE : `${BASE}?section=${section}`;
}

/**
 * WhatsApp-Web style frame: a slim icon rail on the left (Chats, Campaigns,
 * Meta templates, Sending hours, Connection) and the section beside it.
 * On the main WhatsApp page `onSelect` switches sections in place; on the
 * chat/campaign pages the rail items are plain links back to that page.
 */
export default function WaShell({ active, onSelect, badges = {}, dots = {}, children }: {
    active: WaSection;
    onSelect?: (s: WaSection) => void;
    badges?: Partial<Record<WaSection, number>>;
    dots?: Partial<Record<WaSection, boolean>>;
    children: ReactNode;
}) {
    return (
        <div className="flex bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden h-[calc(100vh-15rem)] min-h-[560px] pb-rise">
            <nav className="w-14 sm:w-16 shrink-0 bg-[#F0F2F5] border-r border-ink-200 flex flex-col items-center py-3 gap-1.5" aria-label="WhatsApp sections">
                {ITEMS.map((it, i) => {
                    const on = it.key === active;
                    const badge = badges[it.key];
                    const cls = `relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition ${on ? 'bg-ink-900/10 text-ink-900' : 'text-ink-500 hover:bg-ink-900/5 hover:text-ink-800'}`;
                    const inner = (
                        <>
                            <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{it.icon}</svg>
                            {!!badge && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#25D366] text-white text-[10px] font-bold flex items-center justify-center">{badge > 99 ? '99+' : badge}</span>
                            )}
                            {!badge && dots[it.key] && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#25D366]" />}
                        </>
                    );
                    return (
                        <div key={it.key} className={`group relative ${i === ITEMS.length - 1 ? 'mt-auto' : ''}`}>
                            {onSelect ? (
                                <button type="button" onClick={() => onSelect(it.key)} className={cls} aria-label={it.label} aria-current={on ? 'page' : undefined}>{inner}</button>
                            ) : (
                                <Link href={waHref(it.key)} className={cls} aria-label={it.label} aria-current={on ? 'page' : undefined}>{inner}</Link>
                            )}
                            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-20 whitespace-nowrap rounded-md bg-ink-900 text-white text-[11.5px] font-semibold px-2 py-1 opacity-0 group-hover:opacity-100 transition">
                                {it.label}
                            </span>
                        </div>
                    );
                })}
            </nav>
            <div className="flex-1 min-w-0 flex">{children}</div>
        </div>
    );
}

/** Thread list item shape shared by the main page and the chat page. */
export type WaThread = { phone: string; display: string; owner: string | null; last: string | null; at: string | null; open: boolean };

/** Left-hand chat list, WhatsApp Web style: search, All / Open / Closed chips, rows. */
export function ChatList({ threads, activePhone, query, setQuery, filter, setFilter, className = '' }: {
    threads: WaThread[];
    activePhone?: string;
    query: string;
    setQuery: (q: string) => void;
    filter: 'all' | 'open' | 'closed';
    setFilter: (f: 'all' | 'open' | 'closed') => void;
    className?: string;
}) {
    const q = query.trim().toLowerCase();
    const shown = threads.filter((t) =>
        (filter === 'all' || (filter === 'open') === t.open)
        && (!q || (t.owner ?? '').toLowerCase().includes(q) || t.display.replace(/\s/g, '').includes(q.replace(/\s/g, '')) || (t.last ?? '').toLowerCase().includes(q)));
    const openCount = threads.filter((t) => t.open).length;

    return (
        <div className={`flex flex-col min-h-0 border-r border-ink-200 bg-white ${className}`}>
            <div className="px-4 pt-4 pb-2">
                <h2 className="text-[20px] font-bold tracking-tight text-[#00A884]">Chats</h2>
            </div>
            <div className="px-3 pb-2">
                <label className="flex items-center gap-2 bg-[#F0F2F5] rounded-full px-3.5 py-2">
                    <svg className="w-4 h-4 text-ink-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or number" className="flex-1 min-w-0 bg-transparent text-[13.5px] focus:outline-none" />
                    {query && <button type="button" onClick={() => setQuery('')} className="text-ink-500 hover:text-ink-900" aria-label="Clear search">×</button>}
                </label>
            </div>
            <div className="px-3 pb-2 flex gap-1.5">
                {([['all', 'All'], ['open', `Open ${openCount || ''}`], ['closed', 'Closed']] as const).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setFilter(k)}
                        className={`px-3 py-1 rounded-full text-[12.5px] font-semibold border transition ${filter === k ? 'bg-[#D9FDD3] border-[#D9FDD3] text-[#008069]' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>
                        {l.trim()}
                    </button>
                ))}
            </div>
            <ul className="flex-1 overflow-y-auto">
                {shown.length === 0 && (
                    <li className="px-5 py-10 text-center text-[12.5px] text-ink-400">
                        {threads.length === 0 ? 'No replies yet. Owners who write back to a campaign show up here.' : 'No chats match.'}
                    </li>
                )}
                {shown.map((t) => {
                    const on = t.phone === activePhone;
                    const name = t.owner ?? t.display;
                    return (
                        <li key={t.phone}>
                            <Link href={`/agent/crm/whatsapp/chat?phone=${t.phone}`} preserveScroll
                                className={`flex items-center gap-3 px-3 py-2.5 mx-1.5 rounded-xl ${on ? 'bg-[#F0F2F5]' : 'hover:bg-[#F5F6F6]'}`}>
                                <span className="w-11 h-11 rounded-full bg-[#DFE5E7] text-ink-600 text-[14px] font-bold flex items-center justify-center shrink-0">
                                    {initials(name)}
                                </span>
                                <span className="min-w-0 flex-1 border-b border-ink-100 pb-2.5 -mb-2.5">
                                    <span className="flex items-baseline gap-2">
                                        <span className="flex-1 truncate text-[14.5px] font-semibold text-ink-900">{name}</span>
                                        <span className={`text-[11px] shrink-0 ${t.open ? 'text-[#00A884] font-semibold' : 'text-ink-400'}`}>{t.at}</span>
                                    </span>
                                    <span className="flex items-center gap-1.5 mt-0.5">
                                        <span className="flex-1 truncate text-[12.5px] text-ink-500">{t.last ?? (t.owner ? t.display : '')}</span>
                                        {t.open && <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] shrink-0" title="Reply window open (24 h)" />}
                                    </span>
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export function initials(name: string) {
    const parts = name.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '#';
    if (/^\d/.test(parts[0])) return '#';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** The empty right pane shown when no chat is open. */
export function NoChatSelected({ connected }: { connected: boolean }) {
    return (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center text-center bg-[#F0F2F5] px-8">
            <span className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-[#25D366] mb-4 shadow-soft">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.9-.9L3 20.5l1.5-4.6A8.2 8.2 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" /></svg>
            </span>
            <h3 className="text-[20px] font-semibold text-ink-800">WhatsApp for Property Basket</h3>
            <p className="text-[13px] text-ink-500 mt-1.5 max-w-sm">
                {connected
                    ? 'Pick a chat to read and reply. You can reply freely for 24 hours after an owner’s last message.'
                    : 'Connect your WhatsApp Business number under Connection to start chatting with owners.'}
            </p>
        </div>
    );
}
