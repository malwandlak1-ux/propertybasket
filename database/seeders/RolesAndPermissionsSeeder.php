<?php

namespace Database\Seeders;

use App\Enums\Role as RoleEnum;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            // Listings
            'listings.view_any', 'listings.create', 'listings.create_sale',
            'listings.update', 'listings.soft_delete', 'listings.restore',
            // Inquiries
            'inquiries.view', 'inquiries.update',
            // Leases
            'leases.create', 'leases.invite_tenant',
            // Commissions
            'commissions.run_payout', 'commissions.set_split',
            // Maintenance
            'maintenance.create_request', 'maintenance.assign_contractor',
            'maintenance.accept_job', 'maintenance.submit_quote',
            'maintenance.submit_invoice', 'maintenance.approve_invoice',
            // Admin
            'admin.manage_subscriptions', 'admin.manage_roles',
            'admin.manage_platform_settings',
        ];

        foreach ($permissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        foreach (RoleEnum::cases() as $role) {
            Role::firstOrCreate(['name' => $role->value, 'guard_name' => 'web']);
        }

        Role::findByName(RoleEnum::SuperAdmin->value)->syncPermissions(Permission::all());

        Role::findByName(RoleEnum::AgencyAdmin->value)->syncPermissions([
            'listings.view_any', 'listings.create', 'listings.create_sale',
            'listings.update', 'listings.soft_delete', 'listings.restore',
            'inquiries.view', 'inquiries.update',
            'leases.create', 'leases.invite_tenant',
            'commissions.run_payout', 'commissions.set_split',
            'maintenance.create_request', 'maintenance.assign_contractor',
            'maintenance.approve_invoice',
        ]);

        Role::findByName(RoleEnum::Agent->value)->syncPermissions([
            'listings.view_any', 'listings.create', 'listings.create_sale',
            'listings.update', 'listings.soft_delete', 'listings.restore',
            'inquiries.view', 'inquiries.update',
            'maintenance.create_request',
        ]);

        Role::findByName(RoleEnum::Landlord->value)->syncPermissions([
            'listings.view_any', 'listings.create',
            'listings.update', 'listings.soft_delete', 'listings.restore',
            'inquiries.view', 'inquiries.update',
            'leases.create', 'leases.invite_tenant',
            'maintenance.create_request', 'maintenance.assign_contractor',
            'maintenance.approve_invoice',
        ]);

        Role::findByName(RoleEnum::Tenant->value)->syncPermissions([
            'listings.view_any',
            'maintenance.create_request',
        ]);

        Role::findByName(RoleEnum::Contractor->value)->syncPermissions([
            'listings.view_any',
            'maintenance.accept_job', 'maintenance.submit_quote', 'maintenance.submit_invoice',
        ]);
    }
}
