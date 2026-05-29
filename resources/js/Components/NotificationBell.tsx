/**
 * Header notification bell — shared across AgentLayout + AgencyLayout (and
 * any other dashboard layout that wants to expose the same UX).
 *
 * Drives off the `notifications` shared Inertia prop (`{ unread_count, recent }`)
 * — see HandleInertiaRequests::notifications().
 */
import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';

export type NotificationItem = {
    id: string;
    type: string;
    title: string;
    body: string;
    href: string | null;
    tone: 'brand' | 'success' | 'warning' | 'danger' | 'muted';
    read_at: string | null;
    created_at: string | null;
    created_human: string | null;
};

type Props = {
    notifications: { unread_count: number; recent: NotificationItem[] } | null;
};

export default function NotificationBell({ notifications }: Props) {
    const [open, setOpen] = useState(false);
    const ref             = useRef<HTMLDivElement>(null);
    const unread          = notifications?.unread_count ?? 0;
    const recent          = notifications?.recent ?? [];

    useEffect(() => {
        if (! open) return;
        function onClick(e: MouseEvent) {
            if (ref.current && ! ref.current.contains(e.target as Node)) setOpen(false);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    function markRead(id: string) {
        router.post(`/notifications/${id}/read`, {}, {
            preserveScroll: true,
            preserveState: true,
            only: ['notifications'],
        });
    }
    function markAllRead() {
        router.post('/notifications/read-all', {}, {
            preserveScroll: true,
            preserveState: true,
            only: ['notifications'],
        });
    }
    function handleItemClick(item: NotificationItem) {
        if (! item.read_at) markRead(item.id);
        if (item.href) {
            setTimeout(() => router.visit(item.href!), 50);
            setOpen(false);
        }
    }

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen((v) => ! v)}
                className="w-9 h-9 rounded-lg hover:bg-ink-100 flex items-center justify-center relative transition shrink-0"
                title={unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'Notifications'}
                aria-label="Notifications"
                aria-expanded={open}
            >
                <svg className="w-4 h-4 text-ink-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                {unread > 0 && (
                    <span className="absolute top-1.5 right-2 min-w-[8px] h-2 rounded-full bg-danger" />
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-ink-200 shadow-lift z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
                        <div>
                            <p className="text-[13px] font-bold">Notifications</p>
                            <p className="text-[11px] text-ink-500">
                                {unread > 0 ? `${unread} unread` : 'All caught up'}
                            </p>
                        </div>
                        {unread > 0 && (
                            <button
                                onClick={markAllRead}
                                className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {recent.length === 0 ? (
                            <div className="px-4 py-10 text-center text-[13px] text-ink-500">
                                <p>You're all caught up.</p>
                                <p className="text-[11px] text-ink-400 mt-1">New notifications will land here.</p>
                            </div>
                        ) : (
                            recent.map((item) => {
                                const isUnread = ! item.read_at;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleItemClick(item)}
                                        className={`w-full text-left px-4 py-3 border-b border-ink-100 last:border-b-0 hover:bg-ink-50 transition flex items-start gap-3 ${
                                            isUnread ? 'bg-brand-50/40' : ''
                                        }`}
                                    >
                                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                            item.tone === 'danger'  ? 'bg-danger'  :
                                            item.tone === 'warning' ? 'bg-warning' :
                                            item.tone === 'success' ? 'bg-success' :
                                            item.tone === 'brand'   ? 'bg-brand-500' :
                                            'bg-ink-300'
                                        }`} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[13px] ${isUnread ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
                                                {item.title}
                                            </p>
                                            {item.body && (
                                                <p className="text-[12px] text-ink-500 mt-0.5">{item.body}</p>
                                            )}
                                            <p className="text-[10px] text-ink-400 mt-1">{item.created_human}</p>
                                        </div>
                                        {isUnread && (
                                            <span className="text-[9px] uppercase tracking-wider font-bold text-brand-600 mt-1">NEW</span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
