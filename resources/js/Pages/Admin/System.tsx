import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';

type HealthItem = {
    name: string;
    status: 'healthy' | 'warning' | 'down';
    uptime: string;
    latency: string;
    detail: string;
};

type Incident = {
    id: number;
    severity: 'resolved' | 'investigating' | 'major';
    title: string;
    summary: string;
    started_at: string;
    duration: string;
};

type Props = {
    health: HealthItem[];
    incidents: Incident[];
};

const STATUS_COLORS = {
    healthy: { dot: 'bg-success', text: 'text-success', bg: 'bg-success/15' },
    warning: { dot: 'bg-warning', text: 'text-warning', bg: 'bg-warning/15' },
    down:    { dot: 'bg-danger',  text: 'text-danger',  bg: 'bg-danger/15' },
};

export default function AdminSystem({ health, incidents }: Props) {
    const overallStatus = health.some((h) => h.status === 'down') ? 'down' :
                          health.some((h) => h.status === 'warning') ? 'warning' :
                          'healthy';
    const overall = STATUS_COLORS[overallStatus];
    const overallLabel = overallStatus === 'healthy' ? 'All systems operational' :
                         overallStatus === 'warning' ? 'Partial degradation' :
                         'Major outage';

    return (
        <AdminLayout crumb="System Health" section="System">
            <Head title="System Health" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Real-time status of platform components and recent incidents
                        </p>
                    </div>
                    <div className={`flex items-center gap-2 px-3.5 py-2 rounded-lg ${overall.bg}`}>
                        <span className={`w-2 h-2 rounded-full animate-pulse ${overall.dot}`} />
                        <span className={`text-[12px] font-bold uppercase ${overall.text}`}>{overallLabel}</span>
                    </div>
                </div>

                {/* Health grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    {health.map((h) => {
                        const c = STATUS_COLORS[h.status];
                        return (
                            <div key={h.name} className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[13px] font-semibold">{h.name}</p>
                                    <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase ${c.text}`}>
                                        <span className={`w-2 h-2 rounded-full animate-pulse ${c.dot}`} />
                                        {h.status}
                                    </span>
                                </div>
                                <p className="text-[11px] text-ink-500 mb-3 min-h-[16px]">{h.detail}</p>
                                <div className="flex items-center justify-between text-[11px] pt-3 border-t border-ink-100">
                                    <div>
                                        <p className="text-ink-400 text-[10px] uppercase tracking-wider">Uptime</p>
                                        <p className="font-mono font-semibold mt-0.5">{h.uptime}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-ink-400 text-[10px] uppercase tracking-wider">Latency</p>
                                        <p className="font-mono font-semibold mt-0.5">{h.latency}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Recent incidents */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                    <div className="p-5 border-b border-ink-200 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-semibold">Recent Incidents</h2>
                            <p className="text-xs text-ink-500 mt-0.5">Last 30 days</p>
                        </div>
                        <button className="text-[12px] text-brand-600 font-semibold hover:underline">Full history →</button>
                    </div>

                    {incidents.length === 0 ? (
                        <div className="p-10 text-center text-[13px] text-ink-400">
                            No incidents reported in the last 30 days
                        </div>
                    ) : (
                        <div className="divide-y divide-ink-100">
                            {incidents.map((i) => (
                                <div key={i.id} className="p-5 hover:bg-ink-50/50 transition">
                                    <div className="flex items-start gap-3 mb-2">
                                        <span className={
                                            'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ' +
                                            (i.severity === 'resolved' ? 'bg-success/15 text-success' :
                                             i.severity === 'investigating' ? 'bg-warning/15 text-warning' :
                                             'bg-danger/15 text-danger')
                                        }>
                                            {i.severity}
                                        </span>
                                        <p className="text-[14px] font-semibold flex-1">{i.title}</p>
                                        <span className="text-[11px] text-ink-500">{i.duration}</span>
                                    </div>
                                    <p className="text-[12px] text-ink-600 mb-1">{i.summary}</p>
                                    <p className="text-[11px] text-ink-400">{i.started_at}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
