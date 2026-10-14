import { Head, Link } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';
import { PageHeader, btnPrimary } from '@/Components/Dashboard/Charts';
import Icon from '@/Components/Dashboard/Icon';
import { useEdition } from '@/Hooks/useEdition';

type Property = {
    id: number;
    title: string;
    suburb: string;
    city: string;
    bedrooms: number;
    bathrooms: number;
    area_sqm: number;
    listing_type: string;
    monthly_rent: number;
    nightly_price: number;
    occupied: boolean;
    tenant_name: string | null;
    tenant_initials: string | null;
    lease_end: string | null;
    lease_end_date: string | null;
    pay_status: 'paid' | 'due' | 'overdue' | null;
    expiry_badge: 'expires_soon' | 'expires_3mo' | null;
    days_to_expiry: number | null;
    color_class: string;
    primary_image: string | null;
    yield_pct: number | null;
};

type Props = {
    landlord: { id: number; name: string };
    properties: Property[];
    slots_used: number;
    slots_max: number;
};

function fmtMoney(n: number) {
    return `R ${Math.round(n).toLocaleString('en-ZA')}`;
}

function StatusChip({ p }: { p: Property }) {
    const [label, cls] = !p.occupied
        ? ['Vacant', 'bg-white/90 text-ink-700']
        : p.expiry_badge === 'expires_soon'
            ? ['Expires soon', 'bg-danger text-white']
            : ['Occupied', 'bg-success text-white'];
    return <span className={`absolute top-3 left-3 text-[10.5px] px-2.5 py-1 rounded-full font-semibold shadow-soft ${cls}`}>{label}</span>;
}

