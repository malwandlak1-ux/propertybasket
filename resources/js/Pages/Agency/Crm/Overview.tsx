import { Head } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import OverviewView, { LeaderRow, OverviewData } from '@/Components/Crm/OverviewView';

type Props = {
    agency: { name: string };
    agents: { id: number; name: string }[];
    agent_id: number | null;
    data: OverviewData;
    leaderboard: LeaderRow[];
};

export default function AgencyCrmOverview({ agency, agents, agent_id, data, leaderboard }: Props) {
    return (
        <AgencyLayout agencyName={agency.name} crumb="CRM">
            <Head title="CRM" />
            <OverviewView base="/agency/crm" data={data} mode="agency" agents={agents} agentId={agent_id} leaderboard={leaderboard} />
        </AgencyLayout>
    );
}
