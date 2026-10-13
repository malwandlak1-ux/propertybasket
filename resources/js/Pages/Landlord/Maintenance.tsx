import { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';
import { PageHeader } from '@/Components/Dashboard/Charts';
import Icon from '@/Components/Dashboard/Icon';
import { Spinner } from '@/Components/Skeleton';
import RateContractorModal, { StarRow } from '@/Components/RateContractorModal';
import InviteContractorModal from '@/Components/InviteContractorModal';

type Line = { label: string; qty: number; unit_price: number; line_total: number };

type Quote = {
    id: number;
    reference: string;
    contractor: string;
    status: 'sent' | 'accepted' | 'rejected';
    lines: Line[];
    subtotal: number;
    vat: number;
    total: number;
    notes: string | null;
    sent_at: string | null;
    valid_until: string | null;
};

type Invoice = {
    id: number;
    reference: string;
    status: string;
    lines: Line[];
    subtotal: number;
    vat: number;
    total: number;
    quote_total: number | null;
    deviation: number;
    deviation_notes: string | null;
    submitted_at: string | null;
    paid_at: string | null;
    bank: { bank: string; holder: string; account: string; branch: string; type: string } | null;
};

type Stage = 'needs_contractor' | 'awaiting_quote' | 'quote_review' | 'scheduling' | 'in_progress' | 'awaiting_invoice' | 'invoice_review' | 'paid';

type MaintItem = {
    id: number;
    title: string;
    description: string;
    category: string;
    urgency: 'emergency' | 'high' | 'medium' | 'low';
    status: string;
    stage: Stage;
    property: string | null;
    tenant_name: string | null;
    tenant_phone: string | null;
    contractor: string | null;
    photos: string[];
    photos_count: number;
    preferred: string | null;
    created_at: string;
    completed_at: string | null;
    pending_quotes: number;
    quotes: Quote[];
    invoice: Invoice | null;
    can_rate: boolean;
    my_rating: number | null;
};

type ContractorOption = {
    id: number;
    business_name: string | null;
    contact_name: string | null;
    specialities: string[];
    average_rating: number;
    total_jobs: number;
    invited: boolean;
};

type Grouped = { open: MaintItem[]; in_progress: MaintItem[]; completed: MaintItem[]; paid: MaintItem[] };

type Props = {
    landlord: { id: number; name: string };
    grouped: Grouped;
    counts: Record<string, number>;
    contractors: { mine: ContractorOption[]; market: ContractorOption[]; marketplace_enabled: boolean };
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

const URGENCY_CFG = {
    emergency: { label: 'EMERGENCY', cls: 'bg-danger/15 text-danger' },
    high:      { label: 'HIGH',      cls: 'bg-orange-100 text-orange-700' },
    medium:    { label: 'MEDIUM',    cls: 'bg-warning/15 text-warning' },
    low:       { label: 'LOW',       cls: 'bg-ink-100 text-ink-600' },
};

const BORDER_CFG: Record<string, string> = {
    emergency: 'border-l-danger',
    high:      'border-l-orange-500',
    medium:    'border-l-warning',
    low:       '',
};

const STAGE_CFG: Record<Stage, { label: string; cls: string }> = {
    needs_contractor: { label: 'Needs a contractor',  cls: 'bg-danger/10 text-danger' },
    awaiting_quote:   { label: 'Waiting for quote',    cls: 'bg-warning/15 text-amber-700' },
    quote_review:     { label: 'Quote to review',      cls: 'bg-brand-50 text-brand-700' },
    scheduling:       { label: 'Quote accepted',       cls: 'bg-success/15 text-success' },
    in_progress:      { label: 'Work under way',       cls: 'bg-brand-50 text-brand-700' },
    awaiting_invoice: { label: 'Waiting for invoice',  cls: 'bg-warning/15 text-amber-700' },
    invoice_review:   { label: 'Invoice to pay',       cls: 'bg-brand-50 text-brand-700' },
    paid:             { label: 'Paid',                 cls: 'bg-success/15 text-success' },
};

const fmtR = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pillPrimary = 'w-full py-1.5 text-[11.5px] bg-brand-700 text-white rounded-full font-semibold hover:bg-brand-800 transition';
const pillOutline = 'w-full py-1.5 text-[11.5px] border border-ink-300 rounded-full font-semibold hover:bg-ink-50 transition';

type Modal =
    | { kind: 'assign'; item: MaintItem }
    | { kind: 'quotes'; item: MaintItem }
    | { kind: 'invoice'; item: MaintItem }
    | { kind: 'rate'; item: MaintItem }
    | { kind: 'details'; item: MaintItem }
    | { kind: 'invite' }
    | null;

export default function LandlordMaintenance({ grouped, counts, contractors }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [modal, setModal] = useState<Modal>(null);
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    const emergencies = [...grouped.open, ...grouped.in_progress].filter((i) => i.urgency === 'emergency').length;
    const toReview = [...grouped.open, ...grouped.completed].filter((i) => i.stage === 'quote_review' || i.stage === 'invoice_review').length;

    return (
        <LandlordLayout crumb="Maintenance" section="Workspace" openMaint={counts.open + counts.in_progress}>
            <Head title="Maintenance" />

            <div className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Maintenance"
                    subtitle={<>Tenant requests across your portfolio · {total} total</>}
                    actions={
                        <Link href="/landlord/contractors" className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2.5 text-[13px] font-semibold hover:bg-ink-50 shadow-soft">
                            <Icon name="wrench" className="w-4 h-4" />My contractors ({contractors.mine.length})
                        </Link>
                    }
                />

                {flash?.success && <div className="mb-4 rounded-2xl bg-success/10 border border-success/30 text-success px-5 py-3 text-[13px] font-medium">{flash.success}</div>}
                {flash?.error && <div className="mb-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger px-5 py-3 text-[13px] font-medium">{flash.error}</div>}

                {/* Summary tiles */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="pb-swirl rounded-2xl p-5 text-white shadow-lift pb-rise">
                        <p className="text-[13px] font-medium">Open</p>
                        <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{counts.open ?? 0}</p>
                        <p className="text-[12px] text-white/80 mt-2">{toReview > 0 ? `${toReview} need${toReview === 1 ? 's' : ''} your review` : 'Getting quotes'}</p>
                    </div>
                    {[
                        { label: 'In progress', value: counts.in_progress ?? 0, sub: 'Contractor on the job' },
                        { label: 'Completed', value: counts.completed ?? 0, sub: 'Invoice to settle' },
                        { label: 'Paid', value: counts.paid ?? 0, sub: 'Closed out' },
                    ].map((t) => (
                        <div key={t.label} className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                            <p className="text-[13px] font-medium text-ink-700">{t.label}</p>
                            <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{t.value}</p>
                            <p className="text-[12px] text-ink-500 mt-2">{t.sub}</p>
                        </div>
                    ))}
                </div>

                {emergencies > 0 ? (
                    <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 mb-4 flex items-center gap-4">
                        <span className="w-10 h-10 rounded-full bg-danger/20 text-danger flex items-center justify-center shrink-0"><Icon name="alert" className="w-5 h-5" /></span>
                        <div className="flex-1">
                            <p className="text-[13.5px] font-semibold text-danger">{emergencies} active emergenc{emergencies === 1 ? 'y' : 'ies'}</p>
                            <p className="text-[12.5px] text-ink-700 mt-0.5">Request a quote from a contractor immediately. Emergencies carry a 4-hour response SLA.</p>
                        </div>
                    </div>
                ) : contractors.mine.length === 0 ? (
                    <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 mb-4 flex flex-wrap items-center gap-4">
                        <span className="w-10 h-10 rounded-full bg-white text-brand-700 flex items-center justify-center shrink-0 shadow-soft"><Icon name="wrench" className="w-5 h-5" /></span>
                        <div className="flex-1 min-w-[200px]">
                            <p className="text-[13.5px] font-semibold">Add your contractors first</p>
                            <p className="text-[12.5px] text-ink-600 mt-0.5">Invite the plumber, electrician or handyman you use. You can then request quotes from them on any tenant request.</p>
                        </div>
                        <button type="button" onClick={() => setModal({ kind: 'invite' })} className="px-4 py-2 text-[12.5px] bg-brand-700 text-white rounded-full font-semibold hover:bg-brand-800">Invite contractor</button>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-ink-200/60 bg-white shadow-soft p-4 mb-4 flex items-center gap-4">
                        <span className="w-10 h-10 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" /></svg>
                        </span>
                        <div className="flex-1">
                            <p className="text-[13.5px] font-semibold">No active emergencies</p>
                            <p className="text-[12.5px] text-ink-500 mt-0.5">If a tenant logs an emergency it appears here first (4-hour response SLA).</p>
                        </div>
                    </div>
                )}

                {/* Kanban board */}
                <div className="flex gap-3 min-h-[420px] overflow-x-auto pb-2">
                    <KanbanColumn title="Open"        color="bg-warning"     items={grouped.open}        count={counts.open}        onOpen={setModal} />
                    <KanbanColumn title="In Progress" color="bg-brand-500"   items={grouped.in_progress} count={counts.in_progress} onOpen={setModal} />
                    <KanbanColumn title="Completed"   color="bg-success"     items={grouped.completed}   count={counts.completed}   onOpen={setModal} />
                    <KanbanColumn title="Paid"        color="bg-emerald-700" items={grouped.paid}        count={counts.paid}        onOpen={setModal} />
                </div>
            </div>

            {modal?.kind === 'assign' && (
                <AssignModal item={modal.item} contractors={contractors} onClose={() => setModal(null)} onInvite={() => setModal({ kind: 'invite' })} />
            )}
            {modal?.kind === 'quotes' && <QuotesModal item={modal.item} onClose={() => setModal(null)} />}
            {modal?.kind === 'invoice' && <InvoiceModal item={modal.item} onClose={() => setModal(null)} />}
            {modal?.kind === 'details' && <DetailsModal item={modal.item} onClose={() => setModal(null)} />}
            {modal?.kind === 'invite' && <InviteContractorModal onClose={() => setModal(null)} />}
            {modal?.kind === 'rate' && (
                <RateContractorModal
                    rateUrl={`/landlord/maintenance/${modal.item.id}/rate`}
                    contractorName={modal.item.contractor}
                    jobTitle={modal.item.title}
                    onClose={() => setModal(null)}
                />
            )}
        </LandlordLayout>
    );
}

function KanbanColumn({ title, color, items, count, onOpen }: {
    title: string; color: string; items: MaintItem[]; count: number; onOpen: (m: Modal) => void;
}) {
    return (
        <div className="bg-white/60 border border-ink-200/60 rounded-2xl p-3 flex-1 min-w-[250px]">
            <div className="flex items-center gap-2 mb-3 px-1">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <p className="text-[13px] font-semibold">{title}</p>
                <span className="text-[11px] bg-ink-100 px-2 py-0.5 rounded-full font-bold ml-auto">{count}</span>
            </div>

            <div className="space-y-2">
                {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-ink-200 p-5 text-center text-[11.5px] text-ink-400">No items</div>
                ) : items.map((item) => <JobCard key={item.id} item={item} onOpen={onOpen} />)}
            </div>
        </div>
    );
}

function JobCard({ item, onOpen }: { item: MaintItem; onOpen: (m: Modal) => void }) {
    const u = URGENCY_CFG[item.urgency];
    const stage = STAGE_CFG[item.stage];

    return (
        <div className={`bg-white rounded-xl p-3.5 shadow-soft border border-ink-200/70 ${BORDER_CFG[item.urgency] ? `border-l-2 ${BORDER_CFG[item.urgency]}` : ''}`}>
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${u.cls}`}>{u.label}</span>
                <span className="text-[9px] text-ink-500 uppercase tracking-wide font-semibold">{item.category}</span>
                <span className={`text-[9.5px] px-2 py-0.5 rounded-full font-semibold ml-auto ${stage.cls}`}>{stage.label}</span>
            </div>

            <button type="button" onClick={() => onOpen({ kind: 'details', item })} className="text-left w-full">
                <p className="text-[13px] font-semibold mb-1 leading-snug hover:text-brand-700">{item.title}</p>
            </button>
            {(item.property || item.tenant_name) && (
                <p className="text-[10.5px] text-ink-500 mb-1.5">{[item.property, item.tenant_name].filter(Boolean).join(' · ')}</p>
            )}
            <p className="text-[10.5px] text-ink-400 mb-2">
                Logged {item.created_at}{item.photos_count > 0 && ` · ${item.photos_count} photo${item.photos_count !== 1 ? 's' : ''}`}
            </p>

            {item.contractor && (
                <div className="flex items-center gap-1.5 mb-2 bg-ink-50 rounded-lg p-1.5">
                    <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center text-[8px] font-bold">
                        {item.contractor.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                    </div>
                    <span className="text-[10.5px] font-semibold truncate">{item.contractor}</span>
                </div>
            )}

            <CardActions item={item} onOpen={onOpen} />
        </div>
    );
}

function CardActions({ item, onOpen }: { item: MaintItem; onOpen: (m: Modal) => void }) {
    switch (item.stage) {
        case 'needs_contractor':
            return <button type="button" onClick={() => onOpen({ kind: 'assign', item })} className={pillPrimary}>Request a quote</button>;
        case 'awaiting_quote':
            return (
                <div className="space-y-1.5">
                    <p className="text-[10.5px] text-ink-500">Waiting for {item.contractor ?? 'the contractor'} to send a quote.</p>
                    <button type="button" onClick={() => onOpen({ kind: 'assign', item })} className={pillOutline}>Ask someone else</button>
                </div>
            );
        case 'quote_review':
            return <button type="button" onClick={() => onOpen({ kind: 'quotes', item })} className={pillPrimary}>Review quote{item.pending_quotes > 1 ? `s (${item.pending_quotes})` : ''}</button>;
        case 'scheduling':
            return (
                <div className="space-y-1.5">
                    <p className="text-[10.5px] text-ink-500">Quote accepted. The contractor will schedule the work.</p>
                    <button type="button" onClick={() => onOpen({ kind: 'quotes', item })} className={pillOutline}>View quote</button>
                </div>
            );
        case 'in_progress':
            return item.quotes.length > 0 ? <button type="button" onClick={() => onOpen({ kind: 'quotes', item })} className={pillOutline}>View quote</button> : null;
        case 'awaiting_invoice':
            return (
                <div className="space-y-1.5">
                    <p className="text-[10.5px] text-ink-500">Work done. Waiting for the contractor's invoice.</p>
                    <RateButton item={item} onOpen={onOpen} />
                </div>
            );
        case 'invoice_review':
            return (
                <div className="space-y-1.5">
                    <button type="button" onClick={() => onOpen({ kind: 'invoice', item })} className={pillPrimary}>Review invoice · {fmtR(item.invoice?.total ?? 0)}</button>
                    <RateButton item={item} onOpen={onOpen} />
                </div>
            );
        case 'paid':
            return (
                <div className="flex items-center justify-between gap-2 mt-1">
                    {item.invoice ? (
                        <button type="button" onClick={() => onOpen({ kind: 'invoice', item })} className="text-[10.5px] text-ink-500 hover:text-brand-700 font-semibold">
                            {item.invoice.reference} · {fmtR(item.invoice.total)}
                        </button>
                    ) : <span className="text-[10.5px] text-ink-500">{item.completed_at}</span>}
                    <RateButton item={item} onOpen={onOpen} compact />
                </div>
            );
    }
}

function RateButton({ item, onOpen, compact = false }: { item: MaintItem; onOpen: (m: Modal) => void; compact?: boolean }) {
    if (! item.can_rate) return null;
    if (item.my_rating) {
        return <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-500">You rated <StarRow rating={item.my_rating} /></span>;
    }
    return compact
        ? <button type="button" onClick={() => onOpen({ kind: 'rate', item })} className="text-[10.5px] text-brand-700 font-semibold">Rate contractor</button>
        : <button type="button" onClick={() => onOpen({ kind: 'rate', item })} className={pillOutline}>Rate contractor</button>;
}

function ModalShell({ title, subtitle, onClose, children, wide = false }: {
    title: string; subtitle?: string | null; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
            <div className={`relative bg-white rounded-2xl shadow-card w-full ${wide ? 'max-w-2xl' : 'max-w-xl'} max-h-[88vh] flex flex-col`}>
                <div className="p-5 border-b border-ink-100 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
                        {subtitle && <p className="text-[12px] text-ink-500 mt-0.5 truncate">{subtitle}</p>}
                    </div>
                    <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700 text-xl leading-none">×</button>
                </div>
                <div className="p-5 overflow-y-auto flex-1">{children}</div>
            </div>
        </div>
    );
}

function AssignModal({ item, contractors, onClose, onInvite }: {
    item: MaintItem; contractors: Props['contractors']; onClose: () => void; onInvite: () => void;
}) {
    const [tab, setTab] = useState<'mine' | 'market'>('mine');
    const [busy, setBusy] = useState<number | null>(null);
    const list = tab === 'mine' ? contractors.mine : contractors.market;

    function assign(c: ContractorOption) {
        setBusy(c.id);
        router.post(`/landlord/maintenance/${item.id}/assign`, { contractor_id: c.id }, {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onFinish: () => setBusy(null),
        });
    }

    return (
        <ModalShell title="Request a quote" subtitle={`${item.title} · ${item.property ?? ''}`} onClose={onClose}>
            {contractors.marketplace_enabled && (
                <div className="flex gap-1 mb-4">
                    {(['mine', 'market'] as const).map((t) => (
                        <button key={t} type="button" onClick={() => setTab(t)} className={`px-3.5 py-1.5 text-[12px] font-semibold rounded-full transition ${tab === t ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>
                            {t === 'mine' ? `My contractors (${contractors.mine.length})` : `Marketplace (${contractors.market.length})`}
                        </button>
                    ))}
                </div>
            )}

            <div className="space-y-2">
                {list.length === 0 ? (
                    <div className="text-center py-6">
                        <p className="text-[13px] text-ink-500">{tab === 'mine' ? "You haven't added any contractors yet." : 'No marketplace contractors available right now.'}</p>
                    </div>
                ) : list.map((c) => (
                    <div key={c.id} className="border border-ink-200 rounded-xl p-3.5 flex items-center gap-3 hover:border-brand-300 transition">
                        <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Icon name="wrench" className="w-4 h-4" /></span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold truncate">{c.business_name ?? c.contact_name ?? 'Contractor'}</p>
                            <p className="text-[11px] text-ink-500 truncate">
                                {c.specialities.length > 0 ? c.specialities.join(', ') : 'General'}
                                {c.total_jobs > 0 && <> · <span className="text-warning">★</span> {c.average_rating.toFixed(1)}</>}
                            </p>
                            {c.invited && <p className="text-[10.5px] text-amber-700 mt-0.5">Hasn't set up their account yet. They'll see the job once they do.</p>}
                        </div>
                        <button type="button" onClick={() => assign(c)} disabled={busy !== null} className="px-3.5 py-1.5 text-[12px] bg-brand-700 text-white rounded-full font-semibold hover:bg-brand-800 disabled:opacity-50 shrink-0 inline-flex items-center gap-1.5">
                            {busy === c.id && <Spinner size={11} />}{busy === c.id ? 'Sending…' : 'Request quote'}
                        </button>
                    </div>
                ))}
            </div>

            {tab === 'mine' && (
                <button type="button" onClick={onInvite} className="mt-4 w-full rounded-xl border-2 border-dashed border-ink-200 hover:border-brand-400 hover:bg-brand-50/40 text-ink-500 hover:text-brand-700 py-3 text-[12.5px] font-semibold transition">
                    + Invite a new contractor
                </button>
            )}
        </ModalShell>
    );
}

