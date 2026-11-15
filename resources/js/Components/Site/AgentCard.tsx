import { Link } from '@inertiajs/react';
import { useTemplate } from '@/Layouts/SiteLayout';

export type SiteAgent = {
    id: number;
    slug: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatar: string | null;
    bio: string | null;
    areas: string[];
    listings: number | null;
};

export function initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

export function AgentAvatar({ agent, className = 'w-full aspect-square' }: { agent: Pick<SiteAgent, 'name' | 'avatar'>; className?: string }) {
    return agent.avatar ? (
        <img src={agent.avatar} alt={agent.name} className={`${className} object-cover`} loading="lazy" />
    ) : (
        <div className={`${className} grid place-items-center bg-brand-100 text-brand-700 font-bold text-[28px]`}>{initials(agent.name)}</div>
    );
}

export default function AgentCard({ agent }: { agent: SiteAgent }) {
    const t = useTemplate();
    return (
        <Link href={`/agents/${agent.slug}`} className={`group block bg-white overflow-hidden border border-ink-200/70 hover:shadow-lift transition ${t.card}`}>
            <div className="overflow-hidden">
                <AgentAvatar agent={agent} className="w-full aspect-[4/5] group-hover:scale-[1.03] transition-transform duration-300" />
            </div>
            <div className="p-4">
                <p className="font-semibold text-[15px] leading-tight">{agent.name}</p>
                <p className="text-[12px] text-ink-500 mt-1">
                    {agent.listings !== null ? `${agent.listings} active listing${agent.listings === 1 ? '' : 's'}` : 'Property practitioner'}
                </p>
            </div>
        </Link>
    );
}
