import { Head, Link } from '@inertiajs/react';
import SiteLayout, { Eyebrow, useTemplate } from '@/Layouts/SiteLayout';
import PropertyCard, { SiteListing } from '@/Components/Site/PropertyCard';
import { AgentAvatar, SiteAgent } from '@/Components/Site/AgentCard';

type Props = { agent: SiteAgent; listings: SiteListing[] };

export default function SiteAgentShow({ agent, listings }: Props) {
    const t = useTemplate();
    const wa = agent.phone?.replace(/[^\d]/g, '').replace(/^0/, '27');

    return (
        <SiteLayout>
            <Head title={agent.name} />
            <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-6">
                <Link href="/agents" className="text-[13px] text-ink-500 hover:text-ink-900">← All agents</Link>
            </section>

            <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 pb-12 grid gap-8 md:grid-cols-[260px_1fr] items-start">
                <div className={`overflow-hidden ${t.card}`}>
                    <AgentAvatar agent={agent} className="w-full aspect-[4/5]" />
                </div>
                <div>
                    <Eyebrow>Property practitioner</Eyebrow>
                    <h1 className={`mt-4 text-[40px] sm:text-[56px] leading-[1.02] ${t.heading}`}>{agent.name}</h1>
                    {agent.areas.length > 0 && <p className="mt-1 text-ink-500">Specialises in {agent.areas.join(', ')}</p>}
                    {agent.bio && <p className="mt-5 text-ink-700 leading-relaxed whitespace-pre-line max-w-2xl">{agent.bio}</p>}
                    <div className="mt-6 flex flex-wrap gap-2">
                        {agent.phone && <a href={`tel:${agent.phone}`} className="px-5 py-2.5 rounded-full bg-ink-900 hover:bg-brand-600 text-white text-[14px] font-semibold">Call {agent.phone}</a>}
                        {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 rounded-full border border-ink-200 hover:border-brand-500 text-[14px] font-semibold">WhatsApp</a>}
                        {agent.email && <a href={`mailto:${agent.email}`} className="px-5 py-2.5 rounded-full border border-ink-200 hover:border-brand-500 text-[14px] font-semibold">Email</a>}
                    </div>
                </div>
            </section>

            <section className="max-w-7xl mx-auto px-4 sm:px-8 pb-16">
                <h2 className={`text-[34px] mb-8 ${t.heading}`}>{agent.name.split(' ')[0]}'s listings</h2>
                {listings.length === 0 ? (
                    <p className="text-ink-500">No active listings right now.</p>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {listings.map((l) => <PropertyCard key={l.id} listing={l} />)}
                    </div>
                )}
            </section>
        </SiteLayout>
    );
}
