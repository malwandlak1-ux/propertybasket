import { useMemo, useState } from 'react';
import { Head } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';

type TenantRow = {
    lease_id: number;
    tenant_id: number;
    name: string;
    email: string | null;
    phone: string | null;
    initials: string;
    listing_id: number | null;
    listing_title: string;
    listing_addr: string;
    primary_image: string | null;
    monthly_rent: number;
    start_date: string | null;
    end_date: string | null;
    lease_status: string;
    days_to_expiry: number | null;
    agent_id: number | null;
    agent_name: string | null;
    agent_email: string | null;
    agent_initials: string;
};

type Props = {
    agency: { id: number; name: string };
    active: TenantRow[];
    archived: TenantRow[];
    counts: { active: number; archived: number };
};

function fmtMoney(n: number): string {
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

const STATUS_BADGE: Record<string, string> = {
    active:     'bg-success text-white',
    pending:    'bg-warning text-white',
    expired:    'bg-ink-400 text-white',
    terminated: 'bg-ink-700 text-white',
};

function expiryHint(row: TenantRow): { label: string; tone: 'success' | 'warn' | 'danger' | 'muted' } | null {
    if (row.days_to_expiry === null) return null;
    const d = row.days_to_expiry;
    if (d < 0)  return { label: `${Math.abs(d)} days ago`, tone: 'muted' };
    if (d === 0) return { label: 'expires today', tone: 'danger' };
    if (d <= 30) return { label: `${d} days left`, tone: 'warn' };
    return { label: `${d} days left`, tone: 'success' };
}

function TenantCard({ row, archived }: { row: TenantRow; archived: boolean }) {
    const hint = expiryHint(row);
    return (
        <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden hover:shadow-lift transition">
            <div className="aspect-[16/9] bg-ink-100 relative">
                {row.primary_image ? (
                    <img src={row.primary_image} alt={row.listing_title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-ink-400">
                        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <path d="M3 21V10l9-7 9 7v11H3z M9 21v-7h6v7" />
                        </svg>
                    </div>
                )}
                <div className="absolute top-3 left-3">
                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase ${STATUS_BADGE[row.lease_status] ?? 'bg-ink-300 text-ink-700'}`}>
                        {row.lease_status}
                    </span>
                </div>
                {archived && (
                    <div className="absolute top-3 right-3">
                        <span className="text-[10px] bg-ink-900/80 text-white px-2 py-1 rounded-md font-bold uppercase backdrop-blur">
                            Remarket
                        </span>
                    </div>
                )}
            </div>

            <div className="p-4">
                <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-[13px] shrink-0">
                        {row.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold truncate">{row.name}</p>
                        <p className="text-[11px] text-ink-500 truncate">{row.listing_title}</p>
                    </div>
                </div>

                <div className="space-y-1.5 mb-3">
                    {row.email && (
                        <a href={`mailto:${row.email}`} className="flex items-center gap-2 text-[12px] text-ink-700 hover:text-brand-600 truncate">
                            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                            <span className="truncate">{row.email}</span>
                        </a>
                    )}
                    {row.phone && (
                        <a href={`tel:${row.phone}`} className="flex items-center gap-2 text-[12px] text-ink-700 hover:text-brand-600">
                            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1.05.37 2.06.72 3a2 2 0 0 1-.45 2.11L8.09 10.91a16 16 0 0 0 6 6l2.08-2.08a2 2 0 0 1 2.11-.45c.94.35 1.95.59 3 .72A2 2 0 0 1 22 16.92z" />
                            </svg>
                            {row.phone}
                        </a>
                    )}
                    {row.listing_addr && (
                        <p className="flex items-center gap-2 text-[12px] text-ink-500">
                            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span className="truncate">{row.listing_addr}</span>
                        </p>
                    )}
                </div>

                {/* Listing agent */}
                <div className="flex items-center gap-2 pt-3 mb-3 border-t border-ink-100">
                    <div className="w-7 h-7 rounded-full bg-ink-100 text-ink-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {row.agent_initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold leading-tight">Listed by</p>
                        <p className="text-[12px] font-semibold truncate leading-tight">{row.agent_name ?? '—'}</p>
                    </div>
                    {row.agent_email && (
                        <a
                            href={`mailto:${row.agent_email}`}
                            title={`Email ${row.agent_name}`}
                            className="text-ink-400 hover:text-brand-600 p-1"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                        </a>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-ink-100 text-[11px]">
                    <div>
                        <p className="text-ink-400 uppercase tracking-wider font-semibold">Rent</p>
                        <p className="font-bold text-[13px] mt-0.5">{fmtMoney(row.monthly_rent)}/mo</p>
                    </div>
                    <div>
                        <p className="text-ink-400 uppercase tracking-wider font-semibold">Lease ends</p>
                        <p className="font-semibold text-[13px] mt-0.5">{row.end_date}</p>
                        {hint && (
                            <p className={`text-[10px] mt-0.5 font-semibold ${
                                hint.tone === 'success' ? 'text-success' :
                                hint.tone === 'warn'    ? 'text-warning' :
                                hint.tone === 'danger'  ? 'text-danger'  :
                                'text-ink-500'
                            }`}>
                                {hint.label}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AgencyTenants({ agency, active, archived, counts }: Props) {
    const [tab, setTab]     = useState<'active' | 'archived'>('active');
    const [query, setQuery] = useState('');

    const list = useMemo(() => {
        const source = tab === 'active' ? active : archived;
        if (! query.trim()) return source;
        const q = query.trim().toLowerCase();
        return source.filter((r) =>
            r.name.toLowerCase().includes(q)
            || r.email?.toLowerCase().includes(q)
            || r.listing_title.toLowerCase().includes(q)
            || r.listing_addr.toLowerCase().includes(q)
            || (r.agent_name ?? '').toLowerCase().includes(q),
        );
    }, [tab, query, active, archived]);

    return (
        <AgencyLayout crumb="Tenants" agencyName={agency.name}>
            <Head title="Tenants" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6 flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Every tenant across {agency.name}'s portfolio with the listing agent who placed them.
                            Archived tenants can be re-engaged for new listings.
                        </p>
                    </div>
                    <div className="relative">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search tenant, agent, property…"
                            className="bg-white border border-ink-200 rounded-lg pl-9 pr-3.5 py-2 text-[13px] w-72 outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                        />
                        <svg className="w-4 h-4 absolute left-3 top-2.5 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <circle cx="11" cy="11" r="8" />
                            <path d="M21 21l-4.35-4.35" />
                        </svg>
                    </div>
                </div>

                <div className="flex items-center gap-1 mb-6 bg-white border border-ink-200 rounded-lg p-1 w-fit">
                    <button
                        onClick={() => setTab('active')}
                        className={`text-[13px] px-4 py-2 rounded-md font-semibold flex items-center gap-2 transition ${
                            tab === 'active' ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-100'
                        }`}
                    >
                        Active
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'active' ? 'bg-white/20' : 'bg-ink-100 text-ink-700'}`}>
                            {counts.active}
                        </span>
                    </button>
                    <button
                        onClick={() => setTab('archived')}
                        className={`text-[13px] px-4 py-2 rounded-md font-semibold flex items-center gap-2 transition ${
                            tab === 'archived' ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-100'
                        }`}
                    >
                        Archived
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'archived' ? 'bg-white/20' : 'bg-ink-100 text-ink-700'}`}>
                            {counts.archived}
                        </span>
                    </button>
                </div>

                {tab === 'archived' && counts.archived > 0 && (
                    <div className="bg-gradient-to-r from-brand-50 to-brand-100 border border-brand-100 rounded-xl p-4 mb-5 flex items-center gap-3">
                        <svg className="w-5 h-5 text-brand-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <p className="text-[13px] text-ink-700">
                            <strong>Remarketing pool.</strong> These tenants had leases that ended or were terminated — pair them with the listing agent for re-engagement.
                        </p>
                    </div>
                )}

                {list.length === 0 ? (
                    <div className="bg-white rounded-xl border border-ink-200 p-16 text-center shadow-soft">
                        <div className="w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            </svg>
                        </div>
                        <p className="text-[15px] font-semibold text-ink-700 mb-1">
                            {query.trim()
                                ? 'No matching tenants'
                                : tab === 'active' ? 'No active tenants yet' : 'No archived tenants yet'}
                        </p>
                        <p className="text-[13px] text-ink-500">
                            {tab === 'active'
                                ? 'Agents can invite tenants from their Listings page.'
                                : 'Past tenants will appear here once their leases end.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {list.map((row) => (
                            <TenantCard key={row.lease_id} row={row} archived={tab === 'archived'} />
                        ))}
                    </div>
                )}
            </div>
        </AgencyLayout>
    );
}
