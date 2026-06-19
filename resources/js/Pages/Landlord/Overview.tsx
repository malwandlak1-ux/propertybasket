import { useState } from 'react';
import { Head } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';
import LandlordInviteTenantModal, { InvitableListing, PendingInvite } from '@/Components/LandlordInviteTenantModal';

type Property = {
    id: number;
    title: string;
    address: string;
    bedrooms: number;
    status: 'occupied' | 'vacant';
    monthly_rent: number | null;
    tenant_name: string | null;
    tenant_initials: string | null;
    lease_end: string | null;
    pay_status: 'paid' | 'due' | 'overdue' | 'no_lease';
    color_class: string;
    primary_image: string | null;
};

type AttentionItem = {
    type: string;
    label: string;
    detail: string;
    tone: 'danger' | 'warning' | 'info';
};

type Props = {
    landlord: { id: number; name: string };
    kpis: {
        rent_roll: number;
        occupancy_pct: number;
        occupied_count: number;
        total_count: number;
        all_count: number;
        open_maint: number;
        needs_quote: number;
    };
    properties: Property[];
    attention: AttentionItem[];
    this_month: { collected: number; outstanding: number; net: number };
    invitable_listings: InvitableListing[];
    pending_invites: PendingInvite[];
};

function fmt(n: number) {
    if (n >= 1_000_000) return `R ${(n / 1_000_000).toFixed(1)}m`;
    if (n >= 1_000)     return `R ${(n / 1_000).toFixed(0)}k`;
    return `R ${n.toLocaleString('en-ZA')}`;
}
function fmtFull(n: number) {
    return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function PayBadge({ status }: { status: Property['pay_status'] }) {
    const cfg = {
        paid:     { label: 'PAID',    cls: 'bg-success/15 text-success' },
        due:      { label: 'DUE',     cls: 'bg-warning/15 text-warning' },
        overdue:  { label: 'OVERDUE', cls: 'bg-danger/15 text-danger' },
        no_lease: { label: 'VACANT',  cls: 'bg-ink-100 text-ink-500' },
    }[status];
    return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
}

export default function LandlordOverview({ landlord, kpis, properties, attention, this_month, invitable_listings, pending_invites }: Props) {
    const firstName = landlord.name.split(' ')[0];
    const [inviteOpen, setInviteOpen] = useState(false);
    const canInvite = pending_invites.length > 0 || invitable_listings.length > 0;

    return (
        <LandlordLayout crumb="Dashboard" openMaint={kpis.open_maint}>
            <Head title="Landlord Dashboard" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                {/* ── Welcome header ───────────────────────────────────── */}
                <div className="flex flex-wrap items-end justify-between gap-3 mb-7">
                    <div>
                        <p className="text-[13px] text-ink-500">{new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <h1 className="text-3xl font-bold tracking-tight mt-1">Welcome, {firstName} 🏡</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {kpis.all_count} propert{kpis.all_count === 1 ? 'y' : 'ies'} ·{' '}
                            <span className="font-semibold text-success">{kpis.occupancy_pct}% occupied</span>
                            {kpis.rent_roll > 0 && (
                                <> · <span className="font-semibold text-ink-900">{fmtFull(kpis.rent_roll)}</span> rent roll/mo</>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setInviteOpen(true)}
                            disabled={! canInvite}
                            title={canInvite
                                ? (pending_invites.length > 0
                                    ? `${pending_invites.length} tenant${pending_invites.length === 1 ? '' : 's'} pending portal acceptance`
                                    : 'Invite a tenant to one of your rentals')
                                : 'You need an active lease or an available rental to invite a tenant'}
                            className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 disabled:bg-ink-100 disabled:text-ink-400 disabled:cursor-not-allowed transition flex items-center gap-2 relative"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>
                            Invite Tenant
                            {pending_invites.length > 0 && (
                                <span className="text-[10px] font-bold bg-warning text-white px-1.5 py-0.5 rounded-full">
                                    {pending_invites.length}
                                </span>
                            )}
                        </button>
                        <a href="/landlord/listings/create" className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition flex items-center gap-2">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14"/></svg>
                            Add Property
                        </a>
                    </div>
                </div>

                {/* ── KPI Grid ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KpiCard
                        label="Monthly Rent Roll"
                        value={fmtFull(kpis.rent_roll)}
                        sub={`Across ${kpis.total_count} long-term rental${kpis.total_count !== 1 ? 's' : ''}`}
                        iconBg="bg-emerald-50"
                        iconColor="text-success"
                        icon={<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>}
                        sparkColor="#10B981"
                    />
                    <KpiCard
                        label="Occupancy"
                        value={`${kpis.occupancy_pct}%`}
                        sub={`${kpis.occupied_count} of ${kpis.total_count} let`}
                        iconBg="bg-brand-50"
                        iconColor="text-brand-600"
                        icon={<path d="M3 21V10l9-7 9 7v11H3z"/>}
                        sparkColor="#5B3DF5"
                    />
                    <KpiCard
                        label="Open Maintenance"
                        value={String(kpis.open_maint)}
                        sub={kpis.needs_quote > 0 ? `${kpis.needs_quote} needs action` : 'All assigned'}
                        iconBg="bg-amber-50"
                        iconColor="text-warning"
                        icon={<path d="M14 6.5a2 2 0 1 0-4 0M9 12l-7 7 3 3 7-7M14 12l4-4 4 4-4 4z"/>}
                        sparkColor="#F59E0B"
                        subTone={kpis.needs_quote > 0 ? 'warning' : undefined}
                    />
                    <KpiCard
                        label="Collected This Month"
                        value={fmtFull(this_month.collected)}
                        sub={this_month.outstanding > 0 ? `${fmtFull(this_month.outstanding)} outstanding` : 'All rent in'}
                        iconBg="bg-emerald-50"
                        iconColor="text-success"
                        icon={<><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></>}
                        sparkColor="#10B981"
                        subTone={this_month.outstanding > 0 ? 'warning' : undefined}
                    />
                </div>

                {/* ── 2-col layout ─────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* LEFT: Properties at a glance */}
                    <div className="col-span-2 bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-semibold">My Properties</h2>
                                <p className="text-xs text-ink-500 mt-0.5">
                                    {kpis.all_count} of 5 slots used
                                </p>
                            </div>
                            <a href="/landlord/properties" className="text-[12px] font-medium text-brand-600 hover:underline">
                                Manage →
                            </a>
                        </div>

                        <div className="space-y-3">
                            {properties.map((p) => (
                                <div key={p.id} className="flex items-center gap-4 p-3 rounded-lg border border-ink-200 hover:shadow-soft transition">
                                    <div className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 ${p.primary_image ? '' : `bg-gradient-to-br ${p.color_class}`}`}>
                                        {p.primary_image && (
                                            <img src={p.primary_image} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] font-bold truncate">{p.title.replace(/^Thandi - /, '')}</p>
                                        <p className="text-[11px] text-ink-500">
                                            {p.bedrooms}-bed · {p.status === 'occupied' ? `Tenant: ${p.tenant_name}` : 'Vacant'}
                                            {p.lease_end && ` · Lease to ${p.lease_end}`}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        {p.monthly_rent != null ? (
                                            <p className="text-[14px] font-bold">
                                                {fmtFull(p.monthly_rent)}
                                                <span className="text-[11px] text-ink-400 font-normal">/mo</span>
                                            </p>
                                        ) : (
                                            <p className="text-[13px] text-ink-400">—</p>
                                        )}
                                        <PayBadge status={p.pay_status} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: Action items + monthly summary */}
                    <div className="space-y-4">
                        {/* Needs Attention */}
                        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <h2 className="text-base font-semibold mb-3">Needs Attention</h2>
                            {attention.length === 0 ? (
                                <div className="py-4 text-center text-[12px] text-ink-400">
                                    <svg className="w-8 h-8 mx-auto mb-2 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M5 13l4 4L19 7"/></svg>
                                    All clear — nothing needs attention
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {attention.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex items-start gap-3 p-2.5 rounded-lg border ${
                                                item.tone === 'danger'
                                                    ? 'bg-danger/5 border-danger/20'
                                                    : 'bg-warning/5 border-warning/20'
                                            }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.tone === 'danger' ? 'bg-danger/15' : 'bg-warning/15'}`}>
                                                {item.type === 'lease_expiring'
                                                    ? <svg className={`w-4 h-4 ${item.tone === 'danger' ? 'text-danger' : 'text-warning'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>
                                                    : <svg className={`w-4 h-4 ${item.tone === 'danger' ? 'text-danger' : 'text-warning'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 6.5a2 2 0 1 0-4 0M9 12l-7 7 3 3 7-7"/></svg>
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12px] font-semibold">{item.label}</p>
                                                <p className="text-[10px] text-ink-500 truncate">{item.detail}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* This Month summary */}
                        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <h2 className="text-base font-semibold mb-3">This Month</h2>
                            <div className="space-y-2 text-[12px]">
                                <div className="flex justify-between py-1.5 border-b border-ink-100">
                                    <span className="text-ink-500">Rent collected</span>
                                    <span className="font-mono font-semibold text-success">{fmtFull(this_month.collected)}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-ink-100">
                                    <span className="text-ink-500">Rent outstanding</span>
                                    <span className={`font-mono font-semibold ${this_month.outstanding > 0 ? 'text-warning' : 'text-ink-500'}`}>
                                        {this_month.outstanding > 0 ? fmtFull(this_month.outstanding) : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between py-2 font-bold">
                                    <span>Net this month</span>
                                    <span className="font-mono text-success">{fmtFull(this_month.net)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick links */}
                        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
                            <h2 className="text-base font-semibold mb-3">Quick Actions</h2>
                            <div className="space-y-2">
                                {[
                                    { href: '/landlord/tenants', label: 'View all tenants', icon: '👥' },
                                    { href: '/landlord/maintenance', label: 'Maintenance requests', icon: '🔧' },
                                    { href: '/landlord/finance', label: 'Finance & payments', icon: '💰' },
                                    { href: '/landlord/messages', label: 'Messages', icon: '💬' },
                                ].map((link) => (
                                    <a
                                        key={link.href}
                                        href={link.href}
                                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-ink-50 transition text-[12px] font-medium"
                                    >
                                        <span className="text-base">{link.icon}</span>
                                        <span>{link.label}</span>
                                        <svg className="w-3.5 h-3.5 text-ink-400 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6"/></svg>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {inviteOpen && (
                <LandlordInviteTenantModal
                    pendingInvites={pending_invites}
                    invitableListings={invitable_listings}
                    onClose={() => setInviteOpen(false)}
                />
            )}
        </LandlordLayout>
    );
}

function KpiCard({ label, value, sub, iconBg, iconColor, icon, sparkColor, subTone }: {
    label: string; value: string; sub: string;
    iconBg: string; iconColor: string; icon: React.ReactNode;
    sparkColor: string; subTone?: 'warning' | 'danger';
}) {
    return (
        <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">{label}</span>
                <span className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center`}>
                    <svg className={`w-3.5 h-3.5 ${iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        {icon}
                    </svg>
                </span>
            </div>
            <div className="text-3xl font-bold mb-1">{value}</div>
            <p className={`text-[11px] ${subTone === 'warning' ? 'text-warning' : subTone === 'danger' ? 'text-danger' : 'text-ink-500'}`}>{sub}</p>
            <svg viewBox="0 0 100 30" className="w-full h-8 mt-2" preserveAspectRatio="none">
                <path d="M0,22 L25,18 L50,14 L75,10 L100,6" fill="none" stroke={sparkColor} strokeWidth="2"/>
            </svg>
        </div>
    );
}
