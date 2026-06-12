import { useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import RateContractorModal, { StarRow } from '@/Components/RateContractorModal';

/**
 * Shared maintenance-request management board used by the Agency and Agent
 * dashboards. Lists every request with tenant photos, and lets the user
 * request a quotation from a specific contractor (own roster or marketplace)
 * or post the job to the open marketplace.
 */

export type MaintRequest = {
    id: number;
    title: string;
    description: string | null;
    category: string;
    urgency: string;
    status: string;
    stage: 'new' | 'allocated' | 'in_progress' | 'done';
    photos: string[];
    photo_count: number;
    tenant: string;
    tenant_phone: string | null;
    property: string;
    suburb: string | null;
    preferred: string | null;
    time_slot: string | null;
    contractor: string | null;
    quote_count: number;
    created: string;
    can_rate: boolean;
    my_rating: number | null;
};

export type ContractorOption = {
    id: number;
    business_name: string | null;
    contact_name: string | null;
    specialities: string[];
    service_areas: string[];
    average_rating: number;
    total_jobs: number;
};

type Props = {
    requests: MaintRequest[];
    /** Omitted on the agent dashboard — allocation is agency-only. */
    contractors?: { mine: ContractorOption[]; market: ContractorOption[] };
    baseUrl: string; // '/agency/maintenance' or '/agent/maintenance'
    quotesUrl?: string | null;
    /** false renders a read-only workflow view (agent dashboard). */
    canAllocate?: boolean;
    /** Rating is for the agency (and tenant page) — false on the agent view. */
    canRate?: boolean;
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

const URGENCY_CFG: Record<string, string> = {
    emergency: 'bg-danger text-white',
    high:      'bg-warning/20 text-warning',
    medium:    'bg-amber-50 text-amber-700',
    low:       'bg-ink-100 text-ink-600',
};

const STAGE_CFG: Record<MaintRequest['stage'], { cls: string; label: string }> = {
    new:         { cls: 'bg-danger/15 text-danger',   label: 'Needs allocation' },
    allocated:   { cls: 'bg-warning/15 text-warning', label: 'Awaiting quote' },
    in_progress: { cls: 'bg-brand-50 text-brand-700', label: 'In progress' },
    done:        { cls: 'bg-success/15 text-success', label: 'Completed' },
};

export default function MaintenanceBoard({ requests, contractors, baseUrl, quotesUrl, canAllocate = true, canRate = true }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [allocating, setAllocating] = useState<MaintRequest | null>(null);
    const [rating, setRating] = useState<MaintRequest | null>(null);
    const [lightbox, setLightbox] = useState<string | null>(null);

    const open = requests.filter((r) => r.stage === 'new');
    const allocated = requests.filter((r) => r.stage === 'allocated');
    const inProgress = requests.filter((r) => r.stage === 'in_progress');
    const done = requests.filter((r) => r.stage === 'done');

    return (
        <div className="px-8 py-7">
            <div className="flex items-end justify-between mb-6 gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Maintenance</h1>
                    <p className="text-[14px] text-ink-500 mt-1">
                        {open.length} unallocated · {allocated.length} awaiting quotes · {inProgress.length} in progress
                    </p>
                </div>
                {quotesUrl && (
                    <a href={quotesUrl} className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 font-semibold transition">
                        Review quotes →
                    </a>
                )}
            </div>

            {flash?.success && (
                <div className="mb-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                    {flash.success}
                </div>
            )}

            {! canAllocate && (
                <div className="mb-4 rounded-lg bg-ink-100/70 border border-ink-200 text-ink-600 px-4 py-3 text-[12px]">
                    Contractor allocation is handled by your agency — this view tracks each job through allocation, quoting, and completion.
                </div>
            )}

            {requests.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-ink-300 p-12 text-center">
                    <p className="text-[13px] text-ink-500">No maintenance requests yet. Tenant submissions will land here.</p>
                </div>
            ) : (
                <>
                    <Section title="Needs allocation" items={open} onAllocate={canAllocate ? setAllocating : null} onRate={canRate ? setRating : null} onPhoto={setLightbox} baseUrl={baseUrl} accent />
                    <Section title="Awaiting quotes" items={allocated} onAllocate={canAllocate ? setAllocating : null} onRate={canRate ? setRating : null} onPhoto={setLightbox} baseUrl={baseUrl} />
                    <Section title="In progress" items={inProgress} onAllocate={null} onRate={canRate ? setRating : null} onPhoto={setLightbox} baseUrl={baseUrl} />
                    <Section title="Completed" items={done} onAllocate={null} onRate={canRate ? setRating : null} onPhoto={setLightbox} baseUrl={baseUrl} />
                </>
            )}

            {allocating && contractors && (
                <AllocateModal
                    request={allocating}
                    contractors={contractors}
                    baseUrl={baseUrl}
                    onClose={() => setAllocating(null)}
                />
            )}

            {rating && (
                <RateContractorModal
                    rateUrl={`${baseUrl}/${rating.id}/rate`}
                    contractorName={rating.contractor}
                    jobTitle={rating.title}
                    onClose={() => setRating(null)}
                />
            )}

            {lightbox && (
                <div className="fixed inset-0 z-50 bg-ink-900/80 grid place-items-center p-6" onClick={() => setLightbox(null)}>
                    <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl shadow-card" />
                </div>
            )}
        </div>
    );
}

function Section({
    title,
    items,
    onAllocate,
    onRate,
    onPhoto,
    baseUrl,
    accent = false,
}: {
    title: string;
    items: MaintRequest[];
    onAllocate: ((r: MaintRequest) => void) | null;
    onRate: ((r: MaintRequest) => void) | null;
    onPhoto: (src: string) => void;
    baseUrl: string;
    accent?: boolean;
}) {
    if (items.length === 0) return null;
    return (
        <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
                {accent && <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />}
                <h2 className="text-[14px] font-bold uppercase tracking-wide">{title}</h2>
                <span className="text-[11px] bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full font-bold">{items.length}</span>
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
                {items.map((r) => (
                    <Card key={r.id} r={r} onAllocate={onAllocate} onRate={onRate} onPhoto={onPhoto} baseUrl={baseUrl} />
                ))}
            </div>
        </section>
    );
}

function Card({
    r,
    onAllocate,
    onRate,
    onPhoto,
    baseUrl,
}: {
    r: MaintRequest;
    onAllocate: ((r: MaintRequest) => void) | null;
    onRate: ((r: MaintRequest) => void) | null;
    onPhoto: (src: string) => void;
    baseUrl: string;
}) {
    const [busy, setBusy] = useState(false);

    function postToMarketplace() {
        if (! confirm('Post this job to the open contractor marketplace? All matching area contractors will be able to quote.')) return;
        setBusy(true);
        router.post(`${baseUrl}/${r.id}/marketplace`, {}, { preserveScroll: true, onFinish: () => setBusy(false) });
    }

    return (
        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${URGENCY_CFG[r.urgency] ?? 'bg-ink-100 text-ink-600'}`}>
                    {r.urgency}
                </span>
                <span className="text-[10px] text-ink-500 uppercase font-semibold">{r.category}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ml-auto ${STAGE_CFG[r.stage].cls}`}>
                    {STAGE_CFG[r.stage].label}
                </span>
            </div>

            <p className="text-[14px] font-bold">{r.title}</p>
            {r.description && <p className="text-[12px] text-ink-600 mt-1 line-clamp-2">{r.description}</p>}

            <div className="grid grid-cols-2 gap-2 text-[11px] text-ink-500 mt-3">
                <div>📍 {r.property}{r.suburb && <span className="text-ink-400"> · {r.suburb}</span>}</div>
                <div>👤 {r.tenant}{r.tenant_phone && <span className="text-ink-400"> · {r.tenant_phone}</span>}</div>
                <div>📅 {r.preferred ?? 'No date'}{r.time_slot && ` · ${r.time_slot}`}</div>
                <div>🕐 {r.created}</div>
            </div>

            {r.photos.length > 0 && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {r.photos.slice(0, 5).map((src, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onPhoto(src)}
                            className="w-14 h-14 rounded-lg overflow-hidden border border-ink-200 hover:ring-2 hover:ring-brand/40 transition"
                        >
                            <img src={src} alt="" className="w-full h-full object-cover" />
                        </button>
                    ))}
                    {r.photos.length > 5 && (
                        <span className="text-[11px] text-ink-500">+{r.photos.length - 5} more</span>
                    )}
                </div>
            )}

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-ink-100 flex-wrap">
                {r.contractor && (
                    <span className="text-[11px] text-ink-600 mr-auto">
                        Allocated to <span className="font-semibold">{r.contractor}</span>
                        {r.quote_count > 0 && <span className="text-ink-400"> · {r.quote_count} quote{r.quote_count === 1 ? '' : 's'}</span>}
                    </span>
                )}
                {! r.contractor && r.stage === 'new' && (
                    <span className="text-[11px] text-ink-400 mr-auto">No contractor allocated yet</span>
                )}
                {onAllocate && (
                    <>
                        <button
                            onClick={() => onAllocate(r)}
                            className="px-3 py-1.5 text-[12px] bg-ink-900 text-white rounded-md font-semibold hover:bg-ink-800 transition"
                        >
                            {r.contractor ? 'Re-allocate' : 'Request quote'}
                        </button>
                        <button
                            onClick={postToMarketplace}
                            disabled={busy}
                            className="px-3 py-1.5 text-[12px] border border-ink-200 rounded-md font-semibold hover:bg-ink-50 disabled:opacity-50 transition"
                        >
                            Post to marketplace
                        </button>
                    </>
                )}
                {onRate !== null && r.can_rate && (
                    r.my_rating ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-600">
                            You rated <StarRow rating={r.my_rating} />
                        </span>
                    ) : (
                        <button
                            onClick={() => onRate(r)}
                            className="px-3 py-1.5 text-[12px] bg-warning/15 text-warning rounded-md font-bold hover:bg-warning/25 transition"
                        >
                            ★ Rate contractor
                        </button>
                    )
                )}
            </div>
        </div>
    );
}

