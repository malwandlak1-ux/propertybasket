import { useState } from 'react';
import { Head } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';

type Payment = {
    id: number;
    period: string;
    amount: number;
    due_date: string;
    paid_at: string | null;
    status: 'paid' | 'overdue' | 'pending';
    property: string | null;
    tenant: string | null;
    method: string;
    reference: string | null;
};

type TrendPoint = {
    label: string;
    period: string;
    collected: number;
};

type Props = {
    landlord: { id: number; name: string };
    kpis: {
        monthly_roll: number;
        ytd_collected: number;
        this_month_collected: number;
        outstanding: number;
    };
    payments: Payment[];
    trend: TrendPoint[];
};

type Filter = 'all' | 'paid' | 'pending';

function fmtMoney(n: number) {
    return `R ${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

function StatusBadge({ status }: { status: Payment['status'] }) {
    const cfg = {
        paid:    { label: 'PAID',    cls: 'bg-success/15 text-success' },
        overdue: { label: 'OVERDUE', cls: 'bg-danger/15 text-danger' },
        pending: { label: 'PENDING', cls: 'bg-warning/15 text-warning' },
    }[status];
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cfg.cls}`}>{cfg.label}</span>;
}

export default function LandlordFinance({ landlord, kpis, payments, trend }: Props) {
    const [filter, setFilter] = useState<Filter>('all');

    const filtered = filter === 'all' ? payments : payments.filter((p) => {
        if (filter === 'paid')    return p.status === 'paid';
        if (filter === 'pending') return p.status !== 'paid';
        return true;
    });

    const maxCollected = Math.max(...trend.map((t) => t.collected), 1);

    return (
        <LandlordLayout crumb="Finance" section="Finance">
            <Head title="Finance" />

            <div className="px-8 py-7">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
                    <p className="text-[14px] text-ink-500 mt-1">Rent collection history and income overview</p>
                </div>

                {/* ── KPI Strip ─────────────────────────────────────────── */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'Monthly Rent Roll',  value: fmtMoney(kpis.monthly_roll),         sub: 'Active leases',             color: 'text-success' },
                        { label: 'YTD Collected',       value: fmtMoney(kpis.ytd_collected),        sub: 'This calendar year',        color: 'text-success' },
                        { label: 'This Month',          value: fmtMoney(kpis.this_month_collected), sub: 'Payments received',         color: 'text-ink-900' },
                        { label: 'Outstanding',         value: fmtMoney(kpis.outstanding),          sub: 'Past due payments',         color: kpis.outstanding > 0 ? 'text-danger' : 'text-success' },
                    ].map((k) => (
                        <div key={k.label} className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold mb-2">{k.label}</p>
                            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                            <p className="text-[11px] text-ink-400 mt-1">{k.sub}</p>
                        </div>
                    ))}
                </div>

                {/* ── Trend chart ───────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft mb-6">
                    <h2 className="text-base font-semibold mb-4">Last 6 Months — Rent Collected</h2>
                    <div className="flex items-end gap-3 h-28">
                        {trend.map((t) => {
                            const pct = maxCollected > 0 ? (t.collected / maxCollected) * 100 : 0;
                            return (
                                <div key={t.period} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-[10px] text-ink-500 font-mono">{fmtMoney(t.collected)}</span>
                                    <div className="w-full bg-ink-100 rounded-t-sm relative flex items-end" style={{ height: '64px' }}>
                                        <div
                                            className="w-full bg-brand-500 rounded-t-sm transition-all"
                                            style={{ height: `${Math.max(pct, 4)}%` }}
                                        />
                                    </div>
                                    <span className="text-[11px] text-ink-500 font-semibold">{t.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Payment history table ─────────────────────────────── */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                    <div className="p-5 border-b border-ink-200 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-semibold">Payment History</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">{payments.length} payments recorded</p>
                        </div>
                        <div className="flex gap-2">
                            {(['all', 'paid', 'pending'] as Filter[]).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1.5 text-[12px] rounded-lg font-medium transition ${
                                        filter === f
                                            ? 'bg-ink-900 text-white'
                                            : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                                    }`}
                                >
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="p-10 text-center text-[13px] text-ink-400">No payments in this view.</div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                    <th className="font-semibold px-5 py-3">Period</th>
                                    <th className="font-semibold py-3">Property</th>
                                    <th className="font-semibold py-3">Tenant</th>
                                    <th className="font-semibold py-3">Due Date</th>
                                    <th className="font-semibold py-3">Paid On</th>
                                    <th className="font-semibold py-3 text-right">Amount</th>
                                    <th className="font-semibold py-3">Status</th>
                                    <th className="font-semibold py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {filtered.map((p) => (
                                    <tr key={p.id} className="border-b border-ink-100 hover:bg-ink-50 transition">
                                        <td className="px-5 py-3.5 font-mono text-[12px] text-ink-700">{p.period}</td>
                                        <td className="py-3.5 text-ink-700">{p.property ?? '—'}</td>
                                        <td className="py-3.5 text-ink-700">{p.tenant ?? '—'}</td>
                                        <td className="py-3.5 text-ink-500 text-[12px]">{p.due_date}</td>
                                        <td className="py-3.5 text-ink-500 text-[12px]">{p.paid_at ?? '—'}</td>
                                        <td className="py-3.5 text-right font-mono font-semibold">{fmtMoney(p.amount)}</td>
                                        <td className="py-3.5"><StatusBadge status={p.status} /></td>
                                        <td className="py-3.5 pr-5">
                                            {p.status === 'paid' && (
                                                <button className="text-[11px] text-brand-600 font-semibold hover:underline">Receipt</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </LandlordLayout>
    );
}
