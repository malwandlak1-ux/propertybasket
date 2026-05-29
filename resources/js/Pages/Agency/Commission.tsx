import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import { Spinner } from '@/Components/Skeleton';

type Commission = {
    id: number;
    agent: { id: number; name: string; initials: string };
    deal_type: 'sale' | 'rental';
    gross_commission: number;
    agent_split_percent: number;
    vat_amount: number;
    agent_net: number;
    agency_amount: number;
    status: 'pending' | 'approved' | 'blocked' | 'paid';
    blocked_reason: string | null;
    paystack_status: 'verified' | 'missing';
};

type Props = {
    agency: { id: number; name: string; payout_day: number; vat_rate: number };
    commissions: Commission[];
    totals: { gross: number; vat: number; agent_net: number; count_eligible: number; count_total: number };
    next_batch: {
        id: number;
        batch_date: string;
        days_away: number;
        total_gross: number;
        total_vat: number;
        total_agent_net: number;
        status: string;
        commissions_count: number;
    } | null;
    paid_ytd: number;
    agency_retained_ytd: number;
    vat_ytd: number;
    recent_transfers: { id: number; batch_date: string; total_agent_net: number; commissions_count: number }[];
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

function fmtMoney(n: number): string {
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}
function fmtMoneyShort(n: number): string {
    if (n >= 1_000_000) return 'R ' + (n / 1_000_000).toFixed(1) + 'm';
    if (n >= 1_000) return 'R ' + Math.round(n / 1_000) + 'k';
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

function gradientFor(idx: number): string {
    const palette = [
        'linear-gradient(135deg,#5B3DF5,#3A23B8)',
        'linear-gradient(135deg,#F472B6,#E11D48)',
        'linear-gradient(135deg,#38BDF8,#0284C7)',
        'linear-gradient(135deg,#34D399,#059669)',
        'linear-gradient(135deg,#FBBF24,#D97706)',
        'linear-gradient(135deg,#A78BFA,#7C3AED)',
    ];
    return palette[idx % palette.length];
}

const STATUS_BADGE: Record<Commission['status'], { label: string; cls: string }> = {
    pending: { label: 'PENDING', cls: 'bg-ink-100 text-ink-500' },
    approved: { label: 'APPROVED', cls: 'bg-brand-50 text-brand-700' },
    blocked: { label: 'BLOCKED', cls: 'bg-danger/15 text-danger' },
    paid: { label: 'PAID', cls: 'bg-success/15 text-success' },
};

export default function Commission({ agency, commissions, totals, next_batch, paid_ytd, agency_retained_ytd, vat_ytd, recent_transfers }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [selected, setSelected] = useState<Set<number>>(new Set());

    function toggleAll(checked: boolean) {
        if (!checked) return setSelected(new Set());
        setSelected(new Set(commissions.filter((c) => c.status === 'pending').map((c) => c.id)));
    }
    function toggle(id: number) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }
    const [approving, setApproving] = useState(false);
    const [paying, setPaying] = useState(false);

    function approveSelected() {
        if (selected.size === 0 || approving) return;
        setApproving(true);
        router.post('/agency/commissions/approve', { commission_ids: [...selected] }, {
            preserveScroll: true,
            onSuccess: () => setSelected(new Set()),
            onFinish: () => setApproving(false),
        });
    }
    function runPayoutBatch() {
        if (paying) return;
        if (!confirm('Run the payout batch via Paystack? This is a stub call and will mark commissions as paid.')) return;
        setPaying(true);
        router.post('/agency/commissions/payout', {}, {
            preserveScroll: true,
            onFinish: () => setPaying(false),
        });
    }

    const selectableCount = commissions.filter((c) => c.status === 'pending').length;
    const allSelected = selectableCount > 0 && selected.size === selectableCount;

    return (
        <AgencyLayout agencyName={agency.name} crumb="Commission & Payouts">
            <Head title="Commission & Payouts" />
            <section className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Commission &amp; Payouts</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Monthly payout day: <span className="font-semibold text-ink-900">{agency.payout_day}th of each month</span> ·
                            Paystack stub connected ✓
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 flex items-center gap-2" disabled title="Coming soon">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                            Export ledger
                        </button>
                        <button
                            onClick={runPayoutBatch}
                            disabled={paying || (!next_batch && totals.count_eligible === 0)}
                            className="px-3.5 py-2 text-[13px] bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
                        >
                            {paying ? <Spinner size={14} /> : (
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M8 12h8M12 8v8" />
                                </svg>
                            )}
                            {paying ? 'Running…' : 'Run Payout Batch'}
                        </button>
                    </div>
                </div>

                {flash?.success && (
                    <div className="mb-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="mb-4 rounded-lg bg-danger/10 border border-danger/30 text-danger px-4 py-3 text-[13px]">
                        {flash.error}
                    </div>
                )}

                {/* Stat strip */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div
                        className="rounded-xl p-5 text-white shadow-card"
                        style={{ background: 'linear-gradient(135deg,#5B3DF5,#3A23B8)' }}
                    >
                        <p className="text-[11px] uppercase tracking-wider opacity-80 font-semibold">Next Payout</p>
                        <p className="text-3xl font-bold mt-2">
                            {next_batch ? fmtMoneyShort(next_batch.total_agent_net) : 'R 0'}
                        </p>
                        <p className="text-[11px] opacity-80 mt-1">
                            {next_batch
                                ? `${new Date(next_batch.batch_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} · ${next_batch.days_away} days`
                                : 'No batch queued yet'}
                        </p>
                        {next_batch && (
                            <div className="mt-3 flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-white" style={{ width: '75%' }} />
                                </div>
                                <span className="text-[10px] font-semibold">
                                    {next_batch.commissions_count} commission{next_batch.commissions_count === 1 ? '' : 's'}
                                </span>
                            </div>
                        )}
                    </div>
                    <Stat label="Paid YTD" value={fmtMoneyShort(paid_ytd)} meta="Approved + transferred this year" />
                    <Stat label="Agency Retained" value={fmtMoneyShort(agency_retained_ytd)} meta="Agency split on YTD deals" />
                    <Stat label="VAT on Commission" value={fmtMoneyShort(vat_ytd)} meta="15% · Reportable to SARS" />
                </div>

                {/* Payout queue */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden mb-6">
                    <div className="p-5 border-b border-ink-200 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-semibold">Payout Queue</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">
                                {totals.count_eligible} eligible · review and approve before batch run
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[12px] text-ink-500">
                                Selected: <span className="font-semibold text-ink-900">{selected.size}</span>
                            </span>
                            <button
                                onClick={approveSelected}
                                disabled={selected.size === 0 || approving}
                                className="px-3 py-1.5 text-[12px] bg-success/10 text-success rounded-md font-semibold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                            >
                                {approving && <Spinner size={12} />}
                                {approving ? 'Approving…' : 'Approve selected'}
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                    <th className="font-semibold px-5 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={(e) => toggleAll(e.target.checked)}
                                            disabled={selectableCount === 0}
                                        />
                                    </th>
                                    <th className="font-semibold py-3">Agent</th>
                                    <th className="font-semibold py-3 text-right">Gross Commission</th>
                                    <th className="font-semibold py-3 text-right">Split %</th>
                                    <th className="font-semibold py-3 text-right">VAT (15%)</th>
                                    <th className="font-semibold py-3 text-right">Agent Net</th>
                                    <th className="font-semibold py-3">Paystack</th>
                                    <th className="font-semibold py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {commissions.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-10 text-center text-ink-500">
                                            No commissions queued. They&apos;ll appear here as deals close.
                                        </td>
                                    </tr>
                                ) : (
                                    commissions.map((c, idx) => {
                                        const isBlocked = c.status === 'blocked';
                                        return (
                                            <tr key={c.id} className="border-b border-ink-100 hover:bg-ink-50">
                                                <td className="px-5 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.has(c.id)}
                                                        onChange={() => toggle(c.id)}
                                                        disabled={c.status !== 'pending'}
                                                    />
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                                            style={{ background: gradientFor(idx) }}
                                                        >
                                                            {c.agent.initials || '?'}
                                                        </div>
                                                        <span className="font-semibold">{c.agent.name}</span>
                                                        {isBlocked && c.blocked_reason && (
                                                            <span className="text-[10px] text-danger">· {c.blocked_reason.replace(/_/g, ' ')}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-right font-mono">{fmtMoney(c.gross_commission)}</td>
                                                <td className="text-right font-mono">{c.agent_split_percent}%</td>
                                                <td className="text-right font-mono text-ink-500">{fmtMoney(c.vat_amount)}</td>
                                                <td className={'text-right font-mono font-bold ' + (isBlocked ? 'text-ink-400' : 'text-success')}>
                                                    {fmtMoney(c.agent_net)}
                                                </td>
                                                <td>
                                                    {c.paystack_status === 'verified' ? (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">VERIFIED</span>
                                                    ) : (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-danger/15 text-danger font-bold">MISSING</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={'text-[10px] px-2 py-0.5 rounded-full font-bold ' + STATUS_BADGE[c.status].cls}>
                                                        {STATUS_BADGE[c.status].label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            {commissions.length > 0 && (
                                <tfoot className="bg-ink-50 border-t-2 border-ink-200">
                                    <tr className="text-[13px] font-semibold">
                                        <td></td>
                                        <td className="px-5 py-3">Batch Total</td>
                                        <td className="text-right font-mono py-3">{fmtMoney(totals.gross)}</td>
                                        <td></td>
                                        <td className="text-right font-mono py-3">{fmtMoney(totals.vat)}</td>
                                        <td className="text-right font-mono text-success font-bold py-3">{fmtMoney(totals.agent_net)}</td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* Three side cards */}
                <div className="grid grid-cols-3 gap-4">
                    {/* Paystack */}
                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <rect x="2" y="5" width="20" height="14" rx="2" />
                                        <path d="M2 10h20" />
                                    </svg>
                                </div>
                                <h3 className="text-base font-semibold">Paystack</h3>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-bold">STUB</span>
                        </div>
                        <p className="text-[12px] text-ink-500 mb-3">Phase 3 uses a stub provider — real Paystack hooks come in Phase 9.</p>
                        <div className="bg-ink-50 rounded-lg p-3 text-[11px] font-mono text-ink-700 space-y-1">
                            <p>Balance: <span className="font-semibold text-ink-900">simulated</span></p>
                            <p>Last sync: <span className="text-ink-500">now</span></p>
                            <p>Webhook: <span className="text-success">healthy ✓</span></p>
                        </div>
                    </div>

                    {/* Recent transfers */}
                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <h3 className="text-base font-semibold mb-3">Recent Transfers</h3>
                        {recent_transfers.length === 0 ? (
                            <p className="text-[13px] text-ink-500">No completed batches yet. Run the first one above.</p>
                        ) : (
                            <div className="space-y-2 text-[12px]">
                                {recent_transfers.map((t) => (
                                    <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-ink-100 last:border-0">
                                        <span className="text-ink-700">
                                            Batch ·{' '}
                                            {new Date(t.batch_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} ·{' '}
                                            {t.commissions_count} agent{t.commissions_count === 1 ? '' : 's'}
                                        </span>
                                        <span className="font-mono font-semibold text-success">{fmtMoney(t.total_agent_net)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Settings */}
                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <h3 className="text-base font-semibold mb-3">Payout Settings</h3>
                        <div className="space-y-3 text-[12px]">
                            <div className="flex items-center justify-between py-1.5 border-b border-ink-100">
                                <span className="text-ink-500">Cycle</span>
                                <span className="font-semibold">Monthly</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 border-b border-ink-100">
                                <span className="text-ink-500">Day of month</span>
                                <span className="font-semibold">{agency.payout_day}th</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 border-b border-ink-100">
                                <span className="text-ink-500">VAT rate</span>
                                <span className="font-semibold">{agency.vat_rate}%</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5">
                                <span className="text-ink-500">Block on FFC expired</span>
                                <span className="font-semibold text-success">ON</span>
                            </div>
                        </div>
                        <a
                            href="/agency/settings"
                            className="w-full block text-center mt-3 py-2 text-[12px] border border-ink-200 rounded-md hover:bg-ink-100 transition"
                        >
                            Edit settings
                        </a>
                    </div>
                </div>
            </section>
        </AgencyLayout>
    );
}

function Stat({ label, value, meta }: { label: string; value: string; meta: string }) {
    return (
        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
            <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">{label}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            <p className="text-[11px] text-ink-500 mt-1">{meta}</p>
        </div>
    );
}