function AllocateModal({
    request,
    contractors,
    baseUrl,
    onClose,
}: {
    request: MaintRequest;
    contractors: { mine: ContractorOption[]; market: ContractorOption[] };
    baseUrl: string;
    onClose: () => void;
}) {
    const [tab, setTab] = useState<'mine' | 'market'>(contractors.mine.length > 0 ? 'mine' : 'market');
    const [busy, setBusy] = useState<number | null>(null);

    const list = tab === 'mine' ? contractors.mine : contractors.market;

    function assign(c: ContractorOption) {
        setBusy(c.id);
        router.post(`${baseUrl}/${request.id}/assign`, { contractor_id: c.id }, {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onFinish: () => setBusy(null),
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-card w-full max-w-xl max-h-[85vh] flex flex-col">
                <div className="p-5 border-b border-ink-200 flex items-start justify-between">
                    <div>
                        <h2 className="text-[17px] font-bold">Request a quotation</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">
                            {request.title} · {request.property}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-ink-400 hover:text-ink-700 text-xl leading-none">×</button>
                </div>

                <div className="px-5 pt-4 flex gap-1">
                    <TabBtn active={tab === 'mine'} onClick={() => setTab('mine')}>
                        My contractors ({contractors.mine.length})
                    </TabBtn>
                    <TabBtn active={tab === 'market'} onClick={() => setTab('market')}>
                        Marketplace ({contractors.market.length})
                    </TabBtn>
                </div>

                <div className="p-5 overflow-y-auto flex-1 space-y-2">
                    {list.length === 0 ? (
                        <p className="text-[13px] text-ink-500 text-center py-6">
                            {tab === 'mine'
                                ? 'You haven\'t added any private contractors yet — check the marketplace tab.'
                                : 'No marketplace contractors available right now.'}
                        </p>
                    ) : (
                        list.map((c) => (
                            <div key={c.id} className="border border-ink-200 rounded-xl p-3.5 flex items-center gap-3 hover:border-brand-300 transition">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold truncate">{c.business_name ?? c.contact_name ?? '—'}</p>
                                    <p className="text-[11px] text-ink-500 truncate">
                                        {c.specialities.length > 0 ? c.specialities.join(', ') : 'General'}
                                        {c.service_areas.length > 0 && <> · {c.service_areas.join(', ')}</>}
                                    </p>
                                    <p className="text-[11px] text-ink-400 mt-0.5">
                                        ⭐ {c.average_rating.toFixed(1)} · {c.total_jobs} job{c.total_jobs === 1 ? '' : 's'} completed
                                    </p>
                                </div>
                                <button
                                    onClick={() => assign(c)}
                                    disabled={busy !== null}
                                    className="px-3 py-1.5 text-[12px] bg-ink-900 text-white rounded-md font-semibold hover:bg-ink-800 disabled:opacity-50 shrink-0 transition"
                                >
                                    {busy === c.id ? 'Sending…' : 'Request quote'}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`px-3.5 py-2 text-[12px] font-bold rounded-t-lg border-b-2 transition ${
                active ? 'border-brand-500 text-brand-700 bg-brand-50/50' : 'border-transparent text-ink-500 hover:text-ink-800'
            }`}
        >
            {children}
        </button>
    );
}
