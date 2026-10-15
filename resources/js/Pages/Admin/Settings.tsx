import { useEffect, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import AppearanceSettings from '@/Components/Dashboard/AppearanceSettings';
import { PageHeader, SummaryStrip, btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';
import Icon, { IconName } from '@/Components/Dashboard/Icon';

const TAB_META: Record<string, { hint: string; icon: IconName }> = {
    general:    { hint: 'Name, support email, currency', icon: 'bulb' },
    appearance: { hint: 'Dashboard colour and logo', icon: 'eye' },
    fees:       { hint: 'Platform fee and free trial', icon: 'file' },
    paystack:   { hint: 'Payments and webhooks', icon: 'wallet' },
    cities:     { hint: 'Where the platform operates', icon: 'pin' },
    advanced:   { hint: 'Signups, maintenance, checks', icon: 'wrench' },
};

type Tab = { key: string; label: string };
type Currency = { code: string; label: string };

type SettingsShape = {
    general: {
        platform_name: string;
        support_email: string;
        default_currency: string;
        default_vat_rate: number;
    };
    fees: {
        contractor_platform_fee: number;
        absorb_paystack_fees: boolean;
        free_trial_days: number;
    };
    paystack: {
        live_mode: boolean;
        webhook_url: string;
        public_key_set: boolean;
        secret_key_set: boolean;
    };
    cities: {
        enabled_provinces: string[];
        enabled_cities: string[];
    };
    advanced: {
        maintenance_mode: boolean;
        allow_signups: boolean;
        enforce_eaab_check: boolean;
        enforce_fica_check: boolean;
        tenant_invites_only: boolean;
    };
};

type Props = {
    tabs: Tab[];
    settings: SettingsShape;
    currencies: Currency[];
    has_overrides: boolean;
};

type FlashProps = { flash?: { success?: string; error?: string } };

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                'relative rounded-full transition-colors shrink-0 ' +
                (on ? 'bg-brand-600' : 'bg-ink-200')
            }
            style={{ width: 40, height: 22 }}
            aria-pressed={on}
        >
            <span
                className="absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform"
                style={{ transform: on ? 'translateX(18px)' : 'translateX(0)' }}
            />
        </button>
    );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden pb-rise">
            <div className="p-5 border-b border-ink-200">
                <h2 className="text-base font-semibold">{title}</h2>
            </div>
            <div className="p-5">{children}</div>
        </section>
    );
}

