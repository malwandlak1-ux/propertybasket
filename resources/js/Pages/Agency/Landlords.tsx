import { FormEvent, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';

type Property = {
    listing_id: number;
    title: string;
    suburb: string | null;
    rent: number;
    landlord_pct: number;
    agency_pct: number;
    agent_pct: number;
    agent_name: string | null;
    has_current_lease: boolean;
    landlord_due: number;
    agency_due: number;
    agent_due: number;
    paid_this_month: boolean;
};
type Landlord = {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    has_banking: boolean;
    bank_name: string | null;
    bank_account_holder: string | null;
    bank_account_masked: string | null;
    bank_branch_code: string | null;
    bank_account_type: string | null;
    properties: Property[];
    month_landlord_due: number;
};
type AvailableListing = { id: number; title: string; suburb: string | null; rent: number };
type HistoryPoint = { label: string; rent: number; landlord: number; agency: number; agent: number };
type Payout = {
    id: number; landlord: string | null; property: string | null; month: string | null;
    rent: number; landlord_amount: number; agency_amount: number; agent_amount: number; status: string;
};

type Props = {
    agency: { id: number; name: string };
    landlords: Landlord[];
    totals: { landlord_due: number; agency_due: number; agent_due: number; properties: number };
    available_listings: AvailableListing[];
    history: HistoryPoint[];
    recent_payouts: Payout[];
    current_month: string;
};
type Shared = { flash?: { success?: string | null; error?: string | null } };

function fmtMoney(n: number): string {
    return 'R ' + Math.round(n || 0).toLocaleString('en-ZA');
}

export default function Landlords({ agency, landlords, totals, available_listings, history, recent_payouts, current_month }: Props) {
    const { flash } = usePage<Shared>().props;
    const [addOpen, setAddOpen] = useState(false);
    const [linkFor, setLinkFor] = useState<Landlord | null>(null);
    const [running, setRunning] = useState(false);

    function runBatch() {
        if (running) return;
        if (! confirm(`Run the landlord payment batch for ${current_month}? This records payouts to landlords and the agency/agent split for every linked property with a current lease.`)) return;
        setRunning(true);
        router.post('/agency/landlords/run-payout', {}, { preserveScroll: true, onFinish: () => setRunning(false) });
    }

    const maxRent = Math.max(1, ...history.map((h) => h.rent));

    return (
        <AgencyLayout agencyName={agency.name} crumb="Landlords">
            <Head title="Landlords" />
            <section className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Managed Landlords</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Landlords who appointed you to manage their rentals · payouts &amp; splits for {current_month}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setAddOpen(true)} className="px-4 py-2 text-[13px] rounded-lg border border-ink-200 bg-white font-semibold hover:bg-ink-50 transition">
                            + Add landlord
                        </button>
                        <button onClick={runBatch} disabled={running} className="px-4 py-2 text-[13px] rounded-lg bg-ink-900 text-white font-semibold hover:bg-brand-500 transition disabled:opacity-50">
                            {running ? 'Running…' : 'Run payment batch'}
                        </button>
                    </div>
                </div>

                {flash?.success && <div className="mb-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">{flash.success}</div>}
                {flash?.error && <div className="mb-4 rounded-lg bg-danger/10 border border-danger/30 text-danger px-4 py-3 text-[13px]">{flash.error}</div>}

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Kpi label={`Due to landlords · ${current_month}`} value={fmtMoney(totals.landlord_due)} tone="brand" />
                    <Kpi label="Agency commission" value={fmtMoney(totals.agency_due)} />
                    <Kpi label="Agent commission" value={fmtMoney(totals.agent_due)} />
                    <Kpi label="Properties under management" value={String(totals.properties)} />
                </div>

                {/* Performance graph */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-base font-semibold">Rental performance</h2>
                            <p className="text-[12px] text-ink-500">Rent under management, split by landlord / agency / agent · last 6 months</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-3 text-[11px] text-ink-500">
                            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-brand-500" /> Landlord</span>
                            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-ink-900" /> Agency</span>
                            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-ink-300" /> Agent</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <div className="flex items-end gap-4 h-44 min-w-[420px]">
                            {history.map((h) => {
                                const h2 = (v: number) => `${Math.max((v / maxRent) * 100, 0)}%`;
                                return (
                                    <div key={h.label} className="flex-1 flex flex-col items-center gap-1.5">
                                        <div className="w-full flex items-end justify-center h-36" title={`${h.label}: ${fmtMoney(h.rent)}`}>
                                            <div className="w-7 flex flex-col-reverse rounded-t overflow-hidden">
                                                <div style={{ height: h2(h.landlord) }} className="bg-brand-500 w-full" />
                                                <div style={{ height: h2(h.agency) }} className="bg-ink-900 w-full" />
                                                <div style={{ height: h2(h.agent) }} className="bg-ink-300 w-full" />
                                            </div>
                                        </div>
                                        <span className="text-[11px] text-ink-500">{h.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Landlords */}
                {landlords.length === 0 ? (
                    <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-10 text-center text-ink-500 text-[14px]">
                        No managed landlords yet. Click <b>Add landlord</b> to capture one and link a rental property.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {landlords.map((l) => (
                            <div key={l.id} className="bg-white rounded-xl border border-ink-200 shadow-soft p-5">
                                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                                    <div>
                                        <h3 className="text-[15px] font-bold">{l.name}</h3>
                                        <p className="text-[12.5px] text-ink-500 mt-0.5">
                                            {l.email || 'no email'} · {l.phone || 'no tel'}
                                        </p>
                                        <p className="text-[12px] mt-1">
                                            {l.has_banking
                                                ? <span className="text-success font-semibold">Banking ✓ {l.bank_name} {l.bank_account_masked}</span>
                                                : <span className="text-warning font-semibold">No banking details — payouts held</span>}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[12px] text-ink-500">Due this month</span>
                                        <span className="text-[15px] font-bold text-brand-600">{fmtMoney(l.month_landlord_due)}</span>
                                        <button onClick={() => setLinkFor(l)} className="ml-2 px-3 py-1.5 text-[12px] rounded-lg border border-ink-200 font-semibold hover:bg-ink-50 transition" disabled={available_listings.length === 0}>
                                            + Link property
                                        </button>
                                    </div>
                                </div>

                                {l.properties.length === 0 ? (
                                    <p className="text-[12.5px] text-ink-400">No properties linked yet.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[640px] text-[13px]">
                                            <thead>
                                                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-400 border-b border-ink-100">
                                                    <th className="py-2 pr-3 font-semibold">Property</th>
                                                    <th className="py-2 px-3 font-semibold">Rent</th>
                                                    <th className="py-2 px-3 font-semibold">Split L / Ag / Agt</th>
                                                    <th className="py-2 px-3 font-semibold">Landlord</th>
                                                    <th className="py-2 px-3 font-semibold">Agency</th>
                                                    <th className="py-2 px-3 font-semibold">Agent</th>
                                                    <th className="py-2 pl-3 font-semibold text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {l.properties.map((p) => (
                                                    <tr key={p.listing_id} className="border-b border-ink-50 last:border-0">
                                                        <td className="py-2.5 pr-3">
                                                            <div className="font-semibold">{p.title}</div>
                                                            <div className="text-[11px] text-ink-400">{p.suburb} · {p.agent_name ?? 'no agent'}</div>
                                                        </td>
                                                        <td className="py-2.5 px-3 font-mono">{p.has_current_lease ? fmtMoney(p.rent) : '—'}</td>
                                                        <td className="py-2.5 px-3 text-ink-500">{p.landlord_pct}% / {p.agency_pct}% / {p.agent_pct}%</td>
                                                        <td className="py-2.5 px-3 font-mono font-semibold text-brand-600">{fmtMoney(p.landlord_due)}</td>
                                                        <td className="py-2.5 px-3 font-mono">{fmtMoney(p.agency_due)}</td>
                                                        <td className="py-2.5 px-3 font-mono">{fmtMoney(p.agent_due)}</td>
                                                        <td className="py-2.5 pl-3 text-right">
                                                            {! p.has_current_lease ? (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ink-100 text-ink-500">VACANT</span>
                                                            ) : p.paid_this_month ? (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success">PAID</span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">DUE</span>
                                                            )}
                                                            <button
                                                                onClick={() => { if (confirm(`Unlink "${p.title}" from ${l.name}?`)) router.post(`/agency/landlords/properties/${p.listing_id}/unlink`, {}, { preserveScroll: true }); }}
                                                                className="ml-2 text-[11px] text-ink-400 hover:text-danger"
                                                                title="Unlink"
                                                            >✕</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Recent payouts */}
                {recent_payouts.length > 0 && (
                    <div className="bg-white rounded-xl border border-ink-200 shadow-soft mt-6 overflow-hidden">
                        <div className="px-5 py-4 border-b border-ink-100"><h2 className="text-base font-semibold">Payout history</h2></div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-[13px]">
                                <thead>
                                    <tr className="text-left text-[11px] uppercase tracking-wider text-ink-400 border-b border-ink-100">
                                        <th className="py-2.5 px-5 font-semibold">Month</th>
                                        <th className="py-2.5 px-3 font-semibold">Landlord</th>
                                        <th className="py-2.5 px-3 font-semibold">Property</th>
                                        <th className="py-2.5 px-3 font-semibold">Rent</th>
                                        <th className="py-2.5 px-3 font-semibold">Landlord</th>
                                        <th className="py-2.5 px-3 font-semibold">Agency</th>
                                        <th className="py-2.5 px-3 font-semibold">Agent</th>
                                        <th className="py-2.5 px-5 font-semibold text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recent_payouts.map((p) => (
                                        <tr key={p.id} className="border-b border-ink-50 last:border-0">
                                            <td className="py-2.5 px-5">{p.month}</td>
                                            <td className="py-2.5 px-3">{p.landlord}</td>
                                            <td className="py-2.5 px-3 text-ink-500">{p.property}</td>
                                            <td className="py-2.5 px-3 font-mono">{fmtMoney(p.rent)}</td>
                                            <td className="py-2.5 px-3 font-mono font-semibold text-brand-600">{fmtMoney(p.landlord_amount)}</td>
                                            <td className="py-2.5 px-3 font-mono">{fmtMoney(p.agency_amount)}</td>
                                            <td className="py-2.5 px-3 font-mono">{fmtMoney(p.agent_amount)}</td>
                                            <td className="py-2.5 px-5 text-right">
                                                <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full ' + (p.status === 'paid' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>
                                                    {p.status.toUpperCase()}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </section>

            {addOpen && <AddLandlordModal onClose={() => setAddOpen(false)} />}
            {linkFor && <LinkPropertyModal landlord={linkFor} listings={available_listings} onClose={() => setLinkFor(null)} />}
        </AgencyLayout>
    );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'brand' }) {
    return (
        <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-4">
            <p className="text-[11px] uppercase tracking-wider text-ink-400">{label}</p>
            <p className={'text-2xl font-bold mt-1 ' + (tone === 'brand' ? 'text-brand-600' : '')}>{value}</p>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="text-[12px] font-semibold text-ink-700 mb-1.5 block">{label}</span>
            {children}
        </label>
    );
}
const inputCls = 'w-full text-[14px] px-3 py-2 border border-ink-200 rounded-lg bg-ink-50 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition';

function AddLandlordModal({ onClose }: { onClose: () => void }) {
    const [form, setForm] = useState({
        name: '', email: '', phone: '',
        bank_name: '', bank_account_holder: '', bank_account_number: '', bank_branch_code: '', bank_account_type: '',
    });
    const [saving, setSaving] = useState(false);
    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

    function submit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        router.post('/agency/landlords', form, { preserveScroll: true, onSuccess: onClose, onFinish: () => setSaving(false) });
    }

    return (
        <Modal title="Add managed landlord" onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Full name *"><input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} required /></Field>
                    <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="082 123 4567" /></Field>
                </div>
                <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="landlord@email.co.za" /></Field>

                <div className="pt-2 border-t border-ink-100">
                    <p className="text-[11px] uppercase tracking-wider text-ink-400 mb-3 mt-3">Banking details (used for payouts)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Bank"><input className={inputCls} value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} /></Field>
                        <Field label="Account holder"><input className={inputCls} value={form.bank_account_holder} onChange={(e) => set('bank_account_holder', e.target.value)} /></Field>
                        <Field label="Account number"><input className={inputCls} value={form.bank_account_number} onChange={(e) => set('bank_account_number', e.target.value)} /></Field>
                        <Field label="Branch code"><input className={inputCls} value={form.bank_branch_code} onChange={(e) => set('bank_branch_code', e.target.value)} /></Field>
                        <Field label="Account type">
                            <select className={inputCls} value={form.bank_account_type} onChange={(e) => set('bank_account_type', e.target.value)}>
                                <option value="">Select…</option>
                                <option>Cheque / Current</option>
                                <option>Savings</option>
                                <option>Transmission</option>
                            </select>
                        </Field>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] rounded-lg border border-ink-200 font-semibold hover:bg-ink-50">Cancel</button>
                    <button type="submit" disabled={saving} className="px-4 py-2 text-[13px] rounded-lg bg-ink-900 text-white font-semibold hover:bg-brand-500 transition disabled:opacity-50">{saving ? 'Saving…' : 'Add landlord'}</button>
                </div>
            </form>
        </Modal>
    );
}

function LinkPropertyModal({ landlord, listings, onClose }: { landlord: Landlord; listings: AvailableListing[]; onClose: () => void }) {
    const [listingId, setListingId] = useState('');
    const [landlordPct, setLandlordPct] = useState('90');
    const [agencyPct, setAgencyPct] = useState('7');
    const [agentPct, setAgentPct] = useState('3');
    const [saving, setSaving] = useState(false);

    const sum = (Number(landlordPct) || 0) + (Number(agencyPct) || 0) + (Number(agentPct) || 0);
    const selected = listings.find((l) => String(l.id) === listingId);

    function submit(e: FormEvent) {
        e.preventDefault();
        if (Math.abs(sum - 100) > 0.01) return;
        setSaving(true);
        router.post('/agency/landlords/link-property', {
            listing_id: listingId,
            managed_landlord_id: landlord.id,
            landlord_split_percent: landlordPct,
            agency_split_percent: agencyPct,
            agent_split_percent: agentPct,
        }, { preserveScroll: true, onSuccess: onClose, onFinish: () => setSaving(false) });
    }

    return (
        <Modal title={`Link a rental property to ${landlord.name}`} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                <Field label="Rental property">
                    <select className={inputCls} value={listingId} onChange={(e) => setListingId(e.target.value)} required>
                        <option value="">Select a property…</option>
                        {listings.map((l) => <option key={l.id} value={l.id}>{l.title}{l.suburb ? ` · ${l.suburb}` : ''} ({fmtMoney(l.rent)}/mo)</option>)}
                    </select>
                </Field>

                <div>
                    <p className="text-[12px] font-semibold text-ink-700 mb-1.5">Commission split (% of monthly rent)</p>
                    <div className="grid grid-cols-3 gap-3">
                        <Field label="Landlord %"><input type="number" min="0" max="100" step="0.01" className={inputCls} value={landlordPct} onChange={(e) => setLandlordPct(e.target.value)} /></Field>
                        <Field label="Agency %"><input type="number" min="0" max="100" step="0.01" className={inputCls} value={agencyPct} onChange={(e) => setAgencyPct(e.target.value)} /></Field>
                        <Field label="Agent %"><input type="number" min="0" max="100" step="0.01" className={inputCls} value={agentPct} onChange={(e) => setAgentPct(e.target.value)} /></Field>
                    </div>
                    <p className={'text-[12px] mt-2 font-semibold ' + (Math.abs(sum - 100) < 0.01 ? 'text-success' : 'text-danger')}>
                        Total: {sum}% {Math.abs(sum - 100) < 0.01 ? '✓' : '— must equal 100%'}
                    </p>
                    {selected && Math.abs(sum - 100) < 0.01 && (
                        <div className="mt-3 rounded-lg bg-ink-50 border border-ink-100 p-3 text-[12.5px] text-ink-600">
                            On {fmtMoney(selected.rent)} rent: landlord <b className="text-brand-600">{fmtMoney(selected.rent * Number(landlordPct) / 100)}</b>,
                            agency <b>{fmtMoney(selected.rent * Number(agencyPct) / 100)}</b>,
                            agent <b>{fmtMoney(selected.rent * Number(agentPct) / 100)}</b> per month.
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] rounded-lg border border-ink-200 font-semibold hover:bg-ink-50">Cancel</button>
                    <button type="submit" disabled={saving || Math.abs(sum - 100) > 0.01 || !listingId} className="px-4 py-2 text-[13px] rounded-lg bg-ink-900 text-white font-semibold hover:bg-brand-500 transition disabled:opacity-50">{saving ? 'Linking…' : 'Link property'}</button>
                </div>
            </form>
        </Modal>
    );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-lift w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold">{title}</h2>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-ink-100 flex items-center justify-center text-ink-500">✕</button>
                </div>
                {children}
            </div>
        </div>
    );
}
