import { useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import { Spinner } from '@/Components/Skeleton';
import Icon from '@/Components/Dashboard/Icon';

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
    payout_method: 'paystack' | 'bank' | null;
};

type Props = {
    agency: { id: number; name: string; payout_day: number; vat_rate: number; sale_commission_percent: number; rental_commission_percent: number; payout_method: PayoutMethod };
    payout: { method: PayoutMethod; paystack_stub: boolean; trust_verified: boolean; trust_bank: string | null; trust_account: string | null;
        investec: { environment: string; account: string; problem: string | null } | null };
    eft_batch: EftBatch | null;
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
    recent_transfers: { id: number; batch_date: string; total_agent_net: number; commissions_count: number; method: PayoutMethod; paid_reference: string | null }[];
    contractor_invoices: { queue: ContractorInvoice[]; paid: ContractorInvoice[] };
};

type PayoutMethod = 'paystack' | 'trust_account' | 'investec';

type EftBatch = {
    id: number;
    method: 'trust_account' | 'investec';
    status: 'processing' | 'failed';
    failure: string | null;
    paid_count: number;
    batch_date: string;
    total: number;
    payees: { agent: string | null; bank: string | null; account: string | null; amount: number; deals: number }[];
    file_url: string | null;
};

type ContractorInvoice = {
    id: number;
    reference: string;
    contractor: string;
    job: string;
    subtotal: number;
    vat: number;
    total: number;
    deviation: number;
    status: string;
    submitted_at: string | null;
    paid_at: string | null;
    has_banking: boolean;
    banking: {
        bank_name: string | null;
        account_holder: string | null;
        account_number: string | null;
        branch_code: string | null;
        account_type: string | null;
    } | null;
    contact: { name: string | null; email: string | null; phone: string | null };
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
        'linear-gradient(135deg,var(--color-brand-500),var(--color-brand-700))',
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

// Friendly labels for blocked_reason codes. The move-in-inspection hold is a
// normal part of the workflow (amber), not a compliance failure (red).
const REASON_LABEL: Record<string, string> = {
    awaiting_move_in_inspection: 'awaiting move-in inspection',
    no_payout_method: 'no payout method',
    ffc_expired: 'FFC expired',
};

function reasonChips(reason: string): { text: string; tone: string }[] {
    return reason.split(',').filter(Boolean).map((r) => ({
        text: REASON_LABEL[r] ?? r.replace(/_/g, ' '),
        tone: r === 'awaiting_move_in_inspection' ? 'text-warning' : 'text-danger',
    }));
}

export default function Commission({ agency, payout, eft_batch, commissions, totals, next_batch, paid_ytd, agency_retained_ytd, vat_ytd, recent_transfers, contractor_invoices }: Props) {
    const viaTrust = payout.method === 'trust_account';
    const viaInvestec = payout.method === 'investec';
    const { flash } = usePage<SharedProps>().props;
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [payInvoiceModal, setPayInvoiceModal] = useState<ContractorInvoice | null>(null);
    const [rateModalOpen, setRateModalOpen] = useState(false);

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
        const msg = viaInvestec
            ? `Pay the approved commissions now from your Investec trust account (${payout.investec?.account ?? ''})?${payout.investec?.environment === 'sandbox' ? ' (Investec sandbox: test data, no real money.)' : ' Real money leaves your account.'}`
            : viaTrust
            ? `Prepare an EFT payout from your trust account (${payout.trust_bank ?? 'bank'} ${payout.trust_account ?? ''})? You'll get a bank payment file; commissions are marked paid once you confirm the EFT went through.`
            : payout.paystack_stub
                ? 'Run the payout batch via Paystack? Paystack is in test mode: no real money moves, and commissions are marked paid.'
                : 'Run the payout batch via Paystack? Agents are paid immediately by Paystack transfer.';
        if (!confirm(msg)) return;
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
            <section className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-[28px] sm:text-[32px] leading-tight tracking-tight">Commission &amp; Payouts</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Monthly payout day: <span className="font-semibold text-ink-900">{agency.payout_day}th of each month</span> ·{' '}
                            {viaInvestec
                                ? <>Paid directly from your Investec trust account <span className="font-semibold text-ink-900">{payout.investec?.account}</span>{payout.investec?.environment === 'sandbox' ? ' (sandbox)' : ''}</>
                                : viaTrust
                                ? <>Paid by EFT from your trust account <span className="font-semibold text-ink-900">{payout.trust_bank} {payout.trust_account}</span></>
                                : <>Paid via Paystack{payout.paystack_stub ? ' (test mode)' : ''}</>}
                            {' '}· <a href="/agency/settings" className="font-semibold text-brand-700 hover:underline">Change</a>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="px-4 py-2 text-[13px] font-semibold border border-ink-900/70 bg-white/60 rounded-full hover:bg-white flex items-center gap-2" disabled title="Coming soon">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                            Export ledger
                        </button>
                        <button
                            onClick={runPayoutBatch}
                            disabled={paying || !!eft_batch || (!next_batch && totals.count_eligible === 0)}
                            title={eft_batch ? 'Finish the EFT payout below first' : undefined}
                            className="px-3.5 py-2 text-[13px] bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
                        >
                            {paying ? <Spinner size={14} /> : (
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M8 12h8M12 8v8" />
                                </svg>
                            )}
                            {paying ? 'Running…' : viaInvestec ? 'Pay via Investec' : viaTrust ? 'Prepare EFT Payout' : 'Run Payout Batch'}
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

                {viaInvestec && payout.investec?.problem && (
                    <div className="mb-4 rounded-lg bg-warning/10 border border-warning/30 text-ink-800 px-4 py-3 text-[13px]">
                        Investec can’t pay yet: {payout.investec.problem} <a href="/agency/settings" className="font-semibold text-brand-700 hover:underline">Settings →</a>
                    </div>
                )}
                {eft_batch && <EftBatchCard batch={eft_batch} trust={`${payout.trust_bank ?? ''} ${payout.trust_account ?? ''}`.trim()} />}

                {/* Stat strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div
                        className="rounded-xl p-5 text-white shadow-card"
                        style={{ background: 'linear-gradient(135deg,var(--color-brand-500),var(--color-brand-700))' }}
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
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden mb-6">
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
                        <div className="overflow-x-auto"><table className="w-full min-w-[700px]">
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
                                    <th className="font-semibold py-3">Payout method</th>
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
                                                        {isBlocked && c.blocked_reason && reasonChips(c.blocked_reason).map((chip, i) => (
                                                            <span key={i} className={'text-[10px] ' + chip.tone}>· {chip.text}</span>
                                                        ))}
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
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold" title={c.payout_method === 'bank' ? 'Bank account on file' : 'Paystack recipient on file'}>
                                                            {c.payout_method === 'bank' ? 'BANK' : 'PAYSTACK'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-danger/15 text-danger font-bold" title="No payout method — agent must add Paystack or banking details">NO PAYOUT METHOD</span>
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
                        </table></div>
                    </div>
                </div>

                {/* Contractor invoices awaiting payment */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden mb-6">
                    <div className="p-5 border-b border-ink-200 flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <h2 className="text-base font-semibold">Contractor Invoices</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">
                                {contractor_invoices.queue.length} awaiting payment · invoices land here when contractors complete jobs
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto"><table className="w-full min-w-[700px]">
                        <thead>
                            <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                <th className="font-semibold px-5 py-3">Contractor</th>
                                <th className="font-semibold py-3">Job</th>
                                <th className="font-semibold py-3 text-right">Subtotal</th>
                                <th className="font-semibold py-3 text-right">VAT</th>
                                <th className="font-semibold py-3 text-right">Total</th>
                                <th className="font-semibold py-3 pl-6">Account</th>
                                <th className="font-semibold py-3 pr-5 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-[13px]">
                            {contractor_invoices.queue.length === 0 && contractor_invoices.paid.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-10 text-center text-ink-500 text-[13px]">
                                        No contractor invoices yet. They'll appear here once contractors complete jobs and invoice.
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {contractor_invoices.queue.map((inv) => (
                                        <tr key={inv.id} className="border-b border-ink-100 hover:bg-ink-50">
                                            <td className="px-5 py-3">
                                                <p className="font-semibold">{inv.contractor}</p>
                                                <p className="text-[11px] text-ink-400 font-mono">{inv.reference}{inv.submitted_at ? ` · ${inv.submitted_at}` : ''}</p>
                                            </td>
                                            <td className="py-3 pr-3">
                                                <p className="truncate max-w-[220px]">{inv.job}</p>
                                                {inv.deviation > 0 && (
                                                    <p className="text-[11px] text-warning">incl. {fmtMoney(inv.deviation)} deviation</p>
                                                )}
                                            </td>
                                            <td className="text-right font-mono py-3">{fmtMoney(inv.subtotal)}</td>
                                            <td className="text-right font-mono py-3 text-ink-500">{fmtMoney(inv.vat)}</td>
                                            <td className="text-right font-mono font-bold py-3">{fmtMoney(inv.total)}</td>
                                            <td className="py-3 pl-6">
                                                {inv.has_banking ? (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">LINKED</span>
                                                ) : (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-bold" title="Contractor hasn't captured banking details">NOT LINKED</span>
                                                )}
                                            </td>
                                            <td className="py-3 pr-5 text-right">
                                                <button
                                                    onClick={() => setPayInvoiceModal(inv)}
                                                    className="px-3 py-1.5 text-[12px] bg-success text-white rounded-md font-semibold hover:bg-success/90 transition"
                                                >
                                                    Pay contractor
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {contractor_invoices.paid.map((inv) => (
                                        <tr key={`paid-${inv.id}`} className="border-b border-ink-100 bg-ink-50/40 text-ink-500">
                                            <td className="px-5 py-3">
                                                <p className="font-semibold text-ink-600">{inv.contractor}</p>
                                                <p className="text-[11px] text-ink-400 font-mono">{inv.reference}</p>
                                            </td>
                                            <td className="py-3 pr-3"><p className="truncate max-w-[220px]">{inv.job}</p></td>
                                            <td className="text-right font-mono py-3">{fmtMoney(inv.subtotal)}</td>
                                            <td className="text-right font-mono py-3">{fmtMoney(inv.vat)}</td>
                                            <td className="text-right font-mono font-semibold py-3">{fmtMoney(inv.total)}</td>
                                            <td className="py-3 pl-6"></td>
                                            <td className="py-3 pr-5 text-right">
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">
                                                    PAID{inv.paid_at ? ` · ${inv.paid_at}` : ''}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </>
                            )}
                        </tbody>
                    </table></div>
                </div>

                {/* Three side cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Paystack */}
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <rect x="2" y="5" width="20" height="14" rx="2" />
                                        <path d="M2 10h20" />
                                    </svg>
                                </div>
                                <h3 className="text-base font-semibold">{viaInvestec ? 'Investec (direct)' : viaTrust ? 'Trust account (EFT)' : 'Paystack'}</h3>
                            </div>
                            {viaInvestec
                                ? <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${payout.investec?.problem ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>{payout.investec?.problem ? 'ATTENTION' : payout.investec?.environment === 'sandbox' ? 'SANDBOX' : 'LINKED'}</span>
                                : viaTrust
                                ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">VERIFIED</span>
                                : <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${payout.paystack_stub ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>{payout.paystack_stub ? 'TEST MODE' : 'LIVE'}</span>}
                        </div>
                        <p className="text-[12px] text-ink-500 mb-3">
                            {viaInvestec
                                ? 'One click pays agents straight from your Investec trust account to their saved beneficiaries.'
                                : viaTrust
                                ? 'You pay agents from your trust account with the bank file we prepare, then mark the batch paid.'
                                : 'Agents are paid automatically by Paystack transfer when you run the batch.'}
                        </p>
                        <div className="bg-ink-50 rounded-lg p-3 text-[11px] font-mono text-ink-700 space-y-1">
                            {viaInvestec ? (
                                <p>Account: <span className="font-semibold text-ink-900">Investec {payout.investec?.account}</span></p>
                            ) : viaTrust ? (
                                <>
                                    <p>Account: <span className="font-semibold text-ink-900">{payout.trust_bank} {payout.trust_account}</span></p>
                                    <p>Waiting: <span className="text-ink-900">{eft_batch ? `${fmtMoney(eft_batch.total)} to pay` : 'nothing'}</span></p>
                                </>
                            ) : (
                                <p>Mode: <span className="font-semibold text-ink-900">{payout.paystack_stub ? 'test (no real money moves)' : 'live transfers'}</span></p>
                            )}
                            <p><a href="/agency/settings" className="text-brand-700 hover:underline font-sans font-semibold">Change payout method →</a></p>
                        </div>
                    </div>

                    {/* Recent transfers */}
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
                        <h3 className="text-base font-semibold mb-3">Recent Transfers</h3>
                        {recent_transfers.length === 0 ? (
                            <p className="text-[13px] text-ink-500">No completed batches yet. Run the first one above.</p>
                        ) : (
                            <div className="space-y-2 text-[12px]">
                                {recent_transfers.map((t) => (
                                    <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-ink-100 last:border-0">
                                        <span className="text-ink-700">
                                            {t.method === 'trust_account' ? 'EFT' : t.method === 'investec' ? 'Investec' : 'Batch'} ·{' '}
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
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
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
                                <span className="text-ink-500">Method</span>
                                <span className="font-semibold">{viaInvestec ? 'Investec (direct)' : viaTrust ? 'Trust account (EFT)' : 'Paystack'}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 border-b border-ink-100">
                                <span className="text-ink-500">VAT rate</span>
                                <span className="font-semibold">{agency.vat_rate}%</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 border-b border-ink-100">
                                <span className="text-ink-500">Sale commission</span>
                                <span className="font-semibold text-brand-700">{agency.sale_commission_percent}%</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 border-b border-ink-100">
                                <span className="text-ink-500">Rental commission</span>
                                <span className="font-semibold text-brand-700">{agency.rental_commission_percent}%</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5">
                                <span className="text-ink-500">Block on FFC expired</span>
                                <span className="font-semibold text-success">ON</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setRateModalOpen(true)}
                            className="w-full text-center mt-3 py-2 text-[12px] bg-ink-900 text-white rounded-md hover:bg-brand-500 transition font-semibold"
                        >
                            Edit commission structure
                        </button>
                    </div>
                </div>
            </section>

            {payInvoiceModal && (
                <PayInvoiceModal invoice={payInvoiceModal} onClose={() => setPayInvoiceModal(null)} />
            )}
            {rateModalOpen && (
                <CommissionRateModal
                    sale={agency.sale_commission_percent}
                    rental={agency.rental_commission_percent}
                    onClose={() => setRateModalOpen(false)}
                />
            )}
        </AgencyLayout>
    );
}

function PayInvoiceModal({ invoice, onClose }: { invoice: ContractorInvoice; onClose: () => void }) {
    const [busy, setBusy] = useState(false);

    function confirmPay() {
        setBusy(true);
        router.post(`/agency/commissions/invoices/${invoice.id}/pay`, {}, {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onFinish: () => setBusy(false),
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-card w-full max-w-md p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-[17px] font-bold">Pay {invoice.contractor}</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">{invoice.reference} · {invoice.job}</p>
                    </div>
                    <button onClick={onClose} className="text-ink-400 hover:text-ink-700 text-xl leading-none">×</button>
                </div>

                <div className="mt-4 rounded-lg bg-ink-50 border border-ink-200 px-4 py-3 flex items-center justify-between">
                    <span className="text-[12px] text-ink-500">Amount to transfer</span>
                    <span className="text-[20px] font-bold font-mono">{fmtMoney(invoice.total)}</span>
                </div>

                {invoice.has_banking && invoice.banking ? (
                    <>
                        <p className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mt-5 mb-2">Banking details on file</p>
                        <div className="rounded-lg border border-ink-200 divide-y divide-ink-100 text-[13px]">
                            <Row k="Bank" v={invoice.banking.bank_name} />
                            <Row k="Account holder" v={invoice.banking.account_holder} />
                            <Row k="Account number" v={invoice.banking.account_number} />
                            <Row k="Branch code" v={invoice.banking.branch_code} />
                            <Row k="Account type" v={invoice.banking.account_type} cap />
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <button onClick={onClose} className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 font-semibold">Cancel</button>
                            <button
                                onClick={confirmPay}
                                disabled={busy}
                                className="px-5 py-2 text-[13px] bg-success text-white rounded-lg hover:bg-success/90 disabled:opacity-50 font-semibold"
                            >
                                {busy ? 'Processing…' : 'Confirm payment'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="mt-5 rounded-lg bg-warning/10 border border-warning/30 px-4 py-3 text-[13px] text-ink-700">
                            <p className="font-bold text-warning">No banking details captured</p>
                            <p className="mt-1">
                                {invoice.contact.name ?? 'This contractor'} hasn't added a payout account to their profile yet.
                                Reach out so they can capture it before you pay.
                            </p>
                        </div>
                        <p className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mt-5 mb-2">Contact the contractor</p>
                        <div className="space-y-2">
                            {invoice.contact.phone && (
                                <a href={`tel:${invoice.contact.phone}`} className="flex items-center gap-3 rounded-lg border border-ink-200 px-3 py-2.5 hover:bg-ink-50 transition">
                                    <span className="w-8 h-8 rounded-full bg-success/10 text-success grid place-items-center"><Icon name="phone" className="w-3.5 h-3.5" /></span>
                                    <span className="text-[13px]"><span className="text-ink-500">Call</span> · {invoice.contact.phone}</span>
                                </a>
                            )}
                            {invoice.contact.email && (
                                <a href={`mailto:${invoice.contact.email}?subject=Banking details needed for payment`} className="flex items-center gap-3 rounded-lg border border-ink-200 px-3 py-2.5 hover:bg-ink-50 transition">
                                    <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 grid place-items-center"><Icon name="mail" className="w-3.5 h-3.5" /></span>
                                    <span className="text-[13px] truncate"><span className="text-ink-500">Email</span> · {invoice.contact.email}</span>
                                </a>
                            )}
                            <a href="/agency/messages" className="flex items-center gap-3 rounded-lg border border-ink-200 px-3 py-2.5 hover:bg-ink-50 transition">
                                <span className="w-8 h-8 rounded-full bg-ink-100 text-ink-700 grid place-items-center"><Icon name="chat" className="w-3.5 h-3.5" /></span>
                                <span className="text-[13px]"><span className="text-ink-500">Message</span> · Open inbox</span>
                            </a>
                        </div>
                        <div className="mt-5 flex justify-end">
                            <button onClick={onClose} className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 font-semibold">Close</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Row({ k, v, cap = false }: { k: string; v: string | null; cap?: boolean }) {
    return (
        <div className="flex items-center justify-between px-3 py-2">
            <span className="text-ink-500">{k}</span>
            <span className={'font-semibold ' + (cap ? 'capitalize' : '')}>{v ?? '—'}</span>
        </div>
    );
}

function CommissionRateModal({ sale, rental, onClose }: { sale: number; rental: number; onClose: () => void }) {
    const form = useForm({ sale_commission_percent: String(sale), rental_commission_percent: String(rental) });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post('/agency/commissions/rates', { preserveScroll: true, onSuccess: () => onClose() });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
            <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-card w-full max-w-md p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-[17px] font-bold">Commission structure</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">Separate rates for property sold vs rented out by your agents.</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700 text-xl leading-none">×</button>
                </div>

                <div className="mt-5 space-y-4">
                    <RateField
                        label="Property sale commission"
                        hint="% of the sale price"
                        value={form.data.sale_commission_percent}
                        onChange={(v) => form.setData('sale_commission_percent', v)}
                        error={form.errors.sale_commission_percent}
                    />
                    <RateField
                        label="Rental commission"
                        hint="% of one year's rent"
                        value={form.data.rental_commission_percent}
                        onChange={(v) => form.setData('rental_commission_percent', v)}
                        error={form.errors.rental_commission_percent}
                    />
                </div>

                <p className="text-[11px] text-ink-400 mt-3">
                    Applies to deals closed from now on. The agent's split (set per agent) is then taken from this gross commission.
                </p>

                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 font-semibold">Cancel</button>
                    <button type="submit" disabled={form.processing} className="px-5 py-2 text-[13px] bg-brand-700 text-white rounded-full hover:bg-brand-800 disabled:opacity-50 font-semibold">
                        {form.processing ? 'Saving…' : 'Save structure'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function RateField({ label, hint, value, onChange, error }: { label: string; hint: string; value: string; onChange: (v: string) => void; error?: string }) {
    return (
        <div>
            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">{label} <span className="text-ink-400 font-normal">— {hint}</span></label>
            <div className="flex items-stretch rounded-lg border border-ink-200 overflow-hidden focus-within:ring-2 focus-within:ring-brand/20 focus-within:border-brand transition">
                <input
                    type="number" step="0.25" min="0" max="100" inputMode="decimal"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-[14px] outline-none min-w-0"
                />
                <span className="grid place-items-center w-10 bg-ink-50 text-ink-500 text-[13px] border-l border-ink-200">%</span>
            </div>
            {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
        </div>
    );
}

function Stat({ label, value, meta }: { label: string; value: string; meta: string }) {
    return (
        <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft">
            <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">{label}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            <p className="text-[11px] text-ink-500 mt-1">{meta}</p>
        </div>
    );
}

/** A trust-account batch waiting for the agency to pay it from its bank. */
function EftBatchCard({ batch, trust }: { batch: EftBatch; trust: string }) {
    const [open, setOpen] = useState(false);
    const [reference, setReference] = useState('');
    const [saving, setSaving] = useState(false);

    function release() {
        if (!confirm(`Release the unpaid commissions from payout #${batch.id}? Only do this if the money did NOT leave your account. They go back to the queue to pay again.`)) return;
        router.post(`/agency/commissions/batches/${batch.id}/release`, {}, { preserveScroll: true });
    }

    function markPaid() {
        setSaving(true);
        router.post(`/agency/commissions/batches/${batch.id}/paid`, { reference }, {
            preserveScroll: true,
            onFinish: () => setSaving(false),
            onSuccess: () => setOpen(false),
        });
    }

    return (
        <div className={`mb-6 rounded-2xl border p-5 ${batch.status === 'failed' ? 'border-danger/40 bg-danger/5' : 'border-warning/40 bg-warning/5'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${batch.status === 'failed' ? 'text-danger' : 'text-warning'}`}>
                        {batch.status === 'failed' ? 'Payout didn’t complete' : batch.method === 'investec' ? 'Waiting for approval in Investec' : 'EFT payout ready'} · #{batch.id}
                    </p>
                    <p className="text-[20px] font-bold mt-1">{fmtMoney(batch.total)} to {batch.payees.length} agent{batch.payees.length === 1 ? '' : 's'}</p>
                    <p className="text-[12.5px] text-ink-600 mt-1">
                        {batch.status === 'failed' ? (
                            <>{batch.failure} {batch.paid_count > 0 && `${batch.paid_count} commission(s) did go through. `}Check Investec Online: if the money went out, mark it paid; if not, release the unpaid commissions to try again.</>
                        ) : batch.method === 'investec' ? (
                            <>Investec accepted the payments but needs them approved. Approve them in Investec Online (or the app), then mark the payout paid here.</>
                        ) : (
                            <>1. Download the payment file and import it as a bulk payment from your trust account{trust ? ` (${trust})` : ''}.
                            {' '}2. Approve the payment in your banking. 3. Mark it paid here and agents are notified.</>
                        )}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {batch.file_url && <a href={batch.file_url} className="px-3.5 py-2 text-[13px] font-semibold border border-ink-300 bg-white rounded-lg hover:bg-ink-50">Download payment file (CSV)</a>}
                    <button type="button" onClick={() => setOpen(true)} className="px-3.5 py-2 text-[13px] font-semibold bg-success text-white rounded-lg hover:bg-success/90">Mark as paid</button>
                    <button type="button" onClick={release} className="px-3.5 py-2 text-[13px] font-semibold text-ink-600 hover:bg-ink-100 rounded-lg">Release</button>
                </div>
            </div>
            <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[480px] text-[12.5px]">
                    <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-500"><th className="py-1.5 font-semibold">Agent</th><th className="font-semibold">Bank</th><th className="font-semibold">Account</th><th className="font-semibold text-right">Deals</th><th className="font-semibold text-right">Amount</th></tr></thead>
                    <tbody>
                        {batch.payees.map((p, i) => (
                            <tr key={i} className="border-t border-warning/20">
                                <td className="py-2 font-semibold">{p.agent}</td>
                                <td>{p.bank ?? '—'}</td>
                                <td className="font-mono">{p.account ?? '—'}</td>
                                <td className="text-right">{p.deals}</td>
                                <td className="text-right font-mono font-semibold">{fmtMoney(p.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
                    <div role="dialog" aria-modal="true" aria-label="Mark EFT payout paid" className="w-full max-w-sm bg-white rounded-2xl shadow-lift p-6">
                        <h2 className="text-lg font-bold">Mark payout #{batch.id} paid?</h2>
                        <p className="text-[12.5px] text-ink-600 mt-1">Only do this once {fmtMoney(batch.total)} has actually gone out from your trust account. The commissions are marked paid and each agent gets a payment notice.</p>
                        <label className="block text-[12px] font-semibold text-ink-700 mt-4 mb-1.5">Bank payment reference (optional)</label>
                        <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} placeholder="e.g. FNB batch 20261109-01"
                            className="w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100" />
                        <div className="flex justify-end gap-2 mt-5">
                            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-ink-600 hover:bg-ink-100">Cancel</button>
                            <button type="button" onClick={markPaid} disabled={saving} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-success hover:bg-success/90 disabled:opacity-60">
                                {saving ? 'Saving…' : 'Yes, it’s paid'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
