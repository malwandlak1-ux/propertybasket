import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';

type Quote = {
    id: number;
    reference: string;
    job_id: number;
    job_title: string;
    property: string;
    property_suburb: string | null;
    tenant: string;
    contractor: string;
    subtotal: number;
    vat: number;
    total: number;
    status: 'sent' | 'accepted' | 'rejected' | string;
    sent_at: string | null;
    expires_at: string | null;
    line_count: number;
};

type Props = {
    agency: { id: number; name: string };
    quotes: Quote[];
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

function fmtMoney(n: number) {
    return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_CFG: Record<string, string> = {
    sent:     'bg-warning/15 text-warning',
    accepted: 'bg-success/15 text-success',
    rejected: 'bg-danger/15 text-danger',
};

export default function AgencyMaintenanceQuotes({ agency, quotes }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [busy, setBusy] = useState<number | null>(null);

    const pending  = quotes.filter((q) => q.status === 'sent');
    const decided  = quotes.filter((q) => q.status !== 'sent');

    function accept(q: Quote) {
        if (! confirm(`Accept ${q.reference} from ${q.contractor} for ${fmtMoney(q.total)}? Any competing quote on this job will be rejected.`)) return;
        setBusy(q.id);
        router.post(`/agency/maintenance/quotes/${q.id}/accept`, {}, { preserveScroll: true, onFinish: () => setBusy(null) });
    }
    function reject(q: Quote) {
        if (! confirm(`Reject ${q.reference} from ${q.contractor}?`)) return;
        setBusy(q.id);
        router.post(`/agency/maintenance/quotes/${q.id}/reject`, {}, { preserveScroll: true, onFinish: () => setBusy(null) });
    }

    return (
        <AgencyLayout crumb="Maintenance quotes" agencyName={agency.name}>
            <Head title="Maintenance quotes" />

            <div className="px-8 py-7">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Maintenance quotes</h1>
                    <p className="text-[14px] text-ink-500 mt-1">
                        Review and approve contractor quotes before they schedule work on your properties.
                    </p>
                </div>

                {flash?.success && (
                    <div className="mb-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                        {flash.success}
                    </div>
                )}

                <Section title="Awaiting approval" subtitle={`${pending.length} quote${pending.length === 1 ? '' : 's'} need a decision`}>
                    {pending.length === 0 ? (
                        <p className="text-[13px] text-ink-500">Nothing waiting. Contractors will appear here once they submit quotes.</p>
                    ) : (
                        <div className="space-y-3">
                            {pending.map((q) => (
                                <div key={q.id} className="bg-white rounded-xl border border-ink-200 shadow-soft p-4 flex items-center gap-4 flex-wrap">
                                    <div className="flex-1 min-w-[200px]">
                                        <p className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold font-mono">{q.reference}</p>
                                        <p className="text-[14px] font-bold mt-0.5">{q.job_title}</p>
                                        <p className="text-[12px] text-ink-500">
                                            {q.property}{q.property_suburb ? ` · ${q.property_suburb}` : ''} · Tenant: {q.tenant}
                                        </p>
                                        <p className="text-[12px] text-ink-700 mt-1">
                                            Contractor: <span className="font-semibold">{q.contractor}</span>
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Total</p>
                                        <p className="text-[18px] font-bold font-mono">{fmtMoney(q.total)}</p>
                                        <p className="text-[11px] text-ink-500">{q.line_count} line{q.line_count === 1 ? '' : 's'} · Sent {q.sent_at}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => reject(q)}
                                            disabled={busy === q.id}
                                            className="px-3 py-1.5 text-[12px] border border-ink-200 rounded-lg hover:bg-ink-100 disabled:opacity-50 font-semibold"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => accept(q)}
                                            disabled={busy === q.id}
                                            className="px-3 py-1.5 text-[12px] bg-success text-white rounded-lg hover:bg-success/90 disabled:opacity-50 font-semibold"
                                        >
                                            {busy === q.id ? 'Working…' : 'Accept'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                <Section title="Recently decided" subtitle="Accepted or rejected in the last review">
                    {decided.length === 0 ? (
                        <p className="text-[13px] text-ink-500">No decisions made yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {decided.map((q) => (
                                <div key={q.id} className="bg-white rounded-lg border border-ink-200 p-3 flex items-center gap-3 text-[13px]">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_CFG[q.status] ?? 'bg-ink-100 text-ink-700'}`}>
                                        {q.status}
                                    </span>
                                    <span className="font-mono text-[12px] text-ink-500">{q.reference}</span>
                                    <span className="flex-1 truncate">{q.job_title} · {q.contractor}</span>
                                    <span className="font-mono font-semibold">{fmtMoney(q.total)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>
            </div>
        </AgencyLayout>
    );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <section className="mb-6">
            <div className="mb-3">
                <h2 className="text-base font-bold">{title}</h2>
                {subtitle && <p className="text-[12px] text-ink-500">{subtitle}</p>}
            </div>
            {children}
        </section>
    );
}
