import { FormEvent } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import { Spinner } from '@/Components/Skeleton';

type Props = {
    agent: { id: number; name: string; agency_name: string };
    ffc: {
        state: 'missing' | 'expired' | 'expiring' | 'valid';
        days_left: number | null;
        ffc_number: string | null;
        ffc_expires_at: string | null;
        has_certificate: boolean;
        certificate_url: string | null;
        last_reminder_sent_at: string | null;
    };
};

const STATE_BANNER: Record<Props['ffc']['state'], { cls: string; title: string; body: (d: number | null) => string }> = {
    missing: {
        cls:   'bg-danger/10 border-danger/30 text-danger',
        title: 'No FFC on file',
        body:  () => 'You must upload a current Fidelity Fund Certificate before you can transact. Agent actions are blocked until then.',
    },
    expired: {
        cls:   'bg-danger/10 border-danger/30 text-danger',
        title: 'FFC expired',
        body:  (d) => `Your certificate expired ${d !== null ? Math.abs(d) + ' days ago' : ''}. Renew with the PPRA and upload the new certificate to resume transacting.`,
    },
    expiring: {
        cls:   'bg-warning/10 border-warning/30 text-warning',
        title: 'FFC expiring soon',
        body:  (d) => `Your certificate expires in ${d ?? 0} days. Renew with the PPRA and upload the new certificate before it lapses.`,
    },
    valid: {
        cls:   'bg-success/10 border-success/30 text-success',
        title: 'FFC valid',
        body:  (d) => `Your certificate is valid for another ${d ?? 0} days. We'll remind you when it's within 30 days of expiry.`,
    },
};

const inputCls = 'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';

export default function AgentFfcCompliance({ agent, ffc }: Props) {
    const { data, setData, post, processing, errors, progress } = useForm<{
        ffc_number: string;
        ffc_expires_at: string;
        ffc_certificate: File | null;
    }>({
        ffc_number:      ffc.ffc_number ?? '',
        ffc_expires_at:  ffc.ffc_expires_at ?? '',
        ffc_certificate: null,
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agent/ffc', { forceFormData: true });
    }

    const banner = STATE_BANNER[ffc.state];

    return (
        <AgentLayout crumb="FFC & Compliance" agencyName={agent.agency_name}>
            <Head title="FFC & Compliance" />

            <div className="px-8 py-7 max-w-3xl">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">FFC &amp; Compliance</h1>
                    <p className="text-[14px] text-ink-500 mt-1">
                        Upload your Fidelity Fund Certificate from the PPRA. A valid FFC is required to transact in South Africa.
                    </p>
                </div>

                {/* Status banner */}
                <div className={`border rounded-xl p-4 mb-6 ${banner.cls}`}>
                    <p className="font-bold text-[14px]">{banner.title}</p>
                    <p className="text-[13px] mt-1">{banner.body(ffc.days_left)}</p>
                    {ffc.state === 'valid' && ffc.ffc_expires_at && (
                        <p className="text-[12px] mt-2 text-ink-600">Expires {ffc.ffc_expires_at}</p>
                    )}
                </div>

                {/* Current cert + form */}
                <form onSubmit={submit} className="space-y-5">
                    <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">FFC number *</label>
                                <input
                                    value={data.ffc_number}
                                    onChange={(e) => setData('ffc_number', e.target.value)}
                                    placeholder="e.g. 2026-PPR-123456"
                                    required
                                    className={inputCls}
                                />
                                {errors.ffc_number && <p className="text-[11px] text-danger mt-1">{errors.ffc_number}</p>}
                            </div>
                            <div>
                                <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Expiry date *</label>
                                <input
                                    type="date"
                                    value={data.ffc_expires_at}
                                    onChange={(e) => setData('ffc_expires_at', e.target.value)}
                                    required
                                    className={inputCls}
                                />
                                {errors.ffc_expires_at && <p className="text-[11px] text-danger mt-1">{errors.ffc_expires_at}</p>}
                            </div>
                        </div>

                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">
                                Certificate file {ffc.has_certificate ? '(upload a new file to replace the existing one)' : '*'}
                            </label>
                            <input
                                type="file"
                                accept="application/pdf,image/png,image/jpeg"
                                onChange={(e) => setData('ffc_certificate', e.target.files?.[0] ?? null)}
                                className="block w-full text-[13px] file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-[12px] file:font-semibold file:bg-ink-100 file:text-ink-700 hover:file:bg-ink-200"
                            />
                            <p className="text-[11px] text-ink-500 mt-1">PDF, JPG or PNG · up to 10 MB</p>
                            {errors.ffc_certificate && <p className="text-[11px] text-danger mt-1">{errors.ffc_certificate}</p>}

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

                    <div className="flex items-center justify-between">
                        <p className="text-[12px] text-ink-500">
                            {ffc.last_reminder_sent_at
                                ? `Last reminder email sent ${ffc.last_reminder_sent_at}`
                                : 'Reminder emails fire automatically within 30 days of expiry.'}
                        </p>
                        <button
                            type="submit"
                            disabled={processing || ! data.ffc_number || ! data.ffc_expires_at}
                            className="px-5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 font-semibold transition"
                        >
                            {processing && <Spinner size={13} />}
                            {processing ? 'Saving…' : 'Save certificate'}
                        </button>
                    </div>
                </form>

                {/* Why this matters */}
                <div className="mt-8 bg-ink-50/60 border border-ink-200 rounded-xl p-5 text-[12.5px] text-ink-600 leading-relaxed">
                    <p className="font-semibold text-ink-700 mb-1">Why this matters</p>
                    Section 47 of the Property Practitioners Act prohibits practitioners from acting (or receiving remuneration)
                    without a current FFC. Property Basket blocks listing creation, tenant invites, viewings, inspections, and
                    other transactional features when an FFC is missing or expired.
                </div>
            </div>
        </AgentLayout>
    );
}
