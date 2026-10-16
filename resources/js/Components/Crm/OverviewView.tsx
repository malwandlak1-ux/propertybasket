import { FormEvent, useState } from 'react';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import {
    AreaChart, Card, Donut, FlashBanners, KpiCard, PageHeader, Segmented, btnOutline, btnPrimary, thRowCls,
} from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';
import CrmTabs from './CrmTabs';
import { Activity, CHANNEL, CHANNELS, ChannelKey, OUTCOME, STATUS, StatusKey } from './constants';

export type OverviewData = {
    days: number;
    kpis: {
        touches: number; touches_prev: number; connected: number; appointments: number; deals_sent: number;
        prospects: number; worked: number; worked_pct: number; warm: number;
    };
    channels: { key: ChannelKey; label: string; attempts: number; connected: number; positive: number; appointments: number; connect_rate: number }[];
    trend: { labels: string[]; series: number[]; previous: number[] };
    funnel: { key: StatusKey; label: string; count: number }[];
    follow_ups: { id: number; owner: string; unit: string | null; scheme_id: number; scheme: string | null; suburb: string | null; status: StatusKey; next_action: string; agent: string | null }[];
    recent: Activity[];
    pipeline: { label: string; count: number }[];
};

export type LeaderRow = {
    id: number; name: string; calls: number; whatsapp: number; sms: number; email: number; other: number;
    touches: number; connected: number; appointments: number; prospects: number; worked: number; deals: number;
};

const CORE: ChannelKey[] = ['call', 'whatsapp', 'sms', 'email'];
const CH_COLORS: Record<ChannelKey, string> = {
    call: 'var(--color-brand-800)', whatsapp: '#25A55F', sms: 'var(--color-brand-500)', email: '#3B82F6',
    social: '#8B5CF6', letter: '#F59E0B', door: '#14B8A6', referral: '#EC4899', other: '#A69E93',
};

