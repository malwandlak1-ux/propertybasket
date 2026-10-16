import { Head, Link, router, usePage } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import CrmTabs from '@/Components/Crm/CrmTabs';
import { FlashBanners, PageHeader, SummaryStrip, btnOutline, btnPrimary, thRowCls } from '@/Components/Dashboard/Charts';
import { CampaignRow, CampaignStatus, Progress, msgTone } from '@/Components/Crm/waParts';

type Msg = { id: number; owner: string | null; unit: string | null; scheme_id: number | null; phone: string; status: string; error: string | null; sent_at: string | null; read_at: string | null; replied: boolean };
type Page<T> = { data: T[]; links: { url: string | null; label: string; active: boolean }[]; total: number; last_page: number };

export default function Campaign({ agent, campaign, messages }: {
    agent: { agency_name: string };
    campaign: CampaignRow & { sample: string | null };
    messages: Page<Msg>;
}) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const c = campaign;
    const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—');
    const act = (what: 'pause' | 'resume' | 'cancel') => router.post(`/agent/crm/whatsapp/campaigns/${c.id}/${what}`, {}, { preserveScroll: true });

    return (
        <AgentLayout crumb="CRM · WhatsApp" agencyName={agent.agency_name}>
            <Head title={c.name} />
            <div className="px-4 sm:px-7 py-6">
                <PageHeader
                    title={c.name}
                    subtitle={<><Link href="/agent/crm/whatsapp" className="font-semibold text-brand-700 hover:underline">← WhatsApp</Link> · template {c.template} · {c.created_at}</>}
                    actions={<>
                        <CampaignStatus status={c.status} />
                        {['queued', 'sending'].includes(c.status) && <button type="button" onClick={() => act('pause')} className={btnOutline}>Pause</button>}
                        {c.status === 'paused' && <button type="button" onClick={() => act('resume')} className={btnPrimary}>Resume</button>}
                        {!['completed', 'cancelled'].includes(c.status) && (
                            <button type="button" onClick={() => confirm('Cancel the rest of this campaign? Sent messages are unaffected.') && act('cancel')}
                                className="px-4 py-2.5 rounded-full text-[13px] font-semibold text-danger hover:bg-danger/10">Cancel</button>
                        )}
                    </>}
                />
                <CrmTabs base="/agent/crm" active="whatsapp" />
                <FlashBanners flash={flash} />
                {c.status === 'paused' && c.pause_reason && (
                    <div className="mb-4 rounded-2xl bg-warning/10 border border-warning/30 px-5 py-3 text-[13px] text-ink-700"><b>Paused:</b> {c.pause_reason}</div>
                )}
                {c.scheduled_at && <div className="mb-4 rounded-2xl bg-sky-50 border border-sky-200 px-5 py-3 text-[13px] text-sky-800">Scheduled for {c.scheduled_at}.</div>}

                <SummaryStrip
                    title="Campaign results"
                    cells={[
                        { label: 'Sent', value: `${c.sent} / ${c.total}`, sub: c.queued ? `${c.queued} still queued` : 'All processed' },
                        { label: 'Delivered', value: c.delivered, sub: pct(c.delivered, c.sent) + ' of sent' },
                        { label: 'Read', value: c.read, sub: pct(c.read, c.delivered) + ' of delivered' },
                        { label: 'Replies', value: c.replied, sub: pct(c.replied, c.delivered) + ' replied', tone: c.replied ? 'success' : 'muted' },
                        { label: 'Failed / skipped', value: `${c.failed} / ${c.skipped}`, sub: 'See reasons below', tone: c.failed ? 'danger' : 'muted' },
                    ]}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                    <section className="lg:col-span-2 bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden pb-rise">
                        <div className="p-5 border-b border-ink-200">
                            <h2 className="text-[16px] font-semibold tracking-tight">Recipients</h2>
                            <div className="mt-2"><Progress c={c} /></div>
                        </div>
                        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-[13px]">
                            <thead><tr className={thRowCls}>
                                <th className="font-semibold py-3 pl-5 pr-3">Owner</th>
                                <th className="font-semibold py-3 px-3">Number</th>
                                <th className="font-semibold py-3 px-3">Status</th>
                                <th className="font-semibold py-3 px-3">Sent</th>
                                <th className="font-semibold py-3 px-3 pr-5">Read</th>
                            </tr></thead>
                            <tbody>
                                {messages.data.map((m) => (
                                    <tr key={m.id} className="border-b border-ink-100">
                                        <td className="py-2.5 pl-5 pr-3">
                                            {m.scheme_id ? <Link href={`/agent/crm/farming?scheme=${m.scheme_id}`} className="font-semibold hover:text-brand-700">{m.owner}</Link> : <span className="font-semibold">{m.owner ?? '—'}</span>}
                                            {m.unit && <span className="text-ink-400 text-[11.5px]"> · unit {m.unit}</span>}
                                        </td>
                                        <td className="py-2.5 px-3 tabular-nums whitespace-nowrap">
                                            <Link href={`/agent/crm/whatsapp/chat?phone=${m.phone.replace(/\s/g, '')}`} className="hover:text-brand-700">{m.phone}</Link>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <span className={`font-semibold capitalize ${msgTone(m.status)}`}>{m.status}</span>
                                            {m.replied && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">REPLIED</span>}
                                            {m.error && <span className="block text-[11px] text-ink-500 max-w-[260px]">{m.error}</span>}
                                        </td>
                                        <td className="py-2.5 px-3 text-ink-600 whitespace-nowrap">{m.sent_at ?? '—'}</td>
                                        <td className="py-2.5 px-3 pr-5 text-ink-600 whitespace-nowrap">{m.read_at ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table></div>
                        {messages.last_page > 1 && (
                            <div className="p-4 flex flex-wrap justify-center gap-1">
                                {messages.links.map((l, i) => (
                                    <Link key={i} href={l.url ?? '#'} preserveScroll
                                        className={'px-3 py-1.5 rounded-full text-[12px] font-semibold ' + (l.active ? 'bg-brand-700 text-white' : l.url ? 'border border-ink-200 hover:bg-ink-50' : 'text-ink-300 pointer-events-none')}
                                        dangerouslySetInnerHTML={{ __html: l.label }} />
                                ))}
                            </div>
                        )}
                    </section>
                    <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 pb-rise">
                        <h2 className="text-[16px] font-semibold tracking-tight mb-3">Message</h2>
                        <div className="rounded-2xl bg-[#E7DFD4] p-4">
                            <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-3.5 py-2.5 shadow-sm">
                                <p className="text-[13px] whitespace-pre-line leading-relaxed">{c.sample ?? '—'}</p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </AgentLayout>
    );
}
