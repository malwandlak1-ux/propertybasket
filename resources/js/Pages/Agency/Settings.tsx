import { FormEvent, useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import AppearanceSettings from '@/Components/Dashboard/AppearanceSettings';
import { FlashBanners, PageHeader, btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';
import Icon, { IconName } from '@/Components/Dashboard/Icon';

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
    payout_method: PayoutMethod;
    paystack_subaccount_code: string | null;
    paystack_stub: boolean;
    trust_holder: string | null;
    trust_status: 'none' | 'review' | 'verified';
    investec: Investec | null;
    bank_link: BankLinkInfo | null;
};

type BankLinkInfo = { bank: string; bank_name: string; status: 'requested' | 'agreement' | 'credentials' | 'testing' | 'live' | 'paused'; requested_at: string | null; live_at: string | null; problem: string | null };

type PayoutMethod = 'paystack' | 'trust_account' | 'investec' | 'bank_h2h';
type Investec = { environment: 'production' | 'sandbox'; account_name: string | null; account: string; connected_at: string | null; last_error: string | null; problem: string | null };

type Props = { agency: AgencyProps };

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

const TABS: readonly { key: 'general' | 'vat' | 'trust' | 'payouts' | 'compliance' | 'appearance'; label: string; hint: string; icon: IconName }[] = [
    { key: 'general', label: 'General Profile', hint: 'Name, contact details, logo', icon: 'user' },
    { key: 'vat', label: 'VAT & Tax', hint: 'VAT registration and rate', icon: 'file' },
    { key: 'trust', label: 'Trust Account', hint: 'Section 32 account', icon: 'wallet' },
    { key: 'payouts', label: 'Payouts', hint: 'How and when agents get paid', icon: 'calendar' },
    { key: 'compliance', label: 'EAAB & Compliance', hint: 'FFC number', icon: 'alert' },
    { key: 'appearance', label: 'Appearance', hint: 'Dashboard colour and logo', icon: 'eye' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const TRUST_BADGE = {
    none: { label: 'NOT SET', tone: 'ink' },
    review: { label: 'AWAITING VERIFICATION', tone: 'warning' },
    verified: { label: 'VERIFIED', tone: 'success' },
} as const;

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
        payout_day: number;
        payout_method: PayoutMethod;
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

        payout_day: agency.payout_day,
        payout_method: agency.payout_method,
        eaab_ffc_number: agency.eaab_ffc_number ?? '',
        _method: 'patch',
    });

    const initials = agency.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

    function submit(e: FormEvent) {
        e.preventDefault();
        post('/agency/settings', { preserveScroll: true, forceFormData: true });
    }

    return (
        <AgencyLayout agencyName={agency.name} crumb="Settings">
            <Head title="Settings" />
            <section className="px-4 sm:px-7 py-6 max-w-6xl">
                <PageHeader title="Settings" subtitle="Configure VAT, trust account, payouts and integrations" />

                <FlashBanners flash={flash} />

                <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <aside className="lg:col-span-4 space-y-4">
                        <div className="pb-swirl rounded-2xl p-5 text-white shadow-lift pb-rise">
                            <div className="flex items-center gap-3">
                                {agency.logo ? (
                                    <img src={agency.logo} alt="" className="w-12 h-12 rounded-full bg-white object-contain ring-1 ring-white/25" />
                                ) : (
                                    <span className="w-12 h-12 rounded-full bg-white/15 ring-1 ring-white/25 flex items-center justify-center text-[15px] font-bold">{initials}</span>
                                )}
                                <div className="min-w-0">
                                    <p className="text-[15px] font-semibold truncate">{agency.name}</p>
                                    <p className="text-[12px] text-white/75 truncate">{agency.email ?? 'No email on file'}</p>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/15 flex flex-wrap items-center gap-2 text-[11px]">
                                <span className={`px-2.5 py-1 rounded-full font-semibold ${agency.eaab_verified_at ? 'bg-success/20' : 'bg-warning/30'}`}>
                                    {agency.eaab_verified_at ? 'EAAB verified' : 'EAAB pending'}
                                </span>
                                <span className={`px-2.5 py-1 rounded-full font-semibold ${agency.trust_account_number ? 'bg-white/15' : 'bg-danger/40'}`}>
                                    {agency.trust_account_number ? 'Trust account set' : 'No trust account'}
                                </span>
                                {agency.vat_registered && <span className="px-2.5 py-1 rounded-full font-semibold bg-white/15">VAT {agency.vat_rate}%</span>}
                            </div>
                        </div>

                        <nav className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-2">
                            {TABS.map((t) => {
                                const on = tab === t.key;
                                return (
                                    <button
                                        type="button"
                                        key={t.key}
                                        onClick={() => setTab(t.key)}
                                        className={'w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl transition ' + (on ? 'bg-brand-50' : 'hover:bg-ink-50')}
                                    >
                                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${on ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-500'}`}>
                                            <Icon name={t.icon} className="w-4 h-4" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className={`block text-[13.5px] font-semibold ${on ? 'text-brand-800' : 'text-ink-800'}`}>{t.label}</span>
                                            <span className="block text-[11.5px] text-ink-500 truncate">{t.hint}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                    <div className="lg:col-span-8 space-y-4">
                        {tab === 'appearance' && <AppearanceSettings />}
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
                                            className="block w-full text-[13px] file:mr-3 file:py-1.5 file:px-3.5 file:rounded-full file:border-0 file:text-[12px] file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
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
                                title="Trust Account (Section 54)"
                                subtitle="Separate account for client money: rent, deposits and payouts"
                                statusBadge={TRUST_BADGE[agency.trust_status]}
                            >
                                {agency.trust_status === 'none' ? (
                                    <p className="text-[13px] text-ink-600">No trust account captured yet. Add it on the Trust Account page so the platform can verify it.</p>
                                ) : (
                                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                                        <div><dt className="text-[11.5px] text-ink-500">Bank</dt><dd className="font-semibold">{agency.trust_bank}</dd></div>
                                        <div><dt className="text-[11.5px] text-ink-500">Account</dt><dd className="font-semibold font-mono">•••• {agency.trust_account_number?.slice(-4)}</dd></div>
                                        <div><dt className="text-[11.5px] text-ink-500">Branch code</dt><dd className="font-semibold font-mono">{agency.trust_branch_code}</dd></div>
                                    </dl>
                                )}
                                <Link href="/agency/trust-account" className={`${btnOutline} inline-flex`}>
                                    {agency.trust_status === 'none' ? 'Capture trust account' : 'View or change trust account'}
                                </Link>
                                <p className="text-[11.5px] text-ink-500">Bank detail changes are made there and go back to the platform for re-verification.</p>
                            </Panel>
                        )}

                        {tab === 'payouts' && (
                            <Panel
                                title="Payouts"
                                subtitle="Choose how your agents’ commission is paid"
                                statusBadge={data.payout_method === 'bank_h2h'
                                    ? { label: `${agency.bank_link?.bank_name ?? 'BANK'} DIRECT`, tone: 'success' }
                                    : data.payout_method === 'investec'
                                    ? { label: 'INVESTEC', tone: 'success' }
                                    : data.payout_method === 'trust_account'
                                    ? { label: 'TRUST ACCOUNT · EFT', tone: 'success' }
                                    : agency.paystack_stub ? { label: 'PAYSTACK · TEST MODE', tone: 'warning' } : { label: 'PAYSTACK', tone: 'success' }}
                            >
                                <div role="radiogroup" aria-label="Payout method" className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <MethodCard
                                        selected={data.payout_method === 'paystack'}
                                        onSelect={() => setData('payout_method', 'paystack')}
                                        title="Paystack"
                                        tag={agency.paystack_stub ? 'Test mode' : 'Automatic'}
                                        description="Agents are paid by Paystack transfer. They need a Paystack payout account."
                                    />
                                    <MethodCard
                                        selected={data.payout_method === 'trust_account'}
                                        onSelect={() => setData('payout_method', 'trust_account')}
                                        disabled={agency.trust_status !== 'verified'}
                                        title="Trust account (EFT)"
                                        tag={agency.trust_status === 'verified' ? `${agency.trust_bank ?? 'Bank'} •••• ${agency.trust_account_number?.slice(-4) ?? ''}` : agency.trust_status === 'review' ? 'Awaiting verification' : 'Not linked'}
                                        description="We prepare the bank payment file; you pay it in your banking, then mark the batch paid."
                                    />
                                    <MethodCard
                                        selected={data.payout_method === 'investec'}
                                        onSelect={() => setData('payout_method', 'investec')}
                                        disabled={!agency.investec || !!agency.investec.problem}
                                        title="Investec (direct)"
                                        tag={agency.investec ? `Linked ${agency.investec.account}${agency.investec.environment === 'sandbox' ? ' · sandbox' : ''}` : 'Not linked'}
                                        description="One click: Investec pays your agents straight from your trust account."
                                    />
                                    <MethodCard
                                        selected={data.payout_method === 'bank_h2h'}
                                        onSelect={() => setData('payout_method', 'bank_h2h')}
                                        disabled={!agency.bank_link || !!agency.bank_link.problem}
                                        title={`${agency.bank_link?.bank_name ?? 'FNB'} direct (host-to-host)`}
                                        tag={agency.bank_link ? (agency.bank_link.problem ? STAGE_LABEL[agency.bank_link.status] : 'Ready') : 'Needs a bank agreement'}
                                        description="One click sends the payout to your bank; your approvers release it in online banking."
                                    />
                                </div>
                                {agency.trust_status !== 'verified' && (
                                    <p className="text-[12px] text-ink-600 bg-ink-50 rounded-lg px-3.5 py-2.5">
                                        {agency.trust_status === 'review'
                                            ? 'Your trust account is waiting for platform verification. You can pay from it once it’s verified.'
                                            : 'To pay from your trust account, capture it first. The platform verifies it before you can use it for payouts.'}{' '}
                                        <Link href="/agency/trust-account" className="font-semibold text-brand-700 hover:underline">Trust account →</Link>
                                    </p>
                                )}
                                {errors.payout_method && <p className="text-[12px] text-danger">{errors.payout_method}</p>}
                                <InvestecLink investec={agency.investec} trustStatus={agency.trust_status} trustAccount={agency.trust_account_number} />
                                <BankLinkPanel link={agency.bank_link} agencyEmail={agency.email} />
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
                                className={`${btnOutline} disabled:opacity-40`}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!isDirty || processing}
                                className={btnPrimary}
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
        <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 pb-rise space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
                    <p className="text-[12px] text-ink-500 mt-0.5">{subtitle}</p>
                </div>
                {statusBadge && (
                    <span className={'text-[10px] px-2 py-1 rounded-full font-bold ' + badgeCls}>{statusBadge.label}</span>
                )}
            </div>
            {children}
        </div>
    );
}

function Row({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">{label}</label>
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
                    'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition ' +
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
                'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 transition ' +
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
                    (on ? 'bg-brand-600' : 'bg-ink-200')
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

function MethodCard({ selected, onSelect, disabled, title, tag, description }: {
    selected: boolean; onSelect: () => void; disabled?: boolean; title: string; tag: string; description: string;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={onSelect}
            className={'text-left rounded-xl border p-4 transition ' + (selected
                ? 'border-brand-500 ring-4 ring-brand-100 bg-brand-50/50'
                : disabled ? 'border-ink-200 opacity-55 cursor-not-allowed' : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50')}
        >
            <span className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selected ? 'border-brand-600' : 'border-ink-300'}`}>
                    {selected && <span className="w-2 h-2 rounded-full bg-brand-600" />}
                </span>
                <span className="text-[14px] font-semibold">{title}</span>
            </span>
            <span className="block text-[11px] font-semibold text-ink-500 mt-1.5 ml-6">{tag}</span>
            <span className="block text-[12px] text-ink-600 mt-2 leading-relaxed">{description}</span>
        </button>
    );
}

/** Link the agency's Investec trust account (Private Bank API keys). Not a <form>: it sits inside the settings form. */
function InvestecLink({ investec, trustStatus, trustAccount }: { investec: Investec | null; trustStatus: 'none' | 'review' | 'verified'; trustAccount: string | null }) {
    const [open, setOpen] = useState(false);
    const [keys, setKeys] = useState({ environment: 'production', client_id: '', client_secret: '', api_key: '' });
    const [busy, setBusy] = useState(false);
    const [check, setCheck] = useState<{ loading: boolean; error?: string; agents?: { agent_id: number; agent: string; account: string | null; beneficiary: string | null }[] }>({ loading: false });
    const field = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13px] font-mono focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100';

    function connect() {
        setBusy(true);
        router.post('/agency/payouts/investec', keys, {
            preserveScroll: true,
            onFinish: () => setBusy(false),
            onSuccess: (page) => { if (!(page.props as { flash?: { error?: string } }).flash?.error) { setOpen(false); setKeys({ ...keys, client_id: '', client_secret: '', api_key: '' }); } },
        });
    }
    function disconnect() {
        if (!confirm('Disconnect Investec? Your API keys are removed and payouts go back to the EFT file.')) return;
        router.delete('/agency/payouts/investec', { preserveScroll: true });
    }
    async function checkAgents() {
        setCheck({ loading: true });
        try {
            const res = await fetch('/agency/payouts/investec/agents', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin' });
            const json = await res.json();
            setCheck(res.ok ? { loading: false, agents: json.agents } : { loading: false, error: json.error ?? 'Couldn’t check with Investec.' });
        } catch {
            setCheck({ loading: false, error: 'Couldn’t reach the server.' });
        }
    }

    return (
        <div className="rounded-xl border border-ink-200 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="text-[13.5px] font-semibold">Investec bank link</p>
                    <p className="text-[12px] text-ink-500">For agencies whose trust account is at Investec (Private Bank API).</p>
                </div>
                {investec && <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${investec.problem ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>{investec.problem ? 'NEEDS ATTENTION' : 'LINKED'}{investec.environment === 'sandbox' ? ' · SANDBOX' : ''}</span>}
            </div>

            {investec ? (
                <>
                    <p className="text-[12.5px] text-ink-700"><span className="font-semibold">{investec.account_name ?? 'Trust account'}</span> {investec.account}{investec.connected_at ? ` · linked ${investec.connected_at}` : ''}</p>
                    {investec.problem && <p className="text-[12px] text-warning">{investec.problem}</p>}
                    {investec.last_error && !investec.problem && <p className="text-[12px] text-danger">Last Investec error: {investec.last_error}</p>}
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={checkAgents} disabled={check.loading} className={btnOutline}>{check.loading ? 'Checking…' : 'Check which agents can be paid'}</button>
                        <button type="button" onClick={() => setOpen(!open)} className={btnOutline}>Replace API keys</button>
                        <button type="button" onClick={disconnect} className="px-3.5 py-2 text-[12.5px] font-semibold text-danger hover:bg-danger/10 rounded-full">Disconnect</button>
                    </div>
                    {check.error && <p className="text-[12px] text-danger">{check.error}</p>}
                    {check.agents && (
                        <ul className="divide-y divide-ink-100 border border-ink-100 rounded-lg text-[12.5px]">
                            {check.agents.length === 0 && <li className="px-3 py-2 text-ink-500">No agents in your agency yet.</li>}
                            {check.agents.map((a) => (
                                <li key={a.agent_id} className="px-3 py-2 flex flex-wrap justify-between gap-2">
                                    <span className="font-semibold">{a.agent} <span className="font-mono font-normal text-ink-500">{a.account ?? 'no bank account on profile'}</span></span>
                                    {a.beneficiary
                                        ? <span className="text-success font-semibold">✓ Investec beneficiary: {a.beneficiary}</span>
                                        : <span className="text-warning font-semibold">Add as a beneficiary in Investec Online</span>}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            ) : trustStatus === 'none' ? (
                <p className="text-[12.5px] text-ink-600">Capture your trust account first, then link it here.</p>
            ) : (
                !open && <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>Link Investec trust account</button>
            )}

            {open && (
                <div className="space-y-3 pt-1">
                    <ol className="list-decimal ml-5 text-[12px] text-ink-600 space-y-1">
                        <li>In Investec Online, go to <b>Programmable Banking → API keys</b> and create a key with <b>Accounts</b> and <b>Beneficiary payments</b> permission.</li>
                        <li>Save each agent as a beneficiary, using the same account number as on their profile, and pay each one once from Investec Online.</li>
                        <li>Paste the client ID, secret and API key below. We only use them to pay commission you approve, and you can disconnect any time.</li>
                    </ol>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block text-[12px] font-semibold text-ink-700">Client ID
                            <input value={keys.client_id} onChange={(e) => setKeys({ ...keys, client_id: e.target.value })} autoComplete="off" className={`${field} mt-1`} />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Client secret
                            <input type="password" value={keys.client_secret} onChange={(e) => setKeys({ ...keys, client_secret: e.target.value })} autoComplete="new-password" className={`${field} mt-1`} />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700 sm:col-span-2">API key
                            <input type="password" value={keys.api_key} onChange={(e) => setKeys({ ...keys, api_key: e.target.value })} autoComplete="new-password" className={`${field} mt-1`} />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Environment
                            <select value={keys.environment} onChange={(e) => setKeys({ ...keys, environment: e.target.value })} className={`${field} mt-1 font-sans`}>
                                <option value="production">Live (real payments)</option>
                                <option value="sandbox">Sandbox (Investec test data)</option>
                            </select>
                        </label>
                    </div>
                    <p className="text-[11.5px] text-ink-500">We check the keys with Investec and link the account matching your trust account{trustAccount ? ` (•••• ${trustAccount.slice(-4)})` : ''}.</p>
                    <div className="flex gap-2">
                        <button type="button" onClick={connect} disabled={busy || !keys.client_id || !keys.client_secret || !keys.api_key} className={btnPrimary}>{busy ? 'Checking with Investec…' : 'Link account'}</button>
                        <button type="button" onClick={() => setOpen(false)} className={btnOutline}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}

const STAGES = ['requested', 'agreement', 'credentials', 'testing', 'live'] as const;
const STAGE_LABEL: Record<BankLinkInfo['status'], string> = {
    requested: 'Request received',
    agreement: 'Bank agreement',
    credentials: 'Connection set-up',
    testing: 'Testing with the bank',
    live: 'Live',
    paused: 'Paused',
};
const STAGE_NEXT: Record<BankLinkInfo['status'], string> = {
    requested: 'Ask your FNB relationship banker for a host-to-host (H2H) agreement on your trust account, naming Property Basket as your technical provider. We’ll be in touch to help.',
    agreement: 'FNB is preparing the agreement. Once signed, FNB issues the connection details (SFTP) and its file specification.',
    credentials: 'We’re setting up the secure connection with FNB’s details.',
    testing: 'We’re exchanging test files with FNB. Payouts sent now go to FNB’s test environment.',
    live: 'Choose this payout method and save. Payouts go straight to FNB for your approvers to release.',
    paused: 'The link is paused. Contact support to resume it.',
};

/** Direct bank link (host-to-host): request it, then follow the onboarding stages. Not a <form>: it sits inside the settings form. */
function BankLinkPanel({ link, agencyEmail }: { link: BankLinkInfo | null; agencyEmail: string | null }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [f, setF] = useState({ bank: 'fnb', contact_name: '', contact_email: agencyEmail ?? '', contact_phone: '', banker_name: '', banker_email: '', notes: '' });
    const field = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 mt-1';

    function submit() {
        setBusy(true);
        router.post('/agency/payouts/bank-link', f, { preserveScroll: true, onFinish: () => setBusy(false), onSuccess: () => setOpen(false) });
    }
    function withdraw() {
        if (!confirm('Withdraw your bank link request?')) return;
        router.delete('/agency/payouts/bank-link', { preserveScroll: true });
    }

    const at = link ? STAGES.indexOf(link.status as (typeof STAGES)[number]) : -1;

    return (
        <div className="rounded-xl border border-ink-200 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="text-[13.5px] font-semibold">Direct bank link (host-to-host)</p>
                    <p className="text-[12px] text-ink-500">For agencies with a corporate agreement with their bank. FNB first; more banks to follow.</p>
                </div>
                {link && <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${link.status === 'live' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>{link.bank_name.toUpperCase()} · {STAGE_LABEL[link.status].toUpperCase()}</span>}
            </div>

            {link ? (
                <>
                    <ol className="flex flex-wrap gap-1.5" aria-label="Onboarding stages">
                        {STAGES.map((st, i) => (
                            <li key={st} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${i < at ? 'bg-success/15 text-success' : i === at ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-500'}`}>
                                {i < at ? '✓ ' : ''}{STAGE_LABEL[st]}
                            </li>
                        ))}
                    </ol>
                    <p className="text-[12.5px] text-ink-700"><span className="font-semibold">Next: </span>{STAGE_NEXT[link.status]}</p>
                    {link.problem && link.status === 'live' && <p className="text-[12px] text-warning">{link.problem}</p>}
                    {link.status !== 'live' && <button type="button" onClick={withdraw} className="text-[12px] font-semibold text-danger hover:underline">Withdraw request</button>}
                </>
            ) : !open ? (
                <div className="space-y-2">
                    <p className="text-[12.5px] text-ink-600">With an FNB host-to-host agreement, “Run payout” sends the payments straight to FNB from your trust account. Your approvers release them in FNB online banking, and each agent is updated automatically as FNB confirms. Setting it up takes a few weeks with FNB and may carry bank fees.</p>
                    <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>Request FNB direct link</button>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block text-[12px] font-semibold text-ink-700">Bank
                            <select value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} className={field}><option value="fnb">FNB</option></select>
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Your contact person
                            <input value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} className={field} />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Contact email
                            <input type="email" value={f.contact_email} onChange={(e) => setF({ ...f, contact_email: e.target.value })} className={field} />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Contact phone
                            <input value={f.contact_phone} onChange={(e) => setF({ ...f, contact_phone: e.target.value })} className={field} />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">FNB relationship banker (if known)
                            <input value={f.banker_name} onChange={(e) => setF({ ...f, banker_name: e.target.value })} className={field} />
                        </label>
                        <label className="block text-[12px] font-semibold text-ink-700">Banker email
                            <input type="email" value={f.banker_email} onChange={(e) => setF({ ...f, banker_email: e.target.value })} className={field} />
                        </label>
                    </div>
                    <label className="block text-[12px] font-semibold text-ink-700">Anything we should know
                        <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} className={field} />
                    </label>
                    <div className="flex gap-2">
                        <button type="button" onClick={submit} disabled={busy || !f.contact_name || !f.contact_email} className={btnPrimary}>{busy ? 'Sending…' : 'Send request'}</button>
                        <button type="button" onClick={() => setOpen(false)} className={btnOutline}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}
