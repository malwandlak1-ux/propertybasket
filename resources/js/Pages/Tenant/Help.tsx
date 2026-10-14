import { Head } from '@inertiajs/react';
import TenantLayout from '@/Layouts/TenantLayout';
import HelpCentre from '@/Components/Dashboard/HelpCentre';
import { TENANT_GUIDES } from '@/help/tenant';

type Props = { lease: { address: string }; managed_by: string | null };

export default function TenantHelp({ lease, managed_by }: Props) {
    return (
        <TenantLayout crumb="Help & Support" leaseAddress={lease.address}>
            <Head title="Help & Support" />
            <HelpCentre
                guides={TENANT_GUIDES}
                intro="How to pay rent, get statements, report repairs and manage your account."
                contact={{
                    title: 'Still need help?',
                    body: `Send ${managed_by ?? 'your landlord'} a message and they'll get back to you.`,
                    label: `Message ${managed_by ?? 'your landlord'}`,
                    href: '/tenant/messages',
                }}
            />
        </TenantLayout>
    );
}