function Lines({ lines, subtotal, vat, total }: { lines: Line[]; subtotal: number; vat: number; total: number }) {
    return (
        <div className="rounded-xl border border-ink-200/70 overflow-hidden">
            <table className="w-full text-[12.5px]">
                <thead className="bg-ink-50 text-ink-500 text-[11px] uppercase tracking-wide">
                    <tr><th className="text-left px-3 py-2 font-semibold">Item</th><th className="text-right px-3 py-2 font-semibold">Qty</th><th className="text-right px-3 py-2 font-semibold">Price</th><th className="text-right px-3 py-2 font-semibold">Total</th></tr>
                </thead>
                <tbody>
                    {lines.map((l, i) => (
                        <tr key={i} className="border-t border-ink-100">
                            <td className="px-3 py-2">{l.label}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{l.qty}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtR(l.unit_price)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtR(l.line_total)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="border-t border-ink-200 text-[12.5px]">
                    <tr><td colSpan={3} className="px-3 pt-2 text-right text-ink-500">Subtotal</td><td className="px-3 pt-2 text-right tabular-nums">{fmtR(subtotal)}</td></tr>
                    {vat > 0 && <tr><td colSpan={3} className="px-3 text-right text-ink-500">VAT (15%)</td><td className="px-3 text-right tabular-nums">{fmtR(vat)}</td></tr>}
                    <tr><td colSpan={3} className="px-3 pb-2 pt-1 text-right font-semibold">Total</td><td className="px-3 pb-2 pt-1 text-right tabular-nums font-semibold text-[14px]">{fmtR(total)}</td></tr>
                </tfoot>
            </table>
        </div>
    );
}

function QuotesModal({ item, onClose }: { item: MaintItem; onClose: () => void }) {
    const [busy, setBusy] = useState<string | null>(null);

    function act(q: Quote, action: 'accept' | 'reject') {
        if (action === 'accept' && ! confirm(`Accept ${q.reference} for ${fmtR(q.total)}? Any other quotes on this job will be declined.`)) return;
        setBusy(`${action}-${q.id}`);
        router.post(`/landlord/maintenance/quotes/${q.id}/${action}`, {}, {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onFinish: () => setBusy(null),
        });
    }

    const STATUS: Record<Quote['status'], string> = {
        sent: 'bg-brand-50 text-brand-700',
        accepted: 'bg-success/15 text-success',
        rejected: 'bg-ink-100 text-ink-500',
    };

    return (
        <ModalShell title="Quotes" subtitle={`${item.title} · ${item.property ?? ''}`} onClose={onClose} wide>
            {item.quotes.length === 0 ? (
                <p className="text-[13px] text-ink-500 text-center py-6">No quotes yet.</p>
            ) : (
                <div className="space-y-5">
                    {item.quotes.map((q) => (
                        <div key={q.id} className={q.status === 'rejected' ? 'opacity-60' : ''}>
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div>
                                    <p className="text-[14px] font-semibold">{q.contractor}</p>
                                    <p className="text-[11.5px] text-ink-500">{q.reference}{q.sent_at && ` · sent ${q.sent_at}`}{q.valid_until && ` · valid to ${q.valid_until}`}</p>
                                </div>
                                <span className={`text-[10.5px] px-2.5 py-1 rounded-full font-semibold capitalize ${STATUS[q.status]}`}>{q.status === 'sent' ? 'Awaiting you' : q.status}</span>
                            </div>
                            <Lines lines={q.lines} subtotal={q.subtotal} vat={q.vat} total={q.total} />
                            {q.notes && <p className="text-[12px] text-ink-600 mt-2 bg-ink-50 rounded-xl px-3 py-2">{q.notes}</p>}
                            {q.status === 'sent' && (
                                <div className="flex justify-end gap-2 mt-3">
                                    <button type="button" onClick={() => act(q, 'reject')} disabled={busy !== null} className="px-4 py-2 text-[12.5px] rounded-full border border-ink-200 font-semibold hover:bg-ink-50 disabled:opacity-50">
                                        {busy === `reject-${q.id}` ? 'Rejecting…' : 'Reject'}
                                    </button>
                                    <button type="button" onClick={() => act(q, 'accept')} disabled={busy !== null} className="px-4 py-2 text-[12.5px] rounded-full bg-brand-700 text-white font-semibold hover:bg-brand-800 disabled:opacity-50 inline-flex items-center gap-1.5">
                                        {busy === `accept-${q.id}` && <Spinner size={12} />}Accept {fmtR(q.total)}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </ModalShell>
    );
}

function InvoiceModal({ item, onClose }: { item: MaintItem; onClose: () => void }) {
    const inv = item.invoice;
    const [busy, setBusy] = useState(false);
    if (! inv) return null;

    function markPaid() {
        if (! inv || ! confirm(`Confirm you have paid ${fmtR(inv.total)} to ${item.contractor ?? 'the contractor'}? This closes the job.`)) return;
        setBusy(true);
        router.post(`/landlord/maintenance/invoices/${inv.id}/paid`, {}, {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onFinish: () => setBusy(false),
        });
    }

    const paid = inv.status === 'paid';

    return (
        <ModalShell title={`Invoice ${inv.reference}`} subtitle={`${item.contractor ?? 'Contractor'} · ${item.title}`} onClose={onClose} wide>
            <div className="space-y-4">
                <Lines lines={inv.lines} subtotal={inv.subtotal} vat={inv.vat} total={inv.total} />

                {inv.quote_total !== null && (
                    Math.abs(inv.deviation) > 0.01 ? (
                        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[12.5px]">
                            <p className="font-semibold text-amber-800">
                                {inv.deviation > 0 ? fmtR(inv.deviation) + ' more' : fmtR(Math.abs(inv.deviation)) + ' less'} than the accepted quote ({fmtR(inv.quote_total)})
                            </p>
                            {inv.deviation_notes && <p className="text-ink-700 mt-1">Contractor's reason: {inv.deviation_notes}</p>}
                        </div>
                    ) : (
                        <p className="text-[12.5px] text-success font-semibold">Matches the accepted quote ({fmtR(inv.quote_total)}).</p>
                    )
                )}

                {paid ? (
                    <div className="rounded-xl bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px] font-semibold">Paid on {inv.paid_at}</div>
                ) : (
                    <>
                        <div className="rounded-xl border border-ink-200/70 p-4">
                            <p className="text-[12px] font-semibold text-ink-700 mb-2">Pay by EFT to</p>
                            {inv.bank ? (
                                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
                                    <dt className="text-ink-500">Account holder</dt><dd className="font-medium">{inv.bank.holder}</dd>
                                    <dt className="text-ink-500">Bank</dt><dd className="font-medium">{inv.bank.bank}</dd>
                                    <dt className="text-ink-500">Account number</dt><dd className="font-medium tabular-nums">{inv.bank.account}</dd>
                                    <dt className="text-ink-500">Branch code</dt><dd className="font-medium tabular-nums">{inv.bank.branch}</dd>
                                    <dt className="text-ink-500">Reference</dt><dd className="font-medium">{inv.reference}</dd>
                                </dl>
                            ) : (
                                <p className="text-[12.5px] text-amber-700">The contractor hasn't added banking details yet. Ask them for their account, or to add it in their portal.</p>
                            )}
                        </div>
                        <div className="flex justify-end">
                            <button type="button" onClick={markPaid} disabled={busy} className="px-4 py-2.5 text-[13px] rounded-full bg-brand-700 text-white font-semibold hover:bg-brand-800 disabled:opacity-50 inline-flex items-center gap-2 shadow-soft">
                                {busy && <Spinner size={13} />}I've paid this invoice
                            </button>
                        </div>
                    </>
                )}
            </div>
        </ModalShell>
    );
}

function DetailsModal({ item, onClose }: { item: MaintItem; onClose: () => void }) {
    const [photo, setPhoto] = useState<string | null>(null);
    return (
        <ModalShell title={item.title} subtitle={item.property} onClose={onClose}>
            <div className="space-y-4 text-[13px]">
                <p className="text-ink-700 whitespace-pre-wrap">{item.description || 'No description given.'}</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
                    <dt className="text-ink-500">Tenant</dt><dd className="font-medium">{item.tenant_name ?? '—'}{item.tenant_phone && ` · ${item.tenant_phone}`}</dd>
                    <dt className="text-ink-500">Urgency</dt><dd className="font-medium capitalize">{item.urgency}</dd>
                    <dt className="text-ink-500">Category</dt><dd className="font-medium capitalize">{item.category}</dd>
                    <dt className="text-ink-500">Preferred visit</dt><dd className="font-medium">{item.preferred ?? 'Any time'}</dd>
                    <dt className="text-ink-500">Status</dt><dd className="font-medium">{STAGE_CFG[item.stage].label}</dd>
                    {item.contractor && <><dt className="text-ink-500">Contractor</dt><dd className="font-medium">{item.contractor}</dd></>}
                </dl>
                {item.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {item.photos.map((src, i) => (
                            <button key={i} type="button" onClick={() => setPhoto(src)} className="w-20 h-20 rounded-xl overflow-hidden border border-ink-200 hover:ring-2 hover:ring-brand-300">
                                <img src={src} alt="" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {photo && (
                <div className="fixed inset-0 z-[60] bg-ink-900/80 grid place-items-center p-6" onClick={() => setPhoto(null)}>
                    <img src={photo} alt="" className="max-w-full max-h-full rounded-xl" />
                </div>
            )}
        </ModalShell>
    );
}
