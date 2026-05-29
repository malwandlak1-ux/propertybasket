import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';

type AgencyRow = {
    id: number;
    slug: string;
    name: string;
    email: string | null;
    phone: string | null;
    head_office_address: string | null;
    logo: string | null;
    listings_count: number;
};

type Props = { agencies: AgencyRow[] };

export default function Index({ agencies }: Props) {
    return (
        <PublicLayout>
            <Head title="Agencies" />
            <section className="max-w-7xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-bold tracking-tight">Agencies on Property Basket</h1>
                <p className="text-ink-500 mt-1 text-[14px]">
                    {agencies.length} active agencies · all EAAB-registered
                </p>

                {agencies.length === 0 ? (
                    <div className="mt-10 bg-white rounded-2xl border border-ink-200 p-12 text-center text-ink-500">
                        No active agencies yet.
                    </div>
                ) : (
                    <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {agencies.map((a) => (
                            <Link
                                key={a.slug}
                                href={`/agencies/${a.slug}`}
                                className="bg-white border border-ink-200 rounded-2xl p-6 hover:shadow-lift transition block"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-[15px]">
                                        {a.name
                                            .split(' ')
                                            .map((w) => w[0])
                                            .slice(0, 2)
                                            .join('')}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[15px] truncate">{a.name}</p>
                                        <p className="text-[12px] text-ink-500 truncate">
                                            {a.head_office_address ?? a.email ?? '—'}
                                        </p>
                                    </div>
                                </div>
                                <p className="mt-4 text-[13px] text-ink-700">
                                    <span className="font-semibold">{a.listings_count}</span> active{' '}
                                    {a.listings_count === 1 ? 'listing' : 'listings'}
                                </p>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </PublicLayout>
    );
}
