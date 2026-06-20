import { FormEvent } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import { LegalShell, LegalMeta } from './_Shell';

type Props = { meta: LegalMeta };
type FlashProps = { flash?: { success?: string } };

const REQUEST_TYPES = [
    { value: 'access',      label: 'Access — a copy of the personal information you hold about me' },
    { value: 'correction',  label: 'Correction — update inaccurate information' },
    { value: 'deletion',    label: 'Deletion — erase my account and personal data' },
    { value: 'objection',   label: 'Objection — stop processing my data for marketing' },
    { value: 'portability', label: 'Portability — export my data in a machine-readable format' },
    { value: 'other',       label: 'Other / general privacy enquiry' },
];

export default function PrivacyPortal({ meta }: Props) {
    const { props } = usePage<FlashProps>();
    const success = props.flash?.success;

    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        request_type: 'access',
        details: '',
        website: '', // honeypot
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/privacy-portal', { preserveScroll: true });
    }

    return (
        <LegalShell
            title="Privacy Portal"
            subtitle="Exercise your data-subject rights under POPIA."
            meta={meta}
        >
            <Head title="Privacy Portal" />

            <p>
                The Protection of Personal Information Act ("POPIA") gives you specific rights over the personal information we hold about you. Use this form to submit a request to our Information Officer. We acknowledge requests within <strong>3 business days</strong> and respond fully within the <strong>30-day statutory period</strong>.
            </p>

            <h2>What you can ask for</h2>
            <ul>
                <li><strong>Access</strong> — a copy of the personal information we hold about you</li>
                <li><strong>Correction</strong> — update inaccurate or out-of-date information</li>
                <li><strong>Deletion</strong> — erase your account and personal data (subject to legal retention obligations such as tax records)</li>
                <li><strong>Objection</strong> — opt out of marketing communications or other non-essential processing</li>
                <li><strong>Portability</strong> — receive your data in a machine-readable format you can take to another service</li>
            </ul>

            <p>
                For verification, we may ask you to confirm your identity before fulfilling certain requests — particularly access, deletion and portability. This protects your data from being released to someone impersonating you.
            </p>

            {/* Form — wrapped in a styled card outside the article prose so layout breathes */}
            <div className="not-prose mt-8 bg-white rounded-xl border border-ink-200 shadow-soft p-6">
                <h2 className="text-base font-bold mb-1">Submit a request</h2>
                <p className="text-[12.5px] text-ink-500 mb-5">
                    All fields except details are required. Your message goes directly to our Information Officer at{' '}
                    <a href={`mailto:${meta.information_officer}`} className="text-brand-600 font-semibold">{meta.information_officer}</a>.
                </p>

                {success ? (
                    <div className="rounded-lg bg-success/10 border border-success/30 p-5 text-center">
                        <div className="w-10 h-10 rounded-full bg-success text-white flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                <path d="M20 6L9 17l-5-5"/>
                            </svg>
                        </div>
                        <p className="text-[13px] font-semibold text-success">Request received</p>
                        <p className="text-[12px] text-ink-600 mt-1">{success}</p>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-4">
                        {/* Honeypot */}
                        <input
                            type="text"
                            value={data.website}
                            onChange={(e) => setData('website', e.target.value)}
                            tabIndex={-1}
                            autoComplete="off"
                            className="absolute left-[-9999px] w-0 h-0 opacity-0"
                            aria-hidden="true"
                        />

                        <div>
                            <label className="block text-[12px] font-semibold text-ink-700 mb-1.5">Full name</label>
                            <input
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                required
                                placeholder="As it appears on your ID"
                                className="w-full bg-white border border-ink-200 rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            />
                            {errors.name && <p className="text-[11px] text-danger mt-1">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold text-ink-700 mb-1.5">Email address</label>
                            <input
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                required
                                placeholder="The email linked to your Property Basket account"
                                className="w-full bg-white border border-ink-200 rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            />
                            {errors.email && <p className="text-[11px] text-danger mt-1">{errors.email}</p>}
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold text-ink-700 mb-1.5">Type of request</label>
                            <select
                                value={data.request_type}
                                onChange={(e) => setData('request_type', e.target.value)}
                                className="w-full bg-white border border-ink-200 rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            >
                                {REQUEST_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                            {errors.request_type && <p className="text-[11px] text-danger mt-1">{errors.request_type}</p>}
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold text-ink-700 mb-1.5">
                                Details <span className="text-ink-400 font-normal">(optional but recommended)</span>
                            </label>
                            <textarea
                                value={data.details}
                                onChange={(e) => setData('details', e.target.value)}
                                rows={4}
                                placeholder="Anything that will help us locate or action your request — for example, which information you'd like corrected."
                                className="w-full bg-white border border-ink-200 rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none"
                            />
                            {errors.details && <p className="text-[11px] text-danger mt-1">{errors.details}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full px-4 py-2.5 rounded-lg bg-ink-900 hover:bg-brand-500 text-white text-[14px] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {processing ? 'Submitting…' : 'Submit request'}
                        </button>
                    </form>
                )}
            </div>

            <h2>Information Regulator</h2>
            <p>
                If you're not satisfied with our response, you have the right to lodge a complaint with the Information Regulator of South Africa:
            </p>
            <ul>
                <li>Email: <a href="mailto:inforeg@justice.gov.za">inforeg@justice.gov.za</a></li>
                <li>Website: <a href="https://inforegulator.org.za" target="_blank" rel="noopener noreferrer">inforegulator.org.za</a></li>
            </ul>
        </LegalShell>
    );
}
