import { Head, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useInertiaLoading } from '@/Hooks/useInertiaLoading';

type Tx = {
    id: number;
    date: string;
    account: string;
    type: 'subscription' | 'platform_fee';
    type_label: string;
    reference: string;
    amount: number;
    status: 'paid' | 'failed' | 'pending';
};

type Props = {
    range: string;
    kpis: {
        collected: number;
        platform_fees: number;
        failed_count: number;
        churn_pct: number;
    };
    transactions: Tx[];
};

function fmtMoney(n: number) {
    return `R ${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

const RANGE_LABEL: Record<string, string> = {
    week:    'This week',
    month:   'This month',
    quarter: 'This quarter',
    year:    'This year',
};

const STATUS_CFG: Record<string, string> = {
    paid:    'bg-success/15 text-success',
    failed:  'bg-danger/15 text-danger',
    pending: 'bg-warning/15 text-warning',
};

const TYPE_CFG: Record<string, string> = {
    subscription: 'bg-brand-50 text-brand-700',
    platform_fee:'bg-amber-50 text-amber-700',
};

export default function AdminTransactions({ range, kpis, transactions }: Props) {
    const loading = useInertiaLoading();

    function changeRange(r: string) {
        router.get('/admin/transactions', { range: r }, { preserveScroll: true, preserveState: true });
    }

    return (
        <AdminLayout crumb="Transactions" section="Financials">
            <Head title="Transactions" />

            <div className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            All subscription charges and platform fees · via Paystack
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={range}
                            onChange={(e) => changeRange(e.target.value)}
                            className="text-[12px] bg-white border border-ink-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20"
                        >
                            {Object.entries(RANGE_LABEL).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                        <button className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg bg-white hover:bg-ink-50 transition flex items-center gap-2">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                            </svg>
                            Export
                        </button>
                    </div>
                </div>

                {/* KPI strip */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <Kpi label="Collected" value={fmtMoney(kpis.collected)} tone="success" />
                    <Kpi label="Platform Fees" value={fmtMoney(kpis.platform_fees)} tone="ink" />
                    <Kpi label="Failed Charges" value={String(kpis.failed_count)} tone={kpis.failed_count > 0 ? 'danger' : 'ink'} />
                    <Kpi label="Churn" value={`${kpis.churn_pct}%`} tone={kpis.churn_pct > 5 ? 'danger' : 'warning'} />
                </div>

                {/* Table */}
                <div className={
                    'bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden transition-opacity duration-150 ' +
                    (loading ? 'opacity-50 pointer-events-none' : '')
                }>
                    {transactions.length === 0 ? (
                        <div className="p-10 text-center text-[13px] text-ink-400">No transactions in this period</div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                    <th className="font-semibold px-5 py-3">Date</th>
                                    <th className="font-semibold py-3">Account</th>
                                    <th className="font-semibold py-3">Type</th>
                                    <th className="font-semibold py-3">Reference</th>
                                    <th className="font-semibold py-3 text-right">Amount</th>
                                    <th className="font-semibold py-3 text-right pr-5">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {transactions.map((t) => (
                                    <tr key={t.id} className="border-b border-ink-100 hover:bg-ink-50 transition">
                                        <td className="px-5 py-4 font-mono text-[12px] text-ink-700">{t.date.replace(/-/g, '/')}</td>
                                        <td className="py-4 font-medium">{t.account}</td>
                                        <td className="py-4">
                                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${TYPE_CFG[t.type] ?? 'bg-ink-100 text-ink-700'}`}>
                                                {t.type_label}
                                            </span>
                                        </td>
                                        <td className="py-4 font-mono text-[12px] text-ink-600">{t.reference}</td>
                                        <td className="py-4 text-right font-mono font-bold">{fmtMoney(t.amount)}</td>
                                        <td className="py-4 text-right pr-5">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_CFG[t.status] ?? 'bg-ink-100 text-ink-700'}`}>
                                                {t.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'success' | 'ink' | 'warning' | 'danger' }) {
    const cls = tone === 'success' ? 'text-success' :
                tone === 'warning' ? 'text-warning' :
                tone === 'danger'  ? 'text-danger' :
                                     'text-ink-900';
    return (
        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
            <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold mb-2">{label}</p>
            <p className={`text-2xl font-bold ${cls}`}>{value}</p>
        </div>
    );
}
