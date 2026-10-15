import { FormEvent } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import { Spinner } from '@/Components/Skeleton';
import { PageHeader, SectionCard, SummaryStrip, btnPrimary } from '@/Components/Dashboard/Charts';

type Props = {
    agency: { id: number; name: string };
    ffc: {
        state: 'missing' | 'expired' | 'expiring' | 'valid';
        days_left: number | null;
        ffc_number: string | null;
        ffc_expires_at: string | null;
        has_certificate: boolean;
        certificate_url: string | null;
        last_reminder_sent_at: string | null;
        verified_at: string | null;
    };
};

const STATE_BANNER: Record<Props['ffc']['state'], { cls: string; title: string; body: (d: number | null) => string }> = {
    missing: {
        cls:   'bg-danger/10 border-danger/30 text-danger',
        title: 'No agency FFC on file',
        body:  () => 'Until you upload a valid Fidelity Fund Certificate, agents on this agency cannot create or edit listings.',
    },
    expired: {
        cls:   'bg-danger/10 border-danger/30 text-danger',
        title: 'Agency FFC expired',
        body:  (d) => `Your certificate expired ${d !== null ? Math.abs(d) + ' days ago' : ''}. Listing creation is blocked across the agency until you upload a current certificate.`,
    },
    expiring: {
        cls:   'bg-warning/10 border-warning/30 text-warning',
        title: 'Agency FFC expiring soon',
        body:  (d) => `Your certificate expires in ${d ?? 0} days. Renew with the PPRA and upload the new certificate before it lapses to avoid disrupting your agents.`,
    },
    valid: {
        cls:   'bg-success/10 border-success/30 text-success',
        title: 'Agency FFC valid',
        body:  (d) => `Your certificate is valid for another ${d ?? 0} days. We'll remind you when it's within 30 days of expiry.`,
    },
};

