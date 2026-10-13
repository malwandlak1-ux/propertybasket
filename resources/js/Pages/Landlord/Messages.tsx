import { useState, useRef, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';
import { Spinner } from '@/Components/Skeleton';
import Icon from '@/Components/Dashboard/Icon';

type ConvItem = {
    id: number;
    title: string;
    subtitle: string | null;
    initials: string;
    type: string;
    preview: string;
    updated_at: string;
    unread_count: number;
};

type MessageItem =
    | { type: 'date_divider'; label: string }
    | {
          type: 'message';
          id: number;
          body: string;
          sender_id: number;
          sender_name: string;
          is_self: boolean;
          created_at: string;
      };

type ActiveConv = { id: number; title: string; subtitle: string | null; initials: string; type: string } | null;

type Props = {
    landlord: { id: number; name: string };
    conversations: ConvItem[];
    active: ActiveConv;
    messages: MessageItem[];
};

const AVATAR_TINTS = [
    'bg-brand-100 text-brand-800',
    'bg-emerald-100 text-emerald-800',
    'bg-sky-100 text-sky-800',
    'bg-amber-100 text-amber-800',
    'bg-rose-100 text-rose-800',
];
const tint = (id: number) => AVATAR_TINTS[id % AVATAR_TINTS.length];

export default function LandlordMessages({ conversations, active, messages }: Props) {
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [messages]);

    function send() {
        if (!body.trim() || !active || sending) return;
        setSending(true);
        router.post(`/landlord/messages/${active.id}`, { body }, {
            preserveScroll: true,
            onSuccess: () => setBody(''),
            onFinish: () => setSending(false),
        });
    }

    const hasMessages = messages.some((m) => m.type === 'message');
    const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

    return (
        <LandlordLayout crumb="Messages" section="People" unreadMessages={totalUnread}>
            <Head title="Messages" />

            <section className="px-4 sm:px-7 py-6">
                <div className="mb-5 pb-rise">
                    <h1 className="text-[28px] sm:text-[32px] leading-tight tracking-tight">Messages</h1>
                    <p className="text-[13.5px] text-ink-500 mt-1">Talk to your tenants and the contractors working on your properties.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[calc(100vh-15rem)] lg:min-h-[480px]">
                    {/* Conversation list */}
                    <aside className="lg:col-span-4 bg-white rounded-2xl border border-ink-200/60 shadow-soft flex flex-col overflow-hidden">
                        <div className="px-5 py-4 border-b border-ink-100">
                            <h2 className="text-[16px] font-semibold tracking-tight">Conversations</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">{conversations.length} thread{conversations.length === 1 ? '' : 's'}</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {conversations.length === 0 ? (
                                <div className="p-6 text-center text-[12.5px] text-ink-400">No conversations yet. A thread appears here once a tenant opens their Messages page.</div>
                            ) : (
                                conversations.map((conv) => {
                                    const on = active?.id === conv.id;
                                    return (
                                        <button
                                            key={conv.id}
                                            onClick={() => router.get('/landlord/messages', { conversation_id: conv.id }, { preserveState: true })}
                                            className={`w-full text-left px-3 py-3 rounded-xl transition flex items-center gap-3 ${on ? 'bg-brand-50' : 'hover:bg-ink-50'}`}
                                        >
                                            <span className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${tint(conv.id)}`}>
                                                {conv.initials}
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="flex items-center justify-between gap-2">
                                                    <span className={`text-[13.5px] font-semibold truncate ${on ? 'text-brand-800' : ''}`}>{conv.title}</span>
                                                    <span className="text-[10.5px] text-ink-400 shrink-0">{conv.updated_at}</span>
                                                </span>
                                                <span className="flex items-center justify-between gap-2 mt-0.5">
                                                    <span className="text-[12px] text-ink-500 truncate">{conv.preview}</span>
                                                    {conv.unread_count > 0 && (
                                                        <span className="text-[10px] min-w-[18px] text-center bg-danger text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">{conv.unread_count}</span>
                                                    )}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    {/* Chat */}
                    <div className="lg:col-span-8 bg-white rounded-2xl border border-ink-200/60 shadow-soft flex flex-col overflow-hidden min-h-[480px]">
                        {active ? (
                            <>
                                <div className="px-5 py-3.5 border-b border-ink-100 flex items-center gap-3 shrink-0">
                                    <span className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold ${tint(active.id)}`}>{active.initials}</span>
                                    <div className="min-w-0">
                                        <p className="text-[14px] font-semibold truncate">{active.title}</p>
                                        <p className="text-[11.5px] text-ink-500 capitalize">{active.subtitle ?? active.type?.replace('_', ' ')}</p>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-[var(--pb-panel,#F5F6F5)]">
                                    {! hasMessages && (
                                        <div className="h-full flex flex-col items-center justify-center text-center py-10">
                                            <span className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center mb-3">
                                                <Icon name="chat" className="w-6 h-6" />
                                            </span>
                                            <p className="text-[14px] font-semibold">Start the conversation</p>
                                            <p className="text-[12.5px] text-ink-500 mt-1 max-w-xs">Send {active.title} a message. They will see it in their portal.</p>
                                        </div>
                                    )}
                                    {messages.map((item, idx) => {
                                        if (item.type === 'date_divider') {
                                            return (
                                                <div key={idx} className="flex items-center justify-center">
                                                    <span className="text-[11px] text-ink-500 font-semibold bg-white rounded-full px-3 py-1 shadow-soft">{item.label}</span>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={item.id} className={`flex gap-2.5 ${item.is_self ? 'flex-row-reverse' : 'flex-row'}`}>
                                                {! item.is_self && (
                                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${tint(active.id)}`}>{active.initials}</span>
                                                )}
                                                <div className={`max-w-[70%] flex flex-col gap-1 ${item.is_self ? 'items-end' : 'items-start'}`}>
                                                    <div className={`px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                                                        item.is_self
                                                            ? 'bg-brand-700 text-white rounded-br-md'
                                                            : 'bg-white text-ink-900 rounded-bl-md shadow-soft'
                                                    }`}>
                                                        {item.body}
                                                    </div>
                                                    <span className="text-[10.5px] text-ink-400">{item.created_at}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={endRef} />
                                </div>

                                <div className="border-t border-ink-100 p-4">
                                    <div className="flex items-center gap-2 bg-ink-50 rounded-full pl-4 pr-1.5 py-1.5 border border-ink-200 focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100 transition">
                                        <input
                                            value={body}
                                            onChange={(e) => setBody(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                                            className="flex-1 bg-transparent text-[13.5px] focus:outline-none py-1.5"
                                            placeholder={`Message ${active.title}…`}
                                        />
                                        <button
                                            onClick={send}
                                            disabled={!body.trim() || sending}
                                            className="inline-flex items-center gap-2 rounded-full bg-brand-700 hover:bg-brand-800 text-white px-4 py-2 text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition min-w-[92px] justify-center"
                                        >
                                            {sending ? <><Spinner size={14} />Sending…</> : (
                                                <>
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                                                    Send
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-[10.5px] text-ink-400 mt-2 px-1">Messages are kept securely in line with POPIA.</p>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                                <span className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center mb-4">
                                    <Icon name="chat" className="w-7 h-7" />
                                </span>
                                <p className="text-[15px] font-semibold">Your messages</p>
                                <p className="text-[13px] text-ink-500 mt-1">Select a conversation to start messaging.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </LandlordLayout>
    );
}
