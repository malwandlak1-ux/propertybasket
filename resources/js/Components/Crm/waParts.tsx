import { ReactNode, useState } from 'react';

export type CampaignRow = {
    id: number; name: string; template: string; status: string; pause_reason: string | null; total: number;
    queued: number; sent: number; delivered: number; read: number; replied: number; failed: number; skipped: number;
    created_at: string | null; scheduled_at: string | null;
};

const CAMPAIGN_TONE: Record<string, string> = {
    queued: 'bg-ink-100 text-ink-600',
    sending: 'bg-brand-50 text-brand-700',
    paused: 'bg-warning/15 text-amber-700',
    completed: 'bg-success/15 text-success',
    cancelled: 'bg-ink-100 text-ink-500',
};

export function CampaignStatus({ status }: { status: string }) {
    return <span className={`text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${CAMPAIGN_TONE[status] ?? 'bg-ink-100 text-ink-600'}`}>{status}</span>;
}

const QUALITY: Record<string, [string, string]> = {
    GREEN: ['High', 'bg-success/15 text-success'],
    YELLOW: ['Medium', 'bg-warning/15 text-amber-700'],
    RED: ['Low', 'bg-danger/15 text-danger'],
};

export function Quality({ rating }: { rating: string | null }) {
    const [label, cls] = QUALITY[(rating ?? '').toUpperCase()] ?? ['Unknown', 'bg-ink-100 text-ink-500'];
    return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

const MSG_TONE: Record<string, string> = {
    queued: 'text-ink-500', sent: 'text-ink-700', delivered: 'text-sky-700', read: 'text-success',
    failed: 'text-danger', skipped: 'text-ink-400', received: 'text-violet-700',
};
export const msgTone = (s: string) => MSG_TONE[s] ?? 'text-ink-600';

export function CopyField({ label, value }: { label: string; value: string }) {
    const [ok, setOk] = useState(false);
    return (
        <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1">{label}</p>
            <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2">
                <code className="flex-1 min-w-0 text-[12px] truncate">{value}</code>
                <button type="button" className="text-[12px] font-semibold text-brand-700 hover:underline shrink-0"
                    onClick={() => navigator.clipboard.writeText(value).then(() => { setOk(true); setTimeout(() => setOk(false), 1400); })}>
                    {ok ? 'Copied ✓' : 'Copy'}
                </button>
            </div>
        </div>
    );
}

export function Progress({ c }: { c: CampaignRow }) {
    const pct = (n: number) => (c.total ? Math.round((n / c.total) * 100) : 0);
    return (
        <div className="h-2 rounded-full bg-ink-100 overflow-hidden flex" title={`${c.read} read · ${c.delivered - c.read} delivered · ${c.sent - c.delivered} sent · ${c.failed} failed`}>
            <span className="bg-success" style={{ width: `${pct(c.read)}%` }} />
            <span className="bg-sky-500" style={{ width: `${pct(c.delivered - c.read)}%` }} />
            <span className="bg-brand-400" style={{ width: `${pct(c.sent - c.delivered)}%` }} />
            <span className="bg-danger" style={{ width: `${pct(c.failed)}%` }} />
        </div>
    );
}

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
    return (
        <li className="flex gap-3">
            <span className="w-7 h-7 rounded-full bg-brand-700 text-white text-[12px] font-bold flex items-center justify-center shrink-0">{n}</span>
            <div className="min-w-0 pt-0.5">
                <p className="text-[13.5px] font-semibold">{title}</p>
                <div className="text-[12.5px] text-ink-600 mt-0.5 space-y-1">{children}</div>
            </div>
        </li>
    );
}
