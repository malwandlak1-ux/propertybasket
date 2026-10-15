import { Head } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import HelpCentre from '@/Components/Dashboard/HelpCentre';
import { AGENCY_GUIDES } from '@/help/agency';

export default function AgencyHelp({ agency_name, support_email }: { agency_name: string; support_email: string | null }) {
    return (
        <AgencyLayout crumb="Help & Support" agencyName={agency_name}>
            <Head title="Help & Support" />
            <HelpCentre
                guides={AGENCY_GUIDES}
                intro="Step-by-step guides for running your agency: agents, listings, leads, maintenance, payouts and compliance."
                contact={{
                    title: 'Still need help?',
                    body: support_email ? `Email us and we'll get back to you within one working day.` : 'Contact your platform administrator for help with anything not covered here.',
                    label: support_email ? `Email ${support_email}` : 'Contact support',
                    href: support_email ? `mailto:${support_email}?subject=Help%20with%20my%20agency%20dashboard` : '#',
                }}
            />
        </AgencyLayout>
    );
}
