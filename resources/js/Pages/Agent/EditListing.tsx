import { Head } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import ListingForm, { ListingFormInitial } from '@/Components/ListingForm';

type Option = { value: string; label: string };

type Props = {
    agency: { id: number; name: string };
    amenities: Record<string, string[]>;
    property_types: Option[];
    provinces: string[];
    listing: ListingFormInitial & { id: number };
};

export default function AgentEditListing({ agency, amenities, property_types, provinces, listing }: Props) {
    return (
        <AgentLayout crumb="Edit Listing" agencyName={agency.name}>
            <Head title={`Edit · ${listing.title}`} />
            <ListingForm
                submitUrl={`/agent/listings/${listing.id}`}
                cancelUrl="/agent/listings"
                ownerLabel={agency.name}
                agents={[]}
                amenities={amenities}
                property_types={property_types}
                provinces={provinces}
                showAgentSelect={false}
                mode="edit"
                initial={listing}
            />
        </AgentLayout>
    );
}
