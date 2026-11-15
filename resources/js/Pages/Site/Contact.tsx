import { FormEvent, useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import SiteLayout, { Eyebrow, useSite, useTemplate } from '@/Layouts/SiteLayout';

type Intent = 'general' | 'sell' | 'let';

export default function SiteContact({ intent: initial }: { intent: Intent }) {
    const site = useSite();
    const t = useTemplate();
    const [sent, setSent] = useState(false);
    const wa = site.social_links.whatsapp?.replace(/[^\d]/g, '').replace(/^0/, '27');

    const form = useForm({ intent: initial, name: '', email: '', phone: '', address: '', message: '' });

    function submit(e: FormEvent) {
        e.preventDefault();
        form.post('/contact', { preserveScroll: true, onSuccess: () => { setSent(true); form.reset('name', 'email', 'phone', 'address', 'message'); } });
    }

    const details = [
        site.contact.phone && { label: 'Call', value: site.contact.phone, href: `tel:${site.contact.phone}` },
        wa && { label: 'WhatsApp', value: site.social_links.whatsapp as string, href: `https://wa.me/${wa}` },
        site.contact.email && { label: 'Email', value: site.contact.email, href: `mailto:${site.contact.email}` },
        site.contact.address && { label: 'Visit', value: site.contact.address, href: `https://maps.google.com/?q=${encodeURIComponent(site.contact.address)}` },
    ].filter(Boolean) as { label: string; value: string; href: string }[];

    const field = 'w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-ink-900';

    return (
        <SiteLayout>
            <Head title={form.data.intent === 'sell' ? 'Book a valuation' : 'Contact'} />
            <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-14 pb-20 grid gap-14 lg:grid-cols-[1fr_1.1fr]">
                <div>
                    <Eyebrow>{form.data.intent === 'general' ? 'Contact' : 'Valuations'}</Eyebrow>
                    <h1 className={`mt-5 text-[42px] sm:text-[56px] leading-[1.02] ${t.heading}`}>
                        {form.data.intent === 'general' ? "Let's talk." : 'What is your property worth?'}
                    </h1>
                    <p className="mt-5 text-[16px] text-ink-600 max-w-md leading-relaxed">
                        {form.data.intent === 'general'
                            ? `Buying, renting, selling or letting — send us a note and someone from ${site.name} will get back to you.`
                            : `Book a free, no-obligation valuation. A ${site.name} agent will contact you to arrange a visit.`}
                    </p>
                    <dl className="mt-10 divide-y divide-black/10 border-y border-black/10">
                        {details.map((d) => (
                            <div key={d.label} className="py-4 grid grid-cols-[90px_1fr] gap-4">
                                <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500 pt-1">{d.label}</dt>
                                <dd><a href={d.href} target={d.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="text-[16px] hover:text-brand-600 break-words">{d.value}</a></dd>
                            </div>
                        ))}
                    </dl>
                </div>

                <form onSubmit={submit} className={`bg-white border border-black/[0.06] p-6 sm:p-8 self-start ${t.card}`}>
                    {sent && <p className="mb-5 rounded-lg bg-success/10 text-success text-[14px] px-4 py-3">Thank you — one of our agents will be in touch shortly.</p>}
                    <div className="flex flex-wrap gap-1 mb-6">
                        {([['general', 'General enquiry'], ['sell', "I'm selling"], ['let', "I'm letting"]] as [Intent, string][]).map(([k, label]) => (
                            <button key={k} type="button" onClick={() => form.setData('intent', k)}
                                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition ${form.data.intent === k ? 'bg-ink-900 text-white' : 'text-ink-600 bg-ink-50 hover:bg-ink-100'}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Name" error={form.errors.name}><input required value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} className={field} /></Field>
                        <Field label="Phone" error={form.errors.phone}><input value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} className={field} /></Field>
                        <div className="sm:col-span-2"><Field label="Email" error={form.errors.email}><input required type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} className={field} /></Field></div>
                        {form.data.intent !== 'general' && (
                            <div className="sm:col-span-2"><Field label="Property address" error={form.errors.address}><input value={form.data.address} onChange={(e) => form.setData('address', e.target.value)} placeholder="Street, suburb" className={field} /></Field></div>
                        )}
                        <div className="sm:col-span-2"><Field label="Message" error={form.errors.message}><textarea rows={4} value={form.data.message} onChange={(e) => form.setData('message', e.target.value)} className={field} /></Field></div>
                    </div>
                    <button disabled={form.processing} className={`mt-6 w-full py-3.5 bg-ink-900 hover:bg-brand-600 disabled:opacity-60 text-white font-semibold text-[15px] transition ${t.button}`}>
                        {form.processing ? 'Sending…' : form.data.intent === 'general' ? 'Send message' : 'Request my valuation'}
                    </button>
                </form>
            </section>
        </SiteLayout>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500 mb-1.5">{label}</span>
            {children}
            {error && <span className="block text-danger text-[12px] mt-1">{error}</span>}
        </label>
    );
}
