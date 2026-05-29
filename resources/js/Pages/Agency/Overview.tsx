import { ReactNode, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import InviteAgentModal from '@/Components/InviteAgentModal';

type FlashShared = {
    flash?: { success?: string | null; error?: string | null };
};

type Props = {
    agency: { id: number; name: string; slug: string; payout_day: number };
    kpis: {
        ytd_revenue: number;
        active_deals: number;
        pipeline_value: number;
        due_to_agents: number;
        trust_balance: number;
    };
    revenue: {
        months: { month: string; sales: number; rental: number }[];
        sales_total: number;
        rental_total: number;
        vat_liability: number;
    };
    top_performers: { rank: number; name: string; deals: number; commission: number }[];
    team_health: { avg_response_hours: number; ffc_valid_pct: number };
    activity: {
        kind: string;
        icon: 'check' | 'users' | 'home' | 'alert' | 'bank';
        tone: 'success' | 'brand' | 'warning' | 'danger' | 'info';
        text: string;
        at: string;
    }[];
    next_batch: {
        id: number;
        batch_date: string;
        days_away: number;
        total_agent_net: number;
        commissions_count: number;
        status: string;
    } | null;
    vat_period: {
        amount: number;
        period_end: string;
        days_remaining: number;
        progress_pct: number;
    };
    agent_count: number;
};

function fmtMoney(n: number): string {
    if (n >= 1_000_000) return 'R ' + (n / 1_000_000).toFixed(1) + 'm';
    if (n >= 1_000) return 'R ' + Math.round(n / 1_000) + 'k';
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}
function fmtFullMoney(n: number): string {
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}
function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const ICONS = {
    check: (
        <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M5 13l4 4L19 7" />
        </svg>
    ),
    users: (
        <svg className="w-4 h-4 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
        </svg>
    ),
    home: (
        <svg className="w-4 h-4 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M3 21V10l9-7 9 7v11H3z" />
        </svg>
    ),
    alert: (
        <svg className="w-4 h-4 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
        </svg>
    ),
    bank: (
        <svg className="w-4 h-4 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <rect x="2" y="6" width="20" height="12" rx="2" />
        </svg>
    ),
};

const ICON_BG: Record<string, string> = {
    success: 'bg-success/15',
    brand: 'bg-brand-50',
    warning: 'bg-amber-50',
    danger: 'bg-rose-50',
    info: 'bg-violet-50',
};

export default function Overview({ agency, kpis, revenue, top_performers, team_health, activity, next_batch, vat_period, agent_count }: Props) {
    const maxRevenue = Math.max(
        1,
        ...revenue.months.flatMap((m) => [m.sales, m.rental]),
    );
    const todayLabel = fmtDate(new Date().toISOString());
    const [inviteOpen, setInviteOpen] = useState(false);
    const { flash } = usePage<FlashShared>().props;

    return (
        <AgencyLayout agencyName={agency.name} crumb="Dashboard">
            <Head title="Agency Dashboard" />

            <section className="px-8 py-7">
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
                <div className="flex items-end justify-between mb-7">
                    <div>
                        <p className="text-[13px] text-ink-500">{todayLabel}</p>
                        <h1 className="text-3xl font-bold tracking-tight mt-1">{agency.name}</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {agent_count} agent{agent_count === 1 ? '' : 's'} · {kpis.active_deals} active{' '}
                            {kpis.active_deals === 1 ? 'deal' : 'deals'} ·{' '}
                            {next_batch ? (
                                <>
                                    <span className="font-semibold text-ink-900">{fmtFullMoney(next_batch.total_agent_net)}</span>{' '}
                                    due on payout day ({new Date(next_batch.batch_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })})
                                </>
                            ) : (
                                <>no payout batch queued</>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setInviteOpen(true)}
                            className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 transition flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M19 8v6M22 11h-6" />
                            </svg>
                            Invite Agent
                        </button>
                        <Link
                            href="/agency/listings/create"
                            className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 8v8M8 12h8" />
                            </svg>
                            Create Listing
                        </Link>
                    </div>
                </div>

                {/* KPI grid */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <Kpi
                        label="YTD Revenue"
                        value={fmtMoney(kpis.ytd_revenue)}
                        meta="Commission earned this year"
                        tone="emerald"
                        sparkColor="#10B981"
                    />
                    <Kpi
                        label="Active Deals"
                        value={String(kpis.active_deals)}
                        meta={fmtMoney(kpis.pipeline_value) + ' pipeline value'}
                        tone="brand"
                        sparkColor="#5B3DF5"
                    />
                    <Kpi
                        label="Due to Agents"
                        value={fmtMoney(kpis.due_to_agents)}
                        meta={
                            next_batch
                                ? `Payout in ${next_batch.days_away} ${next_batch.days_away === 1 ? 'day' : 'days'}`
                                : 'No batch queued'
                        }
                        tone="amber"
                        sparkColor="#F59E0B"
                        metaTone="warning"
                    />
                    <Kpi
                        label="Trust Balance"
                        value={fmtMoney(kpis.trust_balance)}
                        meta="Section 32 · Reconciled today"
                        tone="violet"
                        sparkColor="#5B3DF5"
                    />
                </div>

                {/* Revenue chart + Top performers */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-semibold">Revenue Breakdown</h2>
                                <p className="text-xs text-ink-500 mt-0.5">Sales vs Rental commissions · Last 6 months</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-brand-500" />Sales
                                </span>
                                <span className="text-[11px] flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-success" />Rentals
                                </span>
                            </div>
                        </div>

                        <div className="flex items-end gap-4 h-52 px-2">
                            {revenue.months.map((m) => (
                                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                                    <div className="w-full flex items-end justify-center gap-1 h-48">
                                        <div
                                            className="bg-brand-500 rounded-t w-6"
                                            style={{ height: `${Math.max(2, (m.sales / maxRevenue) * 100)}%` }}
                                        />
                                        <div
                                            className="bg-success rounded-t w-6"
                                            style={{ height: `${Math.max(2, (m.rental / maxRevenue) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-ink-500">{m.month}</span>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-3 gap-4 pt-4 mt-4 border-t border-ink-200 text-center">
                            <div>
                                <p className="text-[11px] text-ink-500 uppercase tracking-wider">Sales Revenue</p>
                                <p className="text-xl font-bold mt-1">{fmtMoney(revenue.sales_total)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-ink-500 uppercase tracking-wider">Rental Revenue</p>
                                <p className="text-xl font-bold mt-1">{fmtMoney(revenue.rental_total)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-ink-500 uppercase tracking-wider">VAT Liability</p>
                                <p className="text-xl font-bold mt-1">{fmtMoney(revenue.vat_liability)}</p>
                                <p className="text-[11px] text-ink-500">15% on agent commissions</p>
                            </div>
                        </div>
                    </div>

                    {/* Top performers */}
                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-semibold">Top Performers</h2>
                            <span className="text-[12px] font-medium text-ink-400">YTD</span>
                        </div>
                        <div className="space-y-3">
                            {top_performers.length === 0 ? (
                                <p className="text-[13px] text-ink-500">No closed deals yet.</p>
                            ) : (
                                top_performers.map((p) => (
                                    <div key={p.rank} className="flex items-center gap-3 p-2 rounded-lg hover:bg-ink-50">
                                        <Medal rank={p.rank} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-semibold truncate">{p.name}</p>
                                            <p className="text-[11px] text-ink-500">
                                                {p.deals} deal{p.deals === 1 ? '' : 's'} · {fmtMoney(p.commission)} net
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-ink-200">
                            <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold mb-2">Team Health</p>
                            <div className="grid grid-cols-2 gap-2 text-center">
                                <div className="bg-ink-50 rounded-md p-2">
                                    <p className="text-base font-bold">{team_health.avg_response_hours}h</p>
                                    <p className="text-[10px] text-ink-500">Avg response</p>
                                </div>
                                <div className="bg-ink-50 rounded-md p-2">
                                    <p className={'text-base font-bold ' + (team_health.ffc_valid_pct >= 90 ? 'text-success' : 'text-warning')}>
                                        {team_health.ffc_valid_pct}%
                                    </p>
                                    <p className="text-[10px] text-ink-500">FFC valid</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Activity + side cards */}
                <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="col-span-2 bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-semibold">Recent Activity</h2>
                            <span className="text-[12px] text-ink-400">Live</span>
                        </div>
                        <div className="space-y-3">
                            {activity.length === 0 ? (
                                <p className="text-[13px] text-ink-500">No activity yet.</p>
                            ) : (
                                activity.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-2 rounded-md hover:bg-ink-50">
                                        <div className={`w-8 h-8 rounded-full ${ICON_BG[item.tone] ?? 'bg-ink-100'} flex items-center justify-center shrink-0`}>
                                            {ICONS[item.icon] ?? ICONS.check}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[13px]" dangerouslySetInnerHTML={renderActivity(item.text)} />
                                            <p className="text-[11px] text-ink-500 mt-0.5">{item.at}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        {next_batch ? (
                            <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                                <h2 className="text-base font-semibold mb-3">Payout Day</h2>
                                <p className="text-[12px] text-ink-500 mb-4">
                                    Next batch ·{' '}
                                    {new Date(next_batch.batch_date).toLocaleDateString('en-ZA', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                    })}{' '}
                                    · {next_batch.days_away} {next_batch.days_away === 1 ? 'day' : 'days'}
                                </p>
                                <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg p-4 text-white mb-3">
                                    <p className="text-[11px] opacity-80 uppercase tracking-wider font-semibold">Queued</p>
                                    <p className="text-2xl font-bold mt-1">{fmtFullMoney(next_batch.total_agent_net)}</p>
                                    <p className="text-[11px] opacity-80">
                                        {next_batch.commissions_count} commission{next_batch.commissions_count === 1 ? '' : 's'} · Paystack ready
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="w-full text-center py-2 text-[12px] bg-ink-900 text-white rounded-md font-medium opacity-60 cursor-not-allowed"
                                    disabled
                                    title="Commission view is in the next slice"
                                >
                                    Review batch →
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                                <h2 className="text-base font-semibold mb-1">Payout Day</h2>
                                <p className="text-[12px] text-ink-500">No batch queued. Approved commissions will appear here.</p>
                            </div>
                        )}

                        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <h2 className="text-base font-semibold mb-3">VAT Period</h2>
                            <p className="text-[12px] text-ink-500 mb-3">
                                Bi-monthly VAT · Period ends{' '}
                                {new Date(vat_period.period_end).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                            </p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold">{fmtMoney(vat_period.amount)}</span>
                                <span className="text-xs text-ink-500">due to SARS</span>
                            </div>
                            <div className="mt-3 h-2 bg-ink-100 rounded-full overflow-hidden">
                                <div
                                    className={'h-full ' + (vat_period.progress_pct >= 75 ? 'bg-warning' : 'bg-brand-500')}
                                    style={{ width: vat_period.progress_pct + '%' }}
                                />
                            </div>
                            <p className="text-[11px] text-ink-500 mt-1.5">{vat_period.days_remaining} days remaining</p>
                        </div>
                    </div>
                </div>
            </section>

            {inviteOpen && <InviteAgentModal onClose={() => setInviteOpen(false)} />}
        </AgencyLayout>
    );
}

function Kpi({
    label,
    value,
    meta,
    tone,
    sparkColor,
    metaTone,
}: {
    label: string;
    value: string;
    meta: string;
    tone: 'emerald' | 'brand' | 'amber' | 'violet';
    sparkColor: string;
    metaTone?: 'warning';
}) {
    const bgByTone = {
        emerald: 'bg-emerald-50',
        brand: 'bg-brand-50',
        amber: 'bg-amber-50',
        violet: 'bg-violet-50',
    } as const;
    const iconColor = {
        emerald: 'text-success',
        brand: 'text-brand-600',
        amber: 'text-warning',
        violet: 'text-brand-600',
    } as const;

    return (
        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">{label}</span>
                <span className={`w-7 h-7 rounded-lg ${bgByTone[tone]} flex items-center justify-center`}>
                    <svg className={`w-3.5 h-3.5 ${iconColor[tone]}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                </span>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{value}</span>
            </div>
            <p className={'text-[11px] mt-1 ' + (metaTone === 'warning' ? 'text-warning' : 'text-ink-500')}>{meta}</p>
            <svg className="w-full h-8 mt-2" viewBox="0 0 100 30" preserveAspectRatio="none">
                <path d="M0,25 L15,22 L30,24 L45,18 L60,15 L75,10 L100,4" fill="none" stroke={sparkColor} strokeWidth={2} />
            </svg>
        </div>
    );
}

function Medal({ rank }: { rank: number }): ReactNode {
    if (rank === 1)
        return (
            <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                style={{ background: 'linear-gradient(135deg, #FCD34D, #F59E0B)' }}
            >
                1
            </div>
        );
    if (rank === 2)
        return (
            <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                style={{ background: 'linear-gradient(135deg, #E5E7EB, #9CA3AF)' }}
            >
                2
            </div>
        );
    if (rank === 3)
        return (
            <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                style={{ background: 'linear-gradient(135deg, #FED7AA, #C2410C)' }}
            >
                3
            </div>
        );
    return (
        <div className="w-8 h-8 rounded-full bg-ink-200 flex items-center justify-center text-ink-700 text-[11px] font-bold">
            {rank}
        </div>
    );
}

// Bold names/listings/amounts that the controller wraps in plain text. Look for capitalised words and amounts.
function renderActivity(text: string): { __html: string } {
    // Escape HTML first
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Bold money amounts
    const withMoney = escaped.replace(/(R\s?[\d,]+(?:\.\d+)?(?:\/mo)?)/g, '<span class="font-semibold">$1</span>');
    return { __html: withMoney };
}