function TextInput({ label, value, onChange, suffix }: { label: string; value: string | number; onChange: (v: string) => void; suffix?: string }) {
    return (
        <div>
            <label className="block text-[12px] font-semibold mb-1.5 text-ink-700">{label}</label>
            <div className="relative">
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 ${suffix ? 'pr-10' : ''}`}
                />
                {suffix && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-500">{suffix}</span>
                )}
            </div>
        </div>
    );
}

function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
    return (
        <div>
            <label className="block text-[12px] font-semibold mb-1.5 text-ink-700">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    );
}

function TagEditor({
    title,
    placeholder,
    chipClass,
    items,
    onChange,
    maxLen,
}: {
    title: string;
    placeholder: string;
    chipClass: string;
    items: string[];
    onChange: (next: string[]) => void;
    maxLen: number;
}) {
    const [draft, setDraft] = useState('');

    function add() {
        const value = draft.trim();
        if (value === '') return;
        // Case-insensitive dedupe so "Cape Town" and "cape town" don't both stick.
        const lower = value.toLowerCase();
        if (items.some((i) => i.toLowerCase() === lower)) {
            setDraft('');
            return;
        }
        onChange([...items, value]);
        setDraft('');
    }

    function remove(i: number) {
        onChange(items.filter((_, idx) => idx !== i));
    }

    function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
        }
    }

    return (
        <div>
            <p className="text-[12px] font-semibold mb-2 text-ink-700">
                {title}
                <span className="ml-2 text-[10px] font-normal text-ink-400">{items.length} total</span>
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
                {items.length === 0 && (
                    <p className="text-[11px] text-ink-400 italic">None added yet.</p>
                )}
                {items.map((it, i) => (
                    <span key={`${it}-${i}`} className={`inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full font-semibold ${chipClass}`}>
                        {it}
                        <button
                            type="button"
                            onClick={() => remove(i)}
                            className="text-ink-500 hover:text-danger transition leading-none"
                            aria-label={`Remove ${it}`}
                            title={`Remove ${it}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKey}
                    placeholder={placeholder}
                    maxLength={maxLen}
                    className="flex-1 bg-white border border-ink-200 rounded-xl px-3.5 py-2 text-[13px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
                />
                <button
                    type="button"
                    onClick={add}
                    disabled={draft.trim() === ''}
                    className={`${btnPrimary} !py-2 !text-[12px] disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                    Add
                </button>
            </div>
            <p className="text-[10px] text-ink-400 mt-1.5">Press Enter or comma to add. Click × to remove.</p>
        </div>
    );
}

function SettingRow({ label, note, on, onToggle }: { label: string; note?: string; on: boolean; onToggle: () => void }) {
    return (
        <div className="flex items-start justify-between gap-4 py-4 border-b border-ink-100 last:border-b-0">
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold">{label}</p>
                {note && <p className="text-[11px] text-ink-500 mt-0.5">{note}</p>}
            </div>
            <Toggle on={on} onClick={onToggle} />
        </div>
    );
}

export default function AdminSettings({ tabs, settings: initial, currencies, has_overrides }: Props) {
    const [activeTab, setActiveTab] = useState('general');
    const [data, setData] = useState<SettingsShape>(initial);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

    const { props } = usePage<FlashProps>();
    const flash = props.flash ?? {};

    // Re-hydrate after server reload (Save flushes the page; this keeps local
    // state in sync with what just got persisted)
    useEffect(() => {
        setData(initial);
    }, [initial]);

    useEffect(() => {
        if (flash.success) setToast({ tone: 'success', message: flash.success });
        else if (flash.error) setToast({ tone: 'error', message: flash.error });
    }, [flash.success, flash.error]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    const dirty = JSON.stringify(data) !== JSON.stringify(initial);

    function patchTab<K extends keyof SettingsShape>(tab: K, patch: Partial<SettingsShape[K]>) {
        setData({ ...data, [tab]: { ...data[tab], ...patch } });
    }

    function cancel() {
        if (!dirty) return;
        if (!window.confirm('Discard unsaved changes?')) return;
        setData(initial);
    }

    function save() {
        // Only send the user-editable subset to keep the payload minimal and
        // server-side validation tight.
        setSaving(true);
        router.patch('/admin/settings', {
            general: data.general,
            fees: data.fees,
            paystack: { live_mode: data.paystack.live_mode },
            cities: {
                enabled_provinces: data.cities.enabled_provinces,
                enabled_cities:    data.cities.enabled_cities,
            },
            advanced: data.advanced,
        } as never, {
            preserveScroll: true,
            onFinish: () => setSaving(false),
        });
    }

    function resetAll() {
        if (!window.confirm('Reset every setting on this page to the platform defaults? This cannot be undone.')) return;
        router.post('/admin/settings/reset', {}, { preserveScroll: true });
    }

    return (
        <AdminLayout crumb="Platform Settings" section="System">
            <Head title="Platform Settings" />

            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lift text-[13px] font-semibold ${
                    toast.tone === 'success' ? 'bg-success text-white' : 'bg-danger text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            <div className="px-4 sm:px-7 py-6">
                <PageHeader title="Platform Settings" subtitle="Global configuration for the application" />

                <SummaryStrip
                    title="Platform Setup"
                    subtitle={data.general.platform_name}
                    action={has_overrides ? <span className="text-[11px] px-2 py-1 rounded-full bg-warning/15 text-amber-700 font-bold">CUSTOMISED</span> : undefined}
                    cells={[
                        { label: 'Paystack', value: data.paystack.live_mode ? 'Live' : 'Test', sub: data.paystack.secret_key_set ? 'Keys configured' : 'No secret key', tone: data.paystack.live_mode ? 'success' : 'warning' },
                        { label: 'Signups', value: data.advanced.allow_signups ? 'Open' : 'Closed', sub: data.advanced.tenant_invites_only ? 'Tenants by invite only' : 'All roles can register', tone: data.advanced.allow_signups ? 'success' : 'muted' },
                        { label: 'Contractor Fee', value: `${data.fees.contractor_platform_fee}%`, sub: `${data.fees.free_trial_days}-day free trial`, tone: 'muted' },
                        { label: 'Maintenance', value: data.advanced.maintenance_mode ? 'On' : 'Off', sub: data.advanced.maintenance_mode ? 'Site is offline to users' : 'Site is live', tone: data.advanced.maintenance_mode ? 'danger' : 'muted' },
                    ]}
                />

                {/* Honest caveat — same as the Roles matrix */}
                <div className="mb-4 px-5 py-3 rounded-2xl bg-warning/10 border border-warning/30 text-[12.5px] text-ink-700">
                    <strong className="font-semibold">Heads up:</strong> Toggles persist as policy intent. Some flags (Paystack live mode, maintenance mode, FFC/FICA enforcement) are also controlled by environment / middleware and may need a code-level switch to fully take effect. Persisted values here drive UI display and informational state.
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Tab nav */}
                    <aside className="lg:col-span-4">
                        <nav className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-2">
                            {tabs.map((t) => {
                                const on = activeTab === t.key;
                                const meta = TAB_META[t.key] ?? { hint: '', icon: 'bulb' as IconName };
                                return (
                                    <button
                                        key={t.key}
                                        onClick={() => setActiveTab(t.key)}
                                        className={'w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl transition ' + (on ? 'bg-brand-50' : 'hover:bg-ink-50')}
                                    >
                                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${on ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-500'}`}>
                                            <Icon name={meta.icon} className="w-4 h-4" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className={`block text-[13.5px] font-semibold ${on ? 'text-brand-800' : 'text-ink-800'}`}>{t.label}</span>
                                            {meta.hint && <span className="block text-[11.5px] text-ink-500 truncate">{meta.hint}</span>}
                                        </span>
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                    {/* Tab content */}
                    <div className="lg:col-span-8 space-y-4">
                        {activeTab === 'general' && (
                            <FieldGroup title="General">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <TextInput
                                        label="Platform name"
                                        value={data.general.platform_name}
                                        onChange={(v) => patchTab('general', { platform_name: v })}
                                    />
                                    <TextInput
                                        label="Support email"
                                        value={data.general.support_email}
                                        onChange={(v) => patchTab('general', { support_email: v })}
                                    />
                                    <SelectInput
                                        label="Default currency"
                                        value={data.general.default_currency}
                                        onChange={(v) => patchTab('general', { default_currency: v })}
                                        options={currencies.map((c) => ({ value: c.code, label: c.label }))}
                                    />
                                    <TextInput
                                        label="Default VAT rate"
                                        value={data.general.default_vat_rate}
                                        onChange={(v) => patchTab('general', { default_vat_rate: Number(v) || 0 })}
                                        suffix="%"
                                    />
                                </div>
                            </FieldGroup>
                        )}

                        {activeTab === 'fees' && (
                            <FieldGroup title="Fees & Commissions">
                                <div className="space-y-1">
                                    <div className="flex items-start justify-between gap-4 py-3 border-b border-ink-100">
                                        <div className="flex-1">
                                            <p className="text-[13px] font-semibold">Contractor platform fee</p>
                                            <p className="text-[11px] text-ink-500 mt-0.5">Charged per completed job invoice</p>
                                        </div>
                                        <div className="w-32">
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={data.fees.contractor_platform_fee}
                                                    onChange={(e) => patchTab('fees', { contractor_platform_fee: Number(e.target.value) || 0 })}
                                                    className="w-full bg-white border border-ink-200 rounded-xl pl-3 pr-8 py-2 text-[13px] text-right focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-500">%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <SettingRow
                                        label="Absorb Paystack fees"
                                        note="Platform covers transaction fees (vs passing to user)"
                                        on={data.fees.absorb_paystack_fees}
                                        onToggle={() => patchTab('fees', { absorb_paystack_fees: !data.fees.absorb_paystack_fees })}
                                    />
                                    <div className="flex items-start justify-between gap-4 py-3">
                                        <div className="flex-1">
                                            <p className="text-[13px] font-semibold">Free trial period</p>
                                            <p className="text-[11px] text-ink-500 mt-0.5">Days before first subscription charge</p>
                                        </div>
                                        <div className="w-32">
                                            <input
                                                type="number"
                                                value={data.fees.free_trial_days}
                                                onChange={(e) => patchTab('fees', { free_trial_days: Number(e.target.value) || 0 })}
                                                className="w-full bg-white border border-ink-200 rounded-xl px-3 py-2 text-[13px] text-right focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </FieldGroup>
                        )}

                        {activeTab === 'appearance' && <AppearanceSettings />}

                        {activeTab === 'paystack' && (
                            <FieldGroup title="Paystack / Integrations">
                                <div className="space-y-1">
                                    <SettingRow
                                        label="Live mode"
                                        note={data.paystack.live_mode ? 'Charges are real' : 'Currently in test mode'}
                                        on={data.paystack.live_mode}
                                        onToggle={() => patchTab('paystack', { live_mode: !data.paystack.live_mode })}
                                    />
                                    <div className="py-4 border-b border-ink-100">
                                        <p className="text-[13px] font-semibold mb-1.5">Webhook URL</p>
                                        <code className="block bg-ink-50 border border-ink-200 rounded-xl px-3.5 py-2.5 text-[12px] font-mono break-all">
                                            {data.paystack.webhook_url}
                                        </code>
                                    </div>
                                    <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between bg-ink-50 rounded-xl px-3.5 py-2.5">
                                            <span className="text-[12px] font-semibold">Public key</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${data.paystack.public_key_set ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                                                {data.paystack.public_key_set ? 'SET' : 'MISSING'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between bg-ink-50 rounded-xl px-3.5 py-2.5">
                                            <span className="text-[12px] font-semibold">Secret key</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${data.paystack.secret_key_set ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                                                {data.paystack.secret_key_set ? 'SET' : 'MISSING'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </FieldGroup>
                        )}

                        {activeTab === 'cities' && (
                            <FieldGroup title="Cities & Areas">
                                <p className="text-[12px] text-ink-500 mb-5">
                                    Provinces and cities where the platform is currently active. These appear in dropdowns when agencies and landlords register or list properties.
                                </p>
                                <div className="space-y-6">
                                    <TagEditor
                                        title="Enabled provinces"
                                        placeholder="e.g. Eastern Cape"
                                        chipClass="bg-brand-50 text-brand-700"
                                        items={data.cities.enabled_provinces}
                                        onChange={(items) => patchTab('cities', { enabled_provinces: items })}
                                        maxLen={60}
                                    />
                                    <TagEditor
                                        title="Enabled cities"
                                        placeholder="e.g. Polokwane"
                                        chipClass="bg-ink-100 text-ink-700"
                                        items={data.cities.enabled_cities}
                                        onChange={(items) => patchTab('cities', { enabled_cities: items })}
                                        maxLen={60}
                                    />
                                </div>
                            </FieldGroup>
                        )}

                        {activeTab === 'advanced' && (
                            <FieldGroup title="Advanced">
                                <SettingRow
                                    label="Maintenance mode"
                                    note="Show a maintenance page to all non-admin users"
                                    on={data.advanced.maintenance_mode}
                                    onToggle={() => patchTab('advanced', { maintenance_mode: !data.advanced.maintenance_mode })}
                                />
                                <SettingRow
                                    label="Allow new signups"
                                    on={data.advanced.allow_signups}
                                    onToggle={() => patchTab('advanced', { allow_signups: !data.advanced.allow_signups })}
                                />
                                <SettingRow
                                    label="Enforce EAAB FFC verification"
                                    note="Agency admins must upload a valid FFC before going live"
                                    on={data.advanced.enforce_eaab_check}
                                    onToggle={() => patchTab('advanced', { enforce_eaab_check: !data.advanced.enforce_eaab_check })}
                                />
                                <SettingRow
                                    label="Enforce landlord FICA"
                                    on={data.advanced.enforce_fica_check}
                                    onToggle={() => patchTab('advanced', { enforce_fica_check: !data.advanced.enforce_fica_check })}
                                />
                                <SettingRow
                                    label="Tenant accounts by invite only"
                                    on={data.advanced.tenant_invites_only}
                                    onToggle={() => patchTab('advanced', { tenant_invites_only: !data.advanced.tenant_invites_only })}
                                />
                            </FieldGroup>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
                    <div className="text-[11px] text-ink-500">
                        {dirty && <span className="font-semibold text-warning">Unsaved changes</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        {has_overrides && (
                            <button
                                onClick={resetAll}
                                className="inline-flex items-center rounded-full border border-danger/40 bg-white px-4 py-2.5 text-[13px] font-semibold text-danger hover:bg-danger/5 transition"
                                title="Restore every setting to the hardcoded defaults"
                            >
                                Reset to defaults
                            </button>
                        )}
                        <button
                            onClick={cancel}
                            disabled={!dirty}
                            className={`${btnOutline} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={save}
                            disabled={!dirty || saving}
                            className={`${btnPrimary} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                            {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
