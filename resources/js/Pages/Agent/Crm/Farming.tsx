import { Head } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import FarmingView from '@/Components/Crm/FarmingView';
import { Farm, Profile } from '@/Components/Crm/constants';

export default function AgentCrmFarming({ agent, profile, farm }: { agent: { name: string; agency_name: string }; profile: Profile; farm: Farm }) {
    return (
        <AgentLayout crumb="CRM · Farming" agencyName={agent.agency_name}>
            <Head title="Property Farming" />
            <FarmingView base="/agent/crm" farm={farm} editable profile={profile} />
        </AgentLayout>
    );
}
