import { useEffect, useRef, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
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
    is_self: boolean;
    is_super_admin: boolean;
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
    pending:   'bg-warning/15 text-warning',
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

type FlashProps = { flash?: { success?: string; error?: string } };

export default function AdminUsers({ users, role_counts, filter, search }: Props) {
    const [query, setQuery] = useState(search ?? '');
    const loading = useInertiaLoading();
    const { props } = usePage<FlashProps>();
    const flash = props.flash ?? {};
    const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);

    useEffect(() => {
        if (flash.success) setToast({ tone: 'success', message: flash.success });
        else if (flash.error) setToast({ tone: 'error', message: flash.error });
    }, [flash.success, flash.error]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

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

            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lift text-[13px] font-semibold ${
                    toast.tone === 'success' ? 'bg-success text-white' : 'bg-danger text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
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
                    'bg-white rounded-xl border border-ink-200 shadow-soft overflow-visible transition-opacity duration-150 ' +
                    (loading ? 'opacity-50 pointer-events-none' : '')
                }>
                    <div className="overflow-x-auto"><table className="w-full min-w-[700px]">
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
                                <tr key={u.id} className={`border-b border-ink-100 hover:bg-ink-50 transition ${u.status === 'suspended' ? 'opacity-70' : ''}`}>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${ROLE_COLORS[u.role] ?? 'from-ink-500 to-ink-700'} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
                                                {u.initials}
                                            </div>
                                            <div>
                                                <p className="font-semibold">
                                                    {u.name}
                                                    {u.is_self && (
                                                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 font-semibold">YOU</span>
                                                    )}
                                                </p>
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
                                        <ActionMenu
                                            user={u}
                                            isOpen={openMenuId === u.id}
                                            onToggle={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                                            onClose={() => setOpenMenuId(null)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table></div>
                </div>

                <p className="text-[11px] text-ink-400 mt-3 text-center">
                    Showing up to 100 users. Use filters above to narrow.
                </p>
            </div>
        </AdminLayout>
    );
}

function ActionMenu({
    user,
    isOpen,
    onToggle,
    onClose,
}: {
    user: UserRow;
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, onClose]);

    function go(action: 'activate' | 'suspend', confirmMsg?: string) {
        if (confirmMsg && !window.confirm(confirmMsg)) return;
        onClose();
        router.post(`/admin/users/${user.id}/${action}`, {}, { preserveScroll: true });
    }

    function destroy() {
        const ok = window.confirm(
            `Delete ${user.name} (${user.email})?\n\n` +
            `This is a soft delete — the account is recoverable from the database, ` +
            `but the user will no longer appear in any list and won't be able to log in.\n\n` +
            `Their related records (agency, listings, leases, inquiries) are preserved.\n\n` +
            `Continue?`
        );
        if (!ok) return;
        onClose();
        router.delete(`/admin/users/${user.id}`, { preserveScroll: true });
    }

    const isPending   = user.status === 'pending' || user.status === 'invited' || user.status === 'inactive';
    const isActive    = user.status === 'active';
    const isSuspended = user.status === 'suspended';

    const canSuspend = !user.is_self && !user.is_super_admin && (isActive || isPending);
    const canActivate = !user.is_self && (isPending || isSuspended);
    const canDelete = !user.is_self && !user.is_super_admin;

    return (
        <div ref={ref} className="relative inline-block">
            <button
                onClick={onToggle}
                className="text-ink-400 hover:text-ink-900 px-2 transition"
                aria-haspopup="menu"
                aria-expanded={isOpen}
            >
                ⋯
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-ink-200 rounded-lg shadow-lift z-20 text-left">
                    <a
                        href={`mailto:${user.email}`}
                        className="block px-3 py-2 text-[12px] text-ink-700 hover:bg-ink-50 transition"
                        onClick={onClose}
                    >
                        Email user
                    </a>

                    {(canActivate || canSuspend) && <div className="border-t border-ink-100 my-1"></div>}

                    {canActivate && (
                        <button
                            onClick={() => go('activate')}
                            className="block w-full text-left px-3 py-2 text-[12px] text-success font-semibold hover:bg-success/10 transition"
                        >
                            {isPending ? 'Activate user' : 'Reactivate user'}
                        </button>
                    )}

                    {canSuspend && (
                        <button
                            onClick={() => go(
                                'suspend',
                                `Suspend ${user.name}? They will not be able to log in.`
                            )}
                            className="block w-full text-left px-3 py-2 text-[12px] text-danger font-semibold hover:bg-danger/10 transition"
                        >
                            Suspend user
                        </button>
                    )}

                    {canDelete && (
                        <>
                            <div className="border-t border-ink-100 my-1"></div>
                            <button
                                onClick={destroy}
                                className="block w-full text-left px-3 py-2 text-[12px] text-danger font-bold hover:bg-danger/10 transition"
                            >
                                Delete user
                            </button>
                        </>
                    )}

                    {user.is_self && (
                        <p className="px-3 py-2 text-[11px] text-ink-400 italic">
                            You can't modify your own account here.
                        </p>
                    )}

                    {user.is_super_admin && !user.is_self && (
                        <p className="px-3 py-2 text-[11px] text-ink-400 italic">
                            Super admins can't be suspended from this panel.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
