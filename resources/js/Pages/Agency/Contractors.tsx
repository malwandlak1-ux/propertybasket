import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import AddContractorModal from '@/Components/AddContractorModal';
import { PageHeader, Segmented, SummaryStrip, btnPrimary } from '@/Components/Dashboard/Charts';

type Card = {
    id: number;
    business_name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    specialities: string[];
    service_areas: string[];
    average_rating: number;
    total_reviews: number;
    total_jobs: number;
    is_private: boolean;
};

type Props = {
    agency: { id: number; name: string };
    tab: 'marketplace' | 'mine';
    list: Card[];
    counts: { marketplace: number; mine: number };
};

function initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '?';
}

function ContractorCard({ c }: { c: Card }) {
    return (
        <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft hover:shadow-lift transition overflow-hidden pb-rise">
            <div className="p-5">
                <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold shrink-0">
                        {initials(c.business_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold tracking-tight truncate">{c.business_name}</p>
                        <p className="text-[12px] text-ink-500 truncate">{c.contact_name ?? '—'}</p>
                    </div>
                    {c.is_private ? (
                        <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-semibold">Private</span>
                    ) : (
                        <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-ink-100 text-ink-600 font-semibold">Marketplace</span>
                    )}
                </div>

                <div className="flex items-center gap-3 mb-3 text-[12px]">
                    <span className="inline-flex items-center gap-1 text-warning">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        <span className="font-bold">{c.average_rating > 0 ? c.average_rating.toFixed(1) : 'New'}</span>
                        {c.total_reviews > 0 && <span className="text-ink-500">({c.total_reviews})</span>}
                    </span>
                    <span className="text-ink-500">·</span>
                    <span className="text-ink-600">{c.total_jobs} jobs</span>
                </div>

                {c.specialities.length > 0 && (
                    <div className="mb-3">
                        <p className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-1">Specialities</p>
                        <div className="flex flex-wrap gap-1">
                            {c.specialities.slice(0, 4).map((s) => (
                                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 font-medium">{s}</span>
                            ))}
                            {c.specialities.length > 4 && (
                                <span className="text-[10px] text-ink-500">+{c.specialities.length - 4}</span>
                            )}
                        </div>
                    </div>
                )}

                {c.service_areas.length > 0 && (
                    <div className="mb-3">
                        <p className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-1">Areas</p>
                        <p className="text-[12px] text-ink-600 truncate">{c.service_areas.join(' · ')}</p>
                    </div>
                )}

                <div className="pt-3 border-t border-ink-100 flex items-center gap-3 text-[12px]">
                    {c.email && (
                        <a href={`mailto:${c.email}`} className="text-ink-700 hover:text-brand-600 inline-flex items-center gap-1 truncate flex-1 min-w-0">
                            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                            <span className="truncate">{c.email}</span>
                        </a>
                    )}
                    {c.phone && (
                        <a href={`tel:${c.phone}`} className="text-ink-700 hover:text-brand-600 inline-flex items-center gap-1 shrink-0">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1.05.37 2.06.72 3a2 2 0 0 1-.45 2.11L8.09 10.91a16 16 0 0 0 6 6l2.08-2.08a2 2 0 0 1 2.11-.45c.94.35 1.95.59 3 .72A2 2 0 0 1 22 16.92z" />
                            </svg>
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AgencyContractors({ agency, tab, list, counts }: Props) {
    const [modalOpen, setModalOpen] = useState(false);

    const topRated = list.filter((c) => c.average_rating >= 4.5).length;
    const jobsDone = list.reduce((n, c) => n + c.total_jobs, 0);

    function switchTab(nextTab: 'marketplace' | 'mine') {
        router.get('/agency/contractors', { tab: nextTab }, { preserveScroll: true, replace: true });
    }

    return (
        <AgencyLayout crumb="Contractors" agencyName={agency.name}>
            <Head title="Contractors" />

            <div className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Contractors"
                    subtitle="Browse the open marketplace or manage your own preferred contractor list"
                    actions={
                        <button onClick={() => setModalOpen(true)} className={btnPrimary}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
                            Add Contractor
                        </button>
                    }
                />

                <SummaryStrip
                    title="Contractor Network"
                    subtitle={tab === 'mine' ? 'Your private roster' : 'Open marketplace'}
                    cells={[
                        { label: 'My Contractors', value: String(counts.mine), sub: 'Private roster' },
                        { label: 'Marketplace', value: String(counts.marketplace), sub: 'Available to request quotes', tone: 'muted' },
                        { label: 'Top Rated (4.5+)', value: String(topRated), sub: 'In this view', tone: 'success' },
                        { label: 'Jobs Completed', value: String(jobsDone), sub: 'By contractors in this view', tone: 'muted' },
                    ]}
                />

                <div className="mb-4">
                    <Segmented<'marketplace' | 'mine'>
                        options={[
                            { value: 'marketplace', label: `Marketplace (${counts.marketplace})` },
                            { value: 'mine', label: `My Contractors (${counts.mine})` },
                        ]}
                        value={tab}
                        onChange={switchTab}
                    />
                </div>

                {tab === 'mine' && counts.mine === 0 ? (
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-16 text-center shadow-soft">
                        <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4 text-brand-700">
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                            </svg>
                        </div>
                        <p className="text-[15px] font-semibold text-ink-700 mb-1">No contractors on your list yet</p>
                        <p className="text-[13px] text-ink-500 mb-4">
                            Add your trusted plumbers, electricians, painters and more to keep them one click away.
                        </p>
                        <button
                            onClick={() => setModalOpen(true)}
                            className="px-3.5 py-2 text-[13px] bg-brand-700 text-white rounded-full hover:bg-brand-800 transition inline-flex items-center gap-2 font-semibold"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
                            Add your first contractor
                        </button>
                    </div>
                ) : list.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-ink-200/60 p-16 text-center shadow-soft">
                        <p className="text-[15px] font-semibold text-ink-700 mb-1">No marketplace contractors yet</p>
                        <p className="text-[13px] text-ink-500">Check back as contractors join the platform.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {list.map((c) => (<ContractorCard key={c.id} c={c} />))}
                    </div>
                )}
            </div>

            {modalOpen && <AddContractorModal onClose={() => setModalOpen(false)} />}
        </AgencyLayout>
    );
}
