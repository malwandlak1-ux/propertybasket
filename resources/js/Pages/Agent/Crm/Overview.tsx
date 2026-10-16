import { Head } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import OverviewView, { OverviewData } from '@/Components/Crm/OverviewView';

export default function AgentCrmOverview({ agent, data }: { agent: { name: string; agency_name: string }; data: OverviewData }) {
    return (
        <AgentLayout crumb="CRM" agencyName={agent.agency_name}>
            <Head title="CRM" />
            <OverviewView base="/agent/crm" data={data} mode="agent" />
        </AgentLayout>
    );
}
