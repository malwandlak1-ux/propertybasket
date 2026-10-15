import { FormEvent, useEffect, useRef, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import Icon from '@/Components/Dashboard/Icon';
import { FlashBanners, PageHeader, SummaryStrip, btnPrimary } from '@/Components/Dashboard/Charts';

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
        'linear-gradient(135deg,var(--color-brand-500),var(--color-brand-700))',
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

    const unread = conversations.reduce((n, c) => n + c.unread_count, 0);
    const broadcasts = conversations.filter((c) => c.is_broadcast).length;

    return (
        <AgencyLayout agencyName={agency.name} crumb="Team Messages">
            <Head title="Team Messages" />

            <section className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Team Messages"
                    subtitle="Direct chats with your agents · team broadcasts"
                    actions={
                        <button type="button" onClick={() => setBroadcastOpen(true)} className={btnPrimary}>
                            <Icon name="megaphone" className="w-4 h-4" />New broadcast
                        </button>
                    }
                />

                <FlashBanners flash={flash} />

                <SummaryStrip
                    title="Inbox Summary"
                    subtitle={`Signed in as ${me.name}`}
                    cells={[
                        { label: 'Conversations', value: String(conversations.length), sub: `${conversations.length - broadcasts} with agents` },
                        { label: 'Unread', value: String(unread), sub: unread > 0 ? 'Messages waiting for you' : 'All caught up', tone: unread > 0 ? 'warning' : 'success' },
                        { label: 'Broadcasts', value: String(broadcasts), sub: 'Team-wide announcements', tone: 'muted' },
                        { label: 'Team', value: String(agents.length), sub: `Agent${agents.length === 1 ? '' : 's'} you can message`, tone: 'muted' },
                    ]}
                />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[calc(100vh-22rem)] lg:min-h-[520px]">
                    <aside className="lg:col-span-4 bg-white rounded-2xl border border-ink-200/60 shadow-soft flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-ink-200">
                            <h2 className="text-base font-semibold">Conversations</h2>
                            <div className="flex items-center gap-1.5 mt-3">
                                {(['all', 'agents', 'broadcast'] as FilterKey[]).map((f) => (
                                    <button
                                        key={f}
                                        type="button"
                                        onClick={() => setFilter(f)}
                                        className={
                                            'text-[12px] px-3 py-1.5 rounded-full font-semibold transition ' +
                                            (filter === f ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200')
                                        }
                                    >
                                        {f === 'agents' ? 'Agents' : f === 'broadcast' ? 'Broadcast' : 'All'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2">
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
                                                'w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition ' +
                                                (selected ? 'bg-brand-50' : 'hover:bg-ink-50')
                                            }
                                        >
                                            <Avatar initials={c.other_initials} broadcast={c.is_broadcast} size={10} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={'text-[13.5px] font-semibold truncate ' + (selected ? 'text-brand-800' : '')}>{c.title}</p>
                                                    <span className="text-[10.5px] text-ink-400 shrink-0">{c.updated_at ?? ''}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 mt-0.5">
                                                    <p className="text-[12px] text-ink-500 truncate">{c.preview}</p>
                                                    {c.unread_count > 0 && (
                                                        <span className="text-[10px] min-w-[18px] text-center bg-danger text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">{c.unread_count}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    <div className="lg:col-span-8 bg-white rounded-2xl border border-ink-200/60 shadow-soft flex flex-col overflow-hidden min-h-[480px]">
                        {active ? (
                            <>
                                <div className="px-5 py-3.5 border-b border-ink-200 flex items-center gap-3 shrink-0">
                                    <Avatar initials={active.other_initials} broadcast={active.is_broadcast} size={9} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] font-semibold truncate">{active.title}</p>
                                        <p className="text-[11.5px] text-ink-500">
                                            {active.is_broadcast
                                                ? `Broadcast · ${active.participant_count - 1} agent${active.participant_count - 1 === 1 ? '' : 's'}`
                                                : 'Direct message'}
                                        </p>
                                    </div>
                                </div>

                                <div ref={messageScrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-[var(--pb-panel,#F5F6F5)]">
                                    {messages.length === 0 ? (
                                        <div className="text-center text-[12.5px] text-ink-400 mt-12">No messages yet. Say hello.</div>
                                    ) : (
                                        messages.map((m) => <MessageBubble key={m.id} m={m} />)
                                    )}
                                </div>

                                <Composer conversationId={active.id} />
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                                <span className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center mb-4"><Icon name="chat" className="w-7 h-7" /></span>
                                <p className="text-[15px] font-semibold">Your team inbox</p>
                                <p className="text-[13px] text-ink-500 mt-1">Pick a conversation to start chatting.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {broadcastOpen && <BroadcastModal agents={agents} onClose={() => setBroadcastOpen(false)} />}
        </AgencyLayout>
    );
}

function Avatar({ initials, broadcast, size }: { initials: string; broadcast: boolean; size: 9 | 10 }) {
    const dim = size === 10 ? 'w-10 h-10' : 'w-9 h-9';
    if (broadcast) {
        return (
            <div className={`${dim} rounded-full bg-ink-900 flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                <Icon name="megaphone" className="w-4 h-4" />
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
                    <div className="bg-brand-700 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-soft">
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
                <div className="bg-white rounded-2xl rounded-bl-md px-4 py-2.5 shadow-soft">
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
        <form onSubmit={submit} className="border-t border-ink-200 p-4 shrink-0">
            <div className="flex items-center gap-2 bg-ink-50 rounded-full pl-4 pr-1.5 py-1.5 border border-ink-200 focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100 transition">
                <input
                    value={data.body}
                    onChange={(e) => setData('body', e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 bg-transparent border-0 focus:outline-none text-[13.5px] py-1.5"
                />
                <button
                    type="submit"
                    disabled={processing || !data.body.trim()}
                    className="rounded-full bg-brand-700 hover:bg-brand-800 text-white px-4 py-2 text-[13px] font-semibold disabled:opacity-40 transition"
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
            <div className="bg-white rounded-2xl shadow-lift max-w-md w-full p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2"><Icon name="megaphone" className="w-5 h-5" />Broadcast to team</h2>
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
                        className="w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[14px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition"
                        placeholder="Type your team announcement…"
                        required
                    />
                    {errors.body && <p className="text-[11px] text-danger mt-1">{errors.body}</p>}
                    <div className="flex justify-end gap-2 pt-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-[13px] border border-ink-200 rounded-full font-semibold hover:bg-ink-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing || !data.body.trim()}
                            className="px-4 py-2 text-[13px] bg-brand-700 text-white rounded-full hover:bg-brand-800 disabled:opacity-60"
                        >
                            {processing ? 'Sending…' : 'Send broadcast'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
