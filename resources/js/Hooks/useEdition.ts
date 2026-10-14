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

export type Brand = {
    name: string;
    logo: string | null;
    icon: string | null;
    color: string;
    color_alt: string | null;
    /** Dashboard accent for users who haven't chosen one. */
    accent: string;
    /** true on a white-label client site (e.g. careline = Careline Clinic). */
    custom: boolean;
};

const DEFAULT_BRAND: Brand = { name: 'Property Basket', logo: null, icon: null, color: '#F26A1B', color_alt: null, accent: 'orange', custom: false };

/** Site branding (config/edition.php `brand`). */
export function useBrand(): Brand {
    const { edition } = usePage<{ edition?: { brand?: Brand } }>().props;
    return edition?.brand ?? DEFAULT_BRAND;
}
