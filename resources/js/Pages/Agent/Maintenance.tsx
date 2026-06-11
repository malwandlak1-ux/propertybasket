import { Head } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import MaintenanceBoard, { ContractorOption, MaintRequest } from '@/Components/MaintenanceBoard';

type Props = {
    agent: { id: number; name: string; agency_name: string };
    requests: MaintRequest[];
    contractors: { mine: ContractorOption[]; market: ContractorOption[] };
    base_url: string;
};

export default function AgentMaintenance({ agent, requests, contractors, base_url }: Props) {
    return (
        <AgentLayout crumb="Maintenance" agencyName={agent.agency_name}>
            <Head title="Maintenance" />
            <MaintenanceBoard
                requests={requests}
                contractors={contractors}
                baseUrl={base_url}
                quotesUrl={null}
            />
        </AgentLayout>
    );
}
