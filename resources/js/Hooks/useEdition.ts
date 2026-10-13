import { usePage } from '@inertiajs/react';

/**
 * Per-site role switches (config/edition.php → `edition` shared prop).
 * careline runs with DISABLED_ROLES=agency_admin,agent, so agency UI hides.
 */
export function useEdition() {
    const { edition } = usePage<{ edition?: { disabled_roles: string[] } }>().props;
    const disabled = edition?.disabled_roles ?? [];
    const roleEnabled = (role: string) => !disabled.includes(role);
    return { roleEnabled, agenciesEnabled: roleEnabled('agency_admin') };
}
