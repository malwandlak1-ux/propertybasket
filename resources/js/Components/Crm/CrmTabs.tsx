import { Link, router } from '@inertiajs/react';
import { selectCls } from '@/Components/Dashboard/Charts';

type Tab = 'overview' | 'farming' | 'pipeline' | 'whatsapp';

/**
 * CRM section tabs: Overview (outreach stats) · Farming · Pipeline.
 * `base` is /agent/crm or /agency/crm. The agency view adds an agent filter
 * that carries across the tabs.
 */
export default function CrmTabs({ base, active, agents, agentId, agentParam = 'agent' }: {
    base: string;
    active: Tab;
    agents?: { id: number; name: string }[];
    agentId?: number | null;
    /** The pipeline page names its filter agent_id. */
    agentParam?: string;
}) {
    const q = (tab: Tab) => {
        if (!agentId) return '';
        return `?${tab === 'pipeline' ? 'agent_id' : 'agent'}=${agentId}`;
    };
    const tabs: { key: Tab; label: string; href: string }[] = [
        { key: 'overview', label: 'Overview', href: `${base}${q('overview')}` },
        { key: 'farming', label: 'Farming', href: `${base}/farming${q('farming')}` },
        { key: 'pipeline', label: 'Pipeline', href: `${base}/pipeline${q('pipeline')}` },
        { key: 'whatsapp', label: 'WhatsApp', href: `${base}/whatsapp${q('whatsapp')}` },
    ];

    function pickAgent(id: string) {
        const url = new URL(window.location.href);
        if (id) url.searchParams.set(agentParam, id);
        else url.searchParams.delete(agentParam);
        router.get(url.pathname + url.search, {}, { preserveScroll: true });
    }

    return (
        <div className="flex flex-wrap items-center gap-3 mb-5">
            <nav className="inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-soft" aria-label="CRM sections">
                {tabs.map((t) => (
                    <Link
                        key={t.key}
                        href={t.href}
                        className={
                            'px-4 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition ' +
                            (t.key === active ? 'bg-brand-700 text-white shadow-soft' : 'text-ink-500 hover:text-ink-900')
                        }
                    >
                        {t.label}
                    </Link>
                ))}
            </nav>
            {agents && (
                <select aria-label="Agent" value={agentId ?? ''} onChange={(e) => pickAgent(e.target.value)} className={`${selectCls} ml-auto`}>
                    <option value="">All agents</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
            )}
        </div>
    );
}
