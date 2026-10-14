<?php

namespace App\Support;

use App\Enums\Role;

/**
 * Per-site role switches (config/edition.php). Lets one codebase run a slimmer
 * site — e.g. careline without the agency/agent dashboards.
 */
class Edition
{
    /** @return string[] Role values switched off on this site. */
    public static function disabledRoles(): array
    {
        return config('edition.disabled_roles', []);
    }

    public static function roleEnabled(Role|string|null $role): bool
    {
        if ($role === null) {
            return true;
        }
        $value = $role instanceof Role ? $role->value : $role;

        return ! in_array($value, self::disabledRoles(), true);
    }

    /** Agencies (and their agents) are part of this site. */
    public static function agenciesEnabled(): bool
    {
        return self::roleEnabled(Role::AgencyAdmin);
    }

    /** The public property portal (home, listings, advice…) is part of this site. */
    public static function publicSiteEnabled(): bool
    {
        return (bool) config('edition.public_site', true);
    }

    /**
     * Site branding: a client site (careline) shows its own name + logo in
     * place of Property Basket's.
     *
     * @return array{name: string, logo: ?string, icon: ?string, color: string, color_alt: ?string, accent: string, custom: bool}
     */
    public static function brand(): array
    {
        $b = (array) config('edition.brand', []);
        $logo = $b['logo'] ?? null;

        return [
            'name'      => $b['name'] ?? 'Property Basket',
            'logo'      => $logo,
            'icon'      => $b['icon'] ?? null,
            'color'     => $b['color'] ?? '#F26A1B',
            'color_alt' => $b['color_alt'] ?? null,
            'accent'    => $b['accent'] ?? 'orange',
            'custom'    => ! empty($logo),
        ];
    }

    /** Contractors can browse + claim unassigned jobs (the marketplace). */
    public static function marketplaceEnabled(): bool
    {
        return (bool) config('edition.contractor_marketplace', true);
    }
}
