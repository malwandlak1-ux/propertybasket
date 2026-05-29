import { Head } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';

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
    return `R ${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

function OccupancyBadge({ p }: { p: Property }) {
    if (!p.occupied) {
        return <span className="text-[10px] bg-ink-200 text-ink-600 px-2 py-1 rounded-md font-bold">VACANT</span>;
    }
    if (p.expiry_badge === 'expires_soon') {
        return <span className="text-[10px] bg-danger text-white px-2 py-1 rounded-md font-bold">EXPIRES SOON</span>;
    }
    return <span className="text-[10px] bg-success text-white px-2 py-1 rounded-md font-bold">OCCUPIED</span>;
}

function PayBadge({ status }: { status: Property['pay_status'] }) {
    if (!status) return null;
    const cfg = {
        paid:    { label: 'PAID',    cls: 'bg-success/15 text-success' },
        due:     { label: 'DUE',     cls: 'bg-warning/15 text-warning' },
        overdue: { label: 'OVERDUE', cls: 'bg-danger/15 text-danger' },
    }[status];
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cfg.cls}`}>{cfg.label}</span>;
}

function TypeLabel({ type, nightly }: { type: string; nightly: number }) {
    if (type === 'long_term_rent') return null;
    return (
        <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-1 rounded-md font-bold">
            SHORT STAY · {fmtMoney(nightly)}/night
        </span>
    );
}

export default function LandlordProperties({ landlord, properties, slots_used, slots_max }: Props) {
    const emptySlots = Array.from({ length: Math.max(0, slots_max - slots_used) }, (_, i) => i);
    const occupiedCount = properties.filter((p) => p.occupied).length;

    return (
        <LandlordLayout crumb="Properties" section="My Portfolio">
            <Head title="My Properties" />

            <div className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">My Properties</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Managing {slots_used} of {slots_max} properties ·{' '}
                            {occupiedCount} occupied
                        </p>
                    </div>
                    <a href="/landlord/listings/create" className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14"/></svg>
                        Add Property
                    </a>
                </div>

                {/* Capacity banner */}
                <div className="bg-gradient-to-r from-brand-50 to-violet-50 border border-brand-100 rounded-xl p-4 mb-6 flex items-center gap-4">
                    <div className="flex-1">
                        <p className="text-[13px] font-semibold">{slots_used} of {slots_max} property slots used</p>
                        <div className="mt-2 h-2 bg-white rounded-full overflow-hidden max-w-md">
                            <div className="h-full bg-brand-500 transition-all" style={{ width: `${(slots_used / slots_max) * 100}%` }} />
                        </div>
                    </div>
                    <p className="text-[12px] text-ink-500">
                        Need more than 5?{' '}
                        <span className="text-brand-600 font-semibold cursor-pointer hover:underline">Upgrade to Agency →</span>
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {properties.map((p) => (
                        <div key={p.id} className="bg-white rounded-xl border border-ink-200 overflow-hidden shadow-soft hover:shadow-lift transition">
                            {/* Photo area */}
                            <div className={`aspect-[4/3] relative overflow-hidden ${p.primary_image ? '' : `bg-gradient-to-br ${p.color_class}`}`}>
                                {p.primary_image && (
                                    <img src={p.primary_image} alt={p.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                                )}
                                <OccupancyBadge p={p} />
                                <span className="absolute top-3 right-3 text-[10px] bg-white/90 backdrop-blur px-2 py-1 rounded-md font-bold">
                                    {p.bedrooms}-BED
                                </span>
                                <TypeLabel type={p.listing_type} nightly={p.nightly_price} />
                            </div>

                            <div className="p-4">
                                <p className="text-[15px] font-bold">{p.title.replace(/^Thandi - /, '')}</p>
                                <p className="text-[12px] text-ink-500 mb-3">{p.suburb}, {p.city}</p>

                                {/* Tenant row */}
                                {p.occupied && p.tenant_name ? (
                                    <div className="bg-ink-50 rounded-lg p-3 mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                                {p.tenant_initials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12px] font-semibold truncate">{p.tenant_name}</p>
                                                {p.lease_end && (
                                                    <p className="text-[10px] text-ink-500">Lease to {p.lease_end}</p>
                                                )}
                                            </div>
                                            <PayBadge status={p.pay_status} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-ink-50 rounded-lg p-3 mb-3 text-center text-[12px] text-ink-400">
                                        {p.listing_type === 'long_term_rent' ? 'No active tenant' : 'Short-stay listing'}
                                    </div>
                                )}

                                {/* Rent & yield */}
                                <div className="flex items-center justify-between">
                                    {p.listing_type === 'long_term_rent' && p.monthly_rent > 0 ? (
                                        <span className="text-lg font-bold">
                                            {fmtMoney(p.monthly_rent)}
                                            <span className="text-[11px] text-ink-400 font-normal">/mo</span>
                                        </span>
                                    ) : p.listing_type === 'short_term_stay' && p.nightly_price > 0 ? (
                                        <span className="text-lg font-bold">
                                            {fmtMoney(p.nightly_price)}
                                            <span className="text-[11px] text-ink-400 font-normal">/night</span>
                                        </span>
                                    ) : (
                                        <span className="text-ink-400 text-[13px]">—</span>
                                    )}
                                    {p.yield_pct != null && (
                                        <span className="text-[11px] text-success font-semibold">{p.yield_pct}% yield</span>
                                    )}
                                </div>

                                {/* Expiry warning */}
                                {p.expiry_badge === 'expires_soon' && p.days_to_expiry != null && (
                                    <div className="mt-2 text-[11px] text-danger font-semibold flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
                                        Lease expires in {p.days_to_expiry} days
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Empty slots */}
                    {emptySlots.map((i) => (
                        <button
                            key={i}
                            className="rounded-xl border-2 border-dashed border-ink-200 hover:border-brand-500 hover:text-brand-600 text-ink-400 flex flex-col items-center justify-center py-12 transition"
                        >
                            <svg className="w-8 h-8 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14"/></svg>
                            <span className="text-[13px] font-semibold">Add property</span>
                            <span className="text-[11px]">Slot {slots_used + i + 1} of {slots_max}</span>
                        </button>
                    ))}
                </div>
            </div>
        </LandlordLayout>
    );
}
