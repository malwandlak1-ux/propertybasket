import { Head } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import ListingForm from '@/Components/ListingForm';

type Option = { value: string; label: string };

type Props = {
    agency: { id: number; name: string };
    agents: { id: number; name: string; email: string }[];
    amenities: Record<string, string[]>;
    property_types: Option[];
    provinces: string[];
};

export default function AgentCreateListing({ agency, amenities, property_types, provinces }: Props) {
    return (
        <AgentLayout crumb="Create" agencyName={agency.name}>
            <Head title="Create New Listing" />
            <ListingForm
                submitUrl="/agent/listings"
                cancelUrl="/agent/listings"
                ownerLabel={agency.name}
                agents={[]}
                amenities={amenities}
                property_types={property_types}
                provinces={provinces}
                showAgentSelect={false}
            />
        </AgentLayout>
    );
}
