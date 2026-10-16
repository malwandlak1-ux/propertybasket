import { FormEvent, useEffect, useRef } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import CrmTabs from '@/Components/Crm/CrmTabs';
import { FlashBanners, PageHeader, btnPrimary } from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';

type Msg = { id: number; direction: 'in' | 'out'; body: string | null; status: string; campaign: string | null; at: string | null };

export default function Chat({ agent, phone, display, prospect, window_open_until, messages }: {
    agent: { agency_name: string };
    phone: string;
    display: string;
    prospect: { id: number; owner: string; unit: string | null; scheme: string | null; scheme_id: number; opted_out: boolean } | null;
    window_open_until: string | null;
    messages: Msg[];
}) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const { data, setData, post, processing, reset } = useForm({ phone, body: '' });
    const end = useRef<HTMLDivElement>(null);
    useEffect(() => {
        end.current?.scrollIntoView({ block: 'end' });
    }, [messages.length]);

    function send(e: FormEvent) {
        e.preventDefault();
        post('/agent/crm/whatsapp/chat', { preserveScroll: true, onSuccess: () => reset('body') });
    }

    return (
        <AgentLayout crumb="CRM · WhatsApp" agencyName={agent.agency_name}>
            <Head title={prospect?.owner ?? display} />
            <div className="px-4 sm:px-7 py-6 max-w-4xl">
                <PageHeader
                    title={prospect?.owner ?? display}
                    subtitle={<>
                        <Link href="/agent/crm/whatsapp" className="font-semibold text-brand-700 hover:underline">← WhatsApp</Link> · {display}
                        {prospect && <> · <Link href={`/agent/crm/farming?scheme=${prospect.scheme_id}`} className="hover:text-brand-700">{prospect.scheme}{prospect.unit ? ` unit ${prospect.unit}` : ''}</Link></>}
                    </>}
                />
                <CrmTabs base="/agent/crm" active="whatsapp" />
                <FlashBanners flash={flash} />
                {prospect?.opted_out && <div className="mb-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger px-5 py-3 text-[13px]">This owner replied STOP. They won’t get campaign messages again.</div>}

                <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden pb-rise">
                    <div className="bg-[#E7DFD4] p-4 sm:p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
                        {messages.map((m) => (
                            <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm ${m.direction === 'out' ? 'bg-[#DCF8C6] rounded-tr-sm' : 'bg-white rounded-tl-sm'}`}>
                                    {m.campaign && <p className="text-[10.5px] font-semibold text-brand-700 mb-0.5">Campaign · {m.campaign}</p>}
                                    <p className="text-[13px] whitespace-pre-line leading-relaxed">{m.body}</p>
                                    <p className="text-[10.5px] text-ink-500 text-right mt-1">
                                        {m.at}{m.direction === 'out' && <> · {m.status === 'read' ? '✓✓ read' : m.status === 'delivered' ? '✓✓' : m.status === 'failed' ? 'failed' : '✓'}</>}
                                    </p>
                                </div>
                            </div>
                        ))}
                        <div ref={end} />
                    </div>
                    <form onSubmit={send} className="p-4 border-t border-ink-200 flex gap-2 items-end">
                        {window_open_until ? (
                            <>
                                <textarea value={data.body} onChange={(e) => setData('body', e.target.value)} rows={2} maxLength={4000} placeholder="Type a reply…"
                                    className="flex-1 bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 resize-none" />
                                <button type="submit" disabled={processing || !data.body.trim()} className={btnPrimary}>{processing && <Spinner size={13} />}Send</button>
                            </>
                        ) : (
                            <p className="text-[12.5px] text-ink-500">
                                WhatsApp only allows free replies within 24 hours of the owner’s last message. To reach them again, include them in a template campaign.
                            </p>
                        )}
                    </form>
                    {window_open_until && <p className="px-4 pb-3 -mt-2 text-[11px] text-ink-400">You can reply freely until {window_open_until}.</p>}
                </section>
            </div>
        </AgentLayout>
    );
}
