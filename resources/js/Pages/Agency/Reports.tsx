import { Head } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';

type Props = {
    agency: {
        id: number;
        name: string;
        trust_bank: string | null;
        trust_account_last4: string | null;
    };
    income_statement: {
        gross_commission: number;
        agent_payouts: number;
        vat_liability: number;
        net_to_agency: number;
        net_margin_pct: number;
        agent_payouts_pct: number;
    };
    cashflow: { month: string; inflow: number; outflow: number }[];
    trust: { balance: number; deposits_held: number; rent_in_transit: number; reconciled_at: string };
    agent_contribution: {
        agent_name: string;
        sales_gmv: number;
        rental_gmv: number;
        gross_commission: number;
        paid_to_agent: number;
        agency_net: number;
        percent_of_revenue: number;
    }[];
    vat_period: { starts_on: string; ends_on: string; amount: number; filing_deadline: string };
};

function fmtMoney(n: number): string {
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}
function fmtMoneyShort(n: number): string {
    if (n >= 1_000_000) return 'R ' + (n / 1_000_000).toFixed(1) + 'm';
    if (n >= 1_000) return 'R ' + Math.round(n / 1_000) + 'k';
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}
function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Reports({ agency, income_statement: pl, cashflow, trust, agent_contribution, vat_period }: Props) {
    const maxFlow = Math.max(1, ...cashflow.flatMap((c) => [c.inflow, c.outflow]));

    return (
        <AgencyLayout agencyName={agency.name} crumb="Financial Reports">
            <Head title="Financial Reports" />
            <section className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Financial Reports</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Cash flow · VAT · Trust account · Sales &amp; rental breakdown
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select className="text-[12px] bg-white border border-ink-200 rounded-md px-3 py-1.5" disabled>
                            <option>FY {new Date().getFullYear()} · YTD</option>
                        </select>
                        <button
                            disabled
                            title="PDF export ships in Phase 9"
                            className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 flex items-center gap-2 opacity-60 cursor-not-allowed"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                            Download PDF
                        </button>
                    </div>
                </div>

                {/* P&L Summary */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden mb-6">
                    <div className="p-5 border-b border-ink-200">
                        <h2 className="text-base font-semibold">Income Statement Summary</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">YTD · {new Date().getFullYear()}</p>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-ink-200">
                        <Cell
                            label="Gross Commission Income"
                            value={fmtMoney(pl.gross_commission)}
                            sub={pl.gross_commission > 0 ? 'Commission rows YTD' : 'No deals yet'}
                            tone="default"
                        />
                        <Cell
                            label="Less: Agent Payouts"
                            value={'- ' + fmtMoney(pl.agent_payouts)}
                            sub={`${pl.agent_payouts_pct}% of gross`}
                            tone="muted"
                        />
                        <Cell
                            label="Less: VAT Liability"
                            value={'- ' + fmtMoney(pl.vat_liability)}
                            sub="15% on agent commissions"
                            tone="muted"
                        />
                        <Cell
                            label="Net to Agency"
                            value={fmtMoney(pl.net_to_agency)}
                            sub={`${pl.net_margin_pct}% net margin`}
                            tone="success"
                        />
                    </div>
                </div>

                {/* Cash flow + Trust */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="col-span-2 bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <h2 className="text-base font-semibold mb-1">Cash Flow Trend</h2>
                        <p className="text-[12px] text-ink-500 mb-4">Inflow vs Outflow · Last 6 months</p>

                        <div className="flex items-end gap-4 h-52 px-2 overflow-x-auto">
                            {cashflow.map((m, idx) => (
                                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                                    <div className="w-full flex items-end justify-center gap-1 h-48">
                                        <div
                                            className="bg-success rounded-t w-6"
                                            style={{ height: `${Math.max(2, (m.inflow / maxFlow) * 100)}%` }}
                                            title={`Inflow ${fmtMoney(m.inflow)}`}
                                        />
                                        <div
                                            className="rounded-t w-6"
                                            style={{
                                                height: `${Math.max(2, (m.outflow / maxFlow) * 100)}%`,
                                                background: 'rgba(239,68,68,0.60)',
                                            }}
                                            title={`Outflow ${fmtMoney(m.outflow)}`}
                                        />
                                    </div>
                                    <span
                                        className={
                                            'text-[10px] ' +
                                            (idx === cashflow.length - 1 ? 'font-semibold text-brand-600' : 'text-ink-500')
                                        }
                                    >
                                        {m.month}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center gap-4 mt-4 text-[11px]">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-success" />
                                Inflow (commissions earned)
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span
                                    className="w-2.5 h-2.5 rounded-sm"
                                    style={{ background: 'rgba(239,68,68,0.60)' }}
                                />
                                Outflow (agent payouts)
                            </span>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-semibold">Trust Account</h2>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">
                                RECONCILED
                            </span>
                        </div>
                        <p className="text-[11px] text-ink-500 mb-3">
                            {agency.trust_bank ?? 'No bank linked'}
                            {agency.trust_account_last4 ? ` · ***${agency.trust_account_last4}` : ''}
                        </p>
                        <div
                            className="rounded-lg p-4 text-white mb-4"
                            style={{ background: 'linear-gradient(135deg,#0B0B0F,#1A1A22)' }}
                        >
                            <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
                                Current Balance
                            </p>
                            <p className="text-3xl font-bold mt-1 font-mono">{fmtMoneyShort(trust.balance)}</p>
                            <p className="text-[11px] opacity-70 mt-2">Last reconciled · just now</p>
                        </div>
                        <div className="space-y-2 text-[12px]">
                            <div className="flex justify-between">
                                <span className="text-ink-500">Deposits held</span>
                                <span className="font-mono font-semibold">{fmtMoney(trust.deposits_held)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-ink-500">Rent in transit</span>
                                <span className="font-mono font-semibold">{fmtMoney(trust.rent_in_transit)}</span>
                            </div>
                            <div className="flex justify-between text-ink-400 pt-2 border-t border-ink-100">
                                <span>Agency commission (clearing)</span>
                                <span className="font-mono">R 0</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Per-agent contribution */}
                <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft mb-6">
                    <h2 className="text-base font-semibold mb-4">Revenue Contribution by Agent</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200">
                                    <th className="font-semibold py-2">Agent</th>
                                    <th className="font-semibold py-2 text-right">Sales (GMV)</th>
                                    <th className="font-semibold py-2 text-right">Rentals (GMV)</th>
                                    <th className="font-semibold py-2 text-right">Gross Commission</th>
                                    <th className="font-semibold py-2 text-right">Paid to Agent</th>
                                    <th className="font-semibold py-2 text-right">Agency Net</th>
                                    <th className="font-semibold py-2 text-right">% of Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {agent_contribution.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-10 text-center text-ink-500">
                                            No agent commissions recorded yet this year.
                                        </td>
                                    </tr>
                                ) : (
                                    agent_contribution.map((row) => (
                                        <tr key={row.agent_name} className="border-b border-ink-100">
                                            <td className="py-3 font-medium">{row.agent_name}</td>
                                            <td className="text-right font-mono">{fmtMoney(row.sales_gmv)}</td>
                                            <td className="text-right font-mono">{fmtMoney(row.rental_gmv)}</td>
                                            <td className="text-right font-mono font-semibold">
                                                {fmtMoney(row.gross_commission)}
                                            </td>
                                            <td className="text-right font-mono text-ink-500">
                                                {fmtMoney(row.paid_to_agent)}
                                            </td>
                                            <td className="text-right font-mono text-success font-semibold">
                                                {fmtMoney(row.agency_net)}
                                            </td>
                                            <td className="text-right font-mono">{row.percent_of_revenue}%</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* VAT panel */}
                <div
                    className="rounded-xl p-5 border border-warning/30"
                    style={{ background: 'linear-gradient(90deg, rgba(245,158,11,0.05), #FEF3C7)' }}
                >
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 8v4M12 16h.01" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-[14px] font-semibold">SARS VAT Return Due</p>
                            <p className="text-[12px] text-ink-700 mt-1">
                                Bi-monthly period {fmtDate(vat_period.starts_on)} – {fmtDate(vat_period.ends_on)}. Output VAT{' '}
                                <span className="font-semibold">{fmtMoney(vat_period.amount)}</span> on commission earned in
                                this window.
                            </p>
                            <p className="text-[11px] text-ink-500 mt-2 font-mono">
                                Filing deadline: {fmtDate(vat_period.filing_deadline)} (eFiling)
                            </p>
                        </div>
                        <button
                            disabled
                            title="VAT 201 generator lands in Phase 9"
                            className="px-3.5 py-2 text-[12px] bg-ink-900 text-white rounded-md font-semibold opacity-60 cursor-not-allowed"
                        >
                            Generate VAT 201
                        </button>
                    </div>
                </div>
            </section>
        </AgencyLayout>
    );
}

function Cell({
    label,
    value,
    sub,
    tone,
}: {
    label: string;
    value: string;
    sub: string;
    tone: 'default' | 'muted' | 'success';
}) {
    const cellBg = tone === 'success' ? 'bg-success/5' : '';
    const valueCls =
        tone === 'success' ? 'text-success' : tone === 'muted' ? 'text-ink-700' : '';
    const labelTone =
        tone === 'success' ? 'text-success' : 'text-ink-500';
    return (
        <div className={'p-5 ' + cellBg}>
            <p className={'text-[11px] uppercase tracking-wider font-semibold ' + labelTone}>{label}</p>
            <p className={'text-2xl font-bold mt-2 ' + valueCls}>{value}</p>
            <p className={'text-[12px] mt-1 ' + (tone === 'success' ? 'text-success' : 'text-ink-500')}>{sub}</p>
        </div>
    );
}
