import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import ContractorLayout from '@/Layouts/ContractorLayout';
import NewQuoteModal, { QuotableJob } from '@/Components/NewQuoteModal';
import { useInertiaLoading } from '@/Hooks/useInertiaLoading';

type Quote = {
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
    vat_registered: boolean;
    line_count: number;
    sent_at: string | null;
    expires_at: string | null;
    expires_soon: boolean;
    updated: string | null;
};

type Props = {
    counts: { requests?: number; active_jobs?: number; messages?: number };
    quotes: Quote[];
    filter: string;
    tab_counts: Record<string, number>;
    quotable_jobs: QuotableJob[];
    vat_registered: boolean;
    vat_rate: number;
};

const STATUS_CFG: Record<string, string> = {
    draft:    'bg-ink-100 text-ink-700',
    sent:     'bg-brand-50 text-brand-700',
    accepted: 'bg-success/15 text-success',
    declined: 'bg-danger/15 text-danger',
    expired:  'bg-ink-200 text-ink-500',
};

const FILTERS: { key: string; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'draft',    label: 'Draft' },
    { key: 'sent',     label: 'Sent' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'declined', label: 'Declined' },
    { key: 'expired',  label: 'Expired' },
];

function fmtMoney(n: number) {
    return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ContractorQuotes({ counts, quotes, filter, tab_counts, quotable_jobs, vat_registered, vat_rate }: Props) {
    const loading = useInertiaLoading();
    const [modalOpen, setModalOpen] = useState(false);

    function applyFilter(k: string) {
        router.get('/contractor/quotes', k === 'all' ? {} : { filter: k }, {
            preserveScroll: true,
            preserveState: true,
        });
    }

    const hasJobs = quotable_jobs.some((j) => ! j.has_quote);

    return (
        <ContractorLayout crumb="Quotes" section="Billing" counts={counts}>
            <Head title="Quotes" />

            <div className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Quotes</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Auto-expire after 14 days · {tab_counts.sent} sent · {tab_counts.accepted} accepted
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        disabled={! hasJobs}
                        title={hasJobs ? 'Create a new quote against one of your assigned jobs' : 'No assigned jobs to quote on'}
                        className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg flex items-center gap-2 hover:bg-ink-800 disabled:bg-ink-200 disabled:text-ink-500 disabled:cursor-not-allowed transition"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14"/></svg>
                        New Quote
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

                {/* Quote list */}
                <div className={
                    'bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden transition-opacity duration-150 ' +
                    (loading ? 'opacity-50 pointer-events-none' : '')
                }>
                    {quotes.length === 0 ? (
                        <div className="p-10 text-center text-[13px] text-ink-400">No quotes match this filter</div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                    <th className="font-semibold px-5 py-3">Reference</th>
                                    <th className="font-semibold py-3">Quote</th>
                                    <th className="font-semibold py-3">Client</th>
                                    <th className="font-semibold py-3 text-right">Lines</th>
                                    <th className="font-semibold py-3 text-right">Total</th>
                                    <th className="font-semibold py-3">Status</th>
                                    <th className="font-semibold py-3 text-right pr-5">Expires</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {quotes.map((q) => (
                                    <tr key={q.id} className={`border-b border-ink-100 hover:bg-ink-50 transition ${q.expires_soon ? 'bg-warning/5' : ''}`}>
                                        <td className="px-5 py-4 font-mono text-[12px] text-ink-700">{q.reference}</td>
                                        <td className="py-4">
                                            <p className="font-semibold">{q.title}</p>
                                            <p className="text-[11px] text-ink-500">{q.property}</p>
                                        </td>
                                        <td className="py-4">
                                            <p className="text-[12px]">{q.agency}</p>
                                            <p className="text-[11px] text-ink-500">{q.tenant}</p>
                                        </td>
                                        <td className="py-4 text-right font-mono">{q.line_count}</td>
                                        <td className="py-4 text-right font-mono font-bold">
                                            {fmtMoney(q.total)}
                                            {q.vat_registered && <span className="block text-[10px] text-ink-400 font-normal">incl. VAT</span>}
                                        </td>
                                        <td className="py-4">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_CFG[q.status] ?? 'bg-ink-100 text-ink-700'}`}>
                                                {q.status}
                                            </span>
                                        </td>
                                        <td className="py-4 text-right pr-5 text-[12px] text-ink-500">
                                            {q.expires_at ?? '—'}
                                            {q.expires_soon && <span className="block text-[10px] text-warning font-bold mt-0.5">SOON</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {modalOpen && (
                <NewQuoteModal
                    jobs={quotable_jobs}
                    vatRegistered={vat_registered}
                    vatRate={vat_rate}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </ContractorLayout>
    );
}
