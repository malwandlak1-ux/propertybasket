import { Head, router, usePage } from '@inertiajs/react';
import { ReactNode, createContext, useContext, useEffect, useRef, useState } from 'react';

type Val = string | number | boolean | null;
type Data = Partial<Record<'personal' | 'address' | 'employment' | 'contact' | 'lease' | 'consent', Record<string, Val>>>;
type Doc = { id: number; kind: string; name: string; size: number };
type Kind = { label: string; hint: string | null; required: string[] };

type Props = {
    token: string;
    status: string;
    editable: boolean;
    step: number;
    employment_type: 'salary' | 'self_employed' | null;
    data: Data;
    invitee: { name: string | null; email: string | null; phone: string | null };
    agency: { name: string; logo: string | null; phone: string | null; email: string | null };
    agent: { name: string; phone: string | null; email: string | null } | null;
    listing: { title: string; address: string; rent: number; image: string | null; bedrooms: number | null; bathrooms: number | null } | null;
    documents: Doc[];
    documentKinds: Record<string, Kind>;
    submitted_at: string | null;
    brand: string;
};

const STEPS = ['Welcome', 'Employment', 'About you', 'Where you live', 'Income', 'Contact & move-in', 'Documents', 'Review & sign'];
const R = (n: number) => 'R ' + Math.round(n).toLocaleString('en-ZA').replace(/,/g, ' ');
const input = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-3 text-[15px] focus:outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 mt-1.5';

type Section = keyof Data;
const FormCtx = createContext<{ val: (s: Section, k: string) => string; set: (s: Section, k: string, v: Val) => void; errors: Record<string, string> }>({ val: () => '', set: () => {}, errors: {} });

function F({ label, section, k, type: t = 'text', ph, opt, half }: { label: string; section: Section; k: string; type?: string; ph?: string; opt?: boolean; half?: boolean }) {
    const { val, set, errors } = useContext(FormCtx);
    return (
        <label className={`block text-[13px] font-semibold text-ink-800 ${half ? '' : 'sm:col-span-2'}`}>{label}{opt && <span className="font-normal text-ink-500"> (optional)</span>}
            <input type={t} inputMode={t === 'number' ? 'decimal' : undefined} value={val(section, k)} placeholder={ph} onChange={(e) => set(section, k, e.target.value)} className={input} />
            {errors[`${section}.${k}`] && <p className="text-danger text-[12.5px] mt-1">{errors[`${section}.${k}`]}</p>}
        </label>
    );
}

