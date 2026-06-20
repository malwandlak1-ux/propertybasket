import { useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import InviteAgentModal from '@/Components/InviteAgentModal';

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
        'linear-gradient(135deg,#F26A1B,#B8470A)',
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
            <section className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Manage Agents</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {totals.agents} agent{totals.agents === 1 ? '' : 's'} ({totals.active} active, {totals.pending} pending) ·
                            Round-robin lead allocation active
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 flex items-center gap-2" disabled title="Coming soon">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                            Export
                        </button>
                        <button
                            onClick={() => setInviteOpen(true)}
                            className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M19 8v6M22 11h-6" />
                            </svg>
                            Invite Agent
                        </button>
                    </div>
                </div>

                {flash?.success && (
                    <div className="mb-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                        {flash.success}
                    </div>
                )}

                {/* Leaderboard podium */}
                <div
                    className="rounded-xl p-6 mb-6 text-white shadow-card"
                    style={{ background: 'linear-gradient(135deg,#0B0B0F,#1A1A22)' }}
                >
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                        <div>
                            <h2 className="text-lg font-bold">{new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })} Leaderboard</h2>
                            <p className="text-[12px] text-white/60 mt-0.5">Closed deals this month · Top 3 visible</p>
                        </div>
                    </div>

                    {leaderboard.length === 0 ? (
                        <p className="text-white/60 text-[13px]">No commissions earned yet this period.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                            {/* 2nd */}
                            <Podium agent={leaderboard[1]} rank={2} size="sm" gradient="linear-gradient(135deg,#E5E7EB,#9CA3AF)" />
                            {/* 1st (centred + taller) */}
                            <Podium agent={leaderboard[0]} rank={1} size="lg" gradient="linear-gradient(135deg,#FCD34D,#F59E0B)" />
                            {/* 3rd */}
                            <Podium agent={leaderboard[2]} rank={3} size="sm" gradient="linear-gradient(135deg,#FED7AA,#C2410C)" />
                        </div>
                    )}
                </div>

                {/* Agent table */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                    <div className="p-5 border-b border-ink-200 flex items-center justify-between">
                        <h2 className="text-base font-semibold">All Agents</h2>
                        <div className="flex items-center gap-2">
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="text-[12px] bg-ink-50 border border-ink-200 rounded-md px-3 py-1.5 w-48"
                                placeholder="Search agent..."
                            />
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="text-[12px] bg-white border border-ink-200 rounded-md px-3 py-1.5"
                            >
                                <option value="all">All statuses</option>
                                <option value="active">Active</option>
                                <option value="pending">Pending</option>
                            </select>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                    <th className="font-semibold px-5 py-3">Agent</th>
                                    <th className="font-semibold py-3">Speciality</th>
                                    <th className="font-semibold py-3 text-right">Split</th>
                                    <th className="font-semibold py-3 text-right">Listings</th>
                                    <th className="font-semibold py-3 text-right">Deals (MTD)</th>
                                    <th className="font-semibold py-3 text-right">Commission</th>
                                    <th className="font-semibold py-3">FFC</th>
                                    <th className="font-semibold py-3">Paystack</th>
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
                                            <td className="text-right font-mono font-semibold">{a.commission_split_percent}/{100 - a.commission_split_percent}</td>
                                            <td className="text-right font-mono">{a.listings}</td>
                                            <td className="text-right font-mono font-semibold">{a.mtd_deals}</td>
                                            <td className="text-right font-mono font-semibold">{fmtMoneyFull(a.mtd_commission)}</td>
                                            <td><FfcBadge ffc={a.ffc} /></td>
                                            <td><PaystackBadge status={a.paystack} /></td>
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
                    <div className="mt-6 bg-white rounded-xl border border-ink-200 shadow-soft p-5">
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

function Podium({
    agent,
    rank,
    size,
    gradient,
}: {
    agent: Agent | undefined;
    rank: number;
    size: 'sm' | 'lg';
    gradient: string;
}) {
    if (!agent)
        return (
            <div className="text-center text-white/40 text-[12px]">
                <div className={`mx-auto rounded-full bg-white/5 ${size === 'lg' ? 'w-20 h-20' : 'w-16 h-16'}`} />
                <p className="mt-3">No #{rank} yet</p>
            </div>
        );
    return (
        <div className={'text-center ' + (size === 'lg' ? '-mt-4' : '')}>
            {size === 'lg' && <div className="text-2xl mb-1">👑</div>}
            <div
                className={`rounded-full mx-auto border-4 border-white/20 flex items-center justify-center font-bold ${
                    size === 'lg' ? 'w-20 h-20 text-2xl' : 'w-16 h-16 text-xl'
                }`}
                style={{ background: gradient }}
            >
                {agent.initials || '?'}
            </div>
            <p className={size === 'lg' ? 'text-[15px] font-bold mt-3' : 'text-[14px] font-bold mt-3'}>{agent.name}</p>
            <p className="text-[11px] text-white/60">
                {agent.mtd_deals} deal{agent.mtd_deals === 1 ? '' : 's'}
            </p>
            <div
                className={`bg-white/10 rounded-lg p-3 mt-3 flex flex-col justify-end ${size === 'lg' ? 'h-32' : 'h-24'}`}
                style={
                    size === 'lg'
                        ? { background: 'linear-gradient(135deg,rgba(252,211,77,0.30),rgba(245,158,11,0.30))' }
                        : undefined
                }
            >
                <p className="text-[10px] text-white/80 uppercase tracking-wider">Commission</p>
                <p className={size === 'lg' ? 'text-2xl font-bold' : 'text-lg font-bold'}>{fmtMoney(agent.mtd_commission)}</p>
            </div>
        </div>
    );
}

