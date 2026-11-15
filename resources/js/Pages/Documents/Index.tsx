import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import AgentLayout from '@/Layouts/AgentLayout';
import { FlashBanners, PageHeader, btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';

type Doc = { id: number; version: number; name: string; size: number; notes: string | null; uploaded_by: string | null; uploaded_at: string | null; url: string; is_pdf: boolean };
type Category = { key: 'lease_agreement' | 'rental_pack' | 'sale_pack'; label: string; hint: string; accept: string; shareable: boolean; share_url: string | null; current: Doc | null; history: Doc[] };
type Signing = { lease_id: number; tenant: string; property: string; signed_at: string | null; version: number | null; own_upload: boolean };

type Props = {
    role: 'agency' | 'agent';
    agencyName: string;
    base: string;
    categories: Category[];
    signing: Signing[] | null;
};

const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const ICON: Record<Category['key'], string> = {
    lease_agreement: 'M9 12h6M9 16h6M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
    rental_pack: 'M3 10.5 12 3l9 7.5V21H3zM9 21v-6h6v6',
    sale_pack: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
};

export default function DocumentsIndex({ role, agencyName, base, categories, signing }: Props) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const manage = role === 'agency';

    const body = (
        <div className="px-4 sm:px-7 py-6">
            <PageHeader
                title="Documentation"
                subtitle={manage
                    ? 'Your standard lease agreement and listing packs. Replace a document here and every agent (and tenant, for the lease) gets the new version straight away.'
                    : `${agencyName}’s latest documents. Always share from here so clients get the current version.`}
            />
            <FlashBanners flash={flash} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {categories.map((c) => <CategoryCard key={c.key} c={c} base={base} manage={manage} />)}
            </div>

            {manage && signing && <SigningTable rows={signing} hasTemplate={!!categories.find((c) => c.key === 'lease_agreement')?.current} />}
        </div>
    );

    return manage
        ? <AgencyLayout crumb="Documentation" agencyName={agencyName}><Head title="Documentation" />{body}</AgencyLayout>
        : <AgentLayout crumb="Documentation" agencyName={agencyName}><Head title="Documentation" />{body}</AgentLayout>;
}

