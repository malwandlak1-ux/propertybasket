import { useEffect, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';

type Row = {
    permission: string;
    grants: Record<string, boolean>;
};

type Props = {
    roles: string[];
    role_labels: Record<string, string>;
    matrix: Row[];
    core_roles: string[];
    has_overrides: boolean;
};

type FlashProps = { flash?: { success?: string; error?: string } };

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={
                'relative rounded-full transition-colors ' +
                (on ? 'bg-brand-500' : 'bg-ink-300') +
                (disabled ? ' opacity-60 cursor-not-allowed' : ' cursor-pointer')
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

export default function AdminRoles({ roles, role_labels, matrix: initialMatrix, core_roles, has_overrides }: Props) {
    const [matrix, setMatrix] = useState(initialMatrix);
    const [newRoleOpen, setNewRoleOpen] = useState(false);
    const [newRoleLabel, setNewRoleLabel] = useState('');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

    const { props } = usePage<FlashProps>();
    const flash = props.flash ?? {};

    // Re-hydrate matrix whenever a server reload updates props (after Save / Reset / New Role)
    useEffect(() => {
        setMatrix(initialMatrix);
    }, [initialMatrix]);

    useEffect(() => {
        if (flash.success) setToast({ tone: 'success', message: flash.success });
        else if (flash.error) setToast({ tone: 'error', message: flash.error });
    }, [flash.success, flash.error]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    // Dirty detection — has the in-memory matrix diverged from what the server sent?
    const dirty = JSON.stringify(matrix) !== JSON.stringify(initialMatrix);

    function toggle(permIdx: number, role: string) {
        if (role === 'super_admin') return; // always on
        setMatrix((prev) =>
            prev.map((r, i) =>
                i === permIdx
                    ? { ...r, grants: { ...r.grants, [role]: !r.grants[role] } }
                    : r
            )
        );
    }

    function resetLocal() {
        setMatrix(initialMatrix);
    }

    function save() {
        setSaving(true);
        router.post('/admin/roles/save', {
            roles,
            role_labels,
            matrix,
        }, {
            preserveScroll: true,
            onFinish: () => setSaving(false),
        });
    }

    function resetToDefaults() {
        if (!window.confirm('Reset the entire permissions matrix to the system defaults? Any custom roles you added will be removed.')) return;
        router.post('/admin/roles/reset', {}, { preserveScroll: true });
    }

    function createNewRole(e: React.FormEvent) {
        e.preventDefault();
        const label = newRoleLabel.trim();
        if (label.length < 2) return;
        router.post('/admin/roles/new-role', { label }, {
            preserveScroll: true,
            onSuccess: () => {
                setNewRoleLabel('');
                setNewRoleOpen(false);
            },
        });
    }

    function deleteRole(roleKey: string, roleLabel: string) {
        if (!window.confirm(`Remove the "${roleLabel}" role column? This only affects this matrix — no user accounts are deleted.`)) return;
        router.delete(`/admin/roles/${roleKey}`, { preserveScroll: true });
    }

    return (
        <AdminLayout crumb="Roles & Permissions" section="Access">
            <Head title="Roles & Permissions" />

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
                        <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Define what each role can do across the platform
                            {has_overrides && (
                                <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-bold">CUSTOMIZED</span>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={() => setNewRoleOpen(true)}
                        className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg flex items-center gap-2 hover:bg-ink-800 transition"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M12 5v14M5 12h14"/>
                        </svg>
                        New Role
                    </button>
                </div>

                {/* Caveat banner — important: custom roles don't yet grant real app access */}
                <div className="mb-4 px-4 py-2.5 rounded-lg bg-warning/10 border border-warning/30 text-[12px] text-ink-700">
                    <strong className="font-semibold">Heads up:</strong> Toggles persist as policy intent. Custom roles you add here are matrix-only — they don't grant real access in the app yet, because route guards still use the built-in role enum. Use them for documentation and planning until controller checks are migrated.
                </div>

                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                    <div className="overflow-x-auto"><table className="w-full min-w-[700px]">
                        <thead>
                            <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                <th className="font-semibold px-5 py-3">Permission</th>
                                {roles.map((r) => {
                                    const isCore = core_roles.includes(r);
                                    return (
                                        <th key={r} className="font-semibold py-3 text-center px-2">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span>{role_labels[r] ?? r}</span>
                                                {!isCore && (
                                                    <button
                                                        onClick={() => deleteRole(r, role_labels[r] ?? r)}
                                                        className="text-[9px] text-danger hover:underline normal-case"
                                                        title="Remove this custom role column"
                                                    >
                                                        remove
                                                    </button>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="text-[13px]">
                            {matrix.map((row, i) => (
                                <tr key={row.permission} className="border-b border-ink-100 hover:bg-ink-50 transition">
                                    <td className="px-5 py-3 font-medium">{row.permission}</td>
                                    {roles.map((r) => (
                                        <td key={r} className="text-center py-3">
                                            <div className="inline-block">
                                                <Toggle
                                                    on={!!row.grants[r]}
                                                    onClick={() => toggle(i, r)}
                                                    disabled={r === 'super_admin'}
                                                />
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table></div>

                    <div className="flex items-center justify-between gap-2 px-5 py-4 bg-ink-50/50 border-t border-ink-200">
                        <div className="text-[11px] text-ink-500">
                            {dirty && <span className="font-semibold text-warning">Unsaved changes</span>}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={resetToDefaults}
                                className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg bg-white hover:bg-ink-50 transition font-semibold text-danger"
                                title="Restore the entire matrix to its hardcoded defaults"
                            >
                                Reset to defaults
                            </button>
                            <button
                                onClick={resetLocal}
                                disabled={!dirty}
                                className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg bg-white hover:bg-ink-50 transition font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Discard unsaved changes"
                            >
                                Discard
                            </button>
                            <button
                                onClick={save}
                                disabled={!dirty || saving}
                                className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Saving…' : 'Save Permissions'}
                            </button>
                        </div>
                    </div>
                </div>

                <p className="text-[11px] text-ink-400 mt-3">
                    Super Admin permissions cannot be modified — full access is implicit.
                </p>
            </div>

            {/* New Role modal */}
            {newRoleOpen && (
                <div className="fixed inset-0 z-40 bg-ink-900/40 flex items-center justify-center p-4" onClick={() => setNewRoleOpen(false)}>
                    <div className="bg-white rounded-xl shadow-lift w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
                        <h2 className="font-bold text-lg mb-1">New role</h2>
                        <p className="text-[12px] text-ink-500 mb-4">
                            Adds a new column to the permissions matrix. The role key is auto-derived from the label (e.g. "Marketing Manager" → <code className="text-[11px] bg-ink-100 px-1 rounded">marketing_manager</code>).
                        </p>
                        <form onSubmit={createNewRole}>
                            <input
                                autoFocus
                                value={newRoleLabel}
                                onChange={(e) => setNewRoleLabel(e.target.value)}
                                placeholder="e.g. Marketing Manager"
                                className="w-full text-[13px] bg-white border border-ink-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                                maxLength={60}
                            />
                            <div className="flex items-center justify-end gap-2 mt-4">
                                <button
                                    type="button"
                                    onClick={() => { setNewRoleLabel(''); setNewRoleOpen(false); }}
                                    className="px-3 py-1.5 text-[12px] border border-ink-200 rounded-lg bg-white hover:bg-ink-50 transition font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={newRoleLabel.trim().length < 2}
                                    className="px-3 py-1.5 text-[12px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Add role
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
