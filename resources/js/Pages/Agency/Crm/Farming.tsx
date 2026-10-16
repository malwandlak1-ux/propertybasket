import { Head } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import FarmingView from '@/Components/Crm/FarmingView';
import { Farm } from '@/Components/Crm/constants';

type Props = { agency: { name: string }; agents: { id: number; name: string }[]; agent_id: number | null; farm: Farm };

export default function AgencyCrmFarming({ agency, agents, agent_id, farm }: Props) {
    return (
        <AgencyLayout agencyName={agency.name} crumb="CRM · Farming">
            <Head title="Property Farming" />
            <FarmingView base="/agency/crm" farm={farm} editable={false} agents={agents} agentId={agent_id} />
        </AgencyLayout>
    );
}
