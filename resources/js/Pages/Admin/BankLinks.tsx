import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { FlashBanners, PageHeader, SectionCard, btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';

type Stage = 'requested' | 'agreement' | 'credentials' | 'testing' | 'live' | 'paused';

type Link = {
    id: number;
    agency: string | null;
    bank: string;
    status: Stage;
    trust: string | null;
    trust_verified: boolean;
    contact: string;
    banker_name: string | null;
    banker_email: string | null;
    notes: string | null;
    client_code: string | null;
    sftp_host: string | null;
    sftp_port: number;
    sftp_username: string | null;
    has_password: boolean;
    has_key: boolean;
    upload_dir: string;
    download_dir: string;
    requested_at: string | null;
    live_at: string | null;
    last_polled_at: string | null;
    last_error: string | null;
    files: { id: number; direction: 'in' | 'out'; name: string; summary: string | null; at: string | null }[];
};

const STAGES: { key: Stage; label: string; hint: string }[] = [
    { key: 'requested', label: 'Requested', hint: 'Agency asked for a direct link. Contact them and their banker.' },
    { key: 'agreement', label: 'Bank agreement', hint: 'Agency is signing the host-to-host agreement with the bank (Property Basket as technical provider).' },
    { key: 'credentials', label: 'Credentials', hint: 'Bank issued SFTP details, keys and its file spec. Capture them below.' },
    { key: 'testing', label: 'Testing', hint: 'Payouts go to the bank’s test server. Exchange test files until the bank signs off.' },
    { key: 'live', label: 'Live', hint: 'Agency can choose the direct payout method. Use the bank’s production server details.' },
    { key: 'paused', label: 'Paused', hint: 'No payouts go through the link.' },
];

const TONE: Record<Stage, string> = {
    requested: 'bg-warning/15 text-warning',
    agreement: 'bg-sky-100 text-sky-700',
    credentials: 'bg-sky-100 text-sky-700',
    testing: 'bg-violet-100 text-violet-700',
    live: 'bg-success/15 text-success',
    paused: 'bg-ink-100 text-ink-600',
};

export default function BankLinks({ links }: { links: Link[] }) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;

    return (
        <AdminLayout crumb="Bank Links" section="Financials">
            <Head title="Bank Links" />
            <div className="px-4 sm:px-7 py-6 max-w-5xl">
                <PageHeader title="Bank Links" subtitle="Agencies paying commission straight from their bank (host-to-host). FNB first." />
                <FlashBanners flash={flash} />
                {links.length === 0 ? (
                    <SectionCard title="No requests yet" subtitle="Agencies request a direct link under Settings → Payouts.">
                        <p className="text-[13px] text-ink-500 px-5 pb-5">When one does, you’ll get a bell notification and an email, and it appears here.</p>
                    </SectionCard>
                ) : (
                    <div className="space-y-4">{links.map((l) => <LinkCard key={l.id} link={l} />)}</div>
                )}
            </div>
        </AdminLayout>
    );
}

