<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class RolesController extends Controller
{
    use EnsuresSuperAdmin;

    /**
     * Role columns (in display order). The "super_admin" column is always
     * on (read-only), and only certain rows are mutable.
     */
    private const ROLES = ['super_admin', 'agency_admin', 'agent', 'landlord', 'tenant', 'contractor'];

    /**
     * Permission matrix. Each row defines what each role can do.
     * Values: true (on), false (off).
     */
    private function matrix(): array
    {
        return [
            [
                'permission' => 'Create / edit listings',
                'grants'     => ['super_admin' => true, 'agency_admin' => true, 'agent' => true, 'landlord' => true, 'tenant' => false, 'contractor' => false],
            ],
            [
                'permission' => 'Run payout batches',
                'grants'     => ['super_admin' => true, 'agency_admin' => true, 'agent' => false, 'landlord' => true, 'tenant' => false, 'contractor' => false],
            ],
            [
                'permission' => 'Set commission splits',
                'grants'     => ['super_admin' => true, 'agency_admin' => true, 'agent' => false, 'landlord' => false, 'tenant' => false, 'contractor' => false],
            ],
            [
                'permission' => 'Conduct inspections',
                'grants'     => ['super_admin' => true, 'agency_admin' => true, 'agent' => true, 'landlord' => true, 'tenant' => false, 'contractor' => false],
            ],
            [
                'permission' => 'Log maintenance request',
                'grants'     => ['super_admin' => true, 'agency_admin' => true, 'agent' => true, 'landlord' => true, 'tenant' => true, 'contractor' => false],
            ],
            [
                'permission' => 'Submit quotes / invoices',
                'grants'     => ['super_admin' => true, 'agency_admin' => false, 'agent' => false, 'landlord' => false, 'tenant' => false, 'contractor' => true],
            ],
            [
                'permission' => 'Approve invoices for payment',
                'grants'     => ['super_admin' => true, 'agency_admin' => true, 'agent' => false, 'landlord' => true, 'tenant' => false, 'contractor' => false],
            ],
            [
                'permission' => 'Sign lease as tenant',
                'grants'     => ['super_admin' => true, 'agency_admin' => false, 'agent' => false, 'landlord' => false, 'tenant' => true, 'contractor' => false],
            ],
            [
                'permission' => 'Manage platform settings',
                'grants'     => ['super_admin' => true, 'agency_admin' => false, 'agent' => false, 'landlord' => false, 'tenant' => false, 'contractor' => false],
            ],
            [
                'permission' => 'Suspend any user account',
                'grants'     => ['super_admin' => true, 'agency_admin' => false, 'agent' => false, 'landlord' => false, 'tenant' => false, 'contractor' => false],
            ],
        ];
    }

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        return Inertia::render('Admin/Roles', [
            'counts'     => $this->sidebarCounts(),
            'roles'      => self::ROLES,
            'role_labels'=> [
                'super_admin'  => 'Super Admin',
                'agency_admin' => 'Agency Admin',
                'agent'        => 'Agent',
                'landlord'     => 'Landlord',
                'tenant'       => 'Tenant',
                'contractor'   => 'Contractor',
            ],
            'matrix'     => $this->matrix(),
        ]);
    }
}
