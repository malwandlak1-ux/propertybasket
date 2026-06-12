import { Head } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import MaintenanceBoard, { MaintRequest } from '@/Components/MaintenanceBoard';

type Props = {
    agent: { id: number; name: string; agency_name: string };
    requests: MaintRequest[];
    base_url: string;
};

export default function AgentMaintenance({ agent, requests, base_url }: Props) {
    return (
        <AgentLayout crumb="Maintenance" agencyName={agent.agency_name}>
            <Head title="Maintenance" />
            <MaintenanceBoard
                requests={requests}
                baseUrl={base_url}
                quotesUrl={null}
                canAllocate={false}
                canRate={false}
            />
        </AgentLayout>
    );
}
