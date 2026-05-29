import { Head, router } from '@inertiajs/react';

type Props = {
    role: string;
    role_label: string;
};

export default function Placeholder({ role, role_label }: Props) {
    return (
        <>
            <Head title="Dashboard" />
            <main className="min-h-screen bg-ink-50 text-ink-900 p-12">
                <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-card p-10">
                    <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700">
                        {role_label}
                    </span>
                    <h1 className="mt-4 text-3xl font-bold tracking-tight">Phase 1 complete.</h1>
                    <p className="mt-3 text-ink-500 text-[15px]">
                        Signed in as a <code className="text-ink-900">{role}</code>. The {role_label} dashboard
                        is built in a later phase per the build guide.
                    </p>
                    <button
                        type="button"
                        onClick={() => router.post('/logout')}
                        className="mt-8 inline-flex items-center rounded-lg bg-ink-900 px-4 py-2 text-[14px] font-semibold text-white hover:bg-ink-800 transition"
                    >
                        Sign out
                    </button>
                </div>
            </main>
        </>
    );
}
