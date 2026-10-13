import { Head } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';
import { PageHeader } from '@/Components/Dashboard/Charts';
import Icon from '@/Components/Dashboard/Icon';

type MaintItem = {
    id: number;
    title: string;
    description: string;
    category: string;
    urgency: 'emergency' | 'high' | 'medium' | 'low';
    status: string;
    property: string | null;
    tenant_name: string | null;
    contractor: string | null;
    photos_count: number;
    created_at: string;
    completed_at: string | null;
};

type Grouped = {
    open: MaintItem[];
    in_progress: MaintItem[];
    completed: MaintItem[];
    paid: MaintItem[];
};

type Props = {
    landlord: { id: number; name: string };
    grouped: Grouped;
    counts: Record<string, number>;
};

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

function UrgencyBadge({ urgency }: { urgency: MaintItem['urgency'] }) {
    const cfg = URGENCY_CFG[urgency];
    return <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${cfg.cls}`}>{cfg.label}</span>;
}

function CategoryBadge({ category }: { category: string }) {
    return <span className="text-[9px] text-ink-500 uppercase tracking-wide font-semibold">{category}</span>;
}

function KanbanColumn({ title, color, items, count }: {
    title: string; color: string; items: MaintItem[]; count: number;
}) {
    return (
        <div className="bg-white/60 border border-ink-200/60 rounded-2xl p-3 flex-1 min-w-[230px]">
            <div className="flex items-center gap-2 mb-3 px-1">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <p className="text-[13px] font-semibold">{title}</p>
                <span className="text-[11px] bg-ink-100 px-2 py-0.5 rounded-full font-bold ml-auto">{count}</span>
            </div>

            <div className="space-y-2">
                {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-ink-200 p-5 text-center text-[11.5px] text-ink-400">
                        No items
                    </div>
                ) : items.map((item) => (
                    <div
                        key={item.id}
                        className={`bg-white rounded-xl p-3.5 shadow-soft border border-ink-200/70 ${BORDER_CFG[item.urgency] ? `border-l-2 ${BORDER_CFG[item.urgency]}` : ''}`}
                    >
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <UrgencyBadge urgency={item.urgency} />
                            <CategoryBadge category={item.category} />
                        </div>

                        <p className="text-[13px] font-semibold mb-1 leading-snug">{item.title}</p>
                        {item.property && item.tenant_name && (
                            <p className="text-[10px] text-ink-500 mb-1.5">
                                {item.property} · {item.tenant_name}
                            </p>
                        )}
                        {item.photos_count > 0 && (
                            <p className="text-[10px] text-ink-400 mb-2">
                                Logged {item.created_at} · {item.photos_count} photo{item.photos_count !== 1 ? 's' : ''}
                            </p>
                        )}
                        {!item.photos_count && (
                            <p className="text-[10px] text-ink-400 mb-2">Logged {item.created_at}</p>
                        )}

                        {item.contractor && (
                            <div className="flex items-center gap-1.5 mb-2 bg-ink-50 rounded-lg p-1.5">
                                <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center text-[8px] font-bold">
                                    {item.contractor.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                                </div>
                                <span className="text-[10px] font-semibold truncate">{item.contractor}</span>
                            </div>
                        )}

                        {item.status === 'open' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                                <button className="py-1.5 text-[11px] bg-brand-700 text-white rounded-full font-semibold hover:bg-brand-800 transition">Assign</button>
                                <button className="py-1.5 text-[11px] border border-ink-300 rounded-full font-semibold hover:bg-ink-50 transition">Get quotes</button>
                            </div>
                        )}
                        {item.status === 'completed' && (
                            <button className="w-full mt-1 py-1.5 text-[11px] border border-ink-300 rounded-full font-semibold hover:bg-ink-50 transition">Review invoice</button>
                        )}
                        {item.status === 'paid' && item.completed_at && (
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-[10px] text-ink-500">{item.completed_at}</span>
                                <button className="text-[10px] text-brand-600 font-semibold">Rate contractor</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function LandlordMaintenance({ landlord, grouped, counts }: Props) {
    const total = Object.values(counts).reduce((s, v) => s + v, 0);

    return (
        <LandlordLayout crumb="Maintenance" section="Workspace" openMaint={counts.open + counts.in_progress}>
            <Head title="Maintenance" />

            <div className="px-4 sm:px-7 py-6">
                <PageHeader title="Maintenance" subtitle={<>Tenant requests across your portfolio · {total} total</>} />

                {/* Summary tiles */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="pb-swirl rounded-2xl p-5 text-white shadow-lift pb-rise">
                        <p className="text-[13px] font-medium">Open</p>
                        <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{counts.open ?? 0}</p>
                        <p className="text-[12px] text-white/80 mt-2">Waiting for a contractor</p>
                    </div>
                    {[
                        { label: 'In progress', value: counts.in_progress ?? 0, sub: 'Contractor on the job' },
                        { label: 'Completed', value: counts.completed ?? 0, sub: 'Awaiting invoice payment' },
                        { label: 'Paid', value: counts.paid ?? 0, sub: 'Closed out' },
                    ].map((t) => (
                        <div key={t.label} className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                            <p className="text-[13px] font-medium text-ink-700">{t.label}</p>
                            <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{t.value}</p>
                            <p className="text-[12px] text-ink-500 mt-2">{t.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Emergency status — red only when there actually is one */}
                {(grouped.open.filter((i) => i.urgency === 'emergency').length + grouped.in_progress.filter((i) => i.urgency === 'emergency').length) > 0 ? (
                    <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 mb-4 flex items-center gap-4">
                        <span className="w-10 h-10 rounded-full bg-danger/20 text-danger flex items-center justify-center shrink-0"><Icon name="alert" className="w-5 h-5" /></span>
                        <div className="flex-1">
                            <p className="text-[13.5px] font-semibold text-danger">{grouped.open.filter((i) => i.urgency === 'emergency').length + grouped.in_progress.filter((i) => i.urgency === 'emergency').length} active emergenc{(grouped.open.filter((i) => i.urgency === 'emergency').length + grouped.in_progress.filter((i) => i.urgency === 'emergency').length) === 1 ? 'y' : 'ies'}</p>
                            <p className="text-[12.5px] text-ink-700 mt-0.5">Assign a contractor immediately — emergencies carry a 4-hour response SLA.</p>
                        </div>
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
                    <KanbanColumn title="Open"        color="bg-warning"    items={grouped.open}        count={counts.open} />
                    <KanbanColumn title="In Progress" color="bg-brand-500"  items={grouped.in_progress} count={counts.in_progress} />
                    <KanbanColumn title="Completed"   color="bg-success"    items={grouped.completed}   count={counts.completed} />
                    <KanbanColumn title="Paid"        color="bg-emerald-700" items={grouped.paid}       count={counts.paid} />
                </div>
            </div>
        </LandlordLayout>
    );
}
