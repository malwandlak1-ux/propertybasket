import { Head } from '@inertiajs/react';
import AppLogo from '@/Components/AppLogo';

export default function Welcome() {
    return (
        <>
            <Head title="Welcome" />
            <main className="min-h-screen bg-ink-50 text-ink-900 grid place-items-center p-8">
                <div className="max-w-lg w-full bg-white rounded-2xl shadow-card p-10 text-center">
                    <div className="flex justify-center mb-6">
                        <AppLogo height={44} />
                    </div>
                    <p className="mt-3 text-ink-500">
                        Inertia + React + Tailwind v4 wired. Phase 1 scaffold up.
                    </p>
                </div>
            </main>
        </>
    );
}
