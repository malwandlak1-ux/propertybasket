import { Head } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';
import ListingCard, { ListingCardData } from '@/Components/ListingCard';

type Agency = {
    id: number;
    name: string;
    slug: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    head_office_address: string | null;
    eaab_ffc_number: string | null;
    agents: { id: number; name: string; email: string | null; phone: string | null }[];
};

type Props = { agency: Agency; listings: ListingCardData[] };

export default function Show({ agency, listings }: Props) {
    return (
        <PublicLayout>
            <Head title={agency.name} />

            <section
                className="text-white"
                style={{
                    background:
                        'radial-gradient(at 20% 20%, rgba(242,106,27,0.35) 0, transparent 50%),' +
                        'radial-gradient(at 80% 0%, rgba(232,22,19,0.30) 0, transparent 50%),' +
                        '#0B0B0F',
                }}
            >
                <div className="max-w-7xl mx-auto px-6 py-12">
                    <p className="text-[12px] uppercase tracking-wider text-white/60 font-semibold">
                        Agency profile
                    </p>
                    <h1 className="mt-2 text-4xl font-bold tracking-tight">{agency.name}</h1>
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-white/70">
                        {agency.head_office_address && <span>{agency.head_office_address}</span>}
                        {agency.email && <span>{agency.email}</span>}
                        {agency.phone && <span>{agency.phone}</span>}
                        {agency.eaab_ffc_number && (
                            <span>EAAB FFC: {agency.eaab_ffc_number}</span>
                        )}
                    </div>
                </div>
            </section>

            <section className="max-w-7xl mx-auto px-6 py-12">
                <div className="grid lg:grid-cols-3 gap-10">
                    <aside>
                        <h2 className="text-[16px] font-bold">Agents</h2>
                        <div className="mt-4 space-y-3">
                            {agency.agents.length === 0 ? (
                                <p className="text-[14px] text-ink-500">No agents listed yet.</p>
                            ) : (
                                agency.agents.map((a) => (
                                    <div key={a.id} className="bg-white border border-ink-200 rounded-xl p-4">
                                        <p className="font-semibold text-[14px]">{a.name}</p>
                                        <p className="text-[12px] text-ink-500 mt-0.5">
                                            {a.email ?? a.phone ?? ''}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </aside>

                    <div className="lg:col-span-2">
                        <h2 className="text-[16px] font-bold">
                            Active listings · {listings.length}
                        </h2>
                        {listings.length === 0 ? (
                            <div className="mt-4 bg-white rounded-2xl border border-ink-200 p-10 text-center text-ink-500">
                                No active listings right now.
                            </div>
                        ) : (
                            <div className="mt-4 grid md:grid-cols-2 gap-5">
                                {listings.map((l) => (
                                    <ListingCard key={l.slug} listing={l} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
