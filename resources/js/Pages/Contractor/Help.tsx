import { Head } from '@inertiajs/react';
import ContractorLayout from '@/Layouts/ContractorLayout';
import HelpCentre from '@/Components/Dashboard/HelpCentre';
import { CONTRACTOR_GUIDES } from '@/help/contractor';

export default function ContractorHelp({ support_email }: { support_email: string | null }) {
    return (
        <ContractorLayout crumb="Help & Support" section="Account">
            <Head title="Help & Support" />
            <HelpCentre
                guides={CONTRACTOR_GUIDES}
                intro="How to quote, schedule and complete jobs, invoice and get paid."
                contact={{
                    title: 'Still need help?',
                    body: 'Message the property owner about a job, or email us about your account.',
                    label: support_email ? `Email ${support_email}` : 'Open Messages',
                    href: support_email ? `mailto:${support_email}?subject=Help%20with%20my%20contractor%20dashboard` : '/contractor/messages',
                }}
            />
        </ContractorLayout>
    );
}
