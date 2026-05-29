import { ReactNode } from 'react';
import AppLogo from '@/Components/AppLogo';

type AuthLayoutProps = {
    children: ReactNode;
    heading: ReactNode;
    subheading?: ReactNode;
    bullets?: { label: string }[];
};

export default function AuthLayout({ children, heading, subheading, bullets }: AuthLayoutProps) {
    return (
        <div className="min-h-screen flex">
            <aside
                className="hidden lg:flex w-[44%] text-white p-12 flex-col justify-between relative overflow-hidden"
                style={{
                    background:
                        'radial-gradient(at 20% 20%, rgba(91,61,245,0.35) 0, transparent 50%),' +
                        'radial-gradient(at 80% 0%, rgba(74,46,224,0.30) 0, transparent 50%),' +
                        'radial-gradient(at 60% 80%, rgba(58,35,184,0.40) 0, transparent 50%),' +
                        '#1A1A22',
                }}
            >
                <div className="relative z-10">
                    <AppLogo variant="white" height={32} />
                </div>

                <div className="relative z-10">
                    <h1 className="text-4xl font-bold leading-tight">{heading}</h1>
                    {subheading && <p className="text-white/70 mt-4 text-[15px] max-w-sm">{subheading}</p>}
                    {bullets && bullets.length > 0 && (
                        <ul className="mt-6 space-y-3 text-[14px] text-white/80">
                            {bullets.map((b) => (
                                <li key={b.label} className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                        <path d="M5 13l4 4L19 7" />
                                    </svg>
                                    {b.label}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="relative z-10 text-[12px] text-white/50">
                    🇿🇦 Built for the South African market · POPIA &amp; EAAB compliant
                </div>
            </aside>

            <main className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
                <div className="w-full max-w-md py-6">
                    <div className="lg:hidden mb-8">
                        <AppLogo height={28} />
                    </div>
                    {children}
                </div>
            </main>
        </div>
    );
}