function Sel({ label, section, k, options, half }: { label: string; section: Section; k: string; options: [string, string][]; half?: boolean }) {
    const { val, set, errors } = useContext(FormCtx);
    return (
        <label className={`block text-[13px] font-semibold text-ink-800 ${half ? '' : 'sm:col-span-2'}`}>{label}
            <select value={val(section, k)} onChange={(e) => set(section, k, e.target.value)} className={input}>
                <option value="">Choose…</option>
                {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {errors[`${section}.${k}`] && <p className="text-danger text-[12.5px] mt-1">{errors[`${section}.${k}`]}</p>}
        </label>
    );
}

export default function Apply(p: Props) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [step, setStep] = useState(p.editable ? Math.min(p.step, STEPS.length - 1) : 0);
    const [type, setType] = useState(p.employment_type);
    const [data, setData] = useState<Data>(() => {
        const d: Data = { ...(p.data ?? {}) };
        d.personal = { email: p.invitee.email, phone: p.invitee.phone, first_name: p.invitee.name?.split(' ')[0] ?? '', last_name: p.invitee.name?.split(' ').slice(1).join(' ') ?? '', id_type: 'sa_id', adults: 1, ...(d.personal ?? {}) };
        d.address = { residence_type: 'renting', ...(d.address ?? {}) };
        d.lease = { lease_term: '12', ...(d.lease ?? {}) };
        return d;
    });
    const [saving, setSaving] = useState(false);
    const top = useRef<HTMLDivElement>(null);

    useEffect(() => { top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [step]);

    // After a failed submit, jump to the first step with a problem.
    useEffect(() => {
        const keys = Object.keys(errors ?? {});
        if (!keys.length) return;
        const order: [string, number][] = [['employment_type', 1], ['personal.', 2], ['address.', 3], ['employment.', 4], ['contact.', 5], ['lease.', 5], ['documents.', 6], ['consent.', 7]];
        const hit = order.find(([prefix]) => keys.some((k) => k.startsWith(prefix)));
        if (hit) setStep(hit[1]);
    }, [errors]);

    const set = (section: keyof Data, key: string, v: Val) => setData((d) => ({ ...d, [section]: { ...(d[section] ?? {}), [key]: v } }));
    const val = (section: keyof Data, key: string) => (data[section]?.[key] ?? '') as string;

    function save(section: keyof Data | null, next: number) {
        setSaving(true);
        router.post(`/apply/${p.token}/save`, { section, values: section ? data[section] : null, employment_type: type, step: next }, {
            preserveScroll: true, preserveState: true,
            onSuccess: () => setStep(next),
            onFinish: () => setSaving(false),
        });
    }

    if (!p.editable) return <Shell p={p}><Done p={p} /></Shell>;

    const err = (k: string) => errors?.[k] && <p className="text-danger text-[12.5px] mt-1">{errors[k]}</p>;
    const Nav = ({ section, nextLabel = 'Continue', disabled }: { section: keyof Data | null; nextLabel?: string; disabled?: boolean }) => (
        <div className="flex items-center gap-3 pt-5">
            <button type="button" onClick={() => setStep(step - 1)} className="px-4 py-3 rounded-xl text-[14px] font-semibold text-ink-600 hover:bg-ink-100">Back</button>
            <button type="button" disabled={saving || disabled} onClick={() => save(section, step + 1)} className="flex-1 px-5 py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-[15px] font-bold disabled:opacity-50">{saving ? 'Saving…' : nextLabel}</button>
        </div>
    );
    const grid = 'grid grid-cols-1 sm:grid-cols-2 gap-4';

    return (
        <FormCtx.Provider value={{ val, set, errors: errors ?? {} }}>
        <Shell p={p}>
            <div ref={top} />
            {step > 0 && (
                <div className="mb-5">
                    <div className="flex justify-between text-[11.5px] font-bold uppercase tracking-wider text-ink-500 mb-1.5"><span>{STEPS[step]}</span><span>Step {step} of {STEPS.length - 1}</span></div>
                    <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden"><div className="h-full bg-brand-500 transition-all" style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} /></div>
                </div>
            )}
            {errors?.application && <p className="mb-4 text-[13px] text-danger bg-danger/5 rounded-xl px-3.5 py-2.5">{errors.application}</p>}

            {step === 0 && (
                <div>
                    {p.listing && <PropertyCard l={p.listing} />}
                    <h1 className="text-[34px] sm:text-[40px] mt-6">Complete your rental application online</h1>
                    <p className="text-[15px] text-ink-600 mt-3">{p.agency.name} has invited you to apply{p.listing ? ' for this home' : ''}. It takes about 10 minutes, and your answers save as you go.</p>
                    <ol className="mt-6 space-y-3">
                        {['Get your documents ready', 'Fill in your details', 'Upload your documents and sign'].map((t, i) => (
                            <li key={t} className="flex items-center gap-3 text-[15px] font-semibold text-ink-800">
                                <span className="w-8 h-8 rounded-full bg-brand-500 text-white grid place-items-center text-[14px] font-bold shrink-0">{i + 1}</span>{t}
                            </li>
                        ))}
                        <li className="flex items-center gap-3 text-[15px] font-semibold text-ink-800"><span className="w-8 h-8 rounded-full bg-success text-white grid place-items-center shrink-0">✓</span>And {p.agent?.name.split(' ')[0] ?? 'we'}’ll do the rest</li>
                    </ol>
                    <button type="button" onClick={() => save(null, 1)} className="w-full mt-8 px-5 py-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-[16px] font-bold">{p.step > 0 ? 'Continue my application' : 'Get started'}</button>
                </div>
            )}

            {step === 1 && (
                <div>
                    <h2 className="text-[26px]">Let’s get started.</h2>
                    <p className="text-[14px] text-ink-600 mt-1">How do you earn your income?</p>
                    <div className="mt-5 space-y-3">
                        {([['salary', 'I’m a salary earner', 'Employed and paid a salary or wage'], ['self_employed', 'I’m self-employed', 'Business owner, freelancer or contractor']] as const).map(([v, t, s]) => (
                            <button key={v} type="button" onClick={() => setType(v)} className={`w-full text-left rounded-2xl border-2 px-4 py-4 transition ${type === v ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-ink-300'}`}>
                                <span className="block text-[16px] font-bold text-ink-900">{t}</span>
                                <span className="block text-[13px] text-ink-500">{s}</span>
                            </button>
                        ))}
                    </div>
                    {err('employment_type')}
                    {type && (
                        <div className="mt-5 rounded-2xl bg-brand-500 text-white p-5">
                            <p className="text-[17px] font-bold">Required documents</p>
                            <p className="text-[13px] text-white/80">For {type === 'salary' ? 'salary earners' : 'self-employed applicants'}</p>
                            <ul className="mt-3 space-y-1.5 text-[14px]">
                                {Object.entries(p.documentKinds).filter(([, k]) => k.required.includes(type)).map(([key, k]) => (
                                    <li key={key} className="flex gap-2"><span>•</span><span>{key === 'bank_statement' ? (type === 'salary' ? 'Latest 3 months’ stamped bank statements' : 'Latest 6 months’ bank statements') : k.label}</span></li>
                                ))}
                                {type === 'salary' && <li className="flex gap-2 text-white/80"><span>•</span><span>Latest IRP5 (if you have it)</span></li>}
                            </ul>
                        </div>
                    )}
                    <Nav section={null} nextLabel="Apply now" disabled={!type} />
                </div>
            )}

            {step === 2 && (
                <div>
                    <h2 className="text-[24px] mb-4">About you</h2>
                    <div className={grid}>
                        <F label="First name" section="personal" k="first_name" half />
                        <F label="Surname" section="personal" k="last_name" half />
                        <Sel label="Identity document" section="personal" k="id_type" options={[['sa_id', 'South African ID'], ['passport', 'Passport']]} half />
                        <F label={val('personal', 'id_type') === 'passport' ? 'Passport number' : 'ID number'} section="personal" k="id_number" half ph={val('personal', 'id_type') === 'passport' ? '' : '13 digits'} />
                        <F label="Date of birth" section="personal" k="date_of_birth" type="date" half opt />
                        <F label="Nationality" section="personal" k="nationality" half opt ph="South African" />
                        <F label="Email" section="personal" k="email" type="email" half />
                        <F label="Mobile number" section="personal" k="phone" type="tel" half ph="082 123 4567" />
                        <Sel label="Marital status" section="personal" k="marital_status" options={[['single', 'Single'], ['married', 'Married'], ['cohabiting', 'Living together'], ['divorced', 'Divorced'], ['widowed', 'Widowed']]} half />
                        <div className="grid grid-cols-2 gap-3">
                            <F label="Adults moving in" section="personal" k="adults" type="number" half />
                            <F label="Children" section="personal" k="children" type="number" half />
                        </div>
                        <label className="flex items-center gap-2.5 text-[14px] font-semibold text-ink-800 sm:col-span-2">
                            <input type="checkbox" className="w-5 h-5" checked={!!data.personal?.pets} onChange={(e) => set('personal', 'pets', e.target.checked)} />I have pets
                        </label>
                        {!!data.personal?.pets && <F label="Tell us about your pets" section="personal" k="pets_details" ph="e.g. 1 small dog" />}
                    </div>
                    <Nav section="personal" />
                </div>
            )}

            {step === 3 && (
                <div>
                    <h2 className="text-[24px] mb-4">Where you live now</h2>
                    <div className={grid}>
                        <F label="Current address" section="address" k="current_address" />
                        <Sel label="Living arrangement" section="address" k="residence_type" options={[['renting', 'Renting'], ['own', 'I own my home'], ['family', 'Living with family'], ['other', 'Other']]} half />
                        <F label="Years at this address" section="address" k="years_at_address" type="number" half opt />
                        {val('address', 'residence_type') === 'renting' && (
                            <>
                                <F label="Current monthly rent (R)" section="address" k="current_rent" type="number" half opt />
                                <div />
                                <F label="Current landlord or agent" section="address" k="landlord_name" half opt />
                                <F label="Their phone number" section="address" k="landlord_phone" type="tel" half opt />
                            </>
                        )}
                        <F label="Reason for moving" section="address" k="reason_for_moving" opt />
                    </div>
                    <Nav section="address" />
                </div>
            )}

            {step === 4 && (
                <div>
                    <h2 className="text-[24px] mb-4">{type === 'self_employed' ? 'Your business & income' : 'Your work & income'}</h2>
                    <div className={grid}>
                        {type === 'self_employed' ? (
                            <>
                                <F label="Business name" section="employment" k="business_name" />
                                <F label="Registration number" section="employment" k="business_reg" half opt />
                                <F label="Years trading" section="employment" k="years_trading" type="number" half />
                                <F label="What does the business do?" section="employment" k="business_nature" opt />
                            </>
                        ) : (
                            <>
                                <F label="Employer" section="employment" k="employer" half />
                                <F label="Job title" section="employment" k="job_title" half />
                                <F label="Employer phone" section="employment" k="employer_phone" type="tel" half opt />
                                <F label="Employed since" section="employment" k="employment_start" type="date" half opt />
                            </>
                        )}
                        <F label={type === 'self_employed' ? 'Average gross monthly income (R)' : 'Gross monthly salary (R)'} section="employment" k="gross_income" type="number" half />
                        <F label="Net monthly income (R)" section="employment" k="net_income" type="number" half />
                        <F label="Other monthly income (R)" section="employment" k="other_income" type="number" half opt />
                        <F label="Monthly debt repayments (R)" section="employment" k="monthly_debt" type="number" half opt />
                    </div>
                    {p.listing && Number(val('employment', 'gross_income')) > 0 && (
                        <p className="mt-4 text-[13px] text-ink-600 bg-ink-50 rounded-xl px-3.5 py-2.5">The rent of {R(p.listing.rent)} is {Math.round((p.listing.rent / (Number(val('employment', 'gross_income')) + Number(val('employment', 'other_income') || 0))) * 100)}% of your gross income. Landlords usually look for rent of about a third of income or less.</p>
                    )}
                    <Nav section="employment" />
                </div>
            )}

            {step === 5 && (
                <div>
                    <h2 className="text-[24px] mb-4">Emergency contact</h2>
                    <div className={grid}>
                        <F label="Full name" section="contact" k="kin_name" half />
                        <F label="Relationship" section="contact" k="kin_relationship" half ph="e.g. Sister" />
                        <F label="Phone number" section="contact" k="kin_phone" type="tel" half />
                    </div>
                    <h2 className="text-[24px] mt-7 mb-4">Your move</h2>
                    <div className={grid}>
                        <F label="When would you like to move in?" section="lease" k="move_in_date" type="date" half />
                        <Sel label="Lease length" section="lease" k="lease_term" options={[['6', '6 months'], ['12', '12 months'], ['24', '24 months'], ['other', 'Other']]} half />
                        <F label="Vehicles" section="lease" k="vehicles" half opt ph="e.g. 1 car" />
                        <F label="Anything else we should know?" section="lease" k="notes" opt />
                    </div>
                    <ContactSave onNext={() => {
                        setSaving(true);
                        router.post(`/apply/${p.token}/save`, { section: 'contact', values: data.contact, step: 5 }, {
                            preserveScroll: true, preserveState: true,
                            onSuccess: () => save('lease', 6),
                            onError: () => setSaving(false),
                        });
                    }} onBack={() => setStep(4)} saving={saving} />
                </div>
            )}

            {step === 6 && (
                <div>
                    <h2 className="text-[24px]">Upload your documents</h2>
                    <p className="text-[14px] text-ink-600 mt-1 mb-4">PDFs or clear photos, up to 10 MB each. Take photos with your phone if you don’t have scans.</p>
                    <div className="space-y-3">
                        {Object.entries(p.documentKinds).map(([key, k]) => (
                            <DocSlot key={key} token={p.token} kind={key} info={k} required={!!type && k.required.includes(type)} docs={p.documents.filter((d) => d.kind === key)} error={errors?.[`documents.${key}`]} type={type} />
                        ))}
                    </div>
                    {errors?.files && <p className="text-danger text-[12.5px] mt-2">{errors.files}</p>}
                    <Nav section={null} />
                </div>
            )}

            {step === 7 && (
                <div>
                    <h2 className="text-[24px]">Review & sign</h2>
                    <div className="mt-4 rounded-2xl border border-ink-200 divide-y divide-ink-100 text-[14px]">
                        {[
                            ['Applicant', `${val('personal', 'first_name')} ${val('personal', 'last_name')}`.trim(), 2],
                            ['Contact', [val('personal', 'email'), val('personal', 'phone')].filter(Boolean).join(' · '), 2],
                            ['Income', type === 'self_employed' ? `Self-employed · ${val('employment', 'business_name')}` : `${val('employment', 'job_title')} at ${val('employment', 'employer')}`, 4],
                            ['Gross income', val('employment', 'gross_income') ? `${R(Number(val('employment', 'gross_income')))} / month` : '', 4],
                            ['Move-in', val('lease', 'move_in_date'), 5],
                            ['Documents', `${p.documents.length} uploaded`, 6],
                        ].map(([l, v, s]) => (
                            <div key={l as string} className="flex items-center justify-between gap-3 px-4 py-2.5">
                                <span className="text-ink-500">{l}</span>
                                <span className="text-right text-ink-900 font-medium">{(v as string) || <em className="text-danger not-italic">missing</em>} <button type="button" onClick={() => setStep(s as number)} className="ml-2 text-[12px] font-semibold text-brand-700 hover:underline">Edit</button></span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-5 space-y-3 text-[13.5px] text-ink-700">
                        <label className="flex gap-3">
                            <input type="checkbox" className="w-5 h-5 mt-0.5 shrink-0" checked={!!data.consent?.credit_check} onChange={(e) => set('consent', 'credit_check', e.target.checked)} />
                            <span>I consent to {p.agency.name} and its credit bureau partners processing my personal information (POPIA) to check my credit record, verify my income and employment, and contact my references, for this application.</span>
                        </label>
                        {err('consent.credit_check')}
                        <label className="flex gap-3">
                            <input type="checkbox" className="w-5 h-5 mt-0.5 shrink-0" checked={!!data.consent?.declaration} onChange={(e) => set('consent', 'declaration', e.target.checked)} />
                            <span>I confirm that the information and documents I have given are true and complete.</span>
                        </label>
                        {err('consent.declaration')}
                        <label className="block text-[13px] font-semibold text-ink-800">Sign by typing your full name
                            <input value={val('consent', 'signature_name')} onChange={(e) => set('consent', 'signature_name', e.target.value)} className={`${input} italic`} style={{ fontFamily: 'Georgia, serif' }} />
                            {err('consent.signature_name')}
                        </label>
                    </div>

                    {Object.keys(errors ?? {}).length > 0 && <p className="mt-4 text-[13px] text-danger bg-danger/5 rounded-xl px-3.5 py-2.5">Some details are missing. We’ve taken you to the first one; please check each step.</p>}

                    <div className="flex items-center gap-3 pt-5">
                        <button type="button" onClick={() => setStep(6)} className="px-4 py-3 rounded-xl text-[14px] font-semibold text-ink-600 hover:bg-ink-100">Back</button>
                        <button type="button" disabled={saving} onClick={() => {
                            setSaving(true);
                            router.post(`/apply/${p.token}/save`, { section: 'consent', values: data.consent, employment_type: type, step: 7 }, {
                                preserveScroll: true, preserveState: true,
                                onSuccess: () => router.post(`/apply/${p.token}/submit`, {}, { preserveScroll: true, onFinish: () => setSaving(false) }),
                                onError: () => setSaving(false),
                            });
                        }} className="flex-1 px-5 py-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-[16px] font-bold disabled:opacity-50">{saving ? 'Submitting…' : 'Submit application'}</button>
                    </div>
                </div>
            )}
        </Shell>
        </FormCtx.Provider>
    );
}

function ContactSave({ onNext, onBack, saving }: { onNext: () => void; onBack: () => void; saving: boolean }) {
    return (
        <div className="flex items-center gap-3 pt-5">
            <button type="button" onClick={onBack} className="px-4 py-3 rounded-xl text-[14px] font-semibold text-ink-600 hover:bg-ink-100">Back</button>
            <button type="button" disabled={saving} onClick={onNext} className="flex-1 px-5 py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-[15px] font-bold disabled:opacity-50">{saving ? 'Saving…' : 'Continue'}</button>
        </div>
    );
}

function DocSlot({ token, kind, info, required, docs, error, type }: { token: string; kind: string; info: Kind; required: boolean; docs: Doc[]; error?: string; type: string | null }) {
    const [busy, setBusy] = useState(false);
    const ref = useRef<HTMLInputElement>(null);
    const label = kind === 'bank_statement' ? (type === 'self_employed' ? 'Latest 6 months’ bank statements' : 'Latest 3 months’ stamped bank statements') : info.label;
    if (!required && kind === 'business_docs' && type !== 'self_employed') return null;

    function upload(files: FileList | null) {
        if (!files?.length) return;
        setBusy(true);
        router.post(`/apply/${token}/documents`, { kind, files: Array.from(files) }, { forceFormData: true, preserveScroll: true, preserveState: true, onFinish: () => { setBusy(false); if (ref.current) ref.current.value = ''; } });
    }

    return (
        <div className={`rounded-2xl border p-4 ${error ? 'border-danger/50 bg-danger/5' : docs.length ? 'border-success/40 bg-success/5' : 'border-ink-200'}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[14.5px] font-bold text-ink-900">{docs.length > 0 && <span className="text-success">✓ </span>}{label}{!required && <span className="font-normal text-ink-500 text-[13px]"> (optional)</span>}</p>
                    {info.hint && kind !== 'bank_statement' && <p className="text-[12.5px] text-ink-500">{info.hint}</p>}
                </div>
                <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="shrink-0 px-3.5 py-2 rounded-xl border border-ink-300 text-[13px] font-semibold text-ink-800 bg-white hover:bg-ink-50 disabled:opacity-50">{busy ? 'Uploading…' : docs.length ? 'Add more' : 'Upload'}</button>
                <input ref={ref} type="file" multiple accept=".pdf,image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
            </div>
            {docs.length > 0 && (
                <ul className="mt-2 space-y-1">
                    {docs.map((d) => (
                        <li key={d.id} className="flex items-center gap-2 text-[13px] text-ink-700">
                            <span className="truncate flex-1">📄 {d.name}</span>
                            <span className="text-ink-400 text-[11.5px]">{Math.max(1, Math.round(d.size / 1024))} KB</span>
                            <button type="button" onClick={() => router.delete(`/apply/${token}/documents/${d.id}`, { preserveScroll: true, preserveState: true })} className="text-[12px] font-semibold text-danger hover:underline">Remove</button>
                        </li>
                    ))}
                </ul>
            )}
            {error && <p className="text-danger text-[12.5px] mt-1.5">{error}</p>}
        </div>
    );
}

function PropertyCard({ l }: { l: NonNullable<Props['listing']> }) {
    return (
        <div className="rounded-2xl overflow-hidden border border-ink-200 bg-white">
            {l.image && <img src={l.image} alt="" className="w-full h-44 object-cover" />}
            <div className="p-4">
                <p className="text-[16px] font-bold text-ink-900">{l.title}</p>
                <p className="text-[13px] text-ink-500">{l.address}</p>
                <p className="text-[13px] text-ink-700 mt-1.5"><span className="font-bold text-brand-600 text-[16px]">{R(l.rent)}</span> / month{l.bedrooms ? ` · ${l.bedrooms} bed` : ''}{l.bathrooms ? ` · ${l.bathrooms} bath` : ''}</p>
            </div>
        </div>
    );
}

function Done({ p }: { p: Props }) {
    const done = ['approved', 'declined'].includes(p.status);
    return (
        <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-success text-white grid place-items-center text-[30px] mx-auto">✓</div>
            <h1 className="text-[30px] mt-5">{p.status === 'approved' ? 'Your application was approved' : done ? 'Application closed' : 'Application submitted'}</h1>
            <p className="text-[15px] text-ink-600 mt-3">
                {p.status === 'approved'
                    ? `${p.agency.name} will contact you about the lease and deposit.`
                    : done
                        ? `${p.agency.name} has finished reviewing this application.`
                        : `Thank you. ${p.agent?.name ?? p.agency.name} will review your application and be in touch.`}
            </p>
            {p.submitted_at && <p className="text-[13px] text-ink-500 mt-2">Submitted {p.submitted_at}</p>}
            {p.listing && <div className="mt-6 text-left"><PropertyCard l={p.listing} /></div>}
            {(p.agent || p.agency.phone) && (
                <p className="text-[13px] text-ink-600 mt-6">Questions? Contact {p.agent?.name ?? p.agency.name}{(p.agent?.phone ?? p.agency.phone) ? ` on ${p.agent?.phone ?? p.agency.phone}` : ''}{(p.agent?.email ?? p.agency.email) ? ` or ${p.agent?.email ?? p.agency.email}` : ''}.</p>
            )}
        </div>
    );
}

function Shell({ p, children }: { p: Props; children: ReactNode }) {
    return (
        <div className="min-h-screen bg-ink-100/60 sm:py-8">
            <Head title={`Rental application · ${p.agency.name}`} />
            <div className="max-w-xl mx-auto bg-white sm:rounded-3xl sm:shadow-soft min-h-screen sm:min-h-0 overflow-hidden">
                <header className="flex items-center gap-3 px-5 sm:px-8 py-4 border-b border-ink-100">
                    {p.agency.logo ? <img src={p.agency.logo} alt="" className="h-9 w-auto max-w-[120px] object-contain" /> : <span className="w-9 h-9 rounded-xl bg-brand-500 text-white grid place-items-center font-bold">{p.agency.name.charAt(0)}</span>}
                    <div className="min-w-0">
                        <p className="text-[14px] font-bold text-ink-900 truncate">{p.agency.name}</p>
                        <p className="text-[11.5px] text-ink-500">Rental application</p>
                    </div>
                </header>
                <main className="px-5 sm:px-8 py-6">{children}</main>
                <footer className="px-5 sm:px-8 py-4 border-t border-ink-100 text-[11.5px] text-ink-400 flex flex-wrap justify-between gap-2">
                    <span>🔒 Sent securely and only shared with {p.agency.name}.</span>
                    <span>Powered by {p.brand}</span>
                </footer>
            </div>
        </div>
    );
}
