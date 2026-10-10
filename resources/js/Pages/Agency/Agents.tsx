import { useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import InviteAgentModal from '@/Components/InviteAgentModal';
import { Card, KpiCard, PageHeader, btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';

type Agent = {
    id: number;
    user_id: number;
    name: string;
    email: string | null;
    initials: string;
    status: 'active' | 'pending' | 'suspended';
    area_speciality: string[];
    property_type_speciality: string[];
    commission_split_percent: number;
    listings: number;
    mtd_deals: number;
    mtd_commission: number;
    ffc: { status: 'valid' | 'expiring' | 'expired' | 'pending'; expires_at: string | null; days_left: number | null };
    paystack: 'linked' | 'missing' | 'pending';
};

type Invite = { id: number; email: string; expires_at: string | null; created_at: string };

type Props = {
    agency: { id: number; name: string };
    agents: Agent[];
    leaderboard: Agent[];
    pending_invites: Invite[];
    totals: { agents: number; active: number; pending: number };
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

function fmtMoney(n: number): string {
    if (n >= 1_000_000) return 'R ' + (n / 1_000_000).toFixed(1) + 'm';
    if (n >= 1_000) return 'R ' + Math.round(n / 1_000) + 'k';
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}
function fmtMoneyFull(n: number): string {
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

function gradientFor(idx: number): string {
    const palette = [
        'linear-gradient(135deg,var(--color-brand-500),var(--color-brand-700))',
        'linear-gradient(135deg,#F472B6,#E11D48)',
        'linear-gradient(135deg,#38BDF8,#0284C7)',
        'linear-gradient(135deg,#34D399,#059669)',
        'linear-gradient(135deg,#FBBF24,#D97706)',
        'linear-gradient(135deg,#A78BFA,#7C3AED)',
    ];
    return palette[idx % palette.length];
}

function FfcBadge({ ffc }: { ffc: Agent['ffc'] }) {
    if (ffc.status === 'valid')
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">VALID</span>;
    if (ffc.status === 'expiring')
        return (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-bold">
                EXPIRES {ffc.days_left}d
            </span>
        );
    if (ffc.status === 'expired')
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-danger/15 text-danger font-bold">EXPIRED</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-ink-100 text-ink-500 font-bold">PENDING</span>;
}

function PaystackBadge({ status }: { status: Agent['paystack'] }) {
    if (status === 'linked')
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">LINKED</span>;
    if (status === 'missing')
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-danger/15 text-danger font-bold">MISSING</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-ink-100 text-ink-500 font-bold">PENDING</span>;
}

export default function Agents({ agency, agents, leaderboard, pending_invites, totals }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [filter, setFilter] = useState<string>('all');
    const [search, setSearch] = useState<string>('');
    const [inviteOpen, setInviteOpen] = useState(false);

    const filtered = agents.filter((a) => {
        if (filter === 'active' && a.status !== 'active') return false;
        if (filter === 'pending' && a.status !== 'pending') return false;
        if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.email?.toLowerCase().includes(search.toLowerCase()))
            return false;
        return true;
    });

    return (
        <AgencyLayout agencyName={agency.name} crumb="Agents">
            <Head title="Agents" />
            <section className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Manage Agents"
                    subtitle={<>{totals.agents} agent{totals.agents === 1 ? '' : 's'} ({totals.active} active, {totals.pending} pending) · Round-robin lead allocation active</>}
                    actions={
                        <>
                            <button className={btnOutline} disabled title="Coming soon">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                </svg>
                                Export
                            </button>
                            <button onClick={() => setInviteOpen(true)} className={btnPrimary}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M19 8v6M22 11h-6" />
                                </svg>
                                Invite Agent
                            </button>
                        </>
                    }
                />

                {flash?.success && (
                    <div className="mb-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                        {flash.success}
                    </div>
                )}

                {/* Leaderboard — Fernly pill podium + team KPIs */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-4">
                    <Card
                        className="xl:col-span-8"
                        title={`${new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })} Leaderboard`}
                        subtitle="Commission earned this month · top 3"
                        action={
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 text-brand-700 text-[11.5px] font-semibold px-2.5 py-1">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>
                                Live ranking
                            </span>
                        }
                    >
                        {leaderboard.length === 0 ? (
                            <p className="py-12 text-center text-[13px] text-ink-400">No commissions earned yet this period.</p>
                        ) : (
                            <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end max-w-[620px] mx-auto pt-2">
                                <Podium agent={leaderboard[1]} rank={2} />
                                <Podium agent={leaderboard[0]} rank={1} />
                                <Podium agent={leaderboard[2]} rank={3} />
                            </div>
                        )}
                    </Card>

                    <div className="xl:col-span-4 grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-4">
                        <KpiCard
                            hero
                            label="Team commission (MTD)"
                            value={fmtMoney(agents.reduce((sum, a) => sum + a.mtd_commission, 0))}
                            sub={`${agents.reduce((sum, a) => sum + a.mtd_deals, 0)} deals closed this month`}
                        />
                        <KpiCard
                            label="Active agents"
                            value={`${totals.active}/${totals.agents}`}
                            sub={totals.pending > 0 ? `${totals.pending} invite${totals.pending === 1 ? '' : 's'} pending` : 'Everyone is onboarded'}
                        />
                        <KpiCard
                            label="Compliance"
                            value={`${agents.filter((a) => a.ffc.status === 'valid').length}/${agents.length || 0}`}
                            sub={`FFC valid · ${agents.filter((a) => a.paystack === 'linked').length} Paystack linked`}
                        />
                    </div>
                </div>

                {/* Agent table */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden">
                    <div className="p-5 border-b border-ink-200 flex flex-wrap gap-3 items-center justify-between">
                        <h2 className="text-[16px] font-semibold tracking-tight">All Agents</h2>
                        <div className="flex items-center gap-2">
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="text-[12.5px] bg-ink-50 border border-ink-200 rounded-full px-4 py-2 w-40 sm:w-52 focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
                                placeholder="Search agent..."
                            />
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="text-[12.5px] bg-white border border-ink-200 rounded-full px-3.5 py-2"
                            >
                                <option value="all">All statuses</option>
                                <option value="active">Active</option>
                                <option value="pending">Pending</option>
                            </select>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[960px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50 whitespace-nowrap">
                                    <th className="font-semibold px-5 py-3">Agent</th>
                                    <th className="font-semibold py-3">Speciality</th>
                                    <th className="font-semibold py-3 text-right pr-6">Split</th>
                                    <th className="font-semibold py-3 text-right pr-6">Listings</th>
                                    <th className="font-semibold py-3 text-right pr-6">Deals (MTD)</th>
                                    <th className="font-semibold py-3 text-right pr-8">Commission</th>
                                    <th className="font-semibold py-3 pr-4">FFC</th>
                                    <th className="font-semibold py-3 pr-4">Paystack</th>
                                    <th className="font-semibold py-3 text-right pr-5">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-ink-500">No agents match those filters.</td>
                                    </tr>
                                ) : (
                                    filtered.map((a, idx) => (
                                        <tr key={a.id} className="border-b border-ink-100 hover:bg-ink-50">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                                        style={{ background: gradientFor(idx) }}
                                                    >
                                                        {a.initials || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold">{a.name}</p>
                                                        <p className="text-[11px] text-ink-500">{a.email ?? '—'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                {a.area_speciality.length > 0 ? (
                                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 font-medium">
                                                        {a.area_speciality.slice(0, 2).join(' · ')}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-ink-400">—</span>
                                                )}
                                            </td>
                                            <td className="text-right tabular-nums font-semibold pr-6">{a.commission_split_percent}/{100 - a.commission_split_percent}</td>
                                            <td className="text-right tabular-nums pr-6">{a.listings}</td>
                                            <td className="text-right tabular-nums font-semibold pr-6">{a.mtd_deals}</td>
                                            <td className="text-right tabular-nums font-semibold pr-8">{fmtMoneyFull(a.mtd_commission)}</td>
                                            <td className="pr-4"><FfcBadge ffc={a.ffc} /></td>
                                            <td className="pr-4"><PaystackBadge status={a.paystack} /></td>
                                            <td className="text-right pr-5">
                                                <button type="button" className="text-ink-400 hover:text-ink-900" title="More actions">⋯</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {pending_invites.length > 0 && (
                    <div className="mt-6 bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5">
                        <h2 className="text-base font-semibold mb-3">Pending invitations</h2>
                        <ul className="space-y-2 text-[13px]">
                            {pending_invites.map((inv) => (
                                <li key={inv.id} className="flex items-center justify-between py-1.5">
                                    <span className="font-medium">{inv.email}</span>
                                    <span className="text-[12px] text-ink-500">
                                        Sent {new Date(inv.created_at).toLocaleDateString('en-ZA')} · expires{' '}
                                        {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString('en-ZA') : '—'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {inviteOpen && <InviteAgentModal onClose={() => setInviteOpen(false)} />}
            </section>
        </AgencyLayout>
    );
}

/**
 * Podium column in Fernly's pill-bar language: avatar on top, a tall rounded
 * pill whose height reads as rank (1st darkest + tallest), commission inside.
 * An empty slot renders as a hatched pill.
 */
function Podium({ agent, rank }: { agent: Agent | undefined; rank: 1 | 2 | 3 }) {
    const height = rank === 1 ? 'h-44 sm:h-52' : rank === 2 ? 'h-32 sm:h-40' : 'h-24 sm:h-32';
    const pill = rank === 1 ? 'bg-brand-800 text-white' : rank === 2 ? 'bg-brand-600 text-white' : 'bg-brand-300 text-brand-800';
    const medal = rank === 1 ? 'bg-amber-400' : rank === 2 ? 'bg-slate-300' : 'bg-orange-300';

    return (
        <div className="flex flex-col items-center text-center min-w-0">
            <div className="relative mb-2">
                {agent ? (
                    <div className={`rounded-full flex items-center justify-center font-bold ring-4 ring-white shadow-soft ${rank === 1 ? 'w-16 h-16 text-lg bg-brand-100 text-brand-800' : 'w-12 h-12 text-sm bg-ink-100 text-ink-700'}`}>
                        {agent.initials || '?'}
                    </div>
                ) : (
                    <div className={`rounded-full border-2 border-dashed border-ink-300 ${rank === 1 ? 'w-16 h-16' : 'w-12 h-12'}`} />
                )}
                <span className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${medal} ring-2 ring-white text-[11px] font-bold text-ink-900 flex items-center justify-center`}>
                    {rank}
                </span>
            </div>
            <p className="text-[13px] font-semibold truncate max-w-full">{agent ? agent.name : `No #${rank} yet`}</p>
            <p className="text-[11px] text-ink-500 mb-3">
                {agent ? `${agent.mtd_deals} deal${agent.mtd_deals === 1 ? '' : 's'}` : 'Close a deal to rank'}
            </p>
            <div
                className={`pb-grow w-full max-w-[150px] ${height} rounded-[28px] flex flex-col items-center justify-end pb-5 ${agent ? pill : 'pb-hatch'}`}
                style={{ animationDelay: `${(3 - rank) * 80}ms` }}
            >
                {agent && (
                    <>
                        <span className={`text-[10px] uppercase tracking-[0.12em] ${rank === 3 ? 'text-brand-800/70' : 'text-white/70'}`}>Commission</span>
                        <span className={`font-semibold tabular-nums ${rank === 1 ? 'text-[22px]' : 'text-[17px]'}`}>{fmtMoney(agent.mtd_commission)}</span>
                    </>
                )}
            </div>
        </div>
    );
}

