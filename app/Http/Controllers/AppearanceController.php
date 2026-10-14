<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Settings → Appearance, shared by every dashboard role.
 *
 * - accent: re-tints the whole dashboard (brand-* tokens swap via data-accent).
 * - logo:   replaces the Property Basket mark in the dashboard sidebar.
 *
 * Columns are written with forceFill so User::$fillable stays untouched.
 */
class AppearanceController extends Controller
{
    public const ACCENTS = ['orange', 'black', 'blue', 'green', 'purple', 'teal'];

    public function updateAccent(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'accent' => ['required', 'string', 'in:' . implode(',', self::ACCENTS)],
        ]);

        $request->user()->forceFill(['theme_accent' => $data['accent']])->save();

        return back()->with('success', 'Appearance updated.');
    }

    /**
     * Tenants and contractors can't replace the dashboard logo — tenants see
     * their landlord's / agency's branding, contractors the platform's.
     */
    public static function canUploadLogo(\App\Models\User $user): bool
    {
        return ! in_array($user->role, [\App\Enums\Role::Tenant, \App\Enums\Role::Contractor], true);
    }

    public function uploadLogo(Request $request): RedirectResponse
    {
        abort_unless(self::canUploadLogo($request->user()), 403, 'Your account type cannot change the dashboard logo.');

        // SVG deliberately excluded — served from our origin it can carry script.
        $request->validate([
            'logo' => ['required', 'file', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
        ]);

        $user = $request->user();
        $old  = $user->dashboard_logo;

        $path = $request->file('logo')->store('logos', 'public');
        $user->forceFill(['dashboard_logo' => $path])->save();

        if ($old && $old !== $path) {
            Storage::disk('public')->delete($old);
        }

        return back()->with('success', 'Logo uploaded.');
    }

    public function destroyLogo(Request $request): RedirectResponse
    {
        $user = $request->user();
        abort_unless(self::canUploadLogo($user), 403, 'Your account type cannot change the dashboard logo.');

        if ($user->dashboard_logo) {
            Storage::disk('public')->delete($user->dashboard_logo);
            $user->forceFill(['dashboard_logo' => null])->save();
        }

        return back()->with('success', 'Logo removed — the Property Basket logo is back.');
    }
}
