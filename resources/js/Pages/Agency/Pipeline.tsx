import { Head, router } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';

type Card = {
    id: number;
    visitor_name: string;
    listing_title: string | null;
    listing_slug: string | null;
    listing_type: 'for_sale' | 'long_term_rent' | 'short_term_stay' | null;
    deal_value: number;
    agent: { id: number | null; name: string | null; initials: string };
    is_hot: boolean;
    status: string;
};
type Column = {
    key: 'new' | 'qualified' | 'viewing' | 'offer' | 'closed';
    label: string;
    dot: string;
    count: number;
    total_value: number;
    cards: Card[];
};
type Props = {
    agency: { id: number; name: string };
    columns: Column[];
    total_pipeline_value: number;
    agents: { id: number; name: string }[];
    filters: { agent_id: number | null; deal_type: 'all' | 'sale' | 'rental' };
};

function fmtMoney(n: number): string {
    if (n >= 1_000_000) return 'R ' + (n / 1_000_000).toFixed(1) + 'm';
    if (n >= 1_000) return 'R ' + Math.round(n / 1_000) + 'k';
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

function gradientForAgent(id: number | null): string {
    const palette = [
        'linear-gradient(135deg,#5B3DF5,#3A23B8)',
        'linear-gradient(135deg,#F472B6,#E11D48)',
        'linear-gradient(135deg,#38BDF8,#0284C7)',
        'linear-gradient(135deg,#34D399,#059669)',
        'linear-gradient(135deg,#FBBF24,#D97706)',
        'linear-gradient(135deg,#A78BFA,#7C3AED)',
    ];
    return palette[(id ?? 0) % palette.length];
}

export default function Pipeline({ agency, columns, total_pipeline_value, agents, filters }: Props) {
    function setFilter(key: 'agent_id' | 'deal_type', value: string) {
        const next: Record<string, string> = {
            agent_id: filters.agent_id ? String(filters.agent_id) : '',
            deal_type: filters.deal_type ?? 'all',
        };
        next[key] = value;
        // Strip empties to keep URLs clean
        const payload: Record<string, string> = {};
        Object.entries(next).forEach(([k, v]) => {
            if (v && v !== '' && !(k === 'deal_type' && v === 'all')) payload[k] = v;
        });
        router.get('/agency/pipeline', payload, { preserveState: true, preserveScroll: true });
    }

    return (
        <AgencyLayout agencyName={agency.name} crumb="Pipeline">
            <Head title="Pipeline" />
            <section className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Agency Pipeline</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            All deals across all agents · {fmtMoney(total_pipeline_value)} total pipeline value
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={filters.agent_id ?? ''}
                            onChange={(e) => setFilter('agent_id', e.target.value)}
                            className="text-[12px] bg-white border border-ink-200 rounded-md px-3 py-1.5"
                        >
                            <option value="">All agents</option>
                            {agents.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                        <select
                            value={filters.deal_type}
                            onChange={(e) => setFilter('deal_type', e.target.value)}
                            className="text-[12px] bg-white border border-ink-200 rounded-md px-3 py-1.5"
                        >
                            <option value="all">All types</option>
                            <option value="sale">Sales only</option>
                            <option value="rental">Rentals only</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-5 gap-3 min-h-[600px]">
                    {columns.map((col) => (
                        <div key={col.key} className="bg-ink-100/50 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-3 px-1">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                                    <p className="text-[12px] font-semibold uppercase tracking-wide">{col.label}</p>
                                    <span className="text-[11px] bg-white px-1.5 py-0.5 rounded-full font-bold">{col.count}</span>
                                </div>
                                <span className="text-[11px] text-ink-500 font-mono">{fmtMoney(col.total_value)}</span>
                            </div>

                            <div className="space-y-2">
                                {col.cards.length === 0 ? (
                                    <p className="text-[12px] text-ink-400 text-center mt-6">No leads here yet</p>
                                ) : (
                                    col.cards.map((c) => (
                                        <PipelineCard key={c.id} card={c} closed={col.key === 'closed'} />
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </AgencyLayout>
    );
}

function PipelineCard({ card, closed }: { card: Card; closed: boolean }) {
    const isHot = card.is_hot;
    return (
        <div
            className={
                'bg-white rounded-lg p-3 shadow-soft border border-ink-200 ' +
                (closed ? 'border-success/30 bg-success/5 ' : '') +
                (isHot ? 'border-l-2 border-l-danger ' : '')
            }
        >
            <div className="flex items-center gap-2 mb-1">
                <p className="text-[13px] font-semibold flex-1 truncate">{card.visitor_name}</p>
                {isHot && (
                    <span className="text-[9px] bg-danger/15 text-danger px-1 rounded font-bold">HOT</span>
                )}
                {closed && (
                    <svg className="w-3 h-3 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </div>
            <p className="text-[11px] text-ink-500 mb-2 truncate">{card.listing_title ?? '—'}</p>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                    <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0"
                        style={{ background: gradientForAgent(card.agent.id) }}
                    >
                        {card.agent.initials || '?'}
                    </div>
                    <span className="text-[10px] text-ink-500 truncate">{card.agent.name ?? '—'}</span>
                </div>
                <span className={'text-[11px] font-mono font-semibold ' + (closed ? 'text-success' : 'text-ink-900')}>
                    {fmtMoney(card.deal_value)}
                </span>
            </div>
        </div>
    );
}
