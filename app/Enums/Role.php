<?php

namespace App\Enums;

enum Role: string
{
    case SuperAdmin = 'super_admin';
    case AgencyAdmin = 'agency_admin';
    case Agent = 'agent';
    case Landlord = 'landlord';
    case Tenant = 'tenant';
    case Contractor = 'contractor';

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super Admin',
            self::AgencyAdmin => 'Agency Admin',
            self::Agent => 'Agent',
            self::Landlord => 'Landlord',
            self::Tenant => 'Tenant',
            self::Contractor => 'Contractor',
        };
    }

    public function canSelfRegister(): bool
    {
        return match ($this) {
            self::AgencyAdmin, self::Landlord, self::Contractor => true,
            default => false,
        };
    }
}