export default function OverviewView({ base, data, mode, agents, agentId, leaderboard }: {
    base: string;
    data: OverviewData;
    mode: 'agent' | 'agency';
    agents?: { id: number; name: string }[];
    agentId?: number | null;
    leaderboard?: LeaderRow[];
}) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const [logOpen, setLogOpen] = useState(false);
    const k = data.kpis;
    const diff = k.touches_prev > 0 ? Math.round(((k.touches - k.touches_prev) / k.touches_prev) * 100) : null;
    const connectRate = k.touches > 0 ? Math.round((k.connected / k.touches) * 100) : 0;
    const shownChannels = data.channels.filter((c) => CORE.includes(c.key) || c.attempts > 0);
    const mix = data.channels.filter((c) => c.attempts > 0);
    const funnelMax = Math.max(1, ...data.funnel.map((f) => f.count));
    const farmingHref = (schemeId: number) => `${base}/farming?scheme=${schemeId}${agentId ? `&agent=${agentId}` : ''}`;

    function setRange(r: string) {
        router.get(base, { range: r, ...(agentId ? { agent: agentId } : {}) }, { preserveScroll: true, preserveState: true });
    }

    return (
        <div className="px-4 sm:px-7 py-6">
            <PageHeader
                title="CRM"
                subtitle={mode === 'agent'
                    ? 'Your outreach, farming prospects and deals in one place'
                    : 'Outreach, farming and deals across your agents (view only)'}
                actions={<>
                    <Segmented
                        options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]}
                        value={String(data.days)}
                        onChange={setRange}
                    />
                    {mode === 'agent' && (
                        <button type="button" onClick={() => setLogOpen(true)} className={btnPrimary}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
                            Log outreach
                        </button>
                    )}
                </>}
            />

            <CrmTabs base={base} active="overview" agents={agents} agentId={agentId} />
            <FlashBanners flash={flash} />

            {/* ── KPI tiles ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <KpiCard
                    hero
                    label="Outreach touches"
                    value={k.touches.toLocaleString('en-ZA')}
                    delta={diff !== null ? { value: `${Math.abs(diff)}%`, up: diff >= 0, label: `vs previous ${data.days} days` } : undefined}
                    sub={diff === null ? `Last ${data.days} days` : undefined}
                />
                <KpiCard label="Conversations" value={k.connected.toLocaleString('en-ZA')} sub={`${connectRate}% of touches connected`} />
                <KpiCard label="Appraisals booked" value={k.appointments.toLocaleString('en-ZA')} sub={`${k.deals_sent} sent to the pipeline`} href={`${base}/pipeline${agentId ? `?agent_id=${agentId}` : ''}`} />
                <KpiCard label="Prospects worked" value={`${k.worked_pct}%`} sub={`${k.worked.toLocaleString('en-ZA')} of ${k.prospects.toLocaleString('en-ZA')} owners · ${k.warm} warm`} href={`${base}/farming${agentId ? `?agent=${agentId}` : ''}`} />
            </div>

            {/* ── Per-channel stats ─────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {shownChannels.map((c) => (
                    <div key={c.key} className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-4 pb-rise min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CH_COLORS[c.key] }} />
                            <p className="text-[13px] font-semibold text-ink-700 truncate">{c.label}</p>
                        </div>
                        <p className="text-[28px] font-semibold tracking-tight leading-none tabular-nums mt-3">{c.attempts.toLocaleString('en-ZA')}</p>
                        <div className="mt-3 pt-3 border-t border-ink-100 grid grid-cols-3 gap-1 text-center">
                            <MiniStat label="Connected" value={c.connected} />
                            <MiniStat label="Rate" value={`${c.connect_rate}%`} />
                            <MiniStat label="Appraisals" value={c.appointments} />
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Trend + channel mix ───────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <Card className="lg:col-span-2" title="Outreach activity" subtitle={`Touches per day · last ${data.days} days vs the ${data.days} before`}>
                    <AreaChart labels={data.trend.labels} series={data.trend.series} previous={data.trend.previous} seriesLabel="This period" previousLabel="Previous period" height={230} />
                </Card>
                <Card title="Channel mix" subtitle="Share of touches">
                    {mix.length ? (
                        <Donut
                            segments={mix.map((c) => ({ label: c.label, value: c.attempts, color: CH_COLORS[c.key], display: c.attempts.toLocaleString('en-ZA') }))}
                            centerValue={k.touches.toLocaleString('en-ZA')}
                            centerLabel="touches"
                        />
                    ) : (
                        <Empty text={mode === 'agent' ? 'Log calls, WhatsApps, SMSes and emails to see your channel mix.' : 'No outreach logged in this period.'} />
                    )}
                </Card>
            </div>

            {/* ── Funnel + pipeline ─────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <Card className="lg:col-span-2" title="Prospect funnel" subtitle="Every farmed owner by contact status">
                    {k.prospects === 0 ? (
                        <Empty text="No farming prospects yet. Add a scheme under Farming and import its owner register." />
                    ) : (
                        <ul className="space-y-2.5">
                            {data.funnel.map((f) => (
                                <li key={f.key} className="flex items-center gap-3 text-[12.5px]">
                                    <span className="w-32 shrink-0 text-ink-600 font-medium">{f.label}</span>
                                    <span className="flex-1 h-2.5 bg-ink-100 rounded-full overflow-hidden">
                                        <span className="block h-full rounded-full pb-grow" style={{ width: `${(f.count / funnelMax) * 100}%`, background: STATUS[f.key].color }} />
                                    </span>
                                    <span className="w-12 text-right font-semibold tabular-nums">{f.count.toLocaleString('en-ZA')}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                <Card
                    title="Pipeline"
                    subtitle="Open deals by stage"
                    action={<Link href={`${base}/pipeline${agentId ? `?agent_id=${agentId}` : ''}`} className="text-[12px] font-semibold text-brand-700 hover:underline">Open →</Link>}
                >
                    <ul className="divide-y divide-ink-100">
                        {data.pipeline.map((s) => (
                            <li key={s.label} className="flex items-center justify-between py-2.5 text-[13px]">
                                <span className="text-ink-600">{s.label}</span>
                                <span className="font-semibold tabular-nums">{s.count}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
            </div>

            {/* ── Follow-ups + recent ───────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <Card title="Follow-ups" subtitle="Warm owners with a next action">
                    {data.follow_ups.length === 0 ? <Empty text="No follow-ups waiting. Set a next action on warm prospects." /> : (
                        <ul className="divide-y divide-ink-100">
                            {data.follow_ups.map((f) => (
                                <li key={f.id}>
                                    <Link href={farmingHref(f.scheme_id)} className="flex items-start gap-3 py-3 hover:bg-ink-50 -mx-2 px-2 rounded-xl transition">
                                        <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: STATUS[f.status].color }} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[13px] font-semibold truncate">{f.owner}{f.unit ? ` · unit ${f.unit}` : ''}</span>
                                            <span className="block text-[12px] text-ink-600 truncate">{f.next_action}</span>
                                            <span className="block text-[11px] text-ink-400 truncate">
                                                {[f.scheme, f.suburb, mode === 'agency' ? f.agent : null].filter(Boolean).join(' · ')}
                                            </span>
                                        </span>
                                        <span className="text-[11px] font-semibold shrink-0" style={{ color: STATUS[f.status].color }}>{STATUS[f.status].label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                <Card title="Recent outreach" subtitle="Latest logged touches">
                    {data.recent.length === 0 ? <Empty text="Nothing logged yet." /> : (
                        <ul className="divide-y divide-ink-100">
                            {data.recent.map((a) => (
                                <li key={a.id} className="flex items-start gap-3 py-2.5">
                                    <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: CH_COLORS[a.channel] }} />
                                    <span className="min-w-0 flex-1 text-[12.5px]">
                                        <span className="font-semibold">
                                            {a.quantity > 1 ? `${a.quantity.toLocaleString('en-ZA')} × ` : ''}{CHANNEL[a.channel]?.label ?? a.channel}
                                        </span>
                                        {a.prospect && <> · <Link href={farmingHref(a.prospect.scheme_id)} className="text-brand-700 hover:underline">{a.prospect.owner}</Link></>}
                                        {a.outcome && <span className="text-ink-500"> · {OUTCOME[a.outcome]?.label}</span>}
                                        {a.note && <span className="block text-[11.5px] text-ink-500 truncate">{a.note}</span>}
                                    </span>
                                    <span className="text-[11px] text-ink-400 shrink-0 text-right">
                                        {a.when}{mode === 'agency' && a.agent ? <><br />{a.agent}</> : null}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            {/* ── Agency: agent league table ───────────────────────── */}
            {leaderboard && (
                <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden pb-rise">
                    <div className="p-5 border-b border-ink-200">
                        <h2 className="text-[16px] font-semibold tracking-tight">Agent outreach</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">Touches per channel · last {data.days} days</p>
                    </div>
                    <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-[13px]">
                        <thead>
                            <tr className={thRowCls}>
                                <th className="font-semibold px-5 py-3">Agent</th>
                                {['Calls', 'WhatsApp', 'SMS', 'Email', 'Other', 'Total', 'Conversations', 'Appraisals', 'Owners worked', 'To pipeline'].map((h) => (
                                    <th key={h} className="font-semibold py-3 px-3 text-right">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.length === 0 && (
                                <tr><td colSpan={11} className="text-center text-ink-400 py-10">No agents yet.</td></tr>
                            )}
                            {leaderboard.map((r) => (
                                <tr key={r.id} className="border-b border-ink-100 hover:bg-ink-50 transition">
                                    <td className="px-5 py-3 font-semibold">
                                        <Link href={`${base}?agent=${r.id}&range=${data.days}`} className="hover:text-brand-700">{r.name}</Link>
                                    </td>
                                    {[r.calls, r.whatsapp, r.sms, r.email, r.other].map((v, i) => (
                                        <td key={i} className="py-3 px-3 text-right tabular-nums text-ink-600">{v || '—'}</td>
                                    ))}
                                    <td className="py-3 px-3 text-right tabular-nums font-semibold">{r.touches}</td>
                                    <td className="py-3 px-3 text-right tabular-nums">{r.connected}</td>
                                    <td className="py-3 px-3 text-right tabular-nums">{r.appointments}</td>
                                    <td className="py-3 px-3 text-right tabular-nums text-ink-600">{r.worked} / {r.prospects}</td>
                                    <td className="py-3 px-3 text-right tabular-nums">{r.deals}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table></div>
                </section>
            )}

            {logOpen && <LogOutreachModal onClose={() => setLogOpen(false)} />}
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="min-w-0">
            <p className="text-[13px] font-semibold tabular-nums">{typeof value === 'number' ? value.toLocaleString('en-ZA') : value}</p>
            <p className="text-[10px] uppercase tracking-wider text-ink-400 truncate">{label}</p>
        </div>
    );
}

function Empty({ text }: { text: string }) {
    return <p className="py-8 text-center text-[13px] text-ink-400">{text}</p>;
}

/** Batch outreach that isn't tied to one owner — e.g. an SMS blast or a day of cold calls. */
export function LogOutreachModal({ onClose }: { onClose: () => void }) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, setData, post, processing, errors } = useForm({
        channel: 'call' as ChannelKey,
        quantity: 1,
        occurred_on: today,
        note: '',
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agent/crm/activities', { preserveScroll: true, onSuccess: onClose });
    }

    const input = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100';
    const label = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

    return (
        <div className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-4" onClick={onClose}>
            <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-lift w-full max-w-md p-6 space-y-4">
                <div>
                    <h2 className="text-lg font-semibold">Log outreach</h2>
                    <p className="text-[12.5px] text-ink-500 mt-0.5">
                        Record a batch of calls, a WhatsApp or SMS campaign, or an email blast. To log a contact with one owner, open them under Farming.
                    </p>
                </div>
                <div>
                    <label className={label}>Channel</label>
                    <div className="flex flex-wrap gap-1.5">
                        {CHANNELS.map((c) => (
                            <button
                                type="button"
                                key={c.key}
                                onClick={() => setData('channel', c.key)}
                                className={'px-3 py-1.5 rounded-full text-[12px] font-semibold border transition ' +
                                    (data.channel === c.key ? 'bg-brand-700 text-white border-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50')}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={label}>How many</label>
                        <input type="number" min={1} max={100000} value={data.quantity} onChange={(e) => setData('quantity', Number(e.target.value))} className={input} />
                        {errors.quantity && <p className="text-[11px] text-danger mt-1">{errors.quantity}</p>}
                    </div>
                    <div>
                        <label className={label}>Date</label>
                        <input type="date" max={today} value={data.occurred_on} onChange={(e) => setData('occurred_on', e.target.value)} className={input} />
                        {errors.occurred_on && <p className="text-[11px] text-danger mt-1">{errors.occurred_on}</p>}
                    </div>
                </div>
                <div>
                    <label className={label}>Note (optional)</label>
                    <input value={data.note} onChange={(e) => setData('note', e.target.value)} maxLength={500} placeholder="e.g. Moreleta Park value-report SMS campaign" className={input} />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} className={btnOutline}>Cancel</button>
                    <button type="submit" disabled={processing} className={btnPrimary}>
                        {processing && <Spinner size={13} />}Log {data.quantity > 1 ? data.quantity.toLocaleString('en-ZA') + ' ' : ''}{CHANNEL[data.channel].short.toLowerCase()}
                    </button>
                </div>
            </form>
        </div>
    );
}
