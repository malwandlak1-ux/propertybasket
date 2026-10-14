import { Head } from '@inertiajs/react';
import LandlordLayout from '@/Layouts/LandlordLayout';
import HelpCentre from '@/Components/Dashboard/HelpCentre';
import { LANDLORD_GUIDES } from '@/help/landlord';

export default function LandlordHelp({ support_email }: { support_email: string | null }) {
    return (
        <LandlordLayout crumb="Help & Support" section="Account">
            <Head title="Help & Support" />
            <HelpCentre
                guides={LANDLORD_GUIDES}
                intro="Step-by-step guides for running your properties: tenants, rent, statements and maintenance."
                contact={{
                    title: 'Still need help?',
                    body: support_email ? `Email us and we'll get back to you within one working day.` : 'Contact your platform administrator for help with anything not covered here.',
                    label: support_email ? `Email ${support_email}` : 'Contact support',
                    href: support_email ? `mailto:${support_email}?subject=Help%20with%20my%20landlord%20dashboard` : '#',
                }}
            />
        </LandlordLayout>
    );
}
