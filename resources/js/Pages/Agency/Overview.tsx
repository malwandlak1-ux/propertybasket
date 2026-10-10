import { useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import InviteAgentModal from '@/Components/InviteAgentModal';
import ErrorBoundary from '@/Components/ErrorBoundary';
import { Card, Donut, KpiCard, PageHeader, RankBars, btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';

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

            <section className="px-4 sm:px-7 py-6">
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
                <PageHeader
                    title={agency.name}
                    subtitle={
                        <>
                            {todayLabel} · {agent_count} agent{agent_count === 1 ? '' : 's'} · {kpis.active_deals} active{' '}
                            {kpis.active_deals === 1 ? 'deal' : 'deals'} ·{' '}
                            {next_batch ? (
                                <>
                                    <span className="font-semibold text-ink-900">{fmtFullMoney(next_batch.total_agent_net)}</span>{' '}
                                    due on payout day ({new Date(next_batch.batch_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })})
                                </>
                            ) : (
                                <>no payout batch queued</>
                            )}
                        </>
                    }
                    actions={
                        <>
                            <Link href="/agency/listings/create" className={btnPrimary}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
                                Create Listing
                            </Link>
                            <button type="button" onClick={() => setInviteOpen(true)} className={btnOutline}>
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

                {/* KPI grid — first tile is the accent hero */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                    <KpiCard hero label="YTD Revenue" value={fmtMoney(kpis.ytd_revenue)} sub="Commission earned this year" href="/agency/reports" />
                    <KpiCard label="Active Deals" value={kpis.active_deals} sub={fmtMoney(kpis.pipeline_value) + ' pipeline value'} href="/agency/pipeline" />
                    <KpiCard
                        label="Due to Agents"
                        value={fmtMoney(kpis.due_to_agents)}
                        sub={next_batch ? `Payout in ${next_batch.days_away} ${next_batch.days_away === 1 ? 'day' : 'days'}` : 'No batch queued'}
                        href="/agency/commissions"
                    />
                    <KpiCard label="Trust Balance" value={fmtMoney(kpis.trust_balance)} sub="Section 32 · Reconciled today" href="/agency/trust-account" />
                </div>

                {/* Revenue chart + split + Top performers */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <Card
                        className="xl:col-span-6"
                        title="Revenue Breakdown"
                        subtitle="Sales vs rental commissions · last 6 months"
                        action={
                            <div className="flex items-center gap-3 text-[11.5px] text-ink-500">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-700" />Sales</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-300" />Rentals</span>
                            </div>
                        }
                    >
                        <ErrorBoundary variant="section" label="revenue chart">
                            <div className="flex items-end gap-3 sm:gap-5 h-52 px-1 overflow-x-auto">
                                {revenue.months.map((m, i) => (
                                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 min-w-[44px]">
                                        <div className="w-full flex items-end justify-center gap-1.5 h-44">
                                            <div
                                                className={`pb-grow rounded-full w-1/2 max-w-[26px] ${m.sales > 0 ? 'bg-brand-700' : 'pb-hatch'}`}
                                                title={`Sales: ${fmtFullMoney(m.sales)}`}
                                                style={{ height: `${Math.max(6, (m.sales / maxRevenue) * 100)}%`, animationDelay: `${i * 60}ms` }}
                                            />
                                            <div
                                                className={`pb-grow rounded-full w-1/2 max-w-[26px] ${m.rental > 0 ? 'bg-brand-300' : 'pb-hatch'}`}
                                                title={`Rentals: ${fmtFullMoney(m.rental)}`}
                                                style={{ height: `${Math.max(6, (m.rental / maxRevenue) * 100)}%`, animationDelay: `${i * 60 + 30}ms` }}
                                            />
                                        </div>
                                        <span className="text-[11px] text-ink-500">{m.month}</span>
                                    </div>
                                ))}
                            </div>
                        </ErrorBoundary>
                    </Card>

                    <Card className="xl:col-span-3" title="Revenue Split" subtitle="Last 6 months">
                        <Donut
                            size={150}
                            centerValue={fmtMoney(revenue.sales_total + revenue.rental_total)}
                            centerLabel="commission"
                            segments={[
                                { label: 'Sales', value: revenue.sales_total, display: fmtMoney(revenue.sales_total), color: 'var(--color-brand-700)' },
                                { label: 'Rentals', value: revenue.rental_total, display: fmtMoney(revenue.rental_total), color: 'var(--color-brand-300)' },
                            ]}
                        />
                        <div className="mt-4 pt-3 border-t border-ink-100 flex items-center justify-between text-[12.5px]">
                            <span className="text-ink-500">VAT liability <span className="text-ink-400">(15%)</span></span>
                            <span className="font-semibold tabular-nums">{fmtMoney(revenue.vat_liability)}</span>
                        </div>
                    </Card>

                    {/* Top performers */}
                    <Card className="xl:col-span-3" title="Top Performers" action={<span className="text-[12px] font-medium text-ink-400">YTD</span>}>
                        <RankBars
                            rows={top_performers.map((p) => ({ label: p.name, value: p.commission, sub: `${p.deals} deal${p.deals === 1 ? '' : 's'}` }))}
                            format={fmtMoney}
                            empty="No closed deals yet."
                        />
                        <div className="mt-5 pt-4 border-t border-ink-100 grid grid-cols-2 gap-2 text-center">
                            <div className="bg-ink-50 rounded-xl p-2.5">
                                <p className="text-base font-semibold">{team_health.avg_response_hours}h</p>
                                <p className="text-[10.5px] text-ink-500">Avg response</p>
                            </div>
                            <div className="bg-ink-50 rounded-xl p-2.5">
                                <p className={'text-base font-semibold ' + (team_health.ffc_valid_pct >= 90 ? 'text-success' : 'text-warning')}>
                                    {team_health.ffc_valid_pct}%
                                </p>
                                <p className="text-[10.5px] text-ink-500">FFC valid</p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Activity + side cards */}
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
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
                            <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
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
                                <div className="pb-swirl rounded-2xl p-4 text-white mb-3">
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
                            <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                                <h2 className="text-base font-semibold mb-1">Payout Day</h2>
                                <p className="text-[12px] text-ink-500">No batch queued. Approved commissions will appear here.</p>
                            </div>
                        )}

                        <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
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

// Bold names/listings/amounts that the controller wraps in plain text. Look for capitalised words and amounts.
function renderActivity(text: string): { __html: string } {
    // Escape HTML first
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Bold money amounts
    const withMoney = escaped.replace(/(R\s?[\d,]+(?:\.\d+)?(?:\/mo)?)/g, '<span class="font-semibold">$1</span>');
    return { __html: withMoney };
}
