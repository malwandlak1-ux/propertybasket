import { FormEvent } from 'react';
import { Head, router } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';

type Contractor = {
    id: number;
    business_name: string;
    specialities: string[] | null;
    service_areas: string[] | null;
    vat_registered: boolean;
    average_rating: number | string;
    total_reviews: number;
    total_jobs: number;
    user: { id: number; name: string; email: string | null; phone: string | null } | null;
};

type Props = {
    contractors: Contractor[];
    filters: { speciality?: string; area?: string };
};

export default function Index({ contractors, filters }: Props) {
    function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const payload: Record<string, string> = {};
        f.forEach((v, k) => {
            const s = String(v).trim();
            if (s !== '') payload[k] = s;
        });
        router.get('/contractors', payload, { preserveState: true, preserveScroll: true });
    }

    return (
        <PublicLayout>
            <Head title="Contractor marketplace" />
            <section className="max-w-7xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-bold tracking-tight">Contractor marketplace</h1>
                <p className="text-ink-500 mt-1 text-[14px]">
                    {contractors.length} vetted contractors · sorted by rating
                </p>

                <form
                    onSubmit={submit}
                    className="mt-6 bg-white border border-ink-200 rounded-2xl p-5 grid md:grid-cols-3 gap-3"
                >
                    <input
                        name="speciality"
                        defaultValue={filters.speciality ?? ''}
                        placeholder="Speciality (e.g. plumbing)"
                        className="bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px]"
                    />
                    <input
                        name="area"
                        defaultValue={filters.area ?? ''}
                        placeholder="Service area (e.g. Sandton)"
                        className="bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px]"
                    />
                    <button
                        type="submit"
                        className="py-2.5 bg-ink-900 hover:bg-brand-500 text-white rounded-lg text-[14px] font-semibold transition"
                    >
                        Filter
                    </button>
                </form>

                {contractors.length === 0 ? (
                    <div className="mt-8 bg-white rounded-2xl border border-ink-200 p-12 text-center text-ink-500">
                        No contractors match those filters.
                    </div>
                ) : (
                    <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {contractors.map((c) => (
                            <div
                                key={c.id}
                                className="bg-white border border-ink-200 rounded-2xl p-6 hover:shadow-card transition"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-bold text-[15px]">{c.business_name}</p>
                                        {c.user?.name && (
                                            <p className="text-[12px] text-ink-500">{c.user.name}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[13px] font-bold">★ {c.average_rating}</p>
                                        <p className="text-[11px] text-ink-500">{c.total_reviews} reviews</p>
                                    </div>
                                </div>

                                {c.specialities && c.specialities.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-1.5">
                                        {c.specialities.map((s) => (
                                            <span
                                                key={s}
                                                className="bg-brand-50 text-brand-700 text-[11px] font-semibold rounded-full px-2.5 py-1"
                                            >
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {c.service_areas && c.service_areas.length > 0 && (
                                    <p className="mt-4 text-[12px] text-ink-500">
                                        Serves: {c.service_areas.join(', ')}
                                    </p>
                                )}

                                <div className="mt-5 pt-5 border-t border-ink-100 flex items-center justify-between text-[12px]">
                                    <span className="text-ink-500">{c.total_jobs} completed jobs</span>
                                    {c.vat_registered && (
                                        <span className="text-success font-semibold">VAT registered</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </PublicLayout>
    );
}
