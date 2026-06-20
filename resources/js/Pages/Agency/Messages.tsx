import { FormEvent, useEffect, useRef, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';

type ConversationSummary = {
    id: number;
    title: string;
    is_broadcast: boolean;
    participant_count: number;
    other_initials: string;
    preview: string;
    updated_at: string | null;
    unread_count: number;
};

type MessageRow = {
    id: number;
    body: string;
    sender_id: number;
    sender_name: string | null;
    is_self: boolean;
    created_at: string | null;
    created_on: string | null;
};

type Props = {
    agency: { id: number; name: string };
    me: { id: number; name: string };
    conversations: ConversationSummary[];
    active: ConversationSummary | null;
    messages: MessageRow[];
    agents: { id: number; name: string }[];
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

type FilterKey = 'all' | 'agents' | 'broadcast';

function gradientFor(initials: string): string {
    const palette = [
        'linear-gradient(135deg,#F26A1B,#B8470A)',
        'linear-gradient(135deg,#F472B6,#E11D48)',
        'linear-gradient(135deg,#38BDF8,#0284C7)',
        'linear-gradient(135deg,#34D399,#059669)',
        'linear-gradient(135deg,#FBBF24,#D97706)',
        'linear-gradient(135deg,#A78BFA,#7C3AED)',
    ];
    const hash = (initials || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return palette[hash % palette.length];
}

export default function Messages({ agency, me, conversations, active, messages, agents }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [filter, setFilter] = useState<FilterKey>('all');
    const [broadcastOpen, setBroadcastOpen] = useState(false);
    const messageScrollRef = useRef<HTMLDivElement>(null);

    const filtered = conversations.filter((c) => {
        if (filter === 'agents') return !c.is_broadcast;
        if (filter === 'broadcast') return c.is_broadcast;
        return true;
    });

    useEffect(() => {
        if (messageScrollRef.current) {
            messageScrollRef.current.scrollTop = messageScrollRef.current.scrollHeight;
        }
    }, [messages.length, active?.id]);

    function openConversation(id: number) {
        router.get('/agency/messages', { conversation_id: id }, { preserveState: true, preserveScroll: false });
    }

    return (
        <AgencyLayout agencyName={agency.name} crumb="Team Messages">
            <Head title="Team Messages" />

            {flash?.success && (
                <div className="mx-8 mt-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                    {flash.success}
                </div>
            )}

            <div className="flex h-[calc(100vh-64px)]">
                <aside className="w-80 border-r border-ink-200 bg-white flex flex-col">
                    <div className="p-4 border-b border-ink-200">
                        <h1 className="text-lg font-bold">Team Messages</h1>
                        <div className="flex items-center gap-2 mt-3">
                            {(['all', 'agents', 'broadcast'] as FilterKey[]).map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFilter(f)}
                                    className={
                                        'text-[11px] px-2.5 py-1 rounded-full font-medium capitalize transition ' +
                                        (filter === f ? 'bg-ink-900 text-white' : 'bg-ink-100 hover:bg-ink-200')
                                    }
                                >
                                    {f === 'agents' ? 'Agents' : f === 'broadcast' ? 'Broadcast' : 'All'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <p className="p-6 text-[13px] text-ink-500 text-center">No conversations.</p>
                        ) : (
                            filtered.map((c) => {
                                const selected = active?.id === c.id;
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => openConversation(c.id)}
                                        className={
                                            'w-full text-left flex items-start gap-3 p-4 border-b border-ink-100 transition ' +
                                            (selected
                                                ? 'bg-brand-50/40 border-l-2 border-l-brand-500'
                                                : 'hover:bg-ink-50')
                                        }
                                    >
                                        <Avatar initials={c.other_initials} broadcast={c.is_broadcast} size={10} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[13px] font-semibold truncate">{c.title}</p>
                                                <span className="text-[10px] text-ink-400">{c.updated_at ?? ''}</span>
                                            </div>
                                            <p className="text-[11px] text-ink-500 truncate mt-0.5">{c.preview}</p>
                                            {c.unread_count > 0 && (
                                                <span className="text-[10px] inline-block mt-1.5 bg-danger text-white px-1.5 rounded-full font-bold">
                                                    {c.unread_count}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    <div className="p-3 border-t border-ink-200">
                        <button
                            type="button"
                            onClick={() => setBroadcastOpen(true)}
                            className="w-full py-2 text-[12px] bg-ink-900 text-white rounded-md font-medium"
                        >
                            + New broadcast
                        </button>
                    </div>
                </aside>

                <div className="flex-1 flex flex-col bg-ink-50 min-w-0">
                    {active ? (
                        <>
                            <div className="h-16 bg-white border-b border-ink-200 px-6 flex items-center gap-3">
                                <Avatar initials={active.other_initials} broadcast={active.is_broadcast} size={9} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[14px] font-semibold truncate">{active.title}</p>
                                    <p className="text-[11px] text-success">
                                        {active.is_broadcast
                                            ? `📣 ${active.participant_count - 1} agent${active.participant_count - 1 === 1 ? '' : 's'}`
                                            : '● Online'}
                                    </p>
                                </div>
                            </div>

                            <div ref={messageScrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                                {messages.length === 0 ? (
                                    <div className="text-center text-[12px] text-ink-400 mt-12">
                                        No messages yet. Say hello.
                                    </div>
                                ) : (
                                    messages.map((m) => <MessageBubble key={m.id} m={m} />)
                                )}
                            </div>

                            <Composer conversationId={active.id} />
                        </>
                    ) : (
                        <div className="flex-1 grid place-items-center text-ink-400 text-[14px]">
                            Pick a conversation from the left to start chatting.
                        </div>
                    )}
                </div>
            </div>

            {broadcastOpen && <BroadcastModal agents={agents} onClose={() => setBroadcastOpen(false)} />}
        </AgencyLayout>
    );
}

function Avatar({ initials, broadcast, size }: { initials: string; broadcast: boolean; size: 9 | 10 }) {
    const dim = size === 10 ? 'w-10 h-10' : 'w-9 h-9';
    if (broadcast) {
        return (
            <div className={`${dim} rounded-full bg-ink-900 flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                📢
            </div>
        );
    }
    return (
        <div
            className={`${dim} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}
            style={{ background: gradientFor(initials) }}
        >
            {initials || '?'}
        </div>
    );
}

function MessageBubble({ m }: { m: MessageRow }) {
    if (m.is_self) {
        return (
            <div className="flex gap-2 justify-end">
                <div className="max-w-md">
                    <div className="bg-brand-500 text-white rounded-2xl rounded-tr-md p-3">
                        <p className="text-[13px]" style={{ whiteSpace: 'pre-wrap' }}>{m.body}</p>
                    </div>
                    <p className="text-[10px] text-ink-400 mt-1 mr-1 text-right">{m.created_at ?? ''} · ✓</p>
                </div>
            </div>
        );
    }
    return (
        <div className="flex gap-2">
            <Avatar initials={(m.sender_name ?? '?').split(' ').map((s) => s[0]).slice(0, 2).join('')} broadcast={false} size={9} />
            <div className="max-w-md">
                <div className="bg-white border border-ink-200 rounded-2xl rounded-tl-md p-3">
                    <p className="text-[11px] text-ink-500 font-semibold mb-1">{m.sender_name}</p>
                    <p className="text-[13px]" style={{ whiteSpace: 'pre-wrap' }}>{m.body}</p>
                </div>
                <p className="text-[10px] text-ink-400 mt-1 ml-1">{m.created_at ?? ''}</p>
            </div>
        </div>
    );
}

function Composer({ conversationId }: { conversationId: number }) {
    const { data, setData, post, processing, reset } = useForm({ body: '' });

    function submit(e: FormEvent) {
        e.preventDefault();
        if (!data.body.trim()) return;
        post(`/agency/messages/${conversationId}`, {
            preserveScroll: true,
            onSuccess: () => reset('body'),
        });
    }

    return (
        <form onSubmit={submit} className="bg-white border-t border-ink-200 p-4">
            <div className="flex items-end gap-2 bg-ink-50 border border-ink-200 rounded-xl p-3">
                <input
                    value={data.body}
                    onChange={(e) => setData('body', e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 bg-transparent border-0 focus:outline-none text-[14px]"
                />
                <button
                    type="submit"
                    disabled={processing || !data.body.trim()}
                    className="px-3 py-1.5 bg-brand-500 text-white text-[12px] rounded-md font-medium disabled:opacity-50"
                >
                    {processing ? 'Sending…' : 'Send'}
                </button>
            </div>
        </form>
    );
}

function BroadcastModal({ agents, onClose }: { agents: { id: number; name: string }[]; onClose: () => void }) {
    const { data, setData, post, processing, errors, reset } = useForm({ body: '' });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agency/messages-broadcast', {
            preserveScroll: false,
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    }

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/50 p-4">
            <div className="bg-white rounded-xl shadow-lift max-w-md w-full p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-bold">📢 Broadcast to team</h2>
                        <p className="text-[13px] text-ink-500 mt-1">
                            Sends to all {agents.length} agent{agents.length === 1 ? '' : 's'}. Shows up in their Team Messages view.
                        </p>
                    </div>
                    <button onClick={onClose} className="text-ink-400 hover:text-ink-900 text-2xl leading-none">×</button>
                </div>
                <form onSubmit={submit} className="mt-5">
                    <textarea
                        value={data.body}
                        onChange={(e) => setData('body', e.target.value)}
                        rows={5}
                        className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
                        placeholder="Type your team announcement…"
                        required
                    />
                    {errors.body && <p className="text-[11px] text-danger mt-1">{errors.body}</p>}
                    <div className="flex justify-end gap-2 pt-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing || !data.body.trim()}
                            className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 disabled:opacity-60"
                        >
                            {processing ? 'Sending…' : 'Send broadcast'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
