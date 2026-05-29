import { useState } from 'react';
import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';

type Row = {
    permission: string;
    grants: Record<string, boolean>;
};

type Props = {
    roles: string[];
    role_labels: Record<string, string>;
    matrix: Row[];
};

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

export default function AdminRoles({ roles, role_labels, matrix: initialMatrix }: Props) {
    const [matrix, setMatrix] = useState(initialMatrix);

    function toggle(permIdx: number, role: string) {
        // Super admin row is always on — disallow toggle
        if (role === 'super_admin') return;

        setMatrix((prev) =>
            prev.map((r, i) =>
                i === permIdx
                    ? { ...r, grants: { ...r.grants, [role]: ! r.grants[role] } }
                    : r
            )
        );
    }

    function reset() {
        setMatrix(initialMatrix);
    }

    return (
        <AdminLayout crumb="Roles & Permissions" section="Access">
            <Head title="Roles & Permissions" />

            <div className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Define what each role can do across the platform
                        </p>
                    </div>
                    <button className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg flex items-center gap-2 hover:bg-ink-800 transition">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M12 5v14M5 12h14"/>
                        </svg>
                        New Role
                    </button>
                </div>

                <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                <th className="font-semibold px-5 py-3">Permission</th>
                                {roles.map((r) => (
                                    <th key={r} className="font-semibold py-3 text-center px-2">
                                        {role_labels[r] ?? r}
                                    </th>
                                ))}
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
                    </table>

                    <div className="flex items-center justify-end gap-2 px-5 py-4 bg-ink-50/50 border-t border-ink-200">
                        <button
                            onClick={reset}
                            className="px-3.5 py-2 text-[13px] border border-ink-200 rounded-lg bg-white hover:bg-ink-50 transition font-semibold"
                        >
                            Reset
                        </button>
                        <button className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition font-semibold">
                            Save Permissions
                        </button>
                    </div>
                </div>

                <p className="text-[11px] text-ink-400 mt-3">
                    Super Admin permissions cannot be modified — full access is implicit.
                </p>
            </div>
        </AdminLayout>
    );
}