function CategoryCard({ c, base, manage }: { c: Category; base: string; manage: boolean }) {
    const [copied, setCopied] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    return (
        <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col">
            <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d={ICON[c.key]} /></svg>
                </span>
                <div className="min-w-0">
                    <h2 className="text-[16px]">{c.label}</h2>
                    <p className="text-[12px] text-ink-500 mt-0.5">{c.key === 'lease_agreement' ? (manage ? c.hint : 'Your agency’s standard lease. Tenants sign it on their dashboard.') : c.hint}</p>
                </div>
            </div>

            {c.key === 'lease_agreement' && <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-brand-700">Shared with tenants to sign</p>}
            {c.key !== 'lease_agreement' && <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-ink-500">Agency & agents only</p>}

            <div className="mt-3 flex-1">
                {c.current ? (
                    <div className="rounded-xl border border-ink-200 p-3.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success">CURRENT · v{c.current.version}</span>
                            <span className="text-[11.5px] text-ink-500">{c.current.uploaded_at}{c.current.uploaded_by ? ` · ${c.current.uploaded_by}` : ''}</span>
                        </div>
                        <p className="text-[13.5px] font-semibold text-ink-900 mt-1.5 break-words">{c.current.name}</p>
                        <p className="text-[11.5px] text-ink-500">{kb(c.current.size)}{c.current.notes ? ` · ${c.current.notes}` : ''}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {c.current.is_pdf && <a href={c.current.url} target="_blank" rel="noopener noreferrer" className={`${btnOutline} !py-1.5 !px-3 !text-[12px]`}>View</a>}
                            <a href={`${c.current.url}?download=1`} className={`${btnOutline} !py-1.5 !px-3 !text-[12px]`}>Download</a>
                            {c.share_url && (
                                <>
                                    <button type="button" onClick={() => { navigator.clipboard?.writeText(c.share_url!); setCopied(true); setTimeout(() => setCopied(false), 1800); }} className={`${btnOutline} !py-1.5 !px-3 !text-[12px]`}>{copied ? 'Link copied ✓' : 'Copy share link'}</button>
                                    <a href={`https://wa.me/?text=${encodeURIComponent(`${c.label}: ${c.share_url}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full bg-[#25D366] text-white px-3 py-1.5 text-[12px] font-semibold">WhatsApp</a>
                                </>
                            )}
                        </div>
                        {c.share_url && <p className="text-[11px] text-ink-400 mt-2">The share link always opens the latest version, even after it’s replaced.</p>}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-ink-300 p-4 text-[12.5px] text-ink-500">
                        {manage ? 'Nothing uploaded yet.' : 'Your agency hasn’t uploaded this yet.'}
                        {c.key === 'lease_agreement' && manage && ' Until you do, tenants get the platform’s standard lease.'}
                    </div>
                )}
            </div>

            {manage && <Uploader c={c} base={base} />}

            {manage && c.history.length > 0 && (
                <div className="mt-3">
                    <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-[12px] font-semibold text-ink-600 hover:underline">{showHistory ? 'Hide' : 'Show'} earlier versions ({c.history.length})</button>
                    {showHistory && (
                        <ul className="mt-2 divide-y divide-ink-100 text-[12.5px]">
                            {c.history.map((d) => (
                                <li key={d.id} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="font-semibold text-ink-700">v{d.version}</span>
                                    <span className="text-ink-500 truncate max-w-[160px]">{d.name}</span>
                                    <span className="text-ink-400">{d.uploaded_at}</span>
                                    <a href={`${d.url}?download=1`} className="font-semibold text-brand-700 hover:underline ml-auto">Download</a>
                                    <button type="button" onClick={() => router.post(`${d.url}/restore`, {}, { preserveScroll: true })} className="font-semibold text-ink-600 hover:underline">Make current</button>
                                    <button type="button" onClick={() => confirm(`Delete version ${d.version}? This can’t be undone.`) && router.delete(d.url, { preserveScroll: true })} className="font-semibold text-danger hover:underline">Delete</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
}

function Uploader({ c, base }: { c: Category; base: string }) {
    const ref = useRef<HTMLInputElement>(null);
    const { data, setData, post, processing, errors, reset, progress } = useForm<{ category: string; file: File | null; notes: string }>({ category: c.key, file: null, notes: '' });

    function submit() {
        if (!data.file) return;
        if (c.current && c.key === 'lease_agreement' && !confirm('Replace the lease agreement? Tenants who haven’t signed yet will see the new version. Signed leases keep the version they signed.')) return;
        post(base, { forceFormData: true, preserveScroll: true, onSuccess: () => { reset(); if (ref.current) ref.current.value = ''; } });
    }

    return (
        <div className="mt-4 pt-4 border-t border-ink-100 space-y-2">
            <p className="text-[12px] font-semibold text-ink-700">{c.current ? 'Replace with a new version' : 'Upload'}</p>
            <input ref={ref} type="file" accept={c.accept} onChange={(e) => setData('file', e.target.files?.[0] ?? null)} className="block w-full text-[12px] file:mr-3 file:rounded-full file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold" />
            {data.file && <input value={data.notes} onChange={(e) => setData('notes', e.target.value)} placeholder="What changed? (optional)" className="w-full bg-white border border-ink-200 rounded-xl px-3 py-2 text-[12.5px] focus:outline-none focus:border-brand-300" />}
            {(errors.file || errors.category) && <p className="text-danger text-[11.5px]">{errors.file ?? errors.category}</p>}
            <button type="button" onClick={submit} disabled={!data.file || processing} className={`${btnPrimary} !py-2 !text-[12.5px]`}>
                {processing ? <><Spinner size={13} />Uploading{progress?.percentage ? ` ${progress.percentage}%` : '…'}</> : c.current ? 'Upload new version' : 'Upload'}
            </button>
        </div>
    );
}

function SigningTable({ rows, hasTemplate }: { rows: Signing[]; hasTemplate: boolean }) {
    const signed = rows.filter((r) => r.signed_at).length;

    return (
        <section className="bg-white rounded-2xl shadow-soft p-5 mt-4">
            <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
                <div>
                    <h2 className="text-[16px]">Lease signatures</h2>
                    <p className="text-[12px] text-ink-500 mt-0.5">Current tenants and whether they’ve signed. Each signed lease keeps a frozen copy of the version signed, with the time, IP address and a file fingerprint.</p>
                </div>
                <span className="text-[12.5px] font-semibold text-ink-700">{signed} of {rows.length} signed</span>
            </div>
            {rows.length === 0 ? (
                <p className="text-[12.5px] text-ink-500">No current leases yet. Once a tenant is given access, their lease shows up here.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wider text-ink-500 border-b border-ink-100">
                                <th className="py-2 pr-3 font-semibold">Tenant</th>
                                <th className="py-2 pr-3 font-semibold">Property</th>
                                <th className="py-2 pr-3 font-semibold">Agreement</th>
                                <th className="py-2 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.lease_id} className="border-b border-ink-100 last:border-0">
                                    <td className="py-2 pr-3 font-medium text-ink-900">{r.tenant}</td>
                                    <td className="py-2 pr-3 text-ink-700">{r.property}</td>
                                    <td className="py-2 pr-3 text-ink-600">{r.version ? `Agency lease v${r.version}` : r.own_upload ? 'Lease-specific upload' : hasTemplate ? 'Agency lease (current)' : 'Platform standard lease'}</td>
                                    <td className="py-2">{r.signed_at ? <span className="text-success font-semibold">Signed {r.signed_at}</span> : <span className="text-warning font-semibold">Awaiting signature</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
