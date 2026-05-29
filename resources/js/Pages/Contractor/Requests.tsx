import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import ContractorLayout from '@/Layouts/ContractorLayout';
import RequestDetailsModal, { RequestDetails, RequestStage } from '@/Components/RequestDetailsModal';

type Req = RequestDetails;

type Props = {
    counts: { requests?: number; active_jobs?: number; messages?: number };
    assigned: Req[];
    marketplace: Req[];
    specialities: string[];
    vat_registered: boolean;
    vat_rate: number;
};

const URGENCY_CFG: Record<string, string> = {
    emergency: 'bg-danger text-white',
    high:      'bg-warning/15 text-warning',
    medium:    'bg-amber-50 text-amber-700',
    low:       'bg-ink-100 text-ink-600',
};

const STAGE_CFG: Record<RequestStage, { cls: string; label: string }> = {
    marketplace:       { cls: 'bg-brand-50 text-brand-700',     label: 'Marketplace' },
    needs_quote:       { cls: 'bg-warning/15 text-warning',     label: 'Needs quote' },
    awaiting_approval: { cls: 'bg-amber-50 text-amber-700',     label: 'Awaiting approval' },
    quote_accepted:    { cls: 'bg-success/15 text-success',     label: 'Quote accepted' },
    quote_rejected:    { cls: 'bg-danger/15 text-danger',       label: 'Quote rejected' },
};

function Card({ req, onView }: { req: Req; onView: () => void }) {
    return (
        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft hover:shadow-card transition">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${URGENCY_CFG[req.urgency] ?? 'bg-ink-100 text-ink-600'}`}>
                    {req.urgency}
                </span>
                <span className="text-[10px] text-ink-500 uppercase font-semibold">{req.category}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ml-auto ${STAGE_CFG[req.stage].cls}`}>
                    {STAGE_CFG[req.stage].label}
                </span>
            </div>
            <p className="text-[14px] font-bold mb-1">{req.title}</p>
            {req.description && <p className="text-[12px] text-ink-600 mb-2 line-clamp-2">{req.description}</p>}

            <div className="grid grid-cols-2 gap-2 text-[11px] text-ink-500 mb-3">
                <div>📍 {req.property}{req.address && <span className="block text-ink-400">{req.address}</span>}</div>
                <div>👤 {req.tenant}</div>
                <div>📅 {req.preferred ?? 'No date'}{req.time_slot && ` · ${req.time_slot}`}</div>
                <div>📸 {req.photo_count} {req.photo_count === 1 ? 'photo' : 'photos'}</div>
            </div>

            {req.my_quote && (
                <div className="bg-ink-50 rounded-md px-2 py-1.5 mb-3 text-[11px] flex items-center justify-between">
                    <span className="font-mono text-ink-500">{req.my_quote.reference}</span>
                    <span className="font-mono font-semibold">R {req.my_quote.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                </div>
            )}

            <div className="flex items-center gap-2 pt-3 border-t border-ink-100">
                <button
                    onClick={onView}
                    className="flex-1 py-1.5 text-[12px] bg-ink-900 text-white rounded-md font-semibold hover:bg-ink-800 transition"
                >
                    {req.stage === 'marketplace'       ? 'View & claim'
                  : req.stage === 'needs_quote'        ? 'View & quote'
                  : req.stage === 'awaiting_approval'  ? 'View details'
                  : req.stage === 'quote_accepted'    ? 'View & schedule'
                  : req.stage === 'quote_rejected'    ? 'View & re-quote'
                  : 'View details'}
                </button>
                {req.kind === 'assigned' && req.stage === 'needs_quote' && (
                    <button
                        onClick={() => {
                            if (! confirm('Return this job to the marketplace?')) return;
                            router.post(`/contractor/requests/${req.id}/decline`, {}, { preserveScroll: true });
                        }}
                        className="px-3 py-1.5 text-[12px] border border-ink-200 rounded-md font-semibold hover:bg-ink-50 transition"
                    >
                        Decline
                    </button>
                )}
            </div>
        </div>
    );
}

export default function ContractorRequests({ counts, assigned, marketplace, specialities, vat_registered, vat_rate }: Props) {
    const [openId, setOpenId] = useState<number | null>(null);
    const openReq = [...assigned, ...marketplace].find((r) => r.id === openId) ?? null;

    return (
        <ContractorLayout crumb="Job Requests" counts={counts}>
            <Head title="Job Requests" />

            <div className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Job Requests</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {assigned.length} assigned to you · {marketplace.length} available in marketplace
                            {specialities.length > 0 && <> · filtered by your specialities ({specialities.join(', ')})</>}
                        </p>
                    </div>
                </div>

                {/* Workflow callout */}
                <div className="bg-brand-50/40 border border-brand-100 rounded-xl p-3 mb-6 text-[12px] text-ink-700 flex items-start gap-2">
                    <svg className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                    </svg>
                    <span>
                        <strong>Workflow:</strong> View the job details and photos → submit a quote → wait for the agency to approve it → then schedule the work.
                    </span>
                </div>

                <section className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                        <h2 className="text-[14px] font-bold uppercase tracking-wide">Assigned to you</h2>
                        <span className="text-[11px] bg-danger/15 text-danger px-2 py-0.5 rounded-full font-bold">{assigned.length}</span>
                    </div>
                    {assigned.length === 0 ? (
                        <div className="bg-white rounded-xl border border-ink-200 p-8 text-center shadow-soft">
                            <p className="text-[13px] text-ink-500">No direct job assignments right now</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {assigned.map((r) => <Card key={r.id} req={r} onView={() => setOpenId(r.id)} />)}
                        </div>
                    )}
                </section>

                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full bg-brand-500" />
                        <h2 className="text-[14px] font-bold uppercase tracking-wide">Marketplace</h2>
                        <span className="text-[11px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-bold">{marketplace.length}</span>
                    </div>
                    {marketplace.length === 0 ? (
                        <div className="bg-white rounded-xl border border-ink-200 p-8 text-center shadow-soft">
                            <p className="text-[13px] text-ink-500">No open marketplace jobs in your specialities</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {marketplace.map((r) => <Card key={r.id} req={r} onView={() => setOpenId(r.id)} />)}
                        </div>
                    )}
                </section>
            </div>

            {openReq && (
                <RequestDetailsModal
                    req={openReq}
                    vatRegistered={vat_registered}
                    vatRate={vat_rate}
                    onClose={() => setOpenId(null)}
                />
            )}
        </ContractorLayout>
    );
}
