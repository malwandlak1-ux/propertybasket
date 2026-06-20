import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import ContractorLayout from '@/Layouts/ContractorLayout';
import NewInvoiceModal, { InvoiceableJob } from '@/Components/NewInvoiceModal';
import { useInertiaLoading } from '@/Hooks/useInertiaLoading';

type Invoice = {
    id: number;
    reference: string;
    title: string;
    agency: string;
    tenant: string;
    property: string;
    status: string;
    subtotal: number;
    vat: number;
    total: number;
    quote_total: number;
    deviation: number;
    has_deviation: boolean;
    submitted_at: string | null;
    approved_at: string | null;
    paid_at: string | null;
    updated: string | null;
};

type Props = {
    counts: { requests?: number; active_jobs?: number; messages?: number };
    invoices: Invoice[];
    filter: string;
    tab_counts: Record<string, number>;
    outstanding: number;
    invoiceable_jobs: InvoiceableJob[];
    vat_registered: boolean;
    vat_rate: number;
};

const STATUS_CFG: Record<string, string> = {
    draft:     'bg-ink-100 text-ink-700',
    submitted: 'bg-brand-50 text-brand-700',
    approved:  'bg-warning/15 text-warning',
    paid:      'bg-success/15 text-success',
    rejected:  'bg-danger/15 text-danger',
};

const FILTERS: { key: string; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'draft',     label: 'Draft' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'approved',  label: 'Approved' },
    { key: 'paid',      label: 'Paid' },
    { key: 'rejected',  label: 'Rejected' },
];

function fmtMoney(n: number) {
    return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ContractorInvoices({ counts, invoices, filter, tab_counts, outstanding, invoiceable_jobs, vat_registered, vat_rate }: Props) {
    const loading = useInertiaLoading();
    const [modalOpen, setModalOpen] = useState(false);
    const hasInvoiceableJobs = invoiceable_jobs.some((j) => ! j.has_invoice);

    function applyFilter(k: string) {
        router.get('/contractor/invoices', k === 'all' ? {} : { filter: k }, {
            preserveScroll: true,
            preserveState: true,
        });
    }

    return (
        <ContractorLayout crumb="Invoices" section="Billing" counts={counts}>
            <Head title="Invoices" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {fmtMoney(outstanding)} outstanding · {tab_counts.submitted + tab_counts.approved} awaiting payment
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        disabled={! hasInvoiceableJobs}
                        title={hasInvoiceableJobs ? 'Invoice a completed or in-progress job' : 'No jobs ready to invoice yet'}
                        className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg flex items-center gap-2 hover:bg-brand-500 disabled:bg-ink-200 disabled:text-ink-500 disabled:cursor-not-allowed transition"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14"/></svg>
                        New Invoice
                    </button>
                </div>

                {/* Filter pills */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {FILTERS.map((f) => {
                        const active = filter === f.key || (filter === '' && f.key === 'all');
                        const count = tab_counts[f.key] ?? 0;
                        return (
                            <button
                                key={f.key}
                                onClick={() => applyFilter(f.key)}
                                className={
                                    'text-[12px] px-3 py-1.5 rounded-full font-medium transition ' +
                                    (active
                                        ? 'bg-ink-900 text-white'
                                        : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-100')
                                }
                            >
                                {f.label} · {count}
                            </button>
                        );
                    })}
                </div>

                {/* Invoice table */}
                <div className={
                    'bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden transition-opacity duration-150 ' +
                    (loading ? 'opacity-50 pointer-events-none' : '')
                }>
                    {invoices.length === 0 ? (
                        <div className="p-10 text-center text-[13px] text-ink-400">No invoices match this filter</div>
                    ) : (
                        <div className="overflow-x-auto"><table className="w-full min-w-[700px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                    <th className="font-semibold px-5 py-3">Reference</th>
                                    <th className="font-semibold py-3">Invoice</th>
                                    <th className="font-semibold py-3">Client</th>
                                    <th className="font-semibold py-3 text-right">Quote vs Final</th>
                                    <th className="font-semibold py-3 text-right">Total</th>
                                    <th className="font-semibold py-3">Status</th>
                                    <th className="font-semibold py-3 text-right pr-5">Updated</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {invoices.map((inv) => (
                                    <tr key={inv.id} className="border-b border-ink-100 hover:bg-ink-50 transition">
                                        <td className="px-5 py-4 font-mono text-[12px]">
                                            <a
                                                href={`/contractor/invoices/${inv.id}/pdf?download=1`}
                                                target="_blank"
                                                rel="noopener"
                                                className="text-brand-600 hover:underline"
                                                title="Download PDF"
                                            >
                                                {inv.reference} ↓
                                            </a>
                                        </td>
                                        <td className="py-4">
                                            <p className="font-semibold">{inv.title}</p>
                                            <p className="text-[11px] text-ink-500">{inv.property}</p>
                                        </td>
                                        <td className="py-4">
                                            <p className="text-[12px]">{inv.agency}</p>
                                            <p className="text-[11px] text-ink-500">{inv.tenant}</p>
                                        </td>
                                        <td className="py-4 text-right font-mono text-[12px]">
                                            <p>{fmtMoney(inv.quote_total)}</p>
                                            {inv.has_deviation && (
                                                <p className={`text-[11px] font-bold ${inv.deviation > 0 ? 'text-danger' : 'text-success'}`}>
                                                    {inv.deviation > 0 ? '+' : ''}{fmtMoney(Math.abs(inv.deviation))}
                                                </p>
                                            )}
                                        </td>
                                        <td className="py-4 text-right font-mono font-bold">{fmtMoney(inv.total)}</td>
                                        <td className="py-4">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_CFG[inv.status] ?? 'bg-ink-100 text-ink-700'}`}>
                                                {inv.status}
                                            </span>
                                            {inv.paid_at && <p className="text-[10px] text-success mt-0.5">Paid {inv.paid_at}</p>}
                                        </td>
                                        <td className="py-4 text-right pr-5 text-[12px] text-ink-500">{inv.updated}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table></div>
                    )}
                </div>
            </div>

            {modalOpen && (
                <NewInvoiceModal
                    jobs={invoiceable_jobs}
                    vatRegistered={vat_registered}
                    vatRate={vat_rate}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </ContractorLayout>
    );
}
