import { Head, Link } from '@inertiajs/react';
import TenantLayout from '@/Layouts/TenantLayout';
import { PageHeader, btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';
import Icon from '@/Components/Dashboard/Icon';

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
    months_elapsed: number;
    months_total: number;
    managed_by: string | null;
    is_agency: boolean;
    has_deposit: boolean;
    has_upload: boolean;
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
    available: boolean;
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

const dot = (t: KeyDate['tone']) =>
    t === 'success' ? 'bg-success' : t === 'warning' ? 'bg-warning' : t === 'danger' ? 'bg-danger' : 'bg-brand-600';

const chip = (t: KeyDate['tone']) =>
    t === 'success' ? 'bg-success/10 text-success'
        : t === 'warning' ? 'bg-warning/10 text-amber-700'
            : t === 'danger' ? 'bg-danger/10 text-danger'
                : 'bg-brand-50 text-brand-700';

export default function TenantLease({ lease, documents, key_dates }: Props) {
    const pct = Math.min(100, Math.round((lease.months_elapsed / Math.max(1, lease.months_total)) * 100));
    const location = [lease.suburb, lease.city, lease.postal_code].filter(Boolean).join(', ');

    return (
        <TenantLayout crumb="My Lease" leaseAddress={lease.address}>
            <Head title="My Lease" />

            <section className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="My Lease"
                    subtitle="Your lease agreement, documents and key dates"
                    actions={
                        <>
                            <a href="/tenant/lease/agreement.pdf" target="_blank" rel="noopener" className={btnOutline}>
                                <Icon name="eye" className="w-4 h-4" />
                                View agreement
                            </a>
                            <a href="/tenant/lease/agreement.pdf?download=1" className={btnPrimary}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                Download
                            </a>
                        </>
                    }
                />

                {/* Hero — accent swirl */}
                <div className="pb-swirl rounded-2xl p-6 text-white shadow-lift mb-4 pb-rise">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <span className="inline-flex items-center gap-1.5 text-[10.5px] bg-white/15 ring-1 ring-white/25 px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide">
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />{lease.status}
                            </span>
                            <p className="text-[26px] sm:text-[30px] font-semibold tracking-tight mt-3 leading-tight">{lease.address}</p>
                            <p className="text-[13px] text-white/75 mt-1">
                                {location}
                                {lease.bedrooms ? ` · ${lease.bedrooms}-bed ${lease.property_type ?? ''}` : ''}
                            </p>
                        </div>
                        <div className="sm:text-right">
                            <p className="text-[11px] text-white/70 uppercase tracking-wider font-semibold">Monthly rent</p>
                            <p className="text-[34px] font-semibold tracking-tight leading-none mt-1 tabular-nums">{fmtMoney(lease.monthly_rent)}</p>
                            <p className="text-[11.5px] text-white/70 mt-1.5">Due on the 1st of each month</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-white/15">
                        {[
                            { label: 'Start date', value: lease.start_date },
                            { label: 'End date', value: lease.end_date },
                            { label: 'Notice period', value: `${lease.notice_period_days} days` },
                            { label: 'Rent escalation', value: lease.escalation_percent > 0 ? `${lease.escalation_percent}% yearly` : 'None' },
                        ].map((f) => (
                            <div key={f.label}>
                                <p className="text-[10.5px] text-white/65 uppercase tracking-wider font-semibold">{f.label}</p>
                                <p className="text-[14px] font-semibold mt-1">{f.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Term · deposit · landlord */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">Lease term</p>
                        <p className="text-[30px] font-semibold tracking-tight mt-3 leading-none tabular-nums">
                            {lease.months_elapsed}<span className="text-[15px] text-ink-400 font-medium"> / {lease.months_total} months</span>
                        </p>
                        <div className="h-2 rounded-full bg-ink-100 mt-4 overflow-hidden">
                            <div className="h-full rounded-full bg-brand-600 transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[11.5px] text-ink-500 mt-2">{pct}% elapsed · {Math.max(0, lease.months_total - lease.months_elapsed)} months remaining</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">Deposit</p>
                        <p className="text-[30px] font-semibold tracking-tight mt-3 leading-none tabular-nums">
                            {lease.has_deposit ? fmtMoney(lease.deposit_amount) : 'None'}
                        </p>
                        <p className="text-[11.5px] text-ink-500 mt-3">
                            {lease.has_deposit ? 'Held in trust, refundable at move-out' : "Your lease doesn't require a security deposit"}
                        </p>
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">{lease.is_agency ? 'Managed by' : 'Landlord'}</p>
                        <p className="text-[20px] font-semibold tracking-tight mt-3 leading-tight">{lease.managed_by ?? '—'}</p>
                        <Link href="/tenant/messages" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 hover:underline mt-3">
                            <Icon name="chat" />Send a message
                        </Link>
                    </div>
                </div>

                {/* Documents */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 mb-4">
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-[16px] font-semibold tracking-tight">Lease Documents</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">Agreements and supporting documents for this lease</p>
                        </div>
                        <Link href="/tenant/documents" className="text-[12px] font-semibold text-brand-700 hover:underline">All documents →</Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {documents.map((d) => (
                            <div key={d.id} className={`rounded-xl border px-4 py-4 flex items-start gap-3 ${d.available ? 'border-ink-200/80' : 'border-dashed border-ink-200 bg-ink-50/50'}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${d.available ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-400'}`}>
                                    <Icon name="file" className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className={`text-[14px] font-semibold ${d.available ? '' : 'text-ink-500'}`}>{d.title}</p>
                                        {d.signed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">SIGNED</span>}
                                    </div>
                                    <p className="text-[11.5px] text-ink-500 mt-0.5 truncate">{d.subtitle}</p>
                                    <p className="text-[11px] text-ink-400 mt-0.5">{d.meta}</p>
                                    {d.available && d.id === 'lease' && (
                                        <div className="flex items-center gap-3 mt-3">
                                            <a href="/tenant/lease/agreement.pdf?download=1" className="text-[12px] font-semibold text-brand-700 hover:underline">Download</a>
                                            <a href="/tenant/lease/agreement.pdf" target="_blank" rel="noopener" className="text-[12px] font-semibold text-ink-600 hover:text-ink-900">View online</a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Key dates — timeline */}
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5">
                    <h2 className="text-[16px] font-semibold tracking-tight mb-4">Key Dates &amp; Reminders</h2>
                    <ol className="relative">
                        {key_dates.map((k, i) => (
                            <li key={k.label} className="relative flex gap-4 pb-5 last:pb-0">
                                {i < key_dates.length - 1 && <span aria-hidden className="absolute left-[11px] top-7 bottom-0 w-px bg-ink-200" />}
                                <span className={`relative mt-1 w-[23px] h-[23px] rounded-full ring-4 ring-white flex items-center justify-center shrink-0 ${dot(k.tone)}`}>
                                    <span className="w-2 h-2 rounded-full bg-white" />
                                </span>
                                <div className="flex-1 min-w-0 flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-[13.5px] font-semibold">{k.label}</p>
                                        <p className="text-[12px] text-ink-500">{k.sub}</p>
                                    </div>
                                    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-md ${chip(k.tone)}`}>
                                        {k.tone === 'success' ? 'Done' : k.tone === 'danger' ? 'End of term' : k.tone === 'warning' ? 'Upcoming' : 'Pending'}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>
        </TenantLayout>
    );
}
