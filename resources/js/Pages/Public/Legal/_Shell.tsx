import { ReactNode } from 'react';
import { Link } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';

export type LegalMeta = {
    last_updated: string;
    effective_date: string;
    company_name: string;
    jurisdiction: string;
    information_officer: string;
    support_email: string;
    support_phone: string;
};

export function LegalShell({
    title,
    subtitle,
    meta,
    children,
}: {
    title: string;
    subtitle: string;
    meta: LegalMeta;
    children: ReactNode;
}) {
    return (
        <PublicLayout>
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                {/* Breadcrumb */}
                <nav className="text-[12px] text-ink-500 mb-6">
                    <Link href="/" className="hover:text-ink-900">Home</Link>
                    <span className="mx-1.5 text-ink-300">/</span>
                    <span className="text-ink-700">{title}</span>
                </nav>

                <header className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
                    <p className="text-[14px] text-ink-600 mt-2">{subtitle}</p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-500">
                        <span>Last updated: <strong className="text-ink-700">{meta.last_updated}</strong></span>
                        <span>Effective: <strong className="text-ink-700">{meta.effective_date}</strong></span>
                    </div>
                </header>

                {/* Cross-links between the three legal pages */}
                <nav className="flex flex-wrap gap-2 mb-8 text-[12px]">
                    <LegalCrumb href="/privacy-policy" label="Privacy Policy" />
                    <LegalCrumb href="/privacy-portal" label="Privacy Portal" />
                    <LegalCrumb href="/terms-and-conditions" label="Terms & Conditions" />
                </nav>

                <article className="legal-prose">
                    {children}
                </article>

                <footer className="mt-12 pt-6 border-t border-ink-200 text-[12px] text-ink-500">
                    <p>
                        Questions about this document? Contact our Information Officer at{' '}
                        <a href={`mailto:${meta.information_officer}`} className="text-brand-600 hover:text-brand-700 font-semibold">
                            {meta.information_officer}
                        </a>.
                    </p>
                </footer>
            </div>

            {/* Article styling — scoped to .legal-prose */}
            <style>{`
                .legal-prose h2 { font-size: 1.25rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.75rem; color: #0B0B0F; }
                .legal-prose h3 { font-size: 1rem;    font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem;  color: #0B0B0F; }
                .legal-prose p  { font-size: 0.875rem; line-height: 1.65; color: #374151; margin-bottom: 0.85rem; }
                .legal-prose ul { font-size: 0.875rem; line-height: 1.65; color: #374151; margin-bottom: 0.85rem; padding-left: 1.25rem; list-style: disc; }
                .legal-prose ul li { margin-bottom: 0.35rem; }
                .legal-prose strong { color: #0B0B0F; }
                .legal-prose a { color: #F26A1B; font-weight: 600; }
                .legal-prose a:hover { text-decoration: underline; }
            `}</style>
        </PublicLayout>
    );
}

function LegalCrumb({ href, label }: { href: string; label: string }) {
    const isActive = typeof window !== 'undefined' && window.location.pathname === href;
    return (
        <Link
            href={href}
            className={
                'px-2.5 py-1 rounded-full font-medium transition border ' +
                (isActive
                    ? 'bg-ink-900 text-white border-ink-900'
                    : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-100')
            }
        >
            {label}
        </Link>
    );
}
