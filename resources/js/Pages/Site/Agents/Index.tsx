import { Head } from '@inertiajs/react';
import SiteLayout, { Eyebrow, useSite, useTemplate } from '@/Layouts/SiteLayout';
import AgentCard, { SiteAgent } from '@/Components/Site/AgentCard';

export default function SiteAgents({ agents }: { agents: SiteAgent[] }) {
    const site = useSite();
    const t = useTemplate();

    return (
        <SiteLayout>
            <Head title="Our agents" />
            <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-12 pb-20">
                <Eyebrow>Our people</Eyebrow>
                <h1 className={`mt-4 text-[40px] sm:text-[56px] leading-none ${t.heading}`}>Local knowledge.<br />Personal service.</h1>
                <p className="text-ink-600 mt-5 max-w-xl text-[16px]">The {site.name} team — local experts ready to help you buy, sell or rent.</p>
                <div className="mt-12 grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {agents.map((a) => <AgentCard key={a.id} agent={a} />)}
                </div>
            </section>
        </SiteLayout>
    );
}
