<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\PlatformSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class RolesController extends Controller
{
    use EnsuresSuperAdmin;

    private const SETTING_KEY = 'role_matrix';

    /** Core roles bound to the PHP Role enum — these cannot be renamed or removed. */
    private const CORE_ROLES = ['super_admin', 'agency_admin', 'agent', 'landlord', 'tenant', 'contractor'];

    private const CORE_ROLE_LABELS = [
        'super_admin'  => 'Super Admin',
        'agency_admin' => 'Agency Admin',
        'agent'        => 'Agent',
        'landlord'     => 'Landlord',
        'tenant'       => 'Tenant',
        'contractor'   => 'Contractor',
    ];

    /**
     * Default matrix. Used as the seed and what Reset restores.
     */
    private function defaultMatrix(): array
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

    /**
     * Default role list (core roles only — no custom roles in the seed).
     */
    private function defaultRoles(): array
    {
        return self::CORE_ROLES;
    }

    private function defaultRoleLabels(): array
    {
        return self::CORE_ROLE_LABELS;
    }

    /**
     * Pull the stored matrix payload from the settings table, falling back to
     * the hardcoded defaults when nothing has been saved yet.
     */
    private function loadPayload(): array
    {
        $stored = PlatformSetting::get(self::SETTING_KEY);

        if (! is_array($stored)) {
            return [
                'roles'       => $this->defaultRoles(),
                'role_labels' => $this->defaultRoleLabels(),
                'matrix'      => $this->defaultMatrix(),
            ];
        }

        // Be defensive about the shape — always merge missing pieces from defaults.
        return [
            'roles'       => $stored['roles']       ?? $this->defaultRoles(),
            'role_labels' => array_merge($this->defaultRoleLabels(), $stored['role_labels'] ?? []),
            'matrix'      => $stored['matrix']      ?? $this->defaultMatrix(),
        ];
    }

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        $payload = $this->loadPayload();

        return Inertia::render('Admin/Roles', [
            'counts'      => $this->sidebarCounts(),
            'roles'       => $payload['roles'],
            'role_labels' => $payload['role_labels'],
            'matrix'      => $payload['matrix'],
            'core_roles'  => self::CORE_ROLES,
            'has_overrides' => PlatformSetting::where('key', self::SETTING_KEY)->exists(),
        ]);
    }

    public function save(Request $request): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        $validated = $request->validate([
            'roles'                  => 'required|array|min:1',
            'roles.*'                => 'required|string|max:64',
            'role_labels'            => 'required|array',
            'matrix'                 => 'required|array',
            'matrix.*.permission'    => 'required|string|max:120',
            'matrix.*.grants'        => 'required|array',
        ]);

        // Normalize: ensure core roles + super_admin row are always granted true.
        $normalizedMatrix = collect($validated['matrix'])->map(function ($row) use ($validated) {
            $grants = [];
            foreach ($validated['roles'] as $role) {
                $grants[$role] = $role === 'super_admin'
                    ? true
                    : (bool) ($row['grants'][$role] ?? false);
            }
            return ['permission' => $row['permission'], 'grants' => $grants];
        })->all();

        // Ensure core role labels are always present even if the client sent partial.
        $roleLabels = array_merge(self::CORE_ROLE_LABELS, $validated['role_labels']);

        PlatformSetting::set(self::SETTING_KEY, [
            'roles'       => $validated['roles'],
            'role_labels' => $roleLabels,
            'matrix'      => $normalizedMatrix,
        ]);

        return back()->with('success', 'Permissions saved.');
    }

    public function reset(Request $request): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        PlatformSetting::forget(self::SETTING_KEY);

        return back()->with('success', 'Permissions reset to defaults.');
    }

    /**
     * Add a new custom role column. The role is persisted immediately so the
     * admin can keep editing before pressing Save Permissions, and the role
     * appears in the URL-survivable state.
     *
     * Note: custom roles created here are matrix-only — they do not yet grant
     * real access in the app, because route guards use the PHP Role enum.
     */
    public function createRole(Request $request): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        $validated = $request->validate([
            'label' => 'required|string|min:2|max:60',
        ]);

        $label = trim($validated['label']);
        $key = Str::slug($label, '_');

        if ($key === '' || in_array($key, self::CORE_ROLES, true)) {
            return back()->with('error', "Role key '{$key}' clashes with a core role — pick a different name.");
        }

        $payload = $this->loadPayload();

        if (in_array($key, $payload['roles'], true)) {
            return back()->with('error', "A role with key '{$key}' already exists.");
        }

        // Append the new column with all-false grants.
        $payload['roles'][] = $key;
        $payload['role_labels'][$key] = $label;
        $payload['matrix'] = collect($payload['matrix'])->map(function ($row) use ($key) {
            $row['grants'][$key] = false;
            return $row;
        })->all();

        PlatformSetting::set(self::SETTING_KEY, $payload);

        return back()->with('success', "Role '{$label}' added. Toggle permissions and press Save.");
    }

    /**
     * Remove a custom role column. Core roles are protected.
     */
    public function deleteRole(Request $request, string $roleKey): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        if (in_array($roleKey, self::CORE_ROLES, true)) {
            return back()->with('error', "Core role '{$roleKey}' cannot be removed.");
        }

        $payload = $this->loadPayload();

        if (! in_array($roleKey, $payload['roles'], true)) {
            return back()->with('error', "Role '{$roleKey}' not found.");
        }

        $label = $payload['role_labels'][$roleKey] ?? $roleKey;

        $payload['roles'] = array_values(array_diff($payload['roles'], [$roleKey]));
        unset($payload['role_labels'][$roleKey]);
        $payload['matrix'] = collect($payload['matrix'])->map(function ($row) use ($roleKey) {
            unset($row['grants'][$roleKey]);
            return $row;
        })->all();

        PlatformSetting::set(self::SETTING_KEY, $payload);

        return back()->with('success', "Role '{$label}' removed.");
    }
}