function PayChip({ status }: { status: Property['pay_status'] }) {
    if (!status) return null;
    const cfg = {
        paid:    { label: 'Paid',    cls: 'bg-success/15 text-success' },
        due:     { label: 'Due',     cls: 'bg-warning/15 text-amber-700' },
        overdue: { label: 'Overdue', cls: 'bg-danger/15 text-danger' },
    }[status];
    return <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

export default function LandlordProperties({ properties, slots_used, slots_max }: Props) {
    const { agenciesEnabled } = useEdition();
    const slotsLeft = Math.max(0, slots_max - slots_used);
    const emptySlots = slotsLeft > 0 ? [0] : [];
    const occupied = properties.filter((p) => p.occupied).length;
    const rentRoll = properties.filter((p) => p.occupied && p.listing_type === 'long_term_rent').reduce((s, p) => s + (p.monthly_rent || 0), 0);
    const slotPct = Math.min(100, Math.round((slots_used / Math.max(1, slots_max)) * 100));

    return (
        <LandlordLayout crumb="Properties" section="My Portfolio">
            <Head title="My Properties" />

            <section className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="My Properties"
                    subtitle={<>Managing {slots_used} of {slots_max} properties · {occupied} occupied</>}
                    actions={
                        <Link href="/landlord/listings/create" className={btnPrimary}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
                            Add property
                        </Link>
                    }
                />

                {/* Summary tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="pb-swirl rounded-2xl p-5 text-white shadow-lift pb-rise">
                        <p className="text-[13px] font-medium">Monthly rent roll</p>
                        <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{fmtMoney(rentRoll)}</p>
                        <p className="text-[12px] text-white/80 mt-2">From {occupied} occupied propert{occupied === 1 ? 'y' : 'ies'}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">Occupancy</p>
                        <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">
                            {properties.length ? Math.round((occupied / properties.length) * 100) : 0}%
                        </p>
                        <p className="text-[12px] text-ink-500 mt-2">{occupied} of {properties.length} let</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-5 shadow-soft pb-rise">
                        <p className="text-[13px] font-medium text-ink-700">Property slots</p>
                        <p className="text-[34px] font-semibold tracking-tight mt-3 leading-none tabular-nums">{slots_used}<span className="text-[16px] text-ink-400 font-medium"> / {slots_max}</span></p>
                        <div className="h-2 rounded-full bg-ink-100 mt-3 overflow-hidden">
                            <div className="h-full rounded-full bg-brand-600 transition-all duration-700" style={{ width: `${slotPct}%` }} />
                        </div>
                        {agenciesEnabled && slots_used >= slots_max && (
                            <p className="text-[11.5px] text-ink-500 mt-2">Need more? Upgrade to an agency plan.</p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {properties.map((p) => (
                        <div key={p.id} className="bg-white rounded-2xl border border-ink-200/60 overflow-hidden shadow-soft hover:shadow-lift transition pb-rise">
                            <div className={`aspect-[16/9] relative overflow-hidden ${p.primary_image ? '' : 'bg-gradient-to-br from-brand-100 via-brand-50 to-white'}`}>
                                {p.primary_image ? (
                                    <img src={p.primary_image} alt={p.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-brand-300">
                                        <svg className="w-14 h-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 21V10l9-7 9 7v11H3z" /><path d="M9 21v-7h6v7" /></svg>
                                    </div>
                                )}
                                <StatusChip p={p} />
                                {p.bedrooms > 0 && (
                                    <span className="absolute top-3 right-3 text-[10.5px] bg-white/90 px-2.5 py-1 rounded-full font-semibold shadow-soft">{p.bedrooms}-bed</span>
                                )}
                                {p.listing_type === 'short_term_stay' && (
                                    <span className="absolute bottom-3 left-3 text-[10.5px] bg-sky-100 text-sky-800 px-2.5 py-1 rounded-full font-semibold">Short stay · {fmtMoney(p.nightly_price)}/night</span>
                                )}
                            </div>

                            <div className="p-4">
                                <p className="text-[15px] font-semibold tracking-tight">{p.title.replace(/^Thandi - /, '')}</p>
                                <p className="text-[12px] text-ink-500 mt-0.5 flex items-center gap-1"><Icon name="pin" />{[p.suburb, p.city].filter(Boolean).join(', ')}</p>

                                {p.occupied && p.tenant_name ? (
                                    <div className="mt-3 rounded-xl border border-ink-200/70 px-3 py-2.5 flex items-center gap-2.5">
                                        <span className="w-8 h-8 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center text-[10.5px] font-bold shrink-0">{p.tenant_initials}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12.5px] font-semibold truncate">{p.tenant_name}</p>
                                            {p.lease_end && <p className="text-[11px] text-ink-500">Lease to {p.lease_end}</p>}
                                        </div>
                                        <PayChip status={p.pay_status} />
                                    </div>
                                ) : (
                                    <div className="mt-3 rounded-xl border border-dashed border-ink-200 bg-ink-50/50 px-3 py-2.5 text-center text-[12px] text-ink-500">
                                        {p.listing_type === 'long_term_rent' ? 'No active tenant' : 'Short-stay listing'}
                                    </div>
                                )}

                                <div className="mt-3 pt-3 border-t border-ink-100 flex items-center justify-between">
                                    {p.listing_type === 'long_term_rent' && p.monthly_rent > 0 ? (
                                        <span className="text-[18px] font-semibold tabular-nums">{fmtMoney(p.monthly_rent)}<span className="text-[11px] text-ink-400 font-normal">/mo</span></span>
                                    ) : p.listing_type === 'short_term_stay' && p.nightly_price > 0 ? (
                                        <span className="text-[18px] font-semibold tabular-nums">{fmtMoney(p.nightly_price)}<span className="text-[11px] text-ink-400 font-normal">/night</span></span>
                                    ) : (
                                        <span className="text-ink-400 text-[13px]">—</span>
                                    )}
                                    {p.yield_pct != null && <span className="text-[11.5px] text-success font-semibold">{p.yield_pct}% yield</span>}
                                </div>

                                {p.expiry_badge === 'expires_soon' && p.days_to_expiry != null && (
                                    <p className="mt-2 text-[11.5px] text-danger font-semibold flex items-center gap-1.5">
                                        <Icon name="alert" />Lease expires in {p.days_to_expiry} days
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}

                    {emptySlots.map((i) => (
                        <Link
                            key={i}
                            href="/landlord/listings/create"
                            className="rounded-2xl border-2 border-dashed border-ink-200 hover:border-brand-400 hover:bg-brand-50/40 text-ink-400 hover:text-brand-700 flex flex-col items-center justify-center py-12 min-h-[240px] transition"
                        >
                            <span className="w-11 h-11 rounded-full bg-white shadow-soft flex items-center justify-center mb-2">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
                            </span>
                            <span className="text-[13px] font-semibold">Add property</span>
                            <span className="text-[11.5px]">{slotsLeft} of {slots_max} slot{slots_max === 1 ? '' : 's'} free</span>
                        </Link>
                    ))}
                </div>
            </section>
        </LandlordLayout>
    );
}