function LinkCard({ link }: { link: Link }) {
    const [editing, setEditing] = useState(link.status !== 'live');
    const { data, setData, patch, processing, errors } = useForm({
        status: link.status,
        client_code: link.client_code ?? '',
        banker_name: link.banker_name ?? '',
        banker_email: link.banker_email ?? '',
        notes: link.notes ?? '',
        sftp_host: link.sftp_host ?? '',
        sftp_port: String(link.sftp_port ?? 22),
        sftp_username: link.sftp_username ?? '',
        sftp_password: '',
        sftp_private_key: '',
        upload_dir: link.upload_dir,
        download_dir: link.download_dir,
    });
    const field = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 mt-1';
    const stage = STAGES.find((s) => s.key === data.status);

    function save() {
        patch(`/admin/bank-links/${link.id}`, { preserveScroll: true, onSuccess: () => setData((d) => ({ ...d, sftp_password: '', sftp_private_key: '' })) });
    }

    return (
        <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-[16px] font-semibold">{link.agency} <span className="text-ink-500 font-normal">· {link.bank}</span></p>
                    <p className="text-[12px] text-ink-500 mt-0.5">
                        Trust account: {link.trust ?? 'not captured'} {link.trust_verified ? '· verified' : '· NOT verified'} · requested {link.requested_at ?? '—'}{link.live_at ? ` · live since ${link.live_at}` : ''}
                    </p>
                    <p className="text-[12px] text-ink-600 mt-1">Contact: {link.contact || '—'}</p>
                </div>
                <span className={`text-[10.5px] px-2.5 py-1 rounded-full font-bold uppercase ${TONE[link.status]}`}>{link.status}</span>
            </div>

            {link.last_error && <p className="mt-3 text-[12px] text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">Last error: {link.last_error}</p>}

            <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditing(!editing)} className={btnOutline}>{editing ? 'Hide details' : 'Edit details'}</button>
                <button type="button" disabled={!link.sftp_host} onClick={() => router.post(`/admin/bank-links/${link.id}/test`, {}, { preserveScroll: true })} className={btnOutline}>Test connection</button>
                <button type="button" disabled={!link.sftp_host} onClick={() => router.post(`/admin/bank-links/${link.id}/poll`, {}, { preserveScroll: true })} className={btnOutline}>Read status files now</button>
            </div>

            {editing && (
                <div className="mt-4 space-y-3 border-t border-ink-100 pt-4">
                    <label className="block text-[12px] font-semibold text-ink-700">Stage
                        <select value={data.status} onChange={(e) => setData('status', e.target.value as Stage)} className={field}>
                            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                    </label>
                    {stage && <p className="text-[12px] text-ink-500 -mt-1">{stage.hint}</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block text-[12px] font-semibold text-ink-700">Bank banker name
                            <input value={data.banker_name} onChange={(e) => setData('banker_name', e.target.value)} className={field} />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Banker email
                            <input value={data.banker_email} onChange={(e) => setData('banker_email', e.target.value)} className={field} />
                            {errors.banker_email && <span className="text-danger text-[11px]">{errors.banker_email}</span>}
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Bank client / initiator code
                            <input value={data.client_code} onChange={(e) => setData('client_code', e.target.value)} className={`${field} font-mono`} placeholder="Issued by the bank" />
                        </label>
                        <div />
                        <label className="block text-[12px] font-semibold text-ink-700">SFTP host
                            <input value={data.sftp_host} onChange={(e) => setData('sftp_host', e.target.value)} className={`${field} font-mono`} placeholder="h2h.bank.co.za" />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Port
                            <input value={data.sftp_port} onChange={(e) => setData('sftp_port', e.target.value)} className={`${field} font-mono`} />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">SFTP username
                            <input value={data.sftp_username} onChange={(e) => setData('sftp_username', e.target.value)} autoComplete="off" className={`${field} font-mono`} />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Password {link.has_password && <span className="text-success font-normal">(saved — leave blank to keep)</span>}
                            <input type="password" value={data.sftp_password} onChange={(e) => setData('sftp_password', e.target.value)} autoComplete="new-password" className={`${field} font-mono`} />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700 sm:col-span-2">Private key (OpenSSH / PEM) {link.has_key && <span className="text-success font-normal">(saved — leave blank to keep)</span>}
                            <textarea value={data.sftp_private_key} onChange={(e) => setData('sftp_private_key', e.target.value)} rows={3} className={`${field} font-mono text-[11px]`} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Upload folder (payment files)
                            <input value={data.upload_dir} onChange={(e) => setData('upload_dir', e.target.value)} className={`${field} font-mono`} />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Download folder (status files)
                            <input value={data.download_dir} onChange={(e) => setData('download_dir', e.target.value)} className={`${field} font-mono`} />
                        </label>
                    </div>
                    <label className="block text-[12px] font-semibold text-ink-700">Notes
                        <textarea value={data.notes} onChange={(e) => setData('notes', e.target.value)} rows={2} className={field} />
                    </label>
                    <button type="button" onClick={save} disabled={processing} className={btnPrimary}>{processing ? 'Saving…' : 'Save'}</button>
                </div>
            )}

            <div className="mt-4 border-t border-ink-100 pt-3">
                <p className="text-[12px] font-semibold text-ink-700 mb-2">Files exchanged {link.last_polled_at && <span className="font-normal text-ink-500">· last checked {link.last_polled_at}</span>}</p>
                {link.files.length === 0 ? (
                    <p className="text-[12px] text-ink-500">None yet.</p>
                ) : (
                    <ul className="text-[12px] divide-y divide-ink-100">
                        {link.files.map((f) => (
                            <li key={f.id} className="py-1.5 flex flex-wrap gap-x-3">
                                <span className={`font-bold ${f.direction === 'out' ? 'text-brand-700' : 'text-sky-700'}`}>{f.direction === 'out' ? '↑ sent' : '↓ received'}</span>
                                <span className="font-mono">{f.name}</span>
                                <span className="text-ink-500">{f.summary}</span>
                                <span className="text-ink-400 ml-auto">{f.at}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
