import { FormEvent, useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import CrmTabs from '@/Components/Crm/CrmTabs';
import { FlashBanners, PageHeader, SummaryStrip, btnOutline, btnPrimary, thRowCls } from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';
import { CampaignRow, CampaignStatus, CopyField, Progress, Quality, Step } from '@/Components/Crm/waParts';

type Account = {
    waba_id: string; phone_number_id: string; display_phone: string | null; verified_name: string | null;
    quality_rating: string | null; messaging_limit: string | null; daily_limit: number; status: string;
    last_error: string | null; last_synced_at: string | null; token_hint: string | null; has_app_secret: boolean;
    webhook_url: string; verify_token: string;
};
type Template = { id: number; name: string; language: string; category: string | null; status: string; body: string | null; footer: string | null; params: string[]; sendable: boolean; reason: string | null };
type Thread = { phone: string; display: string; owner: string | null; last: string | null; at: string | null; open: boolean };

type Props = {
    agent: { name: string; agency_name: string };
    account: Account | null;
    stub: boolean;
    templates: Template[];
    campaigns: CampaignRow[];
    threads: Thread[];
};

const input = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100';
const label = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

export default function AgentCrmWhatsApp({ agent, account, stub, templates, campaigns, threads }: Props) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const [editing, setEditing] = useState(!account);
    const [newTemplate, setNewTemplate] = useState(false);
    const connected = account?.status === 'connected';
    const approved = templates.filter((t) => t.status === 'APPROVED' && t.sendable);

    return (
        <AgentLayout crumb="CRM · WhatsApp" agencyName={agent.agency_name}>
            <Head title="WhatsApp" />
            <div className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="WhatsApp"
                    subtitle="Bulk WhatsApp to your CRM owners through your own WhatsApp Business number (Meta Cloud API)"
                    actions={connected && (
                        approved.length
                            ? <Link href="/agent/crm/whatsapp/campaigns/new" className={btnPrimary}>+ New campaign</Link>
                            : <button type="button" onClick={() => setNewTemplate(true)} className={btnPrimary}>+ Create a template first</button>
                    )}
                />
                <CrmTabs base="/agent/crm" active="whatsapp" />
                <FlashBanners flash={flash} />
                {stub && (
                    <div className="mb-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-800 px-5 py-3 text-[12.5px]">
                        <b>Demo mode:</b> WhatsApp calls are simulated on this server. Nothing reaches Meta or any phone.
                    </div>
                )}

                {account && connected && !editing && (
                    <>
                        <SummaryStrip
                            title="WhatsApp number"
                            cells={[
                                { label: 'Your number', value: account.display_phone ?? '—', sub: account.verified_name ?? 'WhatsApp Business' },
                                { label: 'Quality', value: <Quality rating={account.quality_rating} />, sub: 'Meta’s rating from recipient feedback' },
                                { label: 'Daily limit', value: account.daily_limit.toLocaleString('en-ZA'), sub: 'New people per 24 hours' },
                                { label: 'Approved templates', value: approved.length, sub: `${templates.length} synced ${account.last_synced_at ?? ''}` },
                            ]}
                        />
                        {!account.has_app_secret && (
                            <div className="mb-4 rounded-2xl bg-warning/10 border border-warning/30 px-5 py-3 text-[12.5px] text-ink-700">
                                <b>Add your App secret</b> to see delivered/read ticks and owners’ replies. Without it, Meta’s updates can’t be verified and are ignored.
                                <button type="button" onClick={() => setEditing(true)} className="ml-2 font-semibold text-brand-700 hover:underline">Update details</button>
                            </div>
                        )}
                    </>
                )}

                {account?.status === 'error' && !editing && (
                    <div className="mb-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger px-5 py-3 text-[13px]">
                        Meta rejected the saved details: {account.last_error}{' '}
                        <button type="button" onClick={() => setEditing(true)} className="font-semibold underline">Fix them</button>
                    </div>
                )}

                {(!account || account.status !== 'connected' || editing) ? (
                    <ConnectSection account={account} onDone={() => setEditing(false)} onCancel={account && account.status === 'connected' ? () => setEditing(false) : undefined} />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                        <div className="lg:col-span-2 space-y-4">
                            {/* Campaigns */}
                            <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden pb-rise">
                                <div className="p-5 border-b border-ink-200 flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-[16px] font-semibold tracking-tight">Campaigns</h2>
                                        <p className="text-[12px] text-ink-500 mt-0.5">Bulk sends to your farming owners</p>
                                    </div>
                                </div>
                                {campaigns.length === 0 ? (
                                    <p className="py-10 text-center text-[13px] text-ink-400">
                                        No campaigns yet. {approved.length ? <Link href="/agent/crm/whatsapp/campaigns/new" className="text-brand-700 font-semibold hover:underline">Start one</Link> : 'Create and get a template approved first.'}
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[13px]">
                                        <thead><tr className={thRowCls}>
                                            <th className="font-semibold py-3 pl-5 pr-3">Campaign</th>
                                            <th className="font-semibold py-3 px-3">Status</th>
                                            <th className="font-semibold py-3 px-3 w-40">Progress</th>
                                            <th className="font-semibold py-3 px-3 text-right">Sent</th>
                                            <th className="font-semibold py-3 px-3 text-right">Read</th>
                                            <th className="font-semibold py-3 px-3 text-right">Replies</th>
                                            <th className="font-semibold py-3 px-3 pr-5 text-right">Failed</th>
                                        </tr></thead>
                                        <tbody>
                                            {campaigns.map((c) => (
                                                <tr key={c.id} className="border-b border-ink-100 hover:bg-brand-50/50 cursor-pointer" onClick={() => router.visit(`/agent/crm/whatsapp/campaigns/${c.id}`)}>
                                                    <td className="py-3 pl-5 pr-3">
                                                        <span className="block font-semibold">{c.name}</span>
                                                        <span className="block text-[11.5px] text-ink-500">{c.scheduled_at ? `Scheduled ${c.scheduled_at}` : c.created_at} · {c.total} owners</span>
                                                    </td>
                                                    <td className="py-3 px-3"><CampaignStatus status={c.status} /></td>
                                                    <td className="py-3 px-3"><Progress c={c} /></td>
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

                            {/* Templates */}
                            <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden pb-rise">
                                <div className="p-5 border-b border-ink-200 flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-[16px] font-semibold tracking-tight">Message templates</h2>
                                        <p className="text-[12px] text-ink-500 mt-0.5">Bulk messages must use a template Meta has approved</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => router.post('/agent/crm/whatsapp/templates/sync', {}, { preserveScroll: true })} className={`${btnOutline} !py-2 !text-[12px]`}>Sync from Meta</button>
                                        <button type="button" onClick={() => setNewTemplate(true)} className={`${btnPrimary} !py-2 !text-[12px]`}>+ New template</button>
                                    </div>
                                </div>
                                {templates.length === 0 ? <p className="py-8 text-center text-[13px] text-ink-400">No templates on this WhatsApp account yet.</p> : (
                                    <ul className="divide-y divide-ink-100">
                                        {templates.map((t) => (
                                            <li key={t.id} className="px-5 py-3.5">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold text-[13.5px]">{t.name}</span>
                                                    <span className="text-[11px] text-ink-400">{t.language} · {(t.category ?? '').toLowerCase()}</span>
                                                    <span className={`ml-auto text-[10.5px] font-bold px-2 py-0.5 rounded-full ${t.status === 'APPROVED' ? 'bg-success/15 text-success' : t.status === 'REJECTED' ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-amber-700'}`}>{t.status}</span>
                                                </div>
                                                {t.body && <p className="text-[12.5px] text-ink-600 mt-1 whitespace-pre-line line-clamp-3">{t.body}</p>}
                                                {!t.sendable && t.reason && <p className="text-[11.5px] text-amber-700 mt-1">Can’t be used for campaigns yet: {t.reason}</p>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </div>

                        <div className="space-y-4">
                            {/* Inbox */}
                            <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 pb-rise">
                                <h2 className="text-[16px] font-semibold tracking-tight">Replies</h2>
                                <p className="text-[12px] text-ink-500 mt-0.5 mb-3">Owners who wrote back. You can reply freely for 24 hours.</p>
                                {threads.length === 0 ? <p className="py-6 text-center text-[12.5px] text-ink-400">No replies yet.</p> : (
                                    <ul className="divide-y divide-ink-100 -mx-2">
                                        {threads.map((t) => (
                                            <li key={t.phone}>
                                                <Link href={`/agent/crm/whatsapp/chat?phone=${t.phone}`} className="flex items-start gap-3 px-2 py-2.5 rounded-xl hover:bg-ink-50">
                                                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${t.open ? 'bg-success' : 'bg-ink-300'}`} title={t.open ? 'Reply window open' : 'Reply window closed'} />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-[13px] font-semibold truncate">{t.owner ?? t.display}</span>
                                                        <span className="block text-[12px] text-ink-500 truncate">{t.last}</span>
                                                    </span>
                                                    <span className="text-[11px] text-ink-400 shrink-0">{t.at}</span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>

                            {/* Connection */}
                            <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 pb-rise space-y-3">
                                <h2 className="text-[16px] font-semibold tracking-tight">Connection</h2>
                                <dl className="text-[12.5px] space-y-1.5">
                                    <Row k="Business account ID" v={account!.waba_id} />
                                    <Row k="Phone number ID" v={account!.phone_number_id} />
                                    <Row k="Access token" v={account!.token_hint ?? '—'} />
                                    <Row k="App secret" v={account!.has_app_secret ? 'Saved' : 'Missing'} />
                                </dl>
                                <p className="text-[12px] text-ink-500 pt-1">Paste these into Meta → WhatsApp → Configuration → Webhook, then subscribe to <b>messages</b>:</p>
                                <CopyField label="Callback URL" value={account!.webhook_url} />
                                <CopyField label="Verify token" value={account!.verify_token} />
                                <div className="flex gap-2 pt-1">
                                    <button type="button" onClick={() => setEditing(true)} className={`${btnOutline} !py-2 !text-[12px]`}>Update details</button>
                                    <button type="button" onClick={() => confirm('Disconnect WhatsApp? Running campaigns will pause.') && router.delete('/agent/crm/whatsapp/account')}
                                        className="px-4 py-2 rounded-full text-[12px] font-semibold text-danger hover:bg-danger/10">Disconnect</button>
                                </div>
                            </section>
                        </div>
                    </div>
                )}
            </div>
            {newTemplate && <NewTemplateModal agentName={agent.name} onClose={() => setNewTemplate(false)} />}
        </AgentLayout>
    );
}

function Row({ k, v }: { k: string; v: string }) {
    return <div className="flex justify-between gap-3"><dt className="text-ink-500">{k}</dt><dd className="font-semibold text-right break-all">{v}</dd></div>;
}

function ConnectSection({ account, onDone, onCancel }: { account: Account | null; onDone: () => void; onCancel?: () => void }) {
    const { data, setData, post, processing, errors } = useForm({
        waba_id: account?.waba_id ?? '',
        phone_number_id: account?.phone_number_id ?? '',
        access_token: '',
        app_secret: '',
    });
    const hasToken = !!account?.token_hint && account.status === 'connected';

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agent/crm/whatsapp/account', { preserveScroll: true, onSuccess: onDone });
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <section className="lg:col-span-7 bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 pb-rise">
                <h2 className="text-[18px] font-semibold tracking-tight">Set up your WhatsApp Business number</h2>
                <p className="text-[12.5px] text-ink-500 mt-0.5 mb-5">
                    Messages go out through Meta’s official WhatsApp Cloud API on your own number, and Meta bills your own account. Do this once:
                </p>
                <ol className="space-y-4">
                    <Step n={1} title="Verify your business with Meta">
                        <p>At <b>business.facebook.com</b>, create or open your business portfolio and complete Business Verification. Verified numbers can message more people per day.</p>
                    </Step>
                    <Step n={2} title="Create a Meta app with WhatsApp">
                        <p>At <b>developers.facebook.com</b> → My Apps → Create app (type <b>Business</b>) → add the <b>WhatsApp</b> product.</p>
                    </Step>
                    <Step n={3} title="Add your business number">
                        <p>WhatsApp → <b>API Setup</b> → add your number. Use a number that is <b>not</b> on the normal WhatsApp app. Copy the <b>Phone number ID</b> and <b>WhatsApp Business Account ID</b> shown there.</p>
                    </Step>
                    <Step n={4} title="Create a permanent access token">
                        <p>Business settings → <b>System users</b> → add an admin system user → assign your app and WhatsApp account → <b>Generate token</b> with <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>, set to never expire.</p>
                    </Step>
                    <Step n={5} title="Copy your App secret">
                        <p>Your app → App settings → <b>Basic</b> → App secret. This lets us verify delivery updates and replies from Meta.</p>
                    </Step>
                    <Step n={6} title="Add a payment method">
                        <p>In <b>WhatsApp Manager</b>, add a card or credit. Meta charges you per delivered marketing or utility template message.</p>
                    </Step>
                    <Step n={7} title="Connect, then set up the webhook">
                        <p>Fill in the form. Once connected, copy the Callback URL and Verify token shown here into WhatsApp → <b>Configuration</b> → Webhook, and subscribe to <b>messages</b>.</p>
                    </Step>
                </ol>
            </section>

            <form onSubmit={submit} className="lg:col-span-5 bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 pb-rise space-y-4">
                <div>
                    <h2 className="text-[18px] font-semibold tracking-tight">{account ? 'Update connection' : 'Connect WhatsApp'}</h2>
                    <p className="text-[12px] text-ink-500 mt-0.5">We check these with Meta and store the token encrypted.</p>
                </div>
                <div>
                    <label className={label}>WhatsApp Business Account ID *</label>
                    <input value={data.waba_id} onChange={(e) => setData('waba_id', e.target.value.trim())} inputMode="numeric" placeholder="e.g. 102290129340398" className={input} />
                    {errors.waba_id && <p className="text-[11px] text-danger mt-1">{errors.waba_id}</p>}
                </div>
                <div>
                    <label className={label}>Phone number ID *</label>
                    <input value={data.phone_number_id} onChange={(e) => setData('phone_number_id', e.target.value.trim())} inputMode="numeric" placeholder="e.g. 106540352242922" className={input} />
                    {errors.phone_number_id && <p className="text-[11px] text-danger mt-1">{errors.phone_number_id}</p>}
                </div>
                <div>
                    <label className={label}>Permanent access token {hasToken ? '(leave blank to keep)' : '*'}</label>
                    <input type="password" autoComplete="off" value={data.access_token} onChange={(e) => setData('access_token', e.target.value)} placeholder={hasToken ? account!.token_hint! : 'EAAG…'} className={input} />
                    {errors.access_token && <p className="text-[11px] text-danger mt-1">{errors.access_token}</p>}
                </div>
                <div>
                    <label className={label}>App secret {account?.has_app_secret ? '(leave blank to keep)' : '(for delivery ticks + replies)'}</label>
                    <input type="password" autoComplete="off" value={data.app_secret} onChange={(e) => setData('app_secret', e.target.value)} className={input} />
                    {errors.app_secret && <p className="text-[11px] text-danger mt-1">{errors.app_secret}</p>}
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    {onCancel && <button type="button" onClick={onCancel} className={btnOutline}>Cancel</button>}
                    <button type="submit" disabled={processing} className={btnPrimary}>{processing && <Spinner size={13} />}{account ? 'Save & check' : 'Connect'}</button>
                </div>
            </form>
        </div>
    );
}

const STARTER = `Hi {{1}}, I'm {{2}}, a property specialist focused on {{3}}. I put together free current-market value reports for local homeowners, based on recent sales and buyer demand in your area.

Would you like one for your property? Just reply YES and I'll send it through.`;

function NewTemplateModal({ agentName, onClose }: { agentName: string; onClose: () => void }) {
    const { data, setData, post, processing, errors } = useForm({
        name: 'home_value_report',
        category: 'MARKETING',
        language: 'en',
        body: STARTER,
        footer: 'Reply STOP to unsubscribe',
        examples: { '1': 'Thabo', '2': agentName, '3': 'Sunnyside' } as Record<string, string>,
    });
    const params = Array.from(new Set([...data.body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1])));

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agent/crm/whatsapp/templates', { preserveScroll: true, onSuccess: onClose });
    }

    return (
        <div className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-4" onClick={onClose}>
            <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-lift w-full max-w-xl p-6 space-y-4 max-h-[92vh] overflow-y-auto">
                <div>
                    <h2 className="text-lg font-semibold">New message template</h2>
                    <p className="text-[12.5px] text-ink-500 mt-0.5">Meta reviews every template, usually within minutes to a day. Use {'{{1}}'}, {'{{2}}'}… where each owner’s details go.</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-3 sm:col-span-1">
                        <label className={label}>Name *</label>
                        <input value={data.name} onChange={(e) => setData('name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} className={input} />
                        {errors.name && <p className="text-[11px] text-danger mt-1">{errors.name}</p>}
                    </div>
                    <div>
                        <label className={label}>Category</label>
                        <select value={data.category} onChange={(e) => setData('category', e.target.value)} className={input}>
                            <option value="MARKETING">Marketing</option>
                            <option value="UTILITY">Utility</option>
                        </select>
                    </div>
                    <div>
                        <label className={label}>Language</label>
                        <select value={data.language} onChange={(e) => setData('language', e.target.value)} className={input}>
                            <option value="en">English</option><option value="en_GB">English (UK)</option><option value="en_US">English (US)</option>
                            <option value="af">Afrikaans</option><option value="zu">isiZulu</option><option value="xh">isiXhosa</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className={label}>Message *</label>
                    <textarea rows={7} value={data.body} onChange={(e) => setData('body', e.target.value)} maxLength={1024} className={input + ' leading-relaxed'} />
                    {errors.body && <p className="text-[11px] text-danger mt-1">{errors.body}</p>}
                </div>
                {params.length > 0 && (
                    <div>
                        <label className={label}>Example values (Meta needs these to review)</label>
                        <div className="grid grid-cols-3 gap-2">
                            {params.map((p) => (
                                <input key={p} value={data.examples[p] ?? ''} onChange={(e) => setData('examples', { ...data.examples, [p]: e.target.value })} placeholder={`{{${p}}}`} className={input + ' !py-2 !text-[12.5px]'} />
                            ))}
                        </div>
                    </div>
                )}
                <div>
                    <label className={label}>Footer</label>
                    <input value={data.footer} onChange={(e) => setData('footer', e.target.value)} maxLength={60} className={input} />
                    <p className="text-[11px] text-ink-500 mt-1">Keep an opt-out line. Owners who reply STOP are never messaged again.</p>
                </div>
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className={btnOutline}>Cancel</button>
                    <button type="submit" disabled={processing} className={btnPrimary}>{processing && <Spinner size={13} />}Submit to Meta</button>
                </div>
            </form>
        </div>
    );
}
