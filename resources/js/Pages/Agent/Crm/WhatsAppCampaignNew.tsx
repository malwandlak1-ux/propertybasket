import { FormEvent, useMemo, useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import CrmTabs from '@/Components/Crm/CrmTabs';
import { FlashBanners, PageHeader, btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';
import { STATUSES, StatusKey } from '@/Components/Crm/constants';
import type { Schedule } from '@/Components/Crm/waParts';

type Template = { id: number; name: string; language: string; body: string | null; footer: string | null; params: string[] };
type Filters = { scheme_ids: number[]; statuses: StatusKey[]; prospect_ids: number[]; opted_in_only: boolean };
type Audience = {
    count: number; not_opted_in: number;
    sample: { owner: string; unit: string | null; scheme: string | null; suburb: string | null; values: Record<string, string> } | null;
};
type Props = {
    agent: { name: string; agency_name: string };
    templates: Template[];
    schemes: { id: number; name: string; suburb: string | null; owners: number }[];
    filters: Filters;
    audience: Audience;
    fields: Record<string, string>;
    limits: { daily: number; used_today: number; frequency_days: number; schedule: Schedule };
};

const input = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100';
const label = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

/** Sensible defaults for the starter template's {{1}} {{2}} {{3}}. */
const GUESS = ['owner_name', 'agent_name', 'suburb', 'agency_name', 'agent_phone'];

export default function NewCampaign({ agent, templates, schemes, filters, audience, fields, limits }: Props) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const [refreshing, setRefreshing] = useState(false);
    const form = useForm({
        name: `${schemes.find((s) => s.id === filters.scheme_ids[0])?.name ?? 'Farming'} · ${new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`,
        template_id: templates[0]?.id ?? 0,
        variable_map: Object.fromEntries((templates[0]?.params ?? []).map((p, i) => [p, GUESS[i] ?? 'owner_name'])) as Record<string, string>,
        send: 'now' as 'now' | 'later',
        scheduled_at: '',
        confirm_consent: false,
    });
    const template = templates.find((t) => t.id === Number(form.data.template_id));

    function pickTemplate(id: number) {
        const t = templates.find((x) => x.id === id);
        form.setData((d) => ({ ...d, template_id: id, variable_map: Object.fromEntries((t?.params ?? []).map((p, i) => [p, d.variable_map[p] ?? GUESS[i] ?? 'owner_name'])) }));
    }

    function setFilters(next: Partial<Filters>) {
        const f = { ...filters, ...next };
        setRefreshing(true);
        router.get('/agent/crm/whatsapp/campaigns/new', {
            scheme_ids: f.scheme_ids, statuses: f.statuses, opted_in_only: f.opted_in_only ? 1 : 0, prospect_ids: f.prospect_ids,
        }, { only: ['audience', 'filters'], preserveState: true, preserveScroll: true, replace: true, onFinish: () => setRefreshing(false) });
    }
    const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

    const preview = useMemo(() => {
        if (!template?.body) return '';
        return template.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, p) => {
            const src = form.data.variable_map[p] ?? '';
            if (src.startsWith('text:')) return src.slice(5) || `{{${p}}}`;
            return audience.sample?.values[src] || `[${fields[src] ?? p}]`;
        });
    }, [template, form.data.variable_map, audience.sample, fields]);

    const roomToday = Math.max(0, limits.daily - limits.used_today);

    function submit(e: FormEvent) {
        e.preventDefault();
        form.transform((d) => ({
            name: d.name,
            template_id: d.template_id,
            variable_map: d.variable_map,
            scheduled_at: d.send === 'later' && d.scheduled_at ? d.scheduled_at : null,
            confirm_consent: d.confirm_consent,
            ...filters,
            opted_in_only: filters.opted_in_only ? 1 : 0,
        }));
        form.post('/agent/crm/whatsapp/campaigns');
    }

    return (
        <AgentLayout crumb="CRM · WhatsApp" agencyName={agent.agency_name}>
            <Head title="New WhatsApp campaign" />
            <div className="px-4 sm:px-7 py-6">
                <PageHeader title="New WhatsApp campaign" subtitle={<Link href="/agent/crm/whatsapp" className="font-semibold text-brand-700 hover:underline">← WhatsApp</Link>} />
                <CrmTabs base="/agent/crm" active="whatsapp" />
                <FlashBanners flash={flash} />

                {templates.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-10 text-center">
                        <h2 className="text-lg font-semibold">No approved templates yet</h2>
                        <p className="text-[13px] text-ink-500 mt-1.5">Create a template on the WhatsApp tab and wait for Meta to approve it.</p>
                    </div>
                ) : (
                    <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        <div className="lg:col-span-7 space-y-4">
                            {/* 1. Audience */}
                            <Panel n={1} title="Who gets it" sub="Your farming owners with a valid SA mobile number. Opted-out owners are always left out.">
                                <div>
                                    <p className={label}>Schemes</p>
                                    {schemes.length === 0 ? <p className="text-[12.5px] text-ink-400">No farmed schemes yet. Add one under CRM → Farming.</p> : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {schemes.map((s) => (
                                                <Pill key={s.id} on={filters.scheme_ids.includes(s.id)} onClick={() => setFilters({ scheme_ids: toggle(filters.scheme_ids, s.id) })}>
                                                    {s.name} <span className="opacity-60">· {s.suburb} · {s.owners}</span>
                                                </Pill>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-[11.5px] text-ink-400 mt-1.5">None selected = all your schemes.</p>
                                </div>
                                <div>
                                    <p className={label}>Contact status</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {STATUSES.filter((s) => !['not_interested', 'lost', 'listed'].includes(s.key)).map((s) => (
                                            <Pill key={s.key} on={filters.statuses.includes(s.key)} onClick={() => setFilters({ statuses: toggle(filters.statuses, s.key) })}>
                                                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.label}
                                            </Pill>
                                        ))}
                                    </div>
                                    <p className="text-[11.5px] text-ink-400 mt-1.5">None selected = every status.</p>
                                </div>
                                <label className="flex items-center gap-2 text-[13px] font-medium cursor-pointer">
                                    <input type="checkbox" checked={filters.opted_in_only} onChange={(e) => setFilters({ opted_in_only: e.target.checked })} className="rounded border-ink-300" />
                                    Only owners who agreed to WhatsApp messages
                                </label>
                                <div className={`rounded-xl bg-ink-50 border border-ink-200 px-4 py-3 flex items-center justify-between gap-3 transition-opacity ${refreshing ? 'opacity-50' : ''}`}>
                                    <span className="text-[13px]"><b className="text-[18px] tabular-nums">{audience.count.toLocaleString('en-ZA')}</b> owners will get this</span>
                                    {audience.not_opted_in > 0 && <span className="text-[12px] text-amber-700 font-semibold">{audience.not_opted_in} haven’t opted in</span>}
                                </div>
                            </Panel>

                            {/* 2. Message */}
                            <Panel n={2} title="Message" sub="Pick an approved template and choose what fills each blank.">
                                <div>
                                    <label className={label}>Template</label>
                                    <select value={form.data.template_id} onChange={(e) => pickTemplate(Number(e.target.value))} className={input}>
                                        {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
                                    </select>
                                </div>
                                {template?.params.map((p) => {
                                    const v = form.data.variable_map[p] ?? '';
                                    const custom = v.startsWith('text:');
                                    return (
                                        <div key={p} className="grid grid-cols-[64px_1fr] items-center gap-3">
                                            <code className="text-[12px] font-bold text-brand-700">{`{{${p}}}`}</code>
                                            <div className="flex gap-2">
                                                <select value={custom ? 'custom' : v} onChange={(e) => form.setData('variable_map', { ...form.data.variable_map, [p]: e.target.value === 'custom' ? 'text:' : e.target.value })} className={input + ' !py-2'}>
                                                    {Object.entries(fields).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                                                    <option value="custom">Fixed text…</option>
                                                </select>
                                                {custom && <input value={v.slice(5)} onChange={(e) => form.setData('variable_map', { ...form.data.variable_map, [p]: `text:${e.target.value}` })} placeholder="Same for everyone" className={input + ' !py-2'} />}
                                            </div>
                                        </div>
                                    );
                                })}
                                {form.errors.variable_map && <p className="text-[11.5px] text-danger">{form.errors.variable_map}</p>}
                            </Panel>

                            {/* 3. Send */}
                            <Panel n={3} title="Send" sub={`Sending hours (SAST): weekdays ${limits.schedule.weekdays}, Saturdays ${limits.schedule.saturday}, never Sundays or public holidays. ${limits.schedule.open_now ? 'Open now.' : `Next window opens ${limits.schedule.next_open}.`}`}>
                                <div>
                                    <label className={label}>Campaign name</label>
                                    <input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} maxLength={160} className={input} />
                                    {form.errors.name && <p className="text-[11px] text-danger mt-1">{form.errors.name}</p>}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Pill on={form.data.send === 'now'} onClick={() => form.setData('send', 'now')}>Send now</Pill>
                                    <Pill on={form.data.send === 'later'} onClick={() => form.setData('send', 'later')}>Schedule</Pill>
                                    {form.data.send === 'later' && (
                                        <input type="datetime-local" value={form.data.scheduled_at} onChange={(e) => form.setData('scheduled_at', e.target.value)} className={input + ' !w-auto !py-1.5'} />
                                    )}
                                </div>
                                {form.errors.scheduled_at && <p className="text-[11px] text-danger">{form.errors.scheduled_at}</p>}
                                {audience.not_opted_in > 0 && (
                                    <label className="flex items-start gap-2.5 rounded-xl bg-warning/10 border border-warning/30 px-4 py-3 cursor-pointer">
                                        <input type="checkbox" checked={form.data.confirm_consent} onChange={(e) => form.setData('confirm_consent', e.target.checked)} className="mt-0.5 rounded border-ink-300" />
                                        <span className="text-[12.5px] text-ink-700">
                                            I confirm I may message the <b>{audience.not_opted_in}</b> owners who haven’t opted in. Unwanted messages get reported, which lowers my number’s quality and can get it restricted.
                                        </span>
                                    </label>
                                )}
                                {form.errors.confirm_consent && <p className="text-[11.5px] text-danger">{form.errors.confirm_consent}</p>}
                            </Panel>
                        </div>

                        {/* Preview + limits */}
                        <aside className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
                            <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 pb-rise">
                                <h2 className="text-[16px] font-semibold tracking-tight">Preview</h2>
                                <p className="text-[12px] text-ink-500 mt-0.5 mb-3">
                                    {audience.sample ? <>As {audience.sample.owner}{audience.sample.unit ? `, unit ${audience.sample.unit}` : ''} will see it</> : 'No owners match yet'}
                                </p>
                                <div className="rounded-2xl bg-[#E7DFD4] p-4">
                                    <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-3.5 py-2.5 shadow-sm">
                                        <p className="text-[13px] whitespace-pre-line leading-relaxed">{preview}</p>
                                        {template?.footer && <p className="text-[11px] text-ink-500 mt-1.5">{template.footer}</p>}
                                    </div>
                                </div>
                            </section>
                            <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 pb-rise text-[12.5px] space-y-2">
                                <h2 className="text-[16px] font-semibold tracking-tight mb-1">Limits &amp; cost</h2>
                                <p className="flex justify-between"><span className="text-ink-500">Meta daily limit</span><b className="tabular-nums">{limits.daily.toLocaleString('en-ZA')} people</b></p>
                                <p className="flex justify-between"><span className="text-ink-500">Room left today</span><b className="tabular-nums">{roomToday.toLocaleString('en-ZA')}</b></p>
                                {audience.count > roomToday && <p className="text-amber-700">This campaign is bigger than today’s room. The rest sends automatically as the limit frees up.</p>}
                                <p className="flex justify-between"><span className="text-ink-500">Repeat protection</span><b>{limits.frequency_days} days per number</b></p>
                                <p className="text-ink-500 pt-1 border-t border-ink-100">Meta bills your own WhatsApp account per delivered template message. Keep it topped up in WhatsApp Manager, or the campaign pauses until you do.</p>
                            </section>
                            <button type="submit" disabled={form.processing || audience.count === 0} className={`${btnPrimary} w-full !py-3`}>
                                {form.processing && <Spinner size={14} />}
                                {form.data.send === 'later' ? 'Schedule' : 'Send'} to {audience.count.toLocaleString('en-ZA')} owners
                            </button>
                            <Link href="/agent/crm/whatsapp" className={`${btnOutline} w-full`}>Cancel</Link>
                        </aside>
                    </form>
                )}
            </div>
        </AgentLayout>
    );
}

function Panel({ n, title, sub, children }: { n: number; title: string; sub: string; children: React.ReactNode }) {
    return (
        <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 pb-rise space-y-4">
            <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-brand-700 text-white text-[12px] font-bold flex items-center justify-center shrink-0">{n}</span>
                <div>
                    <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
                    <p className="text-[12px] text-ink-500 mt-0.5">{sub}</p>
                </div>
            </div>
            {children}
        </section>
    );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button type="button" onClick={onClick} className={'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-semibold transition ' +
            (on ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50')}>
            {children}
        </button>
    );
}
