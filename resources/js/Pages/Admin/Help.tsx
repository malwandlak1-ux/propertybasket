import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import HelpCentre from '@/Components/Dashboard/HelpCentre';
import { ADMIN_GUIDES } from '@/help/admin';

export default function AdminHelp({ counts }: { counts?: { agencies: number; landlords: number; contractors: number } }) {
    return (
        <AdminLayout crumb="Help & Support" section="System" counts={counts}>
            <Head title="Help & Support" />
            <HelpCentre
                guides={ADMIN_GUIDES}
                intro="Quick guides for running the platform: verifying accounts, plans, payments, announcements and system health."
                contact={{
                    title: 'Something not working?',
                    body: 'System Health shows the status of every service and any open incidents.',
                    label: 'Open System Health',
                    href: '/admin/system',
                }}
            />
        </AdminLayout>
    );
}
