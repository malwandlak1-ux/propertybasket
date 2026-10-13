import { FormEvent, useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import TenantLayout from '@/Layouts/TenantLayout';
import { PageHeader, btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';
import Icon from '@/Components/Dashboard/Icon';

function fmtMoney(n: number): string {
    return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type DepositInfo = {
    amount_deposited: number;
    accrued_interest: number;
    interest_rate: number;
    total_held: number;
    deposited_at: string;
};

type LedgerRow = {
    date: string;
    description: string;
    sub: string | null;
    type: string;
    tone: 'brand' | 'success' | 'ink';
    amount: number;
    balance: number;
};

type Document = {
    id: string;
    title: string;
    subtitle: string;
    meta: string;
    tone: 'rose' | 'brand' | 'emerald';
    signed: boolean;
    available: boolean;
    category: string;
};

type InspectionCard = {
    id: number;
    type: string;
    status: string;
    date: string;
    photo_count: number;
    room_count: number;
    agent_signed: boolean;
    tenant_signed: boolean;
};

type Props = {
    tenant: { id: number; name: string };
    lease: {
        id: number;
        address: string;
        monthly_rent: number;
        start_date: string;
        end_date: string;
        tenant_signed_at: string | null;
        tenant_signature: string | null;
        managed_by: string | null;
        is_agency: boolean;
    };
    deposit: DepositInfo;
    ledger: LedgerRow[];
    documents: Document[];
    inspections: InspectionCard[];
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };


const typeTone = (t: LedgerRow['tone']) => {
    if (t === 'brand')   return 'bg-brand-50 text-brand-700';
    if (t === 'success') return 'bg-success/15 text-success';
    return 'bg-ink-100 text-ink-700';
};

export default function TenantDocuments({ tenant, lease, deposit, ledger, documents, inspections }: Props) {
    const hasDeposit = deposit.amount_deposited > 0;
    const { flash } = usePage<SharedProps>().props;
    const [signOpen, setSignOpen] = useState(false);
    const leaseSigned = !! lease.tenant_signed_at;

    return (
        <TenantLayout crumb="Documents" leaseAddress={lease.address}>
            <Head title="Documents" />

            <section className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Documents"
                    subtitle={hasDeposit ? 'Lease records, inspection reports and your deposit ledger' : 'Lease records and inspection reports'}
                    actions={
                        <>
                            <a href="/tenant/payments/statement.pdf" target="_blank" rel="noopener" className={btnOutline}>
                                <Icon name="file" className="w-4 h-4" />
                                Rent statement
                            </a>
                            <a href="/tenant/lease/agreement.pdf?download=1" className={btnPrimary}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                Lease agreement
                            </a>
                        </>
                    }
                />

                {/* Sign-lease prompt when the tenant signature is outstanding */}
                {! leaseSigned && (
                    <div className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 px-5 py-4 flex flex-wrap items-center gap-4">
                        <Icon name="alert" className="w-5 h-5 text-warning" />
                        <p className="text-[13px] text-ink-700 flex-1 min-w-[200px]">
                            <span className="font-semibold">Your lease is awaiting your signature.</span>{' '}
                            Review the agreement and sign it electronically to activate your lease.
                        </p>
                        <button onClick={() => setSignOpen(true)} className={btnPrimary}>Review &amp; sign</button>
                    </div>
                )}

                {flash?.success && (
                    <div className="mb-4 rounded-2xl border border-success/30 bg-success/10 text-success px-5 py-3 text-[13px]">{flash.success}</div>
                )}
                {flash?.error && (
                    <div className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 text-danger px-5 py-3 text-[13px]">{flash.error}</div>
                )}

                {/* Deposit */}
                {hasDeposit ? (
                    <div className="pb-swirl rounded-2xl p-6 text-white shadow-lift mb-4 pb-rise">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div>
                                <p className="text-[11px] text-white/70 uppercase tracking-wider font-semibold">Total held</p>
                                <p className="text-[34px] font-semibold tracking-tight leading-none mt-2 tabular-nums">{fmtMoney(deposit.total_held)}</p>
                                <p className="text-[12px] text-white/75 mt-2">Deposit + interest, held in trust</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-white/70 uppercase tracking-wider font-semibold">Original deposit</p>
                                <p className="text-[24px] font-semibold tracking-tight leading-none mt-2 tabular-nums">{fmtMoney(deposit.amount_deposited)}</p>
                                <p className="text-[12px] text-white/75 mt-2">Paid {deposit.deposited_at}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-white/70 uppercase tracking-wider font-semibold">Interest earned</p>
                                <p className="text-[24px] font-semibold tracking-tight leading-none mt-2 tabular-nums">{fmtMoney(deposit.accrued_interest)}</p>
                                <p className="text-[12px] text-white/75 mt-2">@ {deposit.interest_rate}% p.a.</p>
                            </div>
                        </div>
                        <p className="mt-5 pt-4 border-t border-white/15 text-[12px] text-white/75">
                            Interest accrues monthly · Refunded within 14 days of move-out, less any agreed deductions
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                            <p className="text-[13px] font-medium text-ink-700">Deposit</p>
                            <p className="text-[30px] font-semibold tracking-tight mt-3 leading-none">None</p>
                            <p className="text-[11.5px] text-ink-500 mt-3">Your lease doesn't require a security deposit, so there's no deposit ledger.</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                            <p className="text-[13px] font-medium text-ink-700">Lease term</p>
                            <p className="text-[20px] font-semibold tracking-tight mt-3 leading-tight">{lease.start_date} – {lease.end_date}</p>
                            <Link href="/tenant/lease" className="inline-flex text-[12px] font-semibold text-brand-700 hover:underline mt-3">View lease details →</Link>
                        </div>
                        <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                            <p className="text-[13px] font-medium text-ink-700">{lease.is_agency ? 'Managed by' : 'Landlord'}</p>
                            <p className="text-[20px] font-semibold tracking-tight mt-3 leading-tight">{lease.managed_by ?? '—'}</p>
                            <Link href="/tenant/messages" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 hover:underline mt-3">
                                <Icon name="chat" />Send a message
                            </Link>
                        </div>
                    </div>
                )}

                {/* Lease documents */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 mb-4">
                    <div className="mb-4">
                        <h2 className="text-[16px] font-semibold tracking-tight">Lease Documents</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">Agreements and supporting documents for your lease</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {documents.map((d) => (
                            <div key={d.id} className={`rounded-xl border px-4 py-4 flex items-start gap-3 ${d.available ? 'border-ink-200/80' : 'border-dashed border-ink-200 bg-ink-50/50'}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${d.available ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-400'}`}>
                                    <Icon name="file" className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className={`text-[14px] font-semibold ${d.available ? '' : 'text-ink-500'}`}>{d.title}</p>
                                        {d.available && (d.signed
                                            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">SIGNED</span>
                                            : <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-amber-700 font-bold">AWAITING SIGNATURE</span>)}
                                    </div>
                                    <p className="text-[11.5px] text-ink-500 mt-0.5 truncate">{d.subtitle}</p>
                                    <p className="text-[11px] text-ink-400 mt-0.5">{d.meta}</p>
                                    {d.available && d.id === 'lease' && (
                                        <div className="flex flex-wrap items-center gap-3 mt-3">
                                            {! d.signed && (
                                                <button onClick={() => setSignOpen(true)} className="text-[12px] font-semibold text-white bg-brand-700 hover:bg-brand-800 rounded-full px-3 py-1">Sign lease</button>
                                            )}
                                            <a href="/tenant/lease/agreement.pdf?download=1" className="text-[12px] font-semibold text-brand-700 hover:underline">Download</a>
                                            <a href="/tenant/lease/agreement.pdf" target="_blank" rel="noopener" className="text-[12px] font-semibold text-ink-600 hover:text-ink-900">View online</a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Inspection reports */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 mb-4">
                    <div className="mb-4">
                        <h2 className="text-[16px] font-semibold tracking-tight">Inspection Reports</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">Move-in and move-out condition reports</p>
                    </div>
                    {inspections.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/50 px-4 py-8 text-center">
                            <p className="text-[13px] text-ink-500">No inspection reports yet. Your move-in inspection will appear here once completed.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {inspections.map((i) => (
                                <div key={i.id} className="rounded-xl border border-ink-200/80 px-4 py-4 flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4"/><path d="M21 12c0 1-1 11-9 11s-9-10-9-11V5l9-3 9 3z"/></svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-[14px] font-semibold capitalize">{i.type.replace('_', '-')} inspection</p>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${i.status === 'completed' ? 'bg-success/15 text-success' : 'bg-brand-50 text-brand-700'}`}>
                                                {i.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p className="text-[11.5px] text-ink-500 mt-0.5">
                                            {i.room_count} room{i.room_count === 1 ? '' : 's'} · {i.photo_count} photo{i.photo_count === 1 ? '' : 's'} · updated {i.date}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2 text-[10.5px]">
                                            <span className={`px-2 py-0.5 rounded-md font-semibold ${i.agent_signed ? 'bg-success/15 text-success' : 'bg-ink-100 text-ink-500'}`}>
                                                {lease.is_agency ? 'Agent' : 'Landlord'} {i.agent_signed ? 'signed' : 'pending'}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-md font-semibold ${i.tenant_signed ? 'bg-success/15 text-success' : 'bg-ink-100 text-ink-500'}`}>
                                                You {i.tenant_signed ? 'signed' : 'pending'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Deposit ledger */}
                {hasDeposit && (
                    <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden">
                        <div className="p-5 border-b border-ink-200">
                            <h2 className="text-[16px] font-semibold tracking-tight">Deposit Ledger</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">Transaction history for your deposit · <Link href="/tenant/lease" className="text-brand-700 font-semibold hover:underline">refund terms in your lease →</Link></p>
                        </div>
                        <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50 whitespace-nowrap">
                                    <th className="font-semibold px-5 py-3">Date</th>
                                    <th className="font-semibold py-3">Description</th>
                                    <th className="font-semibold py-3">Type</th>
                                    <th className="font-semibold py-3 text-right pr-6">Amount</th>
                                    <th className="font-semibold py-3 text-right pr-5">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {ledger.map((r, idx) => (
                                    <tr key={idx} className="border-b border-ink-100 hover:bg-ink-50">
                                        <td className="px-5 py-3 text-[12px] text-ink-500 whitespace-nowrap">{r.date}</td>
                                        <td className="py-3">
                                            <p className="font-medium">{r.description}</p>
                                            {r.sub && <p className="text-[11px] text-ink-500">{r.sub}</p>}
                                        </td>
                                        <td><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${typeTone(r.tone)}`}>{r.type}</span></td>
                                        <td className={`text-right tabular-nums pr-6 ${r.tone === 'success' ? 'text-success' : ''}`}>
                                            {r.amount >= 0 ? '+ ' : '- '}{fmtMoney(Math.abs(r.amount))}
                                        </td>
                                        <td className="text-right pr-5 tabular-nums font-semibold">{fmtMoney(r.balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table></div>
                    </div>
                )}
            </section>

            {signOpen && (
                <SignLeaseModal
                    tenantName={tenant.name}
                    lease={lease}
                    onClose={() => setSignOpen(false)}
                />
            )}
        </TenantLayout>
    );
}

function SignLeaseModal({
    tenantName,
    lease,
    onClose,
}: {
    tenantName: string;
    lease: Props['lease'];
    onClose: () => void;
}) {
    const form = useForm({ signature: '', agreed: false as boolean });

    function submit(e: FormEvent) {
        e.preventDefault();
        form.post('/tenant/lease/sign', {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    }

    const nameMatches = form.data.signature.trim().toLowerCase() === tenantName.trim().toLowerCase();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-card w-full max-w-lg p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-[18px] font-bold">Sign your lease</h2>
                        <p className="text-[13px] text-ink-500 mt-1">
                            {lease.address} · {lease.start_date} — {lease.end_date}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-ink-400 hover:text-ink-700 text-xl leading-none">×</button>
                </div>

                <div className="mt-4 rounded-lg bg-ink-50 border border-ink-200 px-4 py-3 text-[12px] text-ink-600 space-y-1">
                    <p>Monthly rent: <span className="font-bold font-mono">R {lease.monthly_rent.toLocaleString('en-ZA')}</span></p>
                    <p>
                        Read the full agreement before signing:{' '}
                        <a href="/tenant/lease/agreement.pdf" target="_blank" rel="noopener" className="text-brand-700 font-semibold hover:underline">
                            open lease PDF →
                        </a>
                    </p>
                </div>

                <form onSubmit={submit} className="mt-5 space-y-4">
                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">
                            Type your full name as your electronic signature
                        </label>
                        <input
                            value={form.data.signature}
                            onChange={(e) => form.setData('signature', e.target.value)}
                            placeholder={tenantName}
                            className="w-full bg-white border border-ink-200 rounded-lg px-3.5 py-2.5 text-[15px] italic outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
                            style={{ fontFamily: 'Georgia, serif' }}
                        />
                        {! nameMatches && form.data.signature.length > 0 && (
                            <p className="text-[11px] text-warning mt-1.5">Must match your account name: {tenantName}</p>
                        )}
                        {form.errors.signature && <p className="text-[11px] text-danger mt-1.5">{form.errors.signature}</p>}
                    </div>

                    <label className="flex items-start gap-2 text-[12px] text-ink-600">
                        <input
                            type="checkbox"
                            checked={form.data.agreed}
                            onChange={(e) => form.setData('agreed', e.target.checked)}
                            className="w-4 h-4 mt-0.5 rounded border-ink-300 text-brand focus:ring-brand/30"
                        />
                        <span>
                            I have read and agree to the terms of the lease agreement. I understand this
                            electronic signature is legally binding under the ECT Act 25 of 2002.
                        </span>
                    </label>
                    {form.errors.agreed && <p className="text-[11px] text-danger">{form.errors.agreed}</p>}

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 font-semibold">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={form.processing || ! nameMatches || ! form.data.agreed}
                            className="px-5 py-2 text-[13px] bg-ink-900 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg font-semibold"
                        >
                            {form.processing ? 'Signing…' : 'Sign lease agreement'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
