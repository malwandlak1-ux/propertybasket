import { useEffect, useMemo, useRef, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import NewLeadModal from '@/Components/NewLeadModal';
import LeadDetailsModal from '@/Components/LeadDetailsModal';

function fmtMoney(n: number): string {
    if (n >= 1_000_000) return 'R ' + (n / 1_000_000).toFixed(1) + 'm';
    if (n >= 1_000) return 'R ' + Math.round(n / 1_000) + 'k';
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

function fmtDealValue(n: number, type?: string | null): string {
    const base = 'R ' + Math.round(n).toLocaleString('en-ZA');
    if (type === 'long_term_rent') return base + '/mo';
    return base;
}

type Card = {
    id: number;
    visitor_name: string;
    email: string | null;
    phone: string | null;
    message: string | null;
    listing_id: number | null;
    listing_title?: string | null;
    listing_type?: string | null;
    listing_slug?: string | null;
    deal_value: number;
    is_hot: boolean;
    status: string;
    source: string | null;
    created_at: string | null;
    age_label: string;
    viewing_at?: string | null;
};

type Column = {
    key: string;
    label: string;
    dot: string;
    count: number;
    total_value: number;
    cards: Card[];
};

type Listing = { id: number; label: string; type: string };

type FlashShared = {
    flash?: { success?: string | null; error?: string | null };
};

type Props = {
    agent: { id: number; name: string; agency_name: string };
    columns: Column[];
    total_value: number;
    listings: Listing[];
};

type Stage = 'new' | 'contacted' | 'qualified' | 'viewing' | 'offer';

// Dropping into kanban column → DB status saved
const COLUMN_TO_STATUS: Record<string, string> = {
    new: 'new',
    qualified: 'qualified',
    viewing: 'viewing',
    offer: 'offer',
    closed: 'closed',
};

const STATUS_TONES: Record<string, string> = {
    new:       'bg-ink-100 text-ink-700',
    contacted: 'bg-sky-50 text-sky-700',
    qualified: 'bg-brand-50 text-brand-700',
    viewing:   'bg-violet-50 text-violet-700',
    offer:     'bg-warning/15 text-warning',
    closed:    'bg-success/15 text-success',
};

const STATUS_LABELS: Record<string, string> = {
    new:       'New Lead',
    contacted: 'Contacted',
    qualified: 'Qualified',
    viewing:   'Viewing',
    offer:     'Offer',
    closed:    'Closed Won',
};

function KanbanCard({
    card,
    onClick,
    onDragStart,
    onDragEnd,
    isDragging,
    locked = false,
}: {
    card: Card;
    onClick: () => void;
    onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragEnd: () => void;
    isDragging: boolean;
    locked?: boolean;
}) {
    const isClosed = card.status === 'closed';

    return (
        <div
            draggable={! locked}
            onDragStart={locked ? undefined : onDragStart}
            onDragEnd={locked ? undefined : onDragEnd}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
            className={
                'text-left w-full bg-white rounded-lg p-3 shadow-soft border transition hover:shadow-lift select-none ' +
                (locked ? 'cursor-pointer ' : 'cursor-grab active:cursor-grabbing ') +
                (isDragging ? 'opacity-40 ring-2 ring-brand-300 ' : '') +
                (isClosed
                    ? 'border-success/30 bg-success/5'
                    : card.is_hot
                        ? 'border-l-2 border-l-danger border-ink-200'
                        : 'border-ink-200')
            }
        >
            <div className="flex items-center gap-2 mb-1.5">
                <p className="text-[13px] font-semibold flex-1 truncate">{card.visitor_name}</p>
                {isClosed && (
                    <svg className="w-3.5 h-3.5 text-success shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M5 13l4 4L19 7" />
                    </svg>
                )}
                {card.is_hot && !isClosed && (
                    <span className="text-[9px] bg-danger/15 text-danger px-1 rounded font-bold shrink-0">HOT</span>
                )}
            </div>

            {card.listing_title && (
                <p className="text-[11px] text-ink-500 mb-2 truncate">{card.listing_title}</p>
            )}

            {card.viewing_at && (
                <div className="bg-brand-50 rounded p-1.5 mb-2 flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <rect x="3" y="5" width="18" height="16" rx="2" />
                        <path d="M16 3v4M8 3v4M3 10h18" />
                    </svg>
                    <span className="text-[10px] text-brand-700 font-semibold">{card.viewing_at}</span>
                </div>
            )}

            <div className="flex items-center justify-between">
                {card.deal_value > 0 ? (
                    <span className={`text-[11px] font-mono font-semibold ${isClosed ? 'text-success' : ''}`}>
                        {fmtDealValue(card.deal_value, card.listing_type)}
                    </span>
                ) : (
                    <span className="text-[11px] text-ink-400">—</span>
                )}
                {!card.viewing_at && (
                    <span className="text-[10px] text-ink-400">{card.age_label}</span>
                )}
            </div>
        </div>
    );
}

export default function AgentPipeline({ agent, columns: initialColumns, listings }: Props) {
    const { flash } = usePage<FlashShared>().props;

    const [view, setView] = useState<'kanban' | 'table'>('kanban');
    const [columns, setColumns] = useState<Column[]>(initialColumns);
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [hoverCol, setHoverCol] = useState<string | null>(null);
    const [newLeadOpen, setNewLeadOpen] = useState<{ open: boolean; stage: Stage }>({ open: false, stage: 'new' });
    const [activeLead, setActiveLead] = useState<Card | null>(null);

    // After a drag, browsers fire a synthetic `click` event. If the dragged
    // card got unmounted by our optimistic move, the click can land on a
    // DIFFERENT card and pop open the wrong details modal (the "white screen").
    // We suppress any click for 500 ms after any drag-end OR drop event.
    const dragEndAtRef = useRef<number>(0);
    function markDragEnd() {
        dragEndAtRef.current = Date.now();
    }
    function handleCardClick(card: Card) {
        if (Date.now() - dragEndAtRef.current < 500) return;
        setActiveLead(card);
    }
    function onCardDragEnd() {
        markDragEnd();
        setDraggingId(null);
    }

    // Keep local in sync with server props (after a partial reload)
    useEffect(() => {
        setColumns(initialColumns);
    }, [initialColumns]);

    // Auto-open "New Lead" modal from Overview → /agent/pipeline?new=1
    useEffect(() => {
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1') {
            setNewLeadOpen({ open: true, stage: 'new' });
        }
    }, []);

    const totalDeals = useMemo(() => columns.reduce((a, c) => a + c.count, 0), [columns]);
    const totalValue = useMemo(
        () => columns.filter((c) => c.key !== 'closed').reduce((a, c) => a + c.total_value, 0),
        [columns]
    );

    const allCards = useMemo(() => columns.flatMap((c) => c.cards), [columns]);

    // ── Drag-and-drop ──────────────────────────────────────────────────

    function onCardDragStart(card: Card) {
        return (e: React.DragEvent<HTMLDivElement>) => {
            setDraggingId(card.id);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(card.id));
        };
    }

    function onColumnDragOver(colKey: string) {
        return (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (hoverCol !== colKey) setHoverCol(colKey);
        };
    }

    function onColumnDragLeave(colKey: string) {
        return () => {
            if (hoverCol === colKey) setHoverCol(null);
        };
    }

    function onColumnDrop(targetColKey: string) {
        return (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setHoverCol(null);
            markDragEnd(); // suppress the synthetic click that fires after drop
            const id = Number(e.dataTransfer.getData('text/plain') || draggingId);
            setDraggingId(null);
            if (! id) return;

            const sourceCol = columns.find((c) => c.cards.some((cc) => cc.id === id));
            if (! sourceCol || sourceCol.key === targetColKey) return;

            const newStatus = COLUMN_TO_STATUS[targetColKey];
            if (! newStatus) return;

            moveCardLocally(id, sourceCol.key, targetColKey, newStatus);

            router.patch(
                `/agent/pipeline/leads/${id}/status`,
                { status: newStatus },
                {
                    preserveScroll: true,
                    preserveState: true,
                    onError: () => router.reload({ only: ['columns'] }),
                }
            );
        };
    }

    function moveCardLocally(id: number, fromKey: string, toKey: string, newStatus: string) {
        setColumns((prev) => {
            const sourceCol = prev.find((c) => c.key === fromKey);
            const card = sourceCol?.cards.find((cc) => cc.id === id);
            if (! card) return prev;

            return prev.map((c) => {
                if (c.key === fromKey) {
                    const newCards = c.cards.filter((cc) => cc.id !== id);
                    return {
                        ...c,
                        cards: newCards,
                        count: Math.max(0, c.count - 1),
                        total_value: newCards.reduce((sum, cc) => sum + cc.deal_value, 0),
                    };
                }
                if (c.key === toKey) {
                    const moved = { ...card, status: newStatus, age_label: 'just now' };
                    const newCards = [moved, ...c.cards];
                    return {
                        ...c,
                        cards: newCards,
                        count: c.count + 1,
                        total_value: newCards.reduce((sum, cc) => sum + cc.deal_value, 0),
                    };
                }
                return c;
            });
        });
        setActiveLead((curr) => (curr && curr.id === id ? { ...curr, status: newStatus } : curr));
    }

    function changeStatus(id: number, newStatus: string) {
        const sourceCol = columns.find((c) => c.cards.some((cc) => cc.id === id));
        if (! sourceCol) return;
        const targetKey = statusToColumnKey(newStatus);
        if (sourceCol.key === targetKey && sourceCol.cards.find((cc) => cc.id === id)?.status === newStatus) return;

        moveCardLocally(id, sourceCol.key, targetKey, newStatus);
        router.patch(`/agent/pipeline/leads/${id}/status`, { status: newStatus }, {
            preserveScroll: true,
            preserveState: true,
            onError: () => router.reload({ only: ['columns'] }),
        });
    }

    return (
        <AgentLayout crumb="Pipeline" agencyName={agent.agency_name}>
            <Head title="Sales Pipeline" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                {flash?.success && (
                    <div className="mb-4 p-3 rounded-lg border border-success/30 bg-success/5 text-[13px] text-success font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7"/></svg>
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="mb-4 p-3 rounded-lg border border-danger/30 bg-danger/5 text-[13px] text-danger font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                        {flash.error}
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {totalDeals} active {totalDeals === 1 ? 'deal' : 'deals'} ·{' '}
                            {fmtMoney(totalValue)} in pipeline value
                            {view === 'kanban' && (
                                <span className="text-ink-400 ml-3 hidden sm:inline">· Drag a card to update its stage</span>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white border border-ink-200 rounded-lg p-1">
                            <button
                                type="button"
                                onClick={() => setView('kanban')}
                                className={
                                    'text-[12px] px-3 py-1.5 rounded-md font-semibold transition ' +
                                    (view === 'kanban' ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:bg-ink-50')
                                }
                            >
                                Kanban
                            </button>
                            <button
                                type="button"
                                onClick={() => setView('table')}
                                className={
                                    'text-[12px] px-3 py-1.5 rounded-md font-semibold transition ' +
                                    (view === 'table' ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:bg-ink-50')
                                }
                            >
                                Table
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => setNewLeadOpen({ open: true, stage: 'new' })}
                            className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
                            Add Deal
                        </button>
                    </div>
                </div>

                {view === 'kanban' ? (
                    <div className="flex gap-3 overflow-x-auto pb-2 min-h-[600px] snap-x lg:grid lg:grid-cols-6 lg:overflow-visible">
                        {columns.map((col) => {
                            const isHovered = hoverCol === col.key;
                            const isRegistered = col.key === 'registered';
                            return (
                                <div
                                    key={col.key}
                                    onDragOver={onColumnDragOver(col.key)}
                                    onDragLeave={onColumnDragLeave(col.key)}
                                    onDrop={onColumnDrop(col.key)}
                                    className={
                                        'rounded-xl p-3 flex flex-col transition-colors shrink-0 snap-start w-[82vw] sm:w-[300px] lg:w-auto lg:shrink ' +
                                        (isHovered && ! isRegistered ? 'bg-brand-50 ring-2 ring-brand-300' : 'bg-ink-100/50')
                                    }
                                >
                                    <div className="flex items-center justify-between mb-3 px-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                                            <p className="text-[12px] font-semibold uppercase tracking-wide">{col.label}</p>
                                            <span className="text-[11px] bg-white px-1.5 py-0.5 rounded-full font-bold">{col.count}</span>
                                        </div>
                                        <span className="text-[11px] text-ink-500 font-mono">{fmtMoney(col.total_value)}</span>
                                    </div>

                                    <div className="space-y-2 flex-1">
                                        {col.cards.map((card) => (
                                            <KanbanCard
                                                key={card.id}
                                                card={card}
                                                onClick={() => handleCardClick(card)}
                                                onDragStart={onCardDragStart(card)}
                                                onDragEnd={onCardDragEnd}
                                                isDragging={draggingId === card.id}
                                                locked={isRegistered}
                                            />
                                        ))}

                                        {col.key !== 'closed' && col.key !== 'registered' && (
                                            <button
                                                type="button"
                                                onClick={() => setNewLeadOpen({ open: true, stage: col.key as Stage })}
                                                className="w-full rounded-lg h-16 flex items-center justify-center text-[11px] text-ink-400 hover:text-brand-600 border-2 border-dashed border-ink-200 hover:border-brand-400 transition"
                                                style={{ backgroundImage: 'radial-gradient(circle, #E5E7EB 1px, transparent 1px)', backgroundSize: '14px 14px' }}
                                            >
                                                + Add deal
                                            </button>
                                        )}

                                        {col.count === 0 && col.key === 'closed' && (
                                            <div className="py-8 text-center text-[12px] text-ink-400">No closed deals this month</div>
                                        )}
                                        {col.count === 0 && col.key === 'registered' && (
                                            <div className="py-8 text-center text-[11px] text-ink-400">Your agency registers closed deals here</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <TableView cards={allCards} onClickRow={setActiveLead} onStatusChange={changeStatus} />
                )}
            </div>

            {newLeadOpen.open && (
                <NewLeadModal
                    listings={listings}
                    initialStage={newLeadOpen.stage}
                    onClose={() => setNewLeadOpen({ open: false, stage: 'new' })}
                />
            )}
            {activeLead && (
                <LeadDetailsModal lead={activeLead} onClose={() => setActiveLead(null)} />
            )}
        </AgentLayout>
    );
}

function statusToColumnKey(status: string): string {
    if (status === 'new' || status === 'contacted') return 'new';
    return status;
}

// ────────────────────────────────────────────────────────────────────────
// Table view

function TableView({
    cards,
    onClickRow,
    onStatusChange,
}: {
    cards: Card[];
    onClickRow: (card: Card) => void;
    onStatusChange: (id: number, newStatus: string) => void;
}) {
    if (cards.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-ink-200 p-10 text-center text-[13px] text-ink-400 shadow-soft">
                No leads in your pipeline yet. Click <strong className="text-ink-900">Add Deal</strong> to capture your first.
            </div>
        );
    }

    const sortedCards = [...cards].sort((a, b) => {
        const order: Record<string, number> = { new: 1, contacted: 2, qualified: 3, viewing: 4, offer: 5, closed: 6 };
        const so = (order[a.status] ?? 99) - (order[b.status] ?? 99);
        if (so !== 0) return so;
        return b.deal_value - a.deal_value;
    });

    return (
        <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                            <th className="font-semibold px-5 py-3">Visitor</th>
                            <th className="font-semibold py-3">Contact</th>
                            <th className="font-semibold py-3">Listing</th>
                            <th className="font-semibold py-3 text-right">Deal value</th>
                            <th className="font-semibold py-3">Stage</th>
                            <th className="font-semibold py-3 pr-5">Updated</th>
                        </tr>
                    </thead>
                    <tbody className="text-[13px]">
                        {sortedCards.map((card) => (
                            <tr
                                key={card.id}
                                onClick={() => onClickRow(card)}
                                className="border-b border-ink-100 hover:bg-ink-50 transition cursor-pointer"
                            >
                                <td className="px-5 py-3 font-semibold">
                                    <div className="flex items-center gap-2">
                                        {card.is_hot && card.status !== 'closed' && (
                                            <span className="text-[9px] bg-danger/15 text-danger px-1 rounded font-bold">HOT</span>
                                        )}
                                        {card.visitor_name}
                                    </div>
                                </td>
                                <td className="py-3 text-[12px]">
                                    {card.email && (
                                        <a
                                            href={`mailto:${card.email}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-brand-600 hover:underline block truncate max-w-[180px]"
                                        >
                                            {card.email}
                                        </a>
                                    )}
                                    {card.phone && (
                                        <a
                                            href={`tel:${card.phone}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-ink-500 hover:text-ink-900 block text-[11px] mt-0.5"
                                        >
                                            {card.phone}
                                        </a>
                                    )}
                                </td>
                                <td className="py-3 text-[12px] truncate max-w-[200px]">
                                    {card.listing_title ?? '—'}
                                </td>
                                <td className="py-3 text-right font-mono font-semibold">
                                    {card.deal_value > 0 ? fmtDealValue(card.deal_value, card.listing_type) : '—'}
                                </td>
                                <td className="py-3" onClick={(e) => e.stopPropagation()}>
                                    <select
                                        value={card.status}
                                        onChange={(e) => onStatusChange(card.id, e.target.value)}
                                        className={
                                            'text-[11px] px-2 py-1 rounded-full font-bold uppercase border-0 outline-none cursor-pointer focus:ring-2 focus:ring-brand/20 ' +
                                            (STATUS_TONES[card.status] ?? STATUS_TONES.new)
                                        }
                                    >
                                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="py-3 pr-5 text-[11px] text-ink-500">{card.age_label}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
