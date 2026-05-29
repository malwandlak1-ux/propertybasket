import { Head } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import ListingForm from '@/Components/ListingForm';

type Agent = { id: number; name: string; email: string };
type Option = { value: string; label: string };

type Props = {
    agency: { id: number; name: string };
    agents: Agent[];
    amenities: Record<string, string[]>;
    property_types: Option[];
    provinces: string[];
};

export default function AgencyCreateListing({ agency, agents, amenities, property_types, provinces }: Props) {
    return (
        <AgencyLayout crumb="Create" agencyName={agency.name}>
            <Head title="Create New Listing" />
            <ListingForm
                submitUrl="/agency/listings"
                cancelUrl="/agency/listings"
                ownerLabel={agency.name}
                agents={agents}
                amenities={amenities}
                property_types={property_types}
                provinces={provinces}
                showAgentSelect
            />
        </AgencyLayout>
    );
}
