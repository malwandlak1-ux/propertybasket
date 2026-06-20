import { Head, router } from '@inertiajs/react';
import ContractorLayout from '@/Layouts/ContractorLayout';

type Job = {
    id: number;
    title: string;
    category: string;
    urgency: string;
    property: string;
    tenant: string;
    agency: string;
    when: string;
    time_slot: string | null;
    completed: string | null;
    invoice: null | { id: number; status: string; total: number };
};

type Column = {
    key: string;
    label: string;
    tone: 'warning' | 'brand' | 'success' | 'emerald';
    jobs: Job[];
};

type Props = {
    counts: { requests?: number; active_jobs?: number; messages?: number };
    columns: Column[];
};

const TONE_DOT: Record<Column['tone'], string> = {
    warning: 'bg-warning',
    brand:   'bg-brand-500',
    success: 'bg-success',
    emerald: 'bg-emerald-700',
};

const URGENCY_CFG: Record<string, string> = {
    emergency: 'bg-danger/15 text-danger',
    high:      'bg-warning/15 text-warning',
    medium:    'bg-amber-50 text-amber-700',
    low:       'bg-ink-100 text-ink-600',
};

function fmtMoney(n: number) {
    return `R ${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

function JobCard({ job, columnKey }: { job: Job; columnKey: string }) {
    const isPaid = columnKey === 'paid';
    const isCompleted = columnKey === 'completed';
    const isToCommence = columnKey === 'to_commence';
    const isInProgress = columnKey === 'in_progress';

    function start() {
        router.post(`/contractor/jobs/${job.id}/start`, {}, { preserveScroll: true });
    }
    function complete() {
        router.post(`/contractor/jobs/${job.id}/complete`, {}, { preserveScroll: true });
    }

    return (
        <div className={
            'rounded-lg p-3 shadow-soft border cursor-grab ' +
            (isPaid
                ? 'bg-success/5 border-success/30'
                : isInProgress
                    ? 'bg-white border-brand-200 border-l-2 border-l-brand-500'
                    : 'bg-white border-ink-200')
        }>
            <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`text-[9px] px-1 rounded font-bold ${URGENCY_CFG[job.urgency] ?? 'bg-ink-100 text-ink-600'}`}>
                    {job.urgency.toUpperCase()}
                </span>
                <span className="text-[9px] text-ink-500 uppercase">{job.category}</span>
            </div>

            <p className="text-[13px] font-semibold mb-1">{job.title}</p>
            <p className="text-[10px] text-ink-500 mb-2">{job.property} · {job.tenant}</p>

            <div className="flex items-center justify-between text-[10px] mb-2">
                <span className="text-ink-500">
                    {isPaid ? `Paid ${job.completed ?? ''}`
                        : isCompleted ? `Done ${job.completed ?? ''}`
                        : `📅 ${job.when}${job.time_slot ? ` ${job.time_slot.split(' ')[0]}` : ''}`}
                </span>
                <span className={isPaid ? 'text-success font-bold' : 'text-brand-600 font-semibold'}>
                    {job.agency}
                </span>
            </div>

            {/* Actions */}
            {isToCommence && (
                <button onClick={start} className="w-full mt-1 py-1.5 text-[11px] bg-brand-500 text-white rounded font-semibold hover:bg-brand-600 transition">
                    Start Job →
                </button>
            )}
            {isInProgress && (
                <button onClick={complete} className="w-full mt-1 py-1.5 text-[11px] bg-success text-white rounded font-semibold hover:bg-success/90 transition">
                    Mark Completed →
                </button>
            )}
            {isCompleted && !job.invoice && (
                <button className="w-full mt-1 py-1.5 text-[11px] bg-ink-900 text-white rounded font-semibold hover:bg-brand-500 transition">
                    Send Invoice →
                </button>
            )}
            {isCompleted && job.invoice && (
                <span className="block text-center mt-1 text-[10px] px-2 py-1 rounded bg-warning/15 text-warning font-bold uppercase">
                    Inv {job.invoice.status}
                </span>
            )}
            {isPaid && (
                <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] font-mono font-bold text-success">{job.invoice ? fmtMoney(job.invoice.total) : '—'}</span>
                    <div className="text-warning text-[12px]">★★★★★</div>
                </div>
            )}
        </div>
    );
}

export default function ContractorJobs({ counts, columns }: Props) {
    return (
        <ContractorLayout crumb="Active Jobs" counts={counts}>
            <Head title="Active Jobs" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Active Jobs</h1>
                        <p className="text-[14px] text-ink-500 mt-1">Update status as you progress through each job</p>
                    </div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 min-h-[500px] snap-x lg:grid lg:grid-cols-4 lg:overflow-visible">
                    {columns.map((col) => (
                        <div key={col.key} className="bg-ink-100/50 rounded-xl p-3 shrink-0 snap-start w-[82vw] sm:w-[300px] lg:w-auto lg:shrink">
                            <div className="flex items-center justify-between mb-3 px-1">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${TONE_DOT[col.tone]}`} />
                                    <p className="text-[12px] font-semibold uppercase tracking-wide">{col.label}</p>
                                    <span className="text-[11px] bg-white px-1.5 py-0.5 rounded-full font-bold">{col.jobs.length}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {col.jobs.length === 0 ? (
                                    <p className="text-[11px] text-ink-400 text-center py-6">Nothing here</p>
                                ) : col.jobs.map((j) => <JobCard key={j.id} job={j} columnKey={col.key} />)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </ContractorLayout>
    );
}
