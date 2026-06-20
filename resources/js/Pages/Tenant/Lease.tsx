import { Head, Link } from '@inertiajs/react';
import TenantLayout from '@/Layouts/TenantLayout';

function fmtMoney(n: number): string {
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

type Lease = {
    id: number;
    address: string;
    suburb?: string;
    city?: string;
    postal_code?: string | null;
    property_type?: string;
    bedrooms?: number;
    monthly_rent: number;
    deposit_amount: number;
    start_date: string;
    end_date: string;
    notice_period_days: number;
    escalation_percent: number;
    status: string;
};
type Document = {
    id: string;
    title: string;
    subtitle: string;
    meta: string;
    tone: 'rose' | 'brand' | 'emerald';
    icon?: string;
    signed: boolean;
};
type KeyDate = {
    label: string;
    sub: string;
    tone: 'success' | 'warning' | 'danger' | 'brand';
    icon: string;
};

type Props = {
    tenant: { id: number; name: string };
    lease: Lease;
    documents: Document[];
    key_dates: KeyDate[];
};

const toneAccent = (t: KeyDate['tone']) => {
    if (t === 'success') return { border: 'border-success', bg: 'bg-success/15', text: 'text-success' };
    if (t === 'warning') return { border: 'border-warning', bg: 'bg-warning/15', text: 'text-warning' };
    if (t === 'danger')  return { border: 'border-danger',  bg: 'bg-danger/15',  text: 'text-danger' };
    return { border: 'border-brand-500', bg: 'bg-brand-50', text: 'text-brand-600' };
};

const docTone = (t: Document['tone']) => {
    if (t === 'rose')    return 'bg-rose-50 text-rose-600';
    if (t === 'emerald') return 'bg-emerald-50 text-success';
    return 'bg-brand-50 text-brand-600';
};

export default function TenantLease({ lease, documents, key_dates }: Props) {
    return (
        <TenantLayout crumb="My Lease" leaseAddress={lease.address}>
            <Head title="My Lease" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">My Lease</h1>
                    <p className="text-[14px] text-ink-500 mt-1">Lease agreement, addendums, and key dates</p>
                </div>

                {/* Hero */}
                <div className="bg-gradient-to-br from-ink-900 to-ink-800 rounded-xl p-6 text-white shadow-card mb-6">
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <span className="text-[10px] bg-success/20 text-success px-2 py-1 rounded-full font-bold uppercase">{lease.status}</span>
                            <p className="text-2xl font-bold mt-3">{lease.address}</p>
                            <p className="text-[13px] opacity-70">
                                {[lease.suburb, lease.city, lease.postal_code].filter(Boolean).join(', ')}
                                {lease.bedrooms ? ` · ${lease.bedrooms}-bed ${lease.property_type ?? ''}` : ''}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] opacity-70 uppercase tracking-wider">Monthly Rent</p>
                            <p className="text-3xl font-bold">{fmtMoney(lease.monthly_rent)}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-5 border-t border-white/10">
                        <div>
                            <p className="text-[10px] opacity-60 uppercase tracking-wider font-semibold">Start Date</p>
                            <p className="text-[13px] font-semibold mt-1 font-mono">{lease.start_date}</p>
                        </div>
                        <div>
                            <p className="text-[10px] opacity-60 uppercase tracking-wider font-semibold">End Date</p>
                            <p className="text-[13px] font-semibold mt-1 font-mono">{lease.end_date}</p>
                        </div>
                        <div>
                            <p className="text-[10px] opacity-60 uppercase tracking-wider font-semibold">Notice Period</p>
                            <p className="text-[13px] font-semibold mt-1">{lease.notice_period_days} days</p>
                        </div>
                        <div>
                            <p className="text-[10px] opacity-60 uppercase tracking-wider font-semibold">Rent Escalation</p>
                            <p className="text-[13px] font-semibold mt-1">{lease.escalation_percent}% on renewal</p>
                        </div>
                    </div>
                </div>

                {/* Documents */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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
                                {d.id === 'lease' ? (
                                    <>
                                        <a
                                            href="/tenant/lease/agreement.pdf?download=1"
                                            target="_blank"
                                            rel="noopener"
                                            className="text-[11px] px-2.5 py-1.5 bg-ink-900 text-white rounded-md font-medium flex items-center gap-1.5 hover:bg-brand-500 transition"
                                        >
                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                                            Download
                                        </a>
                                        <a
                                            href="/tenant/lease/agreement.pdf"
                                            target="_blank"
                                            rel="noopener"
                                            className="text-[11px] px-2.5 py-1.5 border border-ink-200 rounded-md hover:bg-ink-100"
                                        >
                                            View online
                                        </a>
                                    </>
                                ) : (
                                    <span className="text-[11px] text-ink-400 italic">PDF coming soon</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Key dates */}
                <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                    <h2 className="text-base font-semibold mb-4">Key Dates &amp; Reminders</h2>
                    <div className="space-y-3">
                        {key_dates.map((k) => {
                            const tone = toneAccent(k.tone);
                            return (
                                <div key={k.label} className={`flex items-center gap-4 p-3 rounded-lg hover:bg-ink-50 border-l-2 ${tone.border}`}>
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone.bg}`}>
                                        <svg className={`w-5 h-5 ${tone.text}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[13px] font-semibold">{k.label}</p>
                                        <p className="text-[11px] text-ink-500">{k.sub}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <Link href="/tenant/documents" className="text-[12px] font-semibold text-brand-600">View all documents →</Link>
                </div>
            </div>
        </TenantLayout>
    );
}
