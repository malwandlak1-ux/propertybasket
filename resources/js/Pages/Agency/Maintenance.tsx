import { Head } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import MaintenanceBoard, { ContractorOption, MaintRequest } from '@/Components/MaintenanceBoard';

type Props = {
    agency: { id: number; name: string };
    requests: MaintRequest[];
    contractors: { mine: ContractorOption[]; market: ContractorOption[] };
    base_url: string;
    quotes_url: string;
};

export default function AgencyMaintenance({ agency, requests, contractors, base_url, quotes_url }: Props) {
    return (
        <AgencyLayout crumb="Maintenance" agencyName={agency.name}>
            <Head title="Maintenance" />
            <MaintenanceBoard
                requests={requests}
                contractors={contractors}
                baseUrl={base_url}
                quotesUrl={quotes_url}
            />
        </AgencyLayout>
    );
}
