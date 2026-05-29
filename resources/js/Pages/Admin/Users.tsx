import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useInertiaLoading } from '@/Hooks/useInertiaLoading';

type UserRow = {
    id: number;
    name: string;
    email: string;
    role: string;
    role_label: string;
    belongs_to: string;
    last_active: string | null;
    status: string;
    initials: string;
    joined: string;
};

type Props = {
    users: UserRow[];
    role_counts: {
        all: number;
        agency_admin: number;
        agent: number;
        landlord: number;
        tenant: number;
        contractor: number;
    };
    filter: string;
    search: string;
};

const ROLE_COLORS: Record<string, string> = {
    super_admin:  'from-ink-900 to-ink-800',
    agency_admin: 'from-brand-500 to-brand-700',
    agent:        'from-violet-500 to-violet-700',
    landlord:     'from-sky-400 to-sky-600',
    tenant:       'from-emerald-400 to-emerald-600',
    contractor:   'from-amber-400 to-amber-600',
};

const STATUS_CFG: Record<string, string> = {
    active:    'bg-success/15 text-success',
    inactive:  'bg-ink-100 text-ink-500',
    invited:   'bg-warning/15 text-warning',
    suspended: 'bg-danger/15 text-danger',
};

const FILTERS = [
    { key: 'all',          label: 'All' },
    { key: 'agency_admin', label: 'Agency Admins' },
    { key: 'agent',        label: 'Agents' },
    { key: 'landlord',     label: 'Landlords' },
    { key: 'tenant',       label: 'Tenants' },
    { key: 'contractor',   label: 'Contractors' },
];

export default function AdminUsers({ users, role_counts, filter, search }: Props) {
    const [query, setQuery] = useState(search ?? '');
    const loading = useInertiaLoading();

    function applyFilter(key: string) {
        router.get('/admin/users', key === 'all' ? { q: query || undefined } : { role: key, q: query || undefined }, {
            preserveState: true,
            preserveScroll: true,
        });
    }

    function applySearch(e: React.FormEvent) {
        e.preventDefault();
        const payload: Record<string, string> = {};
        if (filter && filter !== 'all') payload.role = filter;
        if (query) payload.q = query;
        router.get('/admin/users', payload, { preserveState: true, preserveScroll: true });
    }

    return (
        <AdminLayout crumb="User Management" section="Access">
            <Head title="User Management" />

            <div className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Every user across all dashboards · adjust roles, suspend, impersonate for support
                        </p>
                    </div>
                    <button className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14"/></svg>
                        Create User
                    </button>
                </div>

                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {FILTERS.map((f) => {
                        const active = filter === f.key;
                        const count = role_counts[f.key as keyof typeof role_counts];
                        return (
                            <button
                                key={f.key}
                                onClick={() => applyFilter(f.key)}
                                className={
                                    'text-[12px] px-3 py-1.5 rounded-full font-medium transition ' +
                                    (active
                                        ? 'bg-ink-900 text-white'
                                        : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-100')
                                }
                            >
                                {f.label} · {count.toLocaleString('en-ZA')}
                            </button>
                        );
                    })}
                    <form onSubmit={applySearch} className="ml-auto">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="text-[12px] bg-white border border-ink-200 rounded-md px-3 py-1.5 w-56 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            placeholder="Search by name or email…"
                        />
                    </form>
                </div>

                <div className={
                    'bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden transition-opacity duration-150 ' +
                    (loading ? 'opacity-50 pointer-events-none' : '')
                }>
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                <th className="font-semibold px-5 py-3">User</th>
                                <th className="font-semibold py-3">Role</th>
                                <th className="font-semibold py-3">Belongs to</th>
                                <th className="font-semibold py-3">Last active</th>
                                <th className="font-semibold py-3">Status</th>
                                <th className="font-semibold py-3 text-right pr-5">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-[13px]">
                            {users.length === 0 ? (
                                <tr><td colSpan={6} className="text-center text-[12px] text-ink-400 py-10">No users match this filter</td></tr>
                            ) : users.map((u) => (
                                <tr key={u.id} className="border-b border-ink-100 hover:bg-ink-50 transition">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${ROLE_COLORS[u.role] ?? 'from-ink-500 to-ink-700'} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
                                                {u.initials}
                                            </div>
                                            <div>
                                                <p className="font-semibold">{u.name}</p>
                                                <p className="text-[11px] text-ink-500">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4">
                                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 font-semibold">
                                            {u.role_label}
                                        </span>
                                    </td>
                                    <td className="py-4 text-[12px]">
                                        {u.belongs_to === 'Independent' ? (
                                            <span className="text-ink-400 italic">Independent</span>
                                        ) : (
                                            u.belongs_to
                                        )}
                                    </td>
                                    <td className="py-4 text-[12px] text-ink-500">{u.last_active ?? '—'}</td>
                                    <td className="py-4">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_CFG[u.status] ?? 'bg-ink-100 text-ink-700'}`}>
                                            {u.status}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right pr-5">
                                        <button className="text-ink-400 hover:text-ink-900 px-2 transition">⋯</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p className="text-[11px] text-ink-400 mt-3 text-center">
                    Showing up to 100 users. Use filters above to narrow.
                </p>
            </div>
        </AdminLayout>
    );
}
