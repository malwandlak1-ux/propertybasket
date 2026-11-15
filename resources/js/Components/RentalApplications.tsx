import { router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/Components/Skeleton';

export type AppRow = {
    id: number;
    status: 'invited' | 'in_progress' | 'submitted' | 'reviewing' | 'approved' | 'declined';
    name: string;
    email: string | null;
    phone: string | null;
    listing: { id: number; title: string; suburb: string | null; rent: number } | null;
    agent: string | null;
    employment_type: 'salary' | 'self_employed' | null;
    income: number;
    rent_to_income: number | null;
    url: string;
    created: string | null;
    opened: boolean;
    submitted: string | null;
    decided: string | null;
    note: string | null;
    data: Record<string, Record<string, string | number | boolean | null>>;
    missing: string[];
    documents: { id: number; kind: string; name: string; size: number; url: string }[];
    base: string;
    lease: { id: number; created: string | null } | null;
    can_lease: boolean;
    listing_leased: boolean;
    lease_defaults: { tenant_name: string; tenant_email: string; tenant_phone: string; start_date: string; end_date: string; monthly_rent: number | null; deposit_amount: number | null };
};

type Props = {
    base: '/agent/tenants' | '/agency/tenants';
    applications: AppRow[];
    listings: { id: number; label: string; rent: number }[];
    documentKinds: Record<string, string>;
    query: string;
    showAgent?: boolean;
};

const STATUS: Record<AppRow['status'], { label: string; cls: string }> = {
    invited: { label: 'Link sent', cls: 'bg-ink-100 text-ink-600' },
    in_progress: { label: 'Filling in', cls: 'bg-sky-100 text-sky-700' },
    submitted: { label: 'Submitted', cls: 'bg-brand-100 text-brand-700' },
    reviewing: { label: 'Reviewing', cls: 'bg-violet-100 text-violet-700' },
    approved: { label: 'Approved', cls: 'bg-success/15 text-success' },
    declined: { label: 'Declined', cls: 'bg-danger/10 text-danger' },
};

const FILTERS: { key: string; label: string; match: (s: AppRow['status']) => boolean }[] = [
    { key: 'all', label: 'All', match: () => true },
    { key: 'review', label: 'To review', match: (s) => s === 'submitted' || s === 'reviewing' },
    { key: 'pending', label: 'Not submitted', match: (s) => s === 'invited' || s === 'in_progress' },
    { key: 'done', label: 'Decided', match: (s) => s === 'approved' || s === 'declined' },
];

const R = (n: number) => 'R ' + Math.round(n).toLocaleString('en-ZA').replace(/,/g, ' ');
const field = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 mt-1';
const btn = 'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition disabled:opacity-50';

export default function RentalApplications({ base, applications, listings, documentKinds, query, showAgent }: Props) {
    const [filter, setFilter] = useState('all');
    const [creating, setCreating] = useState(false);
    const [openId, setOpenId] = useState<number | null>(() => {
        const id = Number(new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('application'));
        return id || null;
    });
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;

    const list = useMemo(() => {
        const q = query.trim().toLowerCase();
        const f = FILTERS.find((x) => x.key === filter)!;
        return applications.filter((a) => f.match(a.status) && (!q || a.name.toLowerCase().includes(q) || (a.email ?? '').toLowerCase().includes(q) || (a.listing?.title ?? '').toLowerCase().includes(q)));
    }, [applications, filter, query]);
    const open = applications.find((a) => a.id === openId) ?? null;
    const toReview = applications.filter((a) => a.status === 'submitted').length;

    return (
        <div>
            {flash?.success && <div className="mb-4 rounded-2xl bg-success/10 border border-success/30 text-success px-5 py-3 text-[13px] font-medium">{flash.success}</div>}
            {flash?.error && <div className="mb-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger px-5 py-3 text-[13px] font-medium">{flash.error}</div>}

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap gap-1.5">
                    {FILTERS.map((f) => (
                        <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={`px-3 py-1.5 rounded-full text-[12px] font-semibold ${filter === f.key ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100'}`}>
                            {f.label} <span className="text-ink-400">{applications.filter((a) => f.match(a.status)).length}</span>
                        </button>
                    ))}
                </div>
                <button type="button" onClick={() => setCreating(true)} className={`${btn} bg-brand-700 text-white hover:bg-brand-800`}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                    New application link
                </button>
            </div>

            {toReview > 0 && filter === 'all' && (
                <div className="mb-4 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 text-[13px] text-ink-700">
                    <strong>{toReview}</strong> {toReview === 1 ? 'application is' : 'applications are'} waiting for your review.
                </div>
            )}

            {list.length === 0 ? (
                <div className="bg-white rounded-2xl border border-ink-200/60 p-14 text-center shadow-soft">
                    <p className="text-[15px] font-semibold text-ink-700 mb-1">{applications.length ? 'Nothing here' : 'No applications yet'}</p>
                    <p className="text-[13px] text-ink-500 max-w-md mx-auto">Create an application link for one of your rentals and send it to a prospect tenant. They fill in their details and upload their documents online, and the application lands here.</p>
                    {!applications.length && <button type="button" onClick={() => setCreating(true)} className={`${btn} bg-brand-700 text-white hover:bg-brand-800 mt-5`}>New application link</button>}
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-500 border-b border-ink-100">
                                    <th className="px-4 py-3 font-semibold">Applicant</th>
                                    <th className="px-4 py-3 font-semibold">Property</th>
                                    {showAgent && <th className="px-4 py-3 font-semibold">Agent</th>}
                                    <th className="px-4 py-3 font-semibold">Income</th>
                                    <th className="px-4 py-3 font-semibold">Docs</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((a) => (
                                    <tr key={a.id} onClick={() => setOpenId(a.id)} className="border-b border-ink-100 last:border-0 hover:bg-ink-50 cursor-pointer">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-ink-900">{a.name}</p>
                                            <p className="text-[11.5px] text-ink-500">{a.submitted ? `Submitted ${a.submitted}` : `Link created ${a.created}${a.opened ? ' · opened' : ''}`}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-ink-800 truncate max-w-[220px]">{a.listing?.title ?? '—'}</p>
                                            {a.listing && <p className="text-[11.5px] text-ink-500">{R(a.listing.rent)}/mo</p>}
                                        </td>
                                        {showAgent && <td className="px-4 py-3 text-ink-700">{a.agent ?? '—'}</td>}
                                        <td className="px-4 py-3 tabular-nums">
                                            {a.income > 0 ? <>{R(a.income)}{a.rent_to_income !== null && <span className={`block text-[11px] ${a.rent_to_income > 33 ? 'text-warning' : 'text-ink-500'}`}>Rent is {a.rent_to_income}% of income</span>}</> : <span className="text-ink-400">—</span>}
                                        </td>
                                        <td className="px-4 py-3">{a.documents.length}{a.missing.length > 0 && <span className="block text-[11px] text-warning">{a.missing.length} missing</span>}</td>
                                        <td className="px-4 py-3"><span className={`text-[10.5px] px-2.5 py-1 rounded-full font-bold uppercase ${STATUS[a.status].cls}`}>{STATUS[a.status].label}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {creating && <NewLinkModal base={base} listings={listings} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setOpenId(-1); }} />}
            {(open ?? (openId === -1 ? applications[0] : null)) && <Details app={(open ?? applications[0])!} documentKinds={documentKinds} onClose={() => setOpenId(null)} />}
        </div>
    );
}

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
    useEffect(() => {
        const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 p-0 sm:p-4" onClick={onClose}>
            <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className={`bg-white w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-lift`}>
                {children}
            </div>
        </div>
    );
}

function NewLinkModal({ base, listings, onClose, onCreated }: { base: string; listings: Props['listings']; onClose: () => void; onCreated: () => void }) {
    const { data, setData, post, processing, errors } = useForm({ listing_id: listings[0]?.id ?? 0, invitee_name: '', invitee_email: '', invitee_phone: '', send_email: true });

    return (
        <Modal onClose={onClose}>
            <form onSubmit={(e) => { e.preventDefault(); post(`${base}/applications`, { preserveScroll: true, onSuccess: onCreated }); }} className="p-5 sm:p-6 space-y-3">
                <h2 className="text-[20px]">New application link</h2>
                <p className="text-[13px] text-ink-500">The prospect gets a private link to apply for this property online, with their details and documents. You can share the link yourself on WhatsApp too.</p>
                {listings.length === 0 ? (
                    <p className="text-[13px] text-warning bg-warning/10 rounded-xl px-3.5 py-2.5">You have no rental listings yet. Add a long-term rental listing first.</p>
                ) : (
                    <label className="block text-[12px] font-semibold text-ink-700">Property
                        <select value={data.listing_id} onChange={(e) => setData('listing_id', Number(e.target.value))} className={field}>
                            {listings.map((l) => <option key={l.id} value={l.id}>{l.label} · {R(l.rent)}/mo</option>)}
                        </select>
                        {errors.listing_id && <span className="text-danger text-[11px]">{errors.listing_id}</span>}
                    </label>
                )}
                <label className="block text-[12px] font-semibold text-ink-700">Prospect’s name <span className="font-normal text-ink-500">(optional)</span>
                    <input value={data.invitee_name} onChange={(e) => setData('invitee_name', e.target.value)} className={field} />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-[12px] font-semibold text-ink-700">Email <span className="font-normal text-ink-500">(optional)</span>
                        <input type="email" value={data.invitee_email} onChange={(e) => setData('invitee_email', e.target.value)} className={field} />
                        {errors.invitee_email && <span className="text-danger text-[11px]">{errors.invitee_email}</span>}
                    </label>
                    <label className="block text-[12px] font-semibold text-ink-700">Mobile <span className="font-normal text-ink-500">(for WhatsApp)</span>
                        <input value={data.invitee_phone} onChange={(e) => setData('invitee_phone', e.target.value)} className={field} placeholder="082 123 4567" />
                    </label>
                </div>
                {data.invitee_email && (
                    <label className="flex items-center gap-2 text-[13px] text-ink-700">
                        <input type="checkbox" checked={data.send_email} onChange={(e) => setData('send_email', e.target.checked)} /> Email the link to them now
                    </label>
                )}
                <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={processing || !listings.length} className={`${btn} bg-brand-700 text-white hover:bg-brand-800`}>{processing ? <><Spinner size={14} />Creating…</> : 'Create link'}</button>
                    <button type="button" onClick={onClose} className={`${btn} border border-ink-300 text-ink-800`}>Cancel</button>
                </div>
            </form>
        </Modal>
    );
}

function waLink(phone: string | null, text: string): string {
    let p = (phone ?? '').replace(/\D/g, '');
    if (p.startsWith('0')) p = '27' + p.slice(1);
    return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

const SECTIONS: { key: string; title: string; fields: [string, string][] }[] = [
    { key: 'personal', title: 'Personal details', fields: [['first_name', 'First name'], ['last_name', 'Surname'], ['id_type', 'ID type'], ['id_number', 'ID / passport'], ['date_of_birth', 'Date of birth'], ['nationality', 'Nationality'], ['email', 'Email'], ['phone', 'Mobile'], ['marital_status', 'Marital status'], ['adults', 'Adults'], ['children', 'Children'], ['pets', 'Pets'], ['pets_details', 'Pet details']] },
    { key: 'address', title: 'Current address', fields: [['current_address', 'Address'], ['residence_type', 'Living arrangement'], ['years_at_address', 'Years there'], ['current_rent', 'Current rent'], ['landlord_name', 'Landlord / agent'], ['landlord_phone', 'Landlord phone'], ['reason_for_moving', 'Reason for moving']] },
    { key: 'employment', title: 'Employment & income', fields: [['employer', 'Employer'], ['job_title', 'Job title'], ['employer_phone', 'Employer phone'], ['employment_start', 'Employed since'], ['business_name', 'Business'], ['business_reg', 'Registration no.'], ['business_nature', 'Nature of business'], ['years_trading', 'Years trading'], ['gross_income', 'Gross monthly income'], ['net_income', 'Net monthly income'], ['other_income', 'Other income'], ['monthly_debt', 'Monthly debt repayments']] },
    { key: 'contact', title: 'Emergency contact', fields: [['kin_name', 'Name'], ['kin_relationship', 'Relationship'], ['kin_phone', 'Phone']] },
    { key: 'lease', title: 'Lease', fields: [['move_in_date', 'Move-in date'], ['lease_term', 'Lease term (months)'], ['vehicles', 'Vehicles'], ['notes', 'Notes']] },
];
const MONEY = new Set(['current_rent', 'gross_income', 'net_income', 'other_income', 'monthly_debt']);
const LABELS: Record<string, string> = { sa_id: 'SA ID', passport: 'Passport', renting: 'Renting', own: 'Owns home', family: 'Lives with family', other: 'Other' };

function show(k: string, v: unknown): string | null {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (MONEY.has(k) && !isNaN(Number(v))) return R(Number(v));
    return LABELS[String(v)] ?? String(v);
}

function Details({ app, documentKinds, onClose }: { app: AppRow; documentKinds: Record<string, string>; onClose: () => void }) {
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [note, setNote] = useState(app.note ?? '');
    const [notify, setNotify] = useState(true);
    const submitted = !['invited', 'in_progress'].includes(app.status);
    const shareText = `Hi${app.name !== 'New applicant' ? ' ' + app.name.split(' ')[0] : ''}, please complete your rental application${app.listing ? ' for ' + app.listing.title : ''} here: ${app.url}`;

    function decide(status: string) {
        setBusy(status);
        router.patch(app.base, { status, note, notify }, { preserveScroll: true, onFinish: () => setBusy(null) });
    }

    return (
        <Modal onClose={onClose} wide>
            <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-[20px]">{app.name}</h2>
                        <p className="text-[12.5px] text-ink-500 mt-0.5">{app.listing ? `${app.listing.title} · ${R(app.listing.rent)}/mo` : 'No property'}{app.agent ? ` · ${app.agent}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-[10.5px] px-2.5 py-1 rounded-full font-bold uppercase ${STATUS[app.status].cls}`}>{STATUS[app.status].label}</span>
                        <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-ink-100 grid place-items-center text-ink-500">✕</button>
                    </div>
                </div>

                {/* Link + sharing */}
                <div className="mt-4 rounded-xl border border-ink-200 p-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">Application link</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <code className="flex-1 min-w-0 truncate text-[12px] bg-ink-50 rounded-lg px-2.5 py-1.5">{app.url}</code>
                        <button type="button" onClick={() => { navigator.clipboard?.writeText(app.url); setCopied(true); setTimeout(() => setCopied(false), 1800); }} className={`${btn} !py-1.5 border border-ink-300 text-ink-800`}>{copied ? 'Copied ✓' : 'Copy'}</button>
                        <a href={waLink(app.phone, shareText)} target="_blank" rel="noopener noreferrer" className={`${btn} !py-1.5 bg-[#25D366] text-white`}>WhatsApp</a>
                        {app.email && !submitted && <button type="button" disabled={busy === 'send'} onClick={() => { setBusy('send'); router.post(`${app.base}/send`, {}, { preserveScroll: true, onFinish: () => setBusy(null) }); }} className={`${btn} !py-1.5 border border-ink-300 text-ink-800`}>Email link</button>}
                    </div>
                    <p className="text-[11.5px] text-ink-500 mt-1.5">{app.submitted ? `Submitted ${app.submitted}.` : app.opened ? 'The applicant has opened the link and is filling it in.' : 'Not opened yet.'}</p>
                </div>

                {submitted ? (
                    <>
                        {/* Affordability */}
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <Stat label="Employment" value={app.employment_type === 'self_employed' ? 'Self-employed' : 'Salary earner'} />
                            <Stat label="Gross income" value={app.income ? R(app.income) : '—'} />
                            <Stat label="Net income" value={show('net_income', app.data.employment?.net_income) ?? '—'} />
                            <Stat label="Rent to income" value={app.rent_to_income !== null ? `${app.rent_to_income}%` : '—'} tone={app.rent_to_income !== null && app.rent_to_income > 33 ? 'warn' : undefined} hint="Guideline: rent no more than about a third of gross income." />
                        </div>

                        {SECTIONS.map((s) => {
                            const rows = s.fields.map(([k, label]) => [label, show(k, app.data[s.key]?.[k])] as const).filter(([, v]) => v !== null);
                            if (!rows.length) return null;
                            return (
                                <section key={s.key} className="mt-4">
                                    <h3 className="text-[14px] mb-1.5">{s.title}</h3>
                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
                                        {rows.map(([label, v]) => (
                                            <div key={label} className="flex justify-between gap-3 border-b border-ink-100 py-1"><dt className="text-ink-500">{label}</dt><dd className="text-ink-900 text-right break-words">{v}</dd></div>
                                        ))}
                                    </dl>
                                </section>
                            );
                        })}

                        <section className="mt-4">
                            <h3 className="text-[14px] mb-1.5">Documents</h3>
                            {app.missing.length > 0 && <p className="text-[12px] text-warning mb-1.5">Missing: {app.missing.map((k) => documentKinds[k] ?? k).join(', ')}</p>}
                            {app.documents.length === 0 ? <p className="text-[12.5px] text-ink-500">None uploaded.</p> : (
                                <ul className="divide-y divide-ink-100 text-[13px]">
                                    {app.documents.map((d) => (
                                        <li key={d.id} className="flex items-center gap-3 py-1.5">
                                            <span className="text-[11px] font-semibold text-ink-500 w-40 shrink-0 truncate">{documentKinds[d.kind] ?? d.kind}</span>
                                            <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-brand-700 font-medium hover:underline">{d.name}</a>
                                            <span className="text-[11px] text-ink-400">{Math.max(1, Math.round(d.size / 1024))} KB</span>
                                            <a href={`${d.url}?download=1`} className="text-[11.5px] font-semibold text-ink-600 hover:underline">Download</a>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {app.data.consent?.signature_name && <p className="mt-3 text-[11.5px] text-ink-500">Signed “{String(app.data.consent.signature_name)}”, consenting to credit and reference checks (POPIA).</p>}

                        <LeaseSection app={app} />

                        {/* Decision */}
                        <section className="mt-5 rounded-xl bg-ink-50 p-4 space-y-3">
                            <h3 className="text-[14px]">Decision</h3>
                            {app.decided && <p className="text-[12.5px] text-ink-600">{STATUS[app.status].label} on {app.decided}.</p>}
                            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (optional): shown to the applicant if you email them" className={field} />
                            <label className="flex items-center gap-2 text-[13px] text-ink-700"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Email the applicant about my decision</label>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" disabled={!!busy} onClick={() => decide('approved')} className={`${btn} bg-success text-white`}>{busy === 'approved' ? <Spinner size={14} /> : null}Approve</button>
                                <button type="button" disabled={!!busy} onClick={() => decide('declined')} className={`${btn} bg-danger text-white`}>{busy === 'declined' ? <Spinner size={14} /> : null}Decline</button>
                                {app.status === 'submitted' && <button type="button" disabled={!!busy} onClick={() => decide('reviewing')} className={`${btn} border border-ink-300 text-ink-800`}>Mark as reviewing</button>}
                                <button type="button" disabled={!!busy} onClick={() => confirm('Let the applicant edit and resubmit using the same link?') && decide('in_progress')} className={`${btn} border border-ink-300 text-ink-800`}>Reopen for changes</button>
                            </div>
                        </section>
                    </>
                ) : (
                    <p className="mt-4 text-[13px] text-ink-600">The details and documents appear here once the applicant submits. Answers so far: {Object.keys(app.data).length ? Object.keys(app.data).length + ' section(s) started' : 'none yet'}, {app.documents.length} document(s).</p>
                )}

                <div className="mt-5 pt-4 border-t border-ink-100 flex justify-end">
                    <button type="button" onClick={() => confirm('Delete this application and its documents? This cannot be undone.') && router.delete(app.base, { preserveScroll: true, onSuccess: onClose })} className="text-[12.5px] font-semibold text-danger hover:underline">Delete application</button>
                </div>
            </div>
        </Modal>
    );
}

function LeaseSection({ app }: { app: AppRow }) {
    const [open, setOpen] = useState(false);
    const d = app.lease_defaults;
    const { data, setData, post, processing, errors } = useForm({
        tenant_name: d.tenant_name,
        tenant_email: d.tenant_email,
        tenant_phone: d.tenant_phone,
        start_date: d.start_date,
        end_date: d.end_date,
        monthly_rent: d.monthly_rent ?? '',
        deposit_amount: d.deposit_amount ?? '',
    });
    const tenantsUrl = app.base.replace(/\/applications\/\d+$/, '');

    if (app.lease) {
        return (
            <section className="mt-5 rounded-xl border border-success/30 bg-success/5 p-4">
                <p className="text-[14px] font-semibold text-success">✓ Lease created{app.lease.created ? ` on ${app.lease.created}` : ''}</p>
                <p className="text-[12.5px] text-ink-600 mt-0.5">The tenant was invited to the platform to sign it. Track it under Active tenants.</p>
                <a href={tenantsUrl} className="inline-block mt-2 text-[12.5px] font-semibold text-brand-700 hover:underline">Open Active tenants →</a>
            </section>
        );
    }
    if (app.listing_leased) {
        return <p className="mt-5 rounded-xl bg-warning/10 text-[12.5px] text-ink-700 px-4 py-3">This property is already leased, so a lease can’t be created from this application. Reactivate the listing first if the previous lease has ended.</p>;
    }
    if (!app.can_lease) return null;

    return (
        <section className="mt-5 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
            {!open ? (
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[220px]">
                        <p className="text-[14px] font-semibold text-ink-900">Ready to rent to {app.name.split(' ')[0]}?</p>
                        <p className="text-[12.5px] text-ink-600">Creates the lease from this application, invites them to the platform to sign it, and takes the listing off the public site.</p>
                    </div>
                    <button type="button" onClick={() => setOpen(true)} className={`${btn} bg-brand-700 text-white hover:bg-brand-800`}>Create lease from this application</button>
                </div>
            ) : (
                <form onSubmit={(e) => { e.preventDefault(); post(`${app.base}/lease`, { preserveScroll: true }); }} className="space-y-3">
                    <h3 className="text-[15px]">Create lease</h3>
                    <p className="text-[12px] text-ink-500">Filled in from the application. Check the dates, rent and deposit.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="block text-[12px] font-semibold text-ink-700">Tenant name
                            <input value={data.tenant_name} onChange={(e) => setData('tenant_name', e.target.value)} className={field} required />
                            {errors.tenant_name && <span className="text-danger text-[11px]">{errors.tenant_name}</span>}
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Email
                            <input type="email" value={data.tenant_email} onChange={(e) => setData('tenant_email', e.target.value)} className={field} required />
                            {errors.tenant_email && <span className="text-danger text-[11px]">{errors.tenant_email}</span>}
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Mobile
                            <input value={data.tenant_phone} onChange={(e) => setData('tenant_phone', e.target.value)} className={field} />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Lease start
                            <input type="date" value={data.start_date} onChange={(e) => setData('start_date', e.target.value)} className={field} required />
                            {errors.start_date && <span className="text-danger text-[11px]">{errors.start_date}</span>}
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Lease end
                            <input type="date" value={data.end_date} onChange={(e) => setData('end_date', e.target.value)} className={field} required />
                            {errors.end_date && <span className="text-danger text-[11px]">{errors.end_date}</span>}
                        </label>
                        <div />
                        <label className="block text-[12px] font-semibold text-ink-700">Monthly rent (R)
                            <input type="number" min={0} value={data.monthly_rent} onChange={(e) => setData('monthly_rent', e.target.value)} className={field} required />
                            {errors.monthly_rent && <span className="text-danger text-[11px]">{errors.monthly_rent}</span>}
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Deposit (R)
                            <input type="number" min={0} value={data.deposit_amount} onChange={(e) => setData('deposit_amount', e.target.value)} className={field} />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <button type="submit" disabled={processing} className={`${btn} bg-brand-700 text-white hover:bg-brand-800`}>{processing ? <><Spinner size={14} />Creating…</> : 'Create lease & invite tenant'}</button>
                        <button type="button" onClick={() => setOpen(false)} className={`${btn} border border-ink-300 text-ink-800`}>Cancel</button>
                    </div>
                    <p className="text-[11.5px] text-ink-500">The application is marked approved. The tenant gets an email to set up their login, then sees your lease agreement on their dashboard to sign.</p>
                </form>
            )}
        </section>
    );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'warn'; hint?: string }) {
    return (
        <div className="rounded-xl border border-ink-200 px-3 py-2.5" title={hint}>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-500">{label}</p>
            <p className={`text-[15px] font-semibold mt-0.5 ${tone === 'warn' ? 'text-warning' : 'text-ink-900'}`}>{value}</p>
        </div>
    );
}
