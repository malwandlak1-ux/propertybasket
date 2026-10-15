import { Head } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import HelpCentre from '@/Components/Dashboard/HelpCentre';
import { AGENT_GUIDES } from '@/help/agent';

export default function AgentHelp({ agency_name, support_email }: { agency_name: string | null; support_email: string | null }) {
    return (
        <AgentLayout crumb="Help & Support" agencyName={agency_name ?? undefined}>
            <Head title="Help & Support" />
            <HelpCentre
                guides={AGENT_GUIDES}
                intro="Step-by-step guides for your day as an agent: listings, leads, viewings, inspections and commission."
                contact={{
                    title: 'Still need help?',
                    body: support_email ? `Email us and we'll get back to you within one working day.` : 'Contact your platform administrator for help with anything not covered here.',
                    label: support_email ? `Email ${support_email}` : 'Contact support',
                    href: support_email ? `mailto:${support_email}?subject=Help%20with%20my%20agent%20dashboard` : '#',
                }}
            />
        </AgentLayout>
    );
}
