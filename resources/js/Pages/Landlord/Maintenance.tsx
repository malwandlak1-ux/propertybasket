import { Head } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';

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
        <div className="bg-ink-100/50 rounded-xl p-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3 px-1">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <p className="text-[12px] font-semibold uppercase tracking-wide">{title}</p>
                <span className="text-[11px] bg-white px-1.5 py-0.5 rounded-full font-bold ml-1">{count}</span>
            </div>

            <div className="space-y-2">
                {items.length === 0 ? (
                    <div className="bg-white/60 rounded-lg p-4 text-center text-[11px] text-ink-400">
                        No items
                    </div>
                ) : items.map((item) => (
                    <div
                        key={item.id}
                        className={`bg-white rounded-lg p-3 shadow-soft border border-ink-200 ${BORDER_CFG[item.urgency] ? `border-l-2 ${BORDER_CFG[item.urgency]}` : ''}`}
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
                            <div className="flex items-center gap-1.5 mb-2 bg-ink-50 rounded p-1.5">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-[8px] font-bold">
                                    {item.contractor.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                                </div>
                                <span className="text-[10px] font-semibold truncate">{item.contractor}</span>
                            </div>
                        )}

                        {item.status === 'open' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                                <button className="py-1.5 text-[10px] bg-ink-900 text-white rounded font-semibold hover:bg-ink-800 transition">Assign</button>
                                <button className="py-1.5 text-[10px] border border-ink-200 rounded font-semibold hover:bg-ink-50 transition">Get Quotes</button>
                            </div>
                        )}
                        {item.status === 'completed' && (
                            <button className="w-full mt-1 py-1.5 text-[10px] border border-ink-200 rounded font-semibold hover:bg-ink-50 transition">Review invoice</button>
                        )}
                        {item.status === 'paid' && item.completed_at && (
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-[10px] text-ink-500">{item.completed_at}</span>
                                <button className="text-[10px] text-brand-600 font-semibold">Rate ⭐</button>
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

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Maintenance</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Tenant requests across your portfolio · {total} total
                        </p>
                    </div>
                </div>

                {/* Emergency banner */}
                <div className="bg-danger/5 border-2 border-danger/30 rounded-xl p-4 mb-6 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-danger/20 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-[13px] font-bold text-danger">No active emergencies</p>
                        <p className="text-[12px] text-ink-700 mt-0.5">
                            If a tenant logs an emergency, you can assign an available contractor immediately (4-hour SLA).
                        </p>
                    </div>
                </div>

                {/* Kanban board */}
                <div className="flex gap-3 min-h-[460px] overflow-x-auto pb-2">
                    <KanbanColumn title="Open"        color="bg-warning"    items={grouped.open}        count={counts.open} />
                    <KanbanColumn title="In Progress" color="bg-brand-500"  items={grouped.in_progress} count={counts.in_progress} />
                    <KanbanColumn title="Completed"   color="bg-success"    items={grouped.completed}   count={counts.completed} />
                    <KanbanColumn title="Paid"        color="bg-emerald-700" items={grouped.paid}       count={counts.paid} />
                </div>
            </div>
        </LandlordLayout>
    );
}
