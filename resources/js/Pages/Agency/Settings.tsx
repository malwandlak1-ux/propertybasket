import { FormEvent, useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';

type AgencyProps = {
    id: number;
    name: string;
    slug: string;
    email: string | null;
    phone: string | null;
    head_office_address: string | null;
    website: string | null;
    logo: string | null;
    eaab_ffc_number: string | null;
    eaab_verified_at: string | null;
    vat_registered: boolean;
    vat_number: string | null;
    vat_rate: number;
    trust_bank: string | null;
    trust_account_number: string | null;
    trust_branch_code: string | null;
    payout_day: number;
    paystack_subaccount_code: string | null;
};

type Props = { agency: AgencyProps };

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

const TABS = [
    { key: 'general', label: 'General Profile' },
    { key: 'vat', label: 'VAT & Tax' },
    { key: 'trust', label: 'Trust Account' },
    { key: 'payouts', label: 'Payouts & Paystack' },
    { key: 'compliance', label: 'EAAB & Compliance' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const SA_BANKS = ['First National Bank (FNB)', 'Standard Bank', 'ABSA', 'Nedbank', 'Capitec', 'Investec', 'TymeBank'];

export default function Settings({ agency }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [tab, setTab] = useState<TabKey>('general');

    const { data, setData, post, processing, errors, isDirty, progress } = useForm<{
        name: string;
        email: string;
        phone: string;
        website: string;
        head_office_address: string;
        logo: File | null;
        vat_registered: boolean;
        vat_number: string;
        vat_rate: number;
        trust_bank: string;
        trust_account_number: string;
        trust_branch_code: string;
        payout_day: number;
        eaab_ffc_number: string;
        _method: string;
    }>({
        name: agency.name ?? '',
        email: agency.email ?? '',
        phone: agency.phone ?? '',
        website: agency.website ?? '',
        head_office_address: agency.head_office_address ?? '',
        logo: null,

        vat_registered: agency.vat_registered,
        vat_number: agency.vat_number ?? '',
        vat_rate: agency.vat_rate,

        trust_bank: agency.trust_bank ?? '',
        trust_account_number: agency.trust_account_number ?? '',
        trust_branch_code: agency.trust_branch_code ?? '',

        payout_day: agency.payout_day,
        eaab_ffc_number: agency.eaab_ffc_number ?? '',
        _method: 'patch',
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agency/settings', { preserveScroll: true, forceFormData: true });
    }

    return (
        <AgencyLayout agencyName={agency.name} crumb="Settings">
            <Head title="Settings" />
            <section className="px-8 py-7">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                    <p className="text-[14px] text-ink-500 mt-1">Configure VAT, trust account, payouts, and integrations</p>
                </div>

                {flash?.success && (
                    <div className="mb-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                        {flash.success}
                    </div>
                )}

                <form onSubmit={submit} className="grid grid-cols-4 gap-6">
                    <aside className="space-y-1">
                        {TABS.map((t) => (
                            <button
                                type="button"
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={
                                    'w-full text-left px-3 py-2 rounded-lg text-[13px] font-semibold transition ' +
                                    (tab === t.key ? 'bg-ink-900 text-white' : 'hover:bg-ink-100 text-ink-700')
                                }
                            >
                                {t.label}
                            </button>
                        ))}
                    </aside>

                    <div className="col-span-3 space-y-6">
                        {tab === 'general' && (
                            <Panel title="General Profile" subtitle="Public details for your agency">
                                {/* Logo */}
                                <div className="flex items-start gap-4 pb-4 border-b border-ink-100">
                                    <div className="w-24 h-24 rounded-xl bg-ink-50 border border-ink-200 flex items-center justify-center overflow-hidden shrink-0">
                                        {data.logo ? (
                                            <img src={URL.createObjectURL(data.logo)} alt="New logo preview" className="w-full h-full object-cover" />
                                        ) : agency.logo ? (
                                            <img src={agency.logo} alt={`${agency.name} logo`} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[28px] font-bold text-ink-400">{agency.name.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[12px] text-ink-500 mb-1 block">Company logo</label>
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                            onChange={(e) => setData('logo', e.target.files?.[0] ?? null)}
                                            className="block w-full text-[13px] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[12px] file:font-semibold file:bg-ink-100 file:text-ink-700 hover:file:bg-ink-200"
                                        />
                                        <p className="text-[11px] text-ink-500 mt-1">
                                            PNG, JPG, WebP, or SVG · up to 2 MB · square works best
                                        </p>
                                        {data.logo && (
                                            <button
                                                type="button"
                                                onClick={() => setData('logo', null)}
                                                className="text-[11px] text-ink-500 hover:text-ink-900 mt-1.5"
                                            >
                                                Clear selected file
                                            </button>
                                        )}
                                        {errors.logo && <p className="text-[11px] text-danger mt-1">{errors.logo}</p>}
                                    </div>
                                </div>

                                <Row>
                                    <Field label="Agency name">
                                        <Input value={data.name} onChange={(v) => setData('name', v)} error={errors.name} />
                                    </Field>
                                    <Field label="Contact email">
                                        <Input type="email" value={data.email} onChange={(v) => setData('email', v)} error={errors.email} />
                                    </Field>
                                </Row>
                                <Row>
                                    <Field label="Phone">
                                        <Input value={data.phone} onChange={(v) => setData('phone', v)} error={errors.phone} />
                                    </Field>
                                    <Field label="Website">
                                        <Input value={data.website} onChange={(v) => setData('website', v)} placeholder="https://..." error={errors.website} />
                                    </Field>
                                </Row>
                                <Field label="Head office address">
                                    <Input value={data.head_office_address} onChange={(v) => setData('head_office_address', v)} error={errors.head_office_address} />
                                </Field>
                            </Panel>
                        )}

                        {tab === 'vat' && (
                            <Panel
                                title="VAT & Tax Settings"
                                subtitle="Configure how the system calculates and reports VAT"
                                statusBadge={data.vat_registered ? { label: 'ACTIVE', tone: 'success' } : { label: 'INACTIVE', tone: 'ink' }}
                            >
                                <ToggleRow
                                    title="VAT Registered"
                                    description="Apply 15% VAT to commission invoices"
                                    on={data.vat_registered}
                                    onToggle={() => setData('vat_registered', !data.vat_registered)}
                                />
                                <Row>
                                    <Field label="VAT Number">
                                        <Input
                                            value={data.vat_number}
                                            onChange={(v) => setData('vat_number', v)}
                                            className="font-mono"
                                            error={errors.vat_number}
                                        />
                                    </Field>
                                    <Field label="VAT Rate (%)">
                                        <Input
                                            type="number"
                                            step={0.01}
                                            value={String(data.vat_rate)}
                                            onChange={(v) => setData('vat_rate', Number(v))}
                                            className="font-mono"
                                            error={errors.vat_rate}
                                        />
                                    </Field>
                                </Row>
                            </Panel>
                        )}

                        {tab === 'trust' && (
                            <Panel
                                title="Trust Account (Section 32)"
                                subtitle="EAAB-mandated separate account for rental income & deposits"
                                statusBadge={data.trust_account_number ? { label: 'CONFIGURED', tone: 'success' } : { label: 'NOT SET', tone: 'ink' }}
                            >
                                <Row>
                                    <Field label="Bank">
                                        <Select
                                            value={data.trust_bank}
                                            onChange={(v) => setData('trust_bank', v)}
                                            options={['', ...SA_BANKS]}
                                            placeholder="Select bank…"
                                        />
                                    </Field>
                                    <Field label="Branch Code">
                                        <Input
                                            value={data.trust_branch_code}
                                            onChange={(v) => setData('trust_branch_code', v)}
                                            className="font-mono"
                                            error={errors.trust_branch_code}
                                        />
                                    </Field>
                                </Row>
                                <Field label="Account Number">
                                    <Input
                                        value={data.trust_account_number}
                                        onChange={(v) => setData('trust_account_number', v)}
                                        className="font-mono"
                                        error={errors.trust_account_number}
                                    />
                                </Field>
                            </Panel>
                        )}

                        {tab === 'payouts' && (
                            <Panel
                                title="Payouts & Paystack"
                                subtitle="Configure when and how agents get paid"
                                statusBadge={{ label: 'STUB', tone: 'warning' }}
                            >
                                <Row>
                                    <Field label="Payout Cycle">
                                        <Select value="Monthly" onChange={() => {}} options={['Monthly']} disabled />
                                    </Field>
                                    <Field label="Day of month">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={28}
                                            value={String(data.payout_day)}
                                            onChange={(v) => setData('payout_day', Number(v))}
                                            className="font-mono"
                                            error={errors.payout_day}
                                        />
                                    </Field>
                                </Row>
                                <div className="bg-ink-50 rounded-lg p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                            <rect x="2" y="5" width="20" height="14" rx="2" />
                                            <path d="M2 10h20" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[13px] font-semibold">Paystack integration</p>
                                        <p className="text-[11px] text-ink-500 font-mono">
                                            {agency.paystack_subaccount_code ?? 'No subaccount yet — using stub'}
                                        </p>
                                    </div>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-bold">PHASE 9</span>
                                </div>
                            </Panel>
                        )}

                        {tab === 'compliance' && (
                            <Panel
                                title="EAAB & Compliance"
                                subtitle="Fidelity Fund Certificate details for the agency"
                                statusBadge={agency.eaab_verified_at ? { label: 'VERIFIED', tone: 'success' } : { label: 'PENDING', tone: 'ink' }}
                            >
                                <Field label="EAAB FFC Number">
                                    <Input
                                        value={data.eaab_ffc_number}
                                        onChange={(v) => setData('eaab_ffc_number', v)}
                                        className="font-mono"
                                        error={errors.eaab_ffc_number}
                                    />
                                </Field>
                                <p className="text-[12px] text-ink-500 mt-2">
                                    Verified on {agency.eaab_verified_at ? new Date(agency.eaab_verified_at).toLocaleDateString('en-ZA') : '—'}.
                                </p>
                            </Panel>
                        )}

                        {progress && (
                            <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress.percentage}%` }} />
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                disabled={!isDirty || processing}
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 disabled:opacity-40"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!isDirty || processing}
                                className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 disabled:opacity-40"
                            >
                                {processing ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </form>
            </section>
        </AgencyLayout>
    );
}

function Panel({
    title,
    subtitle,
    statusBadge,
    children,
}: {
    title: string;
    subtitle: string;
    statusBadge?: { label: string; tone: 'success' | 'warning' | 'ink' };
    children: React.ReactNode;
}) {
    const badgeCls =
        statusBadge?.tone === 'success'
            ? 'bg-success/15 text-success'
            : statusBadge?.tone === 'warning'
            ? 'bg-warning/15 text-warning'
            : 'bg-ink-100 text-ink-500';
    return (
        <div className="bg-white rounded-xl border border-ink-200 p-6 shadow-soft">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-base font-bold">{title}</h2>
                    <p className="text-[12px] text-ink-500 mt-0.5">{subtitle}</p>
                </div>
                {statusBadge && (
                    <span className={'text-[10px] px-2 py-1 rounded-full font-bold ' + badgeCls}>{statusBadge.label}</span>
                )}
            </div>
            <div className="space-y-4">{children}</div>
        </div>
    );
}

function Row({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-2 gap-4 py-1">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-[12px] text-ink-500 mb-1 block">{label}</label>
            {children}
        </div>
    );
}

function Input({
    value,
    onChange,
    type = 'text',
    className = '',
    placeholder,
    error,
    step,
    min,
    max,
    disabled,
}: {
    value: string;
    onChange: (v: string) => void;
    type?: string;
    className?: string;
    placeholder?: string;
    error?: string;
    step?: number;
    min?: number;
    max?: number;
    disabled?: boolean;
}) {
    return (
        <>
            <input
                type={type}
                step={step}
                min={min}
                max={max}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className={
                    'w-full bg-ink-50 border border-ink-200 rounded-md px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition ' +
                    (error ? 'border-danger focus:ring-danger/20 focus:border-danger ' : '') +
                    (disabled ? 'opacity-60 cursor-not-allowed ' : '') +
                    className
                }
            />
            {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
        </>
    );
}

function Select({
    value,
    onChange,
    options,
    placeholder,
    disabled,
}: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    placeholder?: string;
    disabled?: boolean;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={
                'w-full bg-ink-50 border border-ink-200 rounded-md px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition ' +
                (disabled ? 'opacity-60 cursor-not-allowed ' : '')
            }
        >
            {options.map((o, i) => (
                <option key={i} value={o}>
                    {o === '' ? placeholder ?? '—' : o}
                </option>
            ))}
        </select>
    );
}

function ToggleRow({
    title,
    description,
    on,
    onToggle,
}: {
    title: string;
    description: string;
    on: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-ink-100 last:border-0">
            <div>
                <p className="text-[13px] font-semibold">{title}</p>
                <p className="text-[11px] text-ink-500">{description}</p>
            </div>
            <button
                type="button"
                onClick={onToggle}
                aria-pressed={on}
                className={
                    'relative w-10 h-[22px] rounded-full transition ' +
                    (on ? 'bg-brand-500' : 'bg-ink-200')
                }
            >
                <span
                    className={
                        'absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-white rounded-full shadow transition-transform ' +
                        (on ? 'translate-x-[18px]' : '')
                    }
                />
            </button>
        </div>
    );
}
