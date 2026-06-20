import { FormEvent, useRef, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import ContractorLayout from '@/Layouts/ContractorLayout';
import { Spinner } from '@/Components/Skeleton';

type BankingState = 'verified' | 'pending_review' | 'missing';

type Props = {
    counts?: { requests?: number; active_jobs?: number; messages?: number };
    contractor: {
        id: number;
        name: string;
        business_name: string;
        average_rating: number;
        total_reviews: number;
        total_jobs: number;
    };
    profile: { name: string; email: string; phone: string | null };
    banking: {
        bank_name: string | null;
        bank_account_holder: string | null;
        bank_account_number: string | null;
        bank_branch_code: string | null;
        bank_account_type: 'cheque' | 'current' | 'savings' | null;
        verified_at: string | null;
        paystack_recipient_code: string | null;
        state: BankingState;
    };
    portfolio: {
        bio: string | null;
        business_name: string;
        trading_name: string | null;
        specialities: string[];
        service_areas: string[];
        portfolio_items: Array<{ url: string; path?: string; caption?: string | null; uploaded_at?: string }>;
    };
    options: {
        banks: string[];
        specialities: string[];
    };
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

const TABS = [
    { key: 'login',     label: 'Login details' },
    { key: 'banking',   label: 'Banking & Paystack' },
    { key: 'portfolio', label: 'Portfolio' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const inputCls = 'w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';
const labelCls = 'text-[12px] font-semibold text-ink-700 mb-1.5 block';

const STATE_BANNER: Record<BankingState, { cls: string; title: string; body: string }> = {
    verified: {
        cls:   'bg-success/10 border-success/30 text-success',
        title: 'Banking verified',
        body:  'Property Basket will release contractor payouts to this account via Paystack as soon as invoices are approved.',
    },
    pending_review: {
        cls:   'bg-warning/10 border-warning/30 text-warning',
        title: 'Awaiting platform verification',
        body:  'Your bank details are on file. Property Basket admins typically verify within 2 business days — payouts pause until then.',
    },
    missing: {
        cls:   'bg-danger/10 border-danger/30 text-danger',
        title: 'No banking details on file',
        body:  'Capture your bank account below so the platform can pay you out via Paystack when an invoice is approved.',
    },
};

const SPECIALITY_LABELS: Record<string, string> = {
    plumbing:     'Plumbing',
    electrical:   'Electrical',
    hvac:         'HVAC / aircon',
    painting:     'Painting',
    carpentry:    'Carpentry',
    roofing:      'Roofing',
    tiling:       'Tiling',
    landscaping:  'Landscaping',
    pool:         'Pool maintenance',
    pest_control: 'Pest control',
    locksmith:    'Locksmith',
    glazing:      'Glazing',
    appliances:   'Appliances',
    general:      'General handyman',
};

export default function ContractorSettings({ counts, contractor, profile, banking, portfolio, options }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [tab, setTab] = useState<TabKey>('login');

    return (
        <ContractorLayout crumb="Settings" section="Account" business={contractor.business_name} counts={counts}>
            <Head title="Settings" />

            <section className="px-4 sm:px-4 sm:px-8 py-6 sm:py-7 max-w-5xl">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                    <p className="text-[14px] text-ink-500 mt-1">
                        Manage how you sign in, where the platform pays you, and what agencies see when they browse the contractor marketplace.
                    </p>
                </div>

                {flash?.success && (
                    <div className="mb-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="mb-4 rounded-lg bg-danger/10 border border-danger/30 text-danger px-4 py-3 text-[13px]">
                        {flash.error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

                    <div className="md:col-span-3 space-y-6">
                        {tab === 'login'     && <LoginPanel profile={profile} />}
                        {tab === 'banking'   && <BankingPanel banking={banking} banks={options.banks} contractorName={contractor.name} />}
                        {tab === 'portfolio' && <PortfolioPanel portfolio={portfolio} specialityOptions={options.specialities} />}
                    </div>
                </div>
            </section>
        </ContractorLayout>
    );
}

// ── Login details + password ─────────────────────────────────────────────────

function LoginPanel({ profile }: { profile: Props['profile'] }) {
    return (
        <div className="space-y-6">
            <ProfileForm profile={profile} />
            <PasswordForm />
        </div>
    );
}

function ProfileForm({ profile }: { profile: Props['profile'] }) {
    const { data, setData, patch, processing, errors, isDirty } = useForm({
        name:  profile.name,
        email: profile.email,
        phone: profile.phone ?? '',
    });
    function submit(e: FormEvent) {
        e.preventDefault();
        patch('/contractor/settings/profile', { preserveScroll: true });
    }
    return (
        <form onSubmit={submit} className="bg-white rounded-xl border border-ink-200 shadow-soft p-6 space-y-4">
            <div>
                <h2 className="text-base font-bold">Login details</h2>
                <p className="text-[12px] text-ink-500 mt-0.5">Your email is your sign-in. Agencies and tenants also use these to reach you.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>Full name *</label>
                    <input value={data.name} onChange={(e) => setData('name', e.target.value)} required className={inputCls} />
                    {errors.name && <p className="text-[11px] text-danger mt-1">{errors.name}</p>}
                </div>
                <div>
                    <label className={labelCls}>Email *</label>
                    <input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} required className={inputCls} />
                    {errors.email && <p className="text-[11px] text-danger mt-1">{errors.email}</p>}
                </div>
            </div>

            <div>
                <label className={labelCls}>Phone</label>
                <input value={data.phone} onChange={(e) => setData('phone', e.target.value)} placeholder="+27 82 555 1234" className={inputCls} />
                {errors.phone && <p className="text-[11px] text-danger mt-1">{errors.phone}</p>}
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={! isDirty || processing}
                    className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 disabled:opacity-40 inline-flex items-center gap-2 font-semibold"
                >
                    {processing && <Spinner size={13} />}
                    {processing ? 'Saving…' : 'Save login details'}
                </button>
            </div>
        </form>
    );
}

function PasswordForm() {
    const { data, setData, patch, processing, errors, reset } = useForm({
        current_password:      '',
        password:              '',
        password_confirmation: '',
    });
    function submit(e: FormEvent) {
        e.preventDefault();
        patch('/contractor/settings/password', {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    }
    return (
        <form onSubmit={submit} className="bg-white rounded-xl border border-ink-200 shadow-soft p-6 space-y-4">
            <div>
                <h2 className="text-base font-bold">Change password</h2>
                <p className="text-[12px] text-ink-500 mt-0.5">Use at least 8 characters. You'll stay signed in on this device.</p>
            </div>

            <div>
                <label className={labelCls}>Current password *</label>
                <input type="password" value={data.current_password} onChange={(e) => setData('current_password', e.target.value)} required className={inputCls} />
                {errors.current_password && <p className="text-[11px] text-danger mt-1">{errors.current_password}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>New password *</label>
                    <input type="password" value={data.password} onChange={(e) => setData('password', e.target.value)} required minLength={8} className={inputCls} />
                    {errors.password && <p className="text-[11px] text-danger mt-1">{errors.password}</p>}
                </div>
                <div>
                    <label className={labelCls}>Confirm new password *</label>
                    <input type="password" value={data.password_confirmation} onChange={(e) => setData('password_confirmation', e.target.value)} required minLength={8} className={inputCls} />
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={processing || ! data.current_password || ! data.password || data.password !== data.password_confirmation}
                    className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 disabled:opacity-40 inline-flex items-center gap-2 font-semibold"
                >
                    {processing && <Spinner size={13} />}
                    {processing ? 'Saving…' : 'Change password'}
                </button>
            </div>
        </form>
    );
}

// ── Banking & Paystack ──────────────────────────────────────────────────────

function BankingPanel({ banking, banks, contractorName }: { banking: Props['banking']; banks: string[]; contractorName: string }) {
    const { data, setData, patch, processing, errors, isDirty } = useForm({
        bank_name:           banking.bank_name ?? '',
        bank_account_holder: banking.bank_account_holder ?? contractorName,
        bank_account_number: banking.bank_account_number ?? '',
        bank_branch_code:    banking.bank_branch_code ?? '',
        bank_account_type:   banking.bank_account_type ?? 'cheque',
    });
    function submit(e: FormEvent) {
        e.preventDefault();
        patch('/contractor/settings/banking', { preserveScroll: true });
    }
    const banner = STATE_BANNER[banking.state];

    return (
        <div className="space-y-4">
            <div className={`border rounded-xl p-4 ${banner.cls}`}>
                <p className="font-bold text-[14px]">{banner.title}</p>
                <p className="text-[13px] mt-1">{banner.body}</p>
                {banking.state === 'verified' && banking.verified_at && (
                    <p className="text-[12px] mt-2 text-ink-600">Verified {banking.verified_at}</p>
                )}
            </div>

            <form onSubmit={submit} className="bg-white rounded-xl border border-ink-200 shadow-soft p-6 space-y-4">
                <div>
                    <h2 className="text-base font-bold">Payout bank account</h2>
                    <p className="text-[12px] text-ink-500 mt-0.5">
                        Property Basket pays you via Paystack when an agency approves your invoice. Cleared funds settle into the account below.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Bank *</label>
                        <select value={data.bank_name} onChange={(e) => setData('bank_name', e.target.value)} required className={inputCls}>
                            <option value="">Select a bank…</option>
                            {banks.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                        {errors.bank_name && <p className="text-[11px] text-danger mt-1">{errors.bank_name}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Account type *</label>
                        <select
                            value={data.bank_account_type}
                            onChange={(e) => setData('bank_account_type', e.target.value as typeof data.bank_account_type)}
                            required
                            className={inputCls}
                        >
                            <option value="cheque">Cheque</option>
                            <option value="current">Current</option>
                            <option value="savings">Savings</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className={labelCls}>Account holder *</label>
                    <input
                        value={data.bank_account_holder}
                        onChange={(e) => setData('bank_account_holder', e.target.value)}
                        required
                        placeholder="Must match the name on the bank account"
                        className={inputCls}
                    />
                    {errors.bank_account_holder && <p className="text-[11px] text-danger mt-1">{errors.bank_account_holder}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Account number *</label>
                        <input
                            value={data.bank_account_number}
                            onChange={(e) => setData('bank_account_number', e.target.value.replace(/\D/g, ''))}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="e.g. 6210 4123 456"
                            required
                            className={inputCls}
                        />
                        {errors.bank_account_number && <p className="text-[11px] text-danger mt-1">{errors.bank_account_number}</p>}
                    </div>
                    <div>
                        <label className={labelCls}>Branch code *</label>
                        <input
                            value={data.bank_branch_code}
                            onChange={(e) => setData('bank_branch_code', e.target.value.replace(/\D/g, ''))}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="e.g. 250655"
                            required
                            className={inputCls}
                        />
                        {errors.bank_branch_code && <p className="text-[11px] text-danger mt-1">{errors.bank_branch_code}</p>}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <p className="text-[11px] text-ink-500">
                        Changing the account number, branch, bank or holder name resets platform verification and the Paystack recipient.
                    </p>
                    <button
                        type="submit"
                        disabled={! isDirty || processing}
                        className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 disabled:opacity-40 inline-flex items-center gap-2 font-semibold shrink-0"
                    >
                        {processing && <Spinner size={13} />}
                        {processing ? 'Saving…' : 'Save banking'}
                    </button>
                </div>
            </form>

            <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-6 space-y-2">
                <h3 className="text-[14px] font-bold">Paystack recipient</h3>
                {banking.paystack_recipient_code ? (
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-success/10 text-success">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" /> Linked
                        </span>
                        <code className="text-[12px] text-ink-600 font-mono">{banking.paystack_recipient_code}</code>
                    </div>
                ) : (
                    <p className="text-[13px] text-ink-500">
                        A Paystack recipient code is generated automatically by the platform once your banking is verified. You don't need to do anything here.
                    </p>
                )}
            </div>

            <div className="bg-ink-50/60 border border-ink-200 rounded-xl p-5 text-[12.5px] text-ink-600 leading-relaxed">
                <p className="font-semibold text-ink-700 mb-1">How payouts work</p>
                When an agency approves your maintenance invoice, Property Basket charges the landlord via Paystack and
                releases your share to this account. The platform retains its fee at source; no manual EFT is required.
            </div>
        </div>
    );
}

// ── Portfolio ───────────────────────────────────────────────────────────────

function PortfolioPanel({ portfolio, specialityOptions }: { portfolio: Props['portfolio']; specialityOptions: string[] }) {
    return (
        <div className="space-y-6">
            <ProfileBlock portfolio={portfolio} specialityOptions={specialityOptions} />
            <PhotosBlock items={portfolio.portfolio_items} />
        </div>
    );
}

function ProfileBlock({ portfolio, specialityOptions }: { portfolio: Props['portfolio']; specialityOptions: string[] }) {
    const { data, setData, patch, processing, errors, isDirty } = useForm({
        bio:            portfolio.bio ?? '',
        business_name:  portfolio.business_name,
        trading_name:   portfolio.trading_name ?? '',
        specialities:   portfolio.specialities ?? [],
        service_areas:  portfolio.service_areas ?? [],
    });
    const [areaInput, setAreaInput] = useState('');

    function toggleSpeciality(key: string) {
        setData('specialities', data.specialities.includes(key)
            ? data.specialities.filter((s) => s !== key)
            : [...data.specialities, key]);
    }

    function addArea() {
        const v = areaInput.trim();
        if (! v) return;
        if (data.service_areas.includes(v)) { setAreaInput(''); return; }
        setData('service_areas', [...data.service_areas, v]);
        setAreaInput('');
    }

    function removeArea(area: string) {
        setData('service_areas', data.service_areas.filter((a) => a !== area));
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        patch('/contractor/settings/portfolio', { preserveScroll: true });
    }

    return (
        <form onSubmit={submit} className="bg-white rounded-xl border border-ink-200 shadow-soft p-6 space-y-5">
            <div>
                <h2 className="text-base font-bold">Public profile</h2>
                <p className="text-[12px] text-ink-500 mt-0.5">
                    This is what agencies see when browsing the contractor marketplace before assigning a job.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>Business name *</label>
                    <input value={data.business_name} onChange={(e) => setData('business_name', e.target.value)} required className={inputCls} />
                    {errors.business_name && <p className="text-[11px] text-danger mt-1">{errors.business_name}</p>}
                </div>
                <div>
                    <label className={labelCls}>Trading name</label>
                    <input value={data.trading_name} onChange={(e) => setData('trading_name', e.target.value)} placeholder="If different from business name" className={inputCls} />
                </div>
            </div>

            <div>
                <label className={labelCls}>About / bio</label>
                <textarea
                    value={data.bio}
                    onChange={(e) => setData('bio', e.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="A short pitch — years of experience, the kind of work you do best, what makes you reliable."
                    className={inputCls}
                />
                <p className="text-[11px] text-ink-400 mt-1">{data.bio.length} / 2000</p>
                {errors.bio && <p className="text-[11px] text-danger">{errors.bio}</p>}
            </div>

            <div>
                <label className={labelCls}>Specialities</label>
                <div className="flex flex-wrap gap-2">
                    {specialityOptions.map((key) => {
                        const active = data.specialities.includes(key);
                        return (
                            <button
                                type="button"
                                key={key}
                                onClick={() => toggleSpeciality(key)}
                                className={
                                    'px-3 py-1.5 rounded-full text-[12px] font-semibold border transition ' +
                                    (active
                                        ? 'bg-brand-600 text-white border-brand-600'
                                        : 'bg-white text-ink-700 border-ink-200 hover:border-ink-300')
                                }
                            >
                                {SPECIALITY_LABELS[key] ?? key}
                            </button>
                        );
                    })}
                </div>
                {errors.specialities && <p className="text-[11px] text-danger mt-1">{errors.specialities}</p>}
            </div>

            <div>
                <label className={labelCls}>Service areas</label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {data.service_areas.map((area) => (
                        <span key={area} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-ink-100 text-ink-700">
                            {area}
                            <button type="button" onClick={() => removeArea(area)} className="text-ink-500 hover:text-danger" aria-label={`Remove ${area}`}>×</button>
                        </span>
                    ))}
                    {data.service_areas.length === 0 && (
                        <p className="text-[12px] text-ink-400">No areas yet — add suburbs or cities you cover.</p>
                    )}
                </div>
                <div className="flex gap-2">
                    <input
                        value={areaInput}
                        onChange={(e) => setAreaInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addArea(); } }}
                        placeholder="e.g. Sandton, Rosebank…"
                        className={inputCls}
                    />
                    <button type="button" onClick={addArea} className="px-3 py-2 text-[13px] bg-ink-100 text-ink-700 rounded-lg hover:bg-ink-200 font-semibold shrink-0">
                        Add
                    </button>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={! isDirty || processing}
                    className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 disabled:opacity-40 inline-flex items-center gap-2 font-semibold"
                >
                    {processing && <Spinner size={13} />}
                    {processing ? 'Saving…' : 'Save portfolio'}
                </button>
            </div>
        </form>
    );
}

function PhotosBlock({ items }: { items: Props['portfolio']['portfolio_items'] }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [caption, setCaption] = useState('');
    const [uploading, setUploading] = useState(false);

    function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (! file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('photo', file);
        if (caption) fd.append('caption', caption);
        router.post('/contractor/settings/portfolio/photos', fd, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => {
                setUploading(false);
                setCaption('');
                if (fileRef.current) fileRef.current.value = '';
            },
        });
    }

    function deletePhoto(index: number) {
        if (! confirm('Remove this photo?')) return;
        router.delete(`/contractor/settings/portfolio/photos/${index}`, { preserveScroll: true });
    }

    return (
        <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-6 space-y-4">
            <div>
                <h2 className="text-base font-bold">Portfolio photos</h2>
                <p className="text-[12px] text-ink-500 mt-0.5">
                    Before-and-afters, completed jobs, certifications. PNG / JPG / WebP, up to 4 MB each.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                    <label className={labelCls}>Caption (optional)</label>
                    <input
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="e.g. Geyser replacement — Sandton, March 2026"
                        className={inputCls}
                    />
                </div>
                <div>
                    <label
                        htmlFor="portfolio-photo-input"
                        className={
                            'inline-flex items-center gap-2 px-4 py-2.5 text-[13px] rounded-lg font-semibold cursor-pointer ' +
                            (uploading ? 'bg-ink-200 text-ink-400 cursor-wait' : 'bg-brand-600 text-white hover:bg-brand-700')
                        }
                    >
                        {uploading ? <><Spinner size={13} />Uploading…</> : <>+ Add photo</>}
                    </label>
                    <input
                        id="portfolio-photo-input"
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={onFileChange}
                        disabled={uploading}
                    />
                </div>
            </div>

            {items.length === 0 ? (
                <div className="border-2 border-dashed border-ink-200 rounded-xl p-8 text-center">
                    <p className="text-[13px] text-ink-500">No photos yet — add your first job photo to stand out on the marketplace.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-3">
                    {items.map((item, idx) => (
                        <div key={idx} className="group relative rounded-lg overflow-hidden border border-ink-200 bg-ink-50">
                            <img src={item.url} alt={item.caption ?? `Portfolio item ${idx + 1}`} className="w-full h-32 object-cover" />
                            {item.caption && (
                                <p className="text-[11px] text-ink-700 px-2 py-1.5 truncate">{item.caption}</p>
                            )}
                            <button
                                type="button"
                                onClick={() => deletePhoto(idx)}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 text-danger opacity-0 group-hover:opacity-100 transition flex items-center justify-center font-bold shadow"
                                aria-label="Delete photo"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
