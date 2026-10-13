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
}