const inputCls = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[14px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition';

const STATE_LABEL: Record<Props['ffc']['state'], string> = { missing: 'Missing', expired: 'Expired', expiring: 'Expiring soon', valid: 'Valid' };
const STATE_TONE: Record<Props['ffc']['state'], 'success' | 'warning' | 'danger'> = { missing: 'danger', expired: 'danger', expiring: 'warning', valid: 'success' };

export default function AgencyCompliance({ agency, ffc }: Props) {
    const { data, setData, post, processing, errors, progress } = useForm<{
        eaab_ffc_number: string;
        eaab_ffc_expires_at: string;
        eaab_ffc_certificate: File | null;
    }>({
        eaab_ffc_number:      ffc.ffc_number ?? '',
        eaab_ffc_expires_at:  ffc.ffc_expires_at ?? '',
        eaab_ffc_certificate: null,
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agency/compliance', { forceFormData: true });
    }

    const banner = STATE_BANNER[ffc.state];

    return (
        <AgencyLayout crumb="Compliance" agencyName={agency.name}>
            <Head title="EAAB & Compliance" />

            <div className="px-4 sm:px-7 py-6 max-w-6xl">
                <PageHeader
                    title="EAAB & Compliance"
                    subtitle="The agency's Fidelity Fund Certificate from the PPRA, required by law before any listing can be marketed"
                />

                <SummaryStrip
                    title="Fidelity Fund Certificate"
                    subtitle={banner.title}
                    cells={[
                        { label: 'Status', value: STATE_LABEL[ffc.state], sub: banner.title, tone: STATE_TONE[ffc.state] },
                        { label: 'FFC Number', value: ffc.ffc_number ?? '—', sub: ffc.verified_at ? `Verified ${ffc.verified_at}` : 'Agency certificate', tone: 'muted' },
                        { label: 'Expires', value: ffc.ffc_expires_at ?? '—', sub: ffc.days_left === null ? 'No date on file' : ffc.days_left < 0 ? `${Math.abs(ffc.days_left)} days ago` : `${ffc.days_left} days left`, tone: ffc.state === 'valid' ? 'muted' : STATE_TONE[ffc.state] },
                        { label: 'Certificate File', value: ffc.has_certificate ? 'On file' : 'Missing', sub: ffc.last_reminder_sent_at ? `Reminder sent ${ffc.last_reminder_sent_at}` : 'Reminders 30 days before expiry', tone: ffc.has_certificate ? 'success' : 'danger' },
                    ]}
                />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <form onSubmit={submit} className="lg:col-span-8">
                    <SectionCard title="Update Certificate" subtitle="Capture the current FFC number, expiry date and a copy of the certificate">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">EAAB FFC number *</label>
                                <input
                                    value={data.eaab_ffc_number}
                                    onChange={(e) => setData('eaab_ffc_number', e.target.value)}
                                    placeholder="e.g. 2026-PPR-AG-987654"
                                    required
                                    className={inputCls}
                                />
                                {errors.eaab_ffc_number && <p className="text-[11px] text-danger mt-1">{errors.eaab_ffc_number}</p>}
                            </div>
                            <div>
                                <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Expiry date *</label>
                                <input
                                    type="date"
                                    value={data.eaab_ffc_expires_at}
                                    onChange={(e) => setData('eaab_ffc_expires_at', e.target.value)}
                                    required
                                    className={inputCls}
                                />
                                {errors.eaab_ffc_expires_at && <p className="text-[11px] text-danger mt-1">{errors.eaab_ffc_expires_at}</p>}
                            </div>
                        </div>

                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">
                                Certificate file {ffc.has_certificate ? '(upload a new file to replace the existing one)' : '*'}
                            </label>
                            <input
                                type="file"
                                accept="application/pdf,image/png,image/jpeg"
                                onChange={(e) => setData('eaab_ffc_certificate', e.target.files?.[0] ?? null)}
                                className="block w-full text-[13px] file:mr-3 file:py-2 file:px-3.5 file:rounded-full file:border-0 file:text-[12px] file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                            />
                            <p className="text-[11px] text-ink-500 mt-1">PDF, JPG or PNG · up to 10 MB</p>
                            {errors.eaab_ffc_certificate && <p className="text-[11px] text-danger mt-1">{errors.eaab_ffc_certificate}</p>}

                            {ffc.has_certificate && ffc.certificate_url && (
                                <a
                                    href={ffc.certificate_url}
                                    target="_blank"
                                    rel="noopener"
                                    className="inline-flex items-center gap-1.5 mt-3 text-[12px] text-brand-600 hover:text-brand-700 font-semibold"
                                >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    View current certificate
                                </a>
                            )}
                        </div>

                        {progress && (
                            <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress.percentage}%` }} />
                            </div>
                        )}
                    </div>
                    </SectionCard>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[12px] text-ink-500">
                            {ffc.last_reminder_sent_at
                                ? `Last reminder email sent ${ffc.last_reminder_sent_at}`
                                : 'Reminder emails fire automatically within 30 days of expiry.'}
                        </p>
                        <button
                            type="submit"
                            disabled={processing || ! data.eaab_ffc_number || ! data.eaab_ffc_expires_at}
                            className={btnPrimary}
                        >
                            {processing && <Spinner size={13} />}
                            {processing ? 'Saving…' : 'Save certificate'}
                        </button>
                    </div>
                </form>

                <aside className="lg:col-span-4 space-y-4">
                <div className="pb-swirl rounded-2xl p-5 text-white shadow-lift pb-rise">
                    <p className="text-[13px] font-medium">{banner.title}</p>
                    <p className="text-[12.5px] text-white/85 mt-2 leading-relaxed">{banner.body(ffc.days_left)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 text-[12.5px] text-ink-600 leading-relaxed pb-rise">
                    <p className="text-base font-semibold text-ink-900 mb-2">Why this matters</p>
                    Section 47 of the Property Practitioners Act requires every property practitioner — including the firm
                    itself — to hold a current FFC before transacting in property. Property Basket blocks listing creation,
                    re-allocation, tenant invites and reactivation across your entire agency when the agency-level FFC is
                    missing or expired.
                </div>
                </aside>
                </div>
            </div>
        </AgencyLayout>
    );
}
