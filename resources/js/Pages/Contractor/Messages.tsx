import { useState, useRef, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import ContractorLayout from '@/Layouts/ContractorLayout';
import { Spinner } from '@/Components/Skeleton';

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
    counts: { requests?: number; active_jobs?: number; messages?: number };
    contractor: { id: number; name: string };
    conversations: ConvItem[];
    active: ActiveConv;
    messages: MessageItem[];
};

const AVATAR_COLORS = [
    'from-brand-500 to-brand-700',
    'from-emerald-400 to-emerald-600',
    'from-rose-400 to-rose-600',
    'from-sky-400 to-sky-600',
    'from-amber-400 to-amber-600',
];

function avatarColor(id: number): string {
    return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

export default function ContractorMessages({ counts, conversations, active, messages }: Props) {
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    function send() {
        if (!body.trim() || !active || sending) return;
        setSending(true);
        router.post(`/contractor/messages/${active.id}`, { body }, {
            preserveScroll: true,
            onSuccess: () => setBody(''),
            onFinish: () => setSending(false),
        });
    }

    return (
        <ContractorLayout crumb="Messages" section="Profile" counts={counts}>
            <Head title="Messages" />

            <div className="flex h-[calc(100vh-64px)]">
                <div className="w-72 shrink-0 bg-white border-r border-ink-200 flex flex-col">
                    <div className="p-4 border-b border-ink-200">
                        <h2 className="text-sm font-semibold mb-1">Messages</h2>
                        <p className="text-[11px] text-ink-500">Talk to agencies, landlords, and tenants</p>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {conversations.length === 0 ? (
                            <div className="p-6 text-center text-[12px] text-ink-400">No conversations yet</div>
                        ) : (
                            conversations.map((conv) => (
                                <button
                                    key={conv.id}
                                    onClick={() => router.get('/contractor/messages', { conversation_id: conv.id }, { preserveState: true })}
                                    className={`w-full text-left p-4 border-b border-ink-100 hover:bg-ink-50 transition ${
                                        active?.id === conv.id ? 'bg-brand-50 border-l-2 border-l-brand-500' : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(conv.id)} flex items-center justify-center text-white text-[12px] font-bold shrink-0`}>
                                            {conv.initials}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[13px] font-semibold truncate">{conv.title}</p>
                                                <span className="text-[10px] text-ink-400 shrink-0 ml-1">{conv.updated_at}</span>
                                            </div>
                                            <p className="text-[11px] text-ink-500 truncate mt-0.5">{conv.preview}</p>
                                            {conv.unread_count > 0 && (
                                                <span className="text-[10px] inline-block mt-1.5 bg-danger text-white px-1.5 rounded-full font-bold">
                                                    {conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {active ? (
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="h-14 border-b border-ink-200 bg-white flex items-center px-5 gap-3 shrink-0">
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(active.id)} flex items-center justify-center text-white text-[11px] font-bold`}>
                                {active.initials}
                            </div>
                            <div>
                                <p className="text-[13px] font-semibold">{active.title}</p>
                                <p className="text-[11px] text-ink-500">{active.subtitle ?? active.type?.replace('_', ' ')}</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-ink-50/30">
                            {messages.map((item, idx) => {
                                if (item.type === 'date_divider') {
                                    return (
                                        <div key={idx} className="flex items-center gap-3">
                                            <div className="flex-1 h-px bg-ink-200" />
                                            <span className="text-[11px] text-ink-400 font-semibold">{item.label}</span>
                                            <div className="flex-1 h-px bg-ink-200" />
                                        </div>
                                    );
                                }

                                return (
                                    <div key={item.id} className={`flex gap-2.5 ${item.is_self ? 'flex-row-reverse' : 'flex-row'}`}>
                                        {!item.is_self && (
                                            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(active.id)} flex items-center justify-center text-white text-[9px] font-bold shrink-0 mt-0.5`}>
                                                {active.initials}
                                            </div>
                                        )}
                                        <div className={`max-w-[65%] ${item.is_self ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                            <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                                                item.is_self
                                                    ? 'bg-brand-500 text-white rounded-br-sm'
                                                    : 'bg-white border border-ink-200 text-ink-900 rounded-bl-sm shadow-soft'
                                            }`}>
                                                {item.body}
                                            </div>
                                            <span className="text-[10px] text-ink-400">{item.created_at}</span>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={endRef} />
                        </div>

                        <div className="border-t border-ink-200 bg-white p-4">
                            <div className="flex gap-3">
                                <input
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                                    className="flex-1 bg-ink-50 border border-ink-200 rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                                    placeholder="Type a message…"
                                />
                                <button
                                    onClick={send}
                                    disabled={!body.trim() || sending}
                                    className="px-4 py-2.5 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 text-[13px] font-semibold min-w-[88px] justify-center"
                                >
                                    {sending ? (
                                        <>
                                            <Spinner size={14} />
                                            Sending…
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                                            </svg>
                                            Send
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-ink-50/30 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-white border border-ink-200 flex items-center justify-center mb-4 shadow-soft">
                            <svg className="w-8 h-8 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.7a8.5 8.5 0 0 1 16.1-3.8z" />
                            </svg>
                        </div>
                        <p className="text-[15px] font-semibold text-ink-700 mb-1">Your messages</p>
                        <p className="text-[13px] text-ink-500">Select a conversation to start messaging</p>
                    </div>
                )}
            </div>
        </ContractorLayout>
    );
}
