import { Head } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import CrmTabs from '@/Components/Crm/CrmTabs';
import { PageHeader, SummaryStrip, thRowCls } from '@/Components/Dashboard/Charts';
import { CampaignStatus, Quality } from '@/Components/Crm/waParts';

type Props = {
    agency: { name: string };
    agents: { id: number; name: string }[];
    agent_id: number | null;
    numbers: { agent: string; phone: string | null; status: string; quality: string | null; limit: number | null }[];
    campaigns: { id: number; name: string; agent: string | null; status: string; total: number; sent: number; delivered: number; read: number; replied: number; failed: number; created_at: string | null }[];
};

export default function AgencyWhatsApp({ agency, agents, agent_id, numbers, campaigns }: Props) {
    const sum = (k: 'sent' | 'delivered' | 'read' | 'replied') => campaigns.reduce((a, c) => a + c[k], 0);
    const connected = numbers.filter((n) => n.status === 'connected').length;

    return (
        <AgencyLayout agencyName={agency.name} crumb="CRM · WhatsApp">
            <Head title="WhatsApp" />
            <div className="px-4 sm:px-7 py-6">
                <PageHeader title="WhatsApp" subtitle="Your agents’ WhatsApp numbers and campaign results (view only). Each agent connects and pays for their own number." />
                <CrmTabs base="/agency/crm" active="whatsapp" agents={agents} agentId={agent_id} />

                <SummaryStrip
                    title="WhatsApp summary"
                    cells={[
                        { label: 'Numbers connected', value: `${connected} / ${numbers.length}`, sub: 'Agents with WhatsApp' },
                        { label: 'Messages sent', value: sum('sent').toLocaleString('en-ZA'), sub: `${campaigns.length} campaigns` },
                        { label: 'Read', value: sum('read').toLocaleString('en-ZA'), sub: `${sum('delivered').toLocaleString('en-ZA')} delivered` },
                        { label: 'Replies', value: sum('replied').toLocaleString('en-ZA'), sub: 'Owners who wrote back' },
                    ]}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                    <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden pb-rise">
                        <div className="p-5 border-b border-ink-200"><h2 className="text-[16px] font-semibold tracking-tight">Agent numbers</h2></div>
                        <ul className="divide-y divide-ink-100">
                            {numbers.map((n) => (
                                <li key={n.agent} className="px-5 py-3 flex items-center justify-between gap-3 text-[13px]">
                                    <span className="min-w-0">
                                        <span className="block font-semibold truncate">{n.agent}</span>
                                        <span className="block text-[12px] text-ink-500">{n.status === 'connected' ? `${n.phone} · ${n.limit?.toLocaleString('en-ZA')}/day` : n.status === 'not_connected' ? 'Not connected' : n.status}</span>
                                    </span>
                                    {n.status === 'connected' && <Quality rating={n.quality} />}
                                </li>
                            ))}
                        </ul>
                    </section>
                    <section className="lg:col-span-2 bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden pb-rise">
                        <div className="p-5 border-b border-ink-200"><h2 className="text-[16px] font-semibold tracking-tight">Campaigns</h2></div>
                        {campaigns.length === 0 ? <p className="py-10 text-center text-[13px] text-ink-400">No WhatsApp campaigns yet.</p> : (
                            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[13px]">
                                <thead><tr className={thRowCls}>
                                    <th className="font-semibold py-3 pl-5 pr-3">Campaign</th>
                                    <th className="font-semibold py-3 px-3">Agent</th>
                                    <th className="font-semibold py-3 px-3">Status</th>
                                    {['Sent', 'Read', 'Replies', 'Failed'].map((h) => <th key={h} className="font-semibold py-3 px-3 text-right last:pr-5">{h}</th>)}
                                </tr></thead>
                                <tbody>
                                    {campaigns.map((c) => (
                                        <tr key={c.id} className="border-b border-ink-100">
                                            <td className="py-3 pl-5 pr-3"><span className="block font-semibold">{c.name}</span><span className="text-[11.5px] text-ink-500">{c.created_at} · {c.total} owners</span></td>
                                            <td className="py-3 px-3 text-ink-600">{c.agent}</td>
                                            <td className="py-3 px-3"><CampaignStatus status={c.status} /></td>
                                            <td className="py-3 px-3 text-right tabular-nums">{c.sent}</td>
                                            <td className="py-3 px-3 text-right tabular-nums">{c.read}</td>
                                            <td className="py-3 px-3 text-right tabular-nums font-semibold">{c.replied}</td>
                                            <td className={`py-3 px-3 pr-5 text-right tabular-nums ${c.failed ? 'text-danger' : 'text-ink-400'}`}>{c.failed}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table></div>
                        )}
                    </section>
                </div>
            </div>
        </AgencyLayout>
    );
}
