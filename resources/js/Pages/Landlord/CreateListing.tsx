import { Head } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';
import ListingForm from '@/Components/ListingForm';

type Option = { value: string; label: string };

type Props = {
    landlord: { id: number; name: string };
    agents: { id: number; name: string; email: string }[];
    amenities: Record<string, string[]>;
    property_types: Option[];
    provinces: string[];
};

export default function LandlordCreateListing({ landlord, amenities, property_types, provinces }: Props) {
    return (
        <LandlordLayout crumb="Add Property" section="Workspace">
            <Head title="Add Property" />
            <ListingForm
                submitUrl="/landlord/listings"
                cancelUrl="/landlord/properties"
                ownerLabel={landlord.name}
                agents={[]}
                amenities={amenities}
                property_types={property_types}
                provinces={provinces}
                showAgentSelect={false}
            />
        </LandlordLayout>
    );
}
