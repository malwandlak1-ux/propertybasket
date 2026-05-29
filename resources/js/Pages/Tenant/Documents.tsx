import { Head, Link } from '@inertiajs/react';
import TenantLayout from '@/Layouts/TenantLayout';

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
    lease: { id: number; address: string; monthly_rent: number; start_date: string; end_date: string };
    deposit: DepositInfo;
    ledger: LedgerRow[];
    documents: Document[];
    inspections: InspectionCard[];
};

const docTone = (t: Document['tone']) => {
    if (t === 'rose')    return 'bg-rose-50 text-rose-600';
    if (t === 'emerald') return 'bg-emerald-50 text-success';
    return 'bg-brand-50 text-brand-600';
};

const typeTone = (t: LedgerRow['tone']) => {
    if (t === 'brand')   return 'bg-brand-50 text-brand-700';
    if (t === 'success') return 'bg-success/15 text-success';
    return 'bg-ink-100 text-ink-700';
};

export default function TenantDocuments({ lease, deposit, ledger, documents, inspections }: Props) {
    return (
        <TenantLayout crumb="Documents" leaseAddress={lease.address}>
            <Head title="Documents" />

            <div className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Documents &amp; Deposit</h1>
                        <p className="text-[14px] text-ink-500 mt-1">Lease records, inspection reports, and your trust deposit ledger.</p>
                    </div>
                    <button className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        Trust statement
                    </button>
                </div>

                {/* Deposit hero */}
                <div className="bg-gradient-to-br from-success to-emerald-700 rounded-xl p-6 text-white shadow-card mb-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
                    <div className="relative grid grid-cols-3 gap-8">
                        <div>
                            <p className="text-[11px] uppercase tracking-wider opacity-80 font-semibold">Total Held</p>
                            <p className="text-5xl font-bold mt-2 font-mono">{fmtMoney(deposit.total_held)}</p>
                            <p className="text-[12px] opacity-80 mt-2">Section 32 Trust</p>
                        </div>
                        <div>
                            <p className="text-[11px] uppercase tracking-wider opacity-80 font-semibold">Original Deposit</p>
                            <p className="text-3xl font-bold mt-2 font-mono">{fmtMoney(deposit.amount_deposited)}</p>
                            <p className="text-[12px] opacity-80 mt-2">Paid {deposit.deposited_at}</p>
                        </div>
                        <div>
                            <p className="text-[11px] uppercase tracking-wider opacity-80 font-semibold">Interest Earned</p>
                            <p className="text-3xl font-bold mt-2 font-mono">{fmtMoney(deposit.accrued_interest)}</p>
                            <p className="text-[12px] opacity-80 mt-2">@ {deposit.interest_rate}% p.a.</p>
                        </div>
                    </div>
                    <div className="mt-6 pt-5 border-t border-white/20 text-[12px] opacity-80">
                        Interest accrues monthly · Tax-free under Rental Housing Act §5(3)(d) · Refunded within 14 days of move-out
                    </div>
                </div>

                {/* Documents */}
                <h2 className="text-base font-semibold mb-3">Lease Documents</h2>
                <div className="grid grid-cols-3 gap-4 mb-8">
                    {documents.map((d) => (
                        <div key={d.id} className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft hover:shadow-lift transition">
                            <div className="flex items-start justify-between mb-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${docTone(d.tone)}`}>
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                                </div>
                                {d.signed && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">SIGNED</span>
                                )}
                            </div>
                            <p className="text-[14px] font-bold">{d.title}</p>
                            <p className="text-[11px] text-ink-500 mt-1">{d.subtitle}</p>
                            <p className="text-[10px] text-ink-400 mt-2 font-mono">Signed: {d.meta}</p>
                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-ink-100">
                                <button className="text-[11px] px-2.5 py-1.5 bg-ink-900 text-white rounded-md font-medium">Download</button>
                                <button className="text-[11px] px-2.5 py-1.5 border border-ink-200 rounded-md hover:bg-ink-100">View online</button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Inspections */}
                <h2 className="text-base font-semibold mb-3">Inspection Reports</h2>
                {inspections.length === 0 ? (
                    <div className="bg-white rounded-xl border border-dashed border-ink-300 p-8 text-center mb-8">
                        <p className="text-[13px] text-ink-500">No inspection reports yet. Your move-in inspection will appear here once completed.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        {inspections.map((i) => (
                            <div key={i.id} className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4"/><path d="M21 12c0 1-1 11-9 11s-9-10-9-11V5l9-3 9 3z"/></svg>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${i.status === 'completed' ? 'bg-success/15 text-success' : 'bg-brand-50 text-brand-700'}`}>
                                        {i.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className="text-[14px] font-bold capitalize">{i.type.replace('_', '-')} Inspection</p>
                                <p className="text-[11px] text-ink-500 mt-1">
                                    {i.room_count} room{i.room_count === 1 ? '' : 's'} · {i.photo_count} photo{i.photo_count === 1 ? '' : 's'}
                                </p>
                                <p className="text-[10px] text-ink-400 mt-2 font-mono">Updated: {i.date}</p>
                                <div className="flex items-center gap-2 mt-3 text-[10px]">
                                    <span className={`px-1.5 py-0.5 rounded ${i.agent_signed ? 'bg-success/15 text-success' : 'bg-ink-100 text-ink-500'} font-semibold`}>
                                        Agent {i.agent_signed ? '✓' : '—'}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded ${i.tenant_signed ? 'bg-success/15 text-success' : 'bg-ink-100 text-ink-500'} font-semibold`}>
                                        Tenant {i.tenant_signed ? '✓' : '—'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Trust Ledger */}
                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                    <div className="p-5 border-b border-ink-200">
                        <h2 className="text-base font-semibold">Trust Ledger</h2>
                        <p className="text-[12px] text-ink-500 mt-0.5">Full transaction history for your deposit</p>
                    </div>
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                <th className="font-semibold px-5 py-3">Date</th>
                                <th className="font-semibold py-3">Description</th>
                                <th className="font-semibold py-3">Type</th>
                                <th className="font-semibold py-3 text-right">Amount</th>
                                <th className="font-semibold py-3 text-right pr-5">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="text-[13px]">
                            {ledger.map((r, idx) => (
                                <tr key={idx} className="border-b border-ink-100 hover:bg-ink-50">
                                    <td className="px-5 py-3 font-mono text-[12px]">{r.date}</td>
                                    <td>
                                        <p className="font-semibold">{r.description}</p>
                                        {r.sub && <p className="text-[11px] text-ink-500">{r.sub}</p>}
                                    </td>
                                    <td><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${typeTone(r.tone)}`}>{r.type}</span></td>
                                    <td className={`text-right font-mono ${r.tone === 'success' ? 'text-success' : ''}`}>
                                        {r.amount >= 0 ? '+ ' : '— '}{fmtMoney(Math.abs(r.amount))}
                                    </td>
                                    <td className="text-right pr-5 font-mono font-semibold">{fmtMoney(r.balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p className="mt-4 text-[11px] text-ink-400 text-center">
                    Deposit held under EAAB Section 32 Trust account regulations · <Link href="/tenant/lease" className="text-brand-600 font-semibold">View lease for refund terms →</Link>
                </p>
            </div>
        </TenantLayout>
    );
}
