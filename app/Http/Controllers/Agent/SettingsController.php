<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    use ResolvesAgent;

    /**
     * Notification toggles surfaced on the Settings page. Storing only the
     * channels the agent cares about lets us extend later without migrations.
     */
    public const NOTIFICATION_CHANNELS = [
        'new_lead'           => 'New lead assigned',
        'viewing_scheduled'  => 'New viewing scheduled',
        'commission_payout'  => 'Commission payout processed',
        'ffc_expiring'       => 'FFC expiring within 30 days',
        'maintenance_update' => 'Maintenance request updates',
    ];

    public function index(Request $request): Response
    {
        $user  = $request->user();
        $pivot = $this->resolveAgentRecord($request);

        return Inertia::render('Agent/Settings', [
            'agent' => ['id' => $user->id, 'name' => $user->name, 'agency_name' => $pivot->agency->name],
            'profile' => [
                'name'   => $user->name,
                'email'  => $user->email,
                'phone'  => $user->phone,
                'avatar' => $user->avatar,
            ],
            'notifications' => [
                'channels' => self::NOTIFICATION_CHANNELS,
                'values'   => $this->resolveNotificationPrefs($user->notification_preferences),
            ],
            'banking' => [
                'bank_account_holder'      => $user->bank_account_holder,
                'bank_account_number'      => $user->bank_account_number,
                'bank_code'                => $user->bank_code,
                'paystack_recipient_code'  => $user->paystack_recipient_code,
            ],
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name'   => ['required', 'string', 'max:120'],
            'email'  => ['required', 'email', 'max:180', Rule::unique('users', 'email')->ignore($user->id)],
            'phone'  => ['nullable', 'string', 'max:30'],
            'avatar' => ['nullable', 'image', 'max:5120'],
        ]);

        $updates = [
            'name'  => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
        ];

        if ($request->hasFile('avatar')) {
            if ($user->avatar && str_starts_with($user->avatar, '/storage/')) {
                Storage::disk('public')->delete(str_replace('/storage/', '', $user->avatar));
            }
            $updates['avatar'] = Storage::url(
                $request->file('avatar')->store("avatars/user-{$user->id}", 'public'),
            );
        }

        $user->update($updates);

        return redirect()
            ->route('agent.settings.index')
            ->with('success', 'Profile updated.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password'         => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            return back()->withErrors(['current_password' => 'Current password is incorrect.']);
        }

        $user->update(['password' => Hash::make($data['password'])]);

        return redirect()
            ->route('agent.settings.index')
            ->with('success', 'Password updated.');
    }

    public function updateNotifications(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'channels'   => ['nullable', 'array'],
            'channels.*' => ['boolean'],
        ]);

        $valid = array_keys(self::NOTIFICATION_CHANNELS);
        $prefs = [];
        foreach ($valid as $key) {
            $prefs[$key] = (bool) ($data['channels'][$key] ?? false);
        }

        $user->update(['notification_preferences' => $prefs]);

        return redirect()
            ->route('agent.settings.index')
            ->with('success', 'Notification preferences saved.');
    }

    public function updateBanking(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'bank_account_holder' => ['required', 'string', 'max:120'],
            'bank_account_number' => ['required', 'string', 'max:32'],
            'bank_code'           => ['required', 'string', 'max:16'],
        ]);

        $user->update($data);

        return redirect()
            ->route('agent.settings.index')
            ->with('success', 'Banking details saved. Commission payouts will route here.');
    }

    /**
     * Defaults: opt the agent in to everything unless they've explicitly opted out.
     */
    private function resolveNotificationPrefs(?array $stored): array
    {
        $stored ??= [];
        $out = [];
        foreach (array_keys(self::NOTIFICATION_CHANNELS) as $key) {
            $out[$key] = (bool) ($stored[$key] ?? true);
        }
        return $out;
    }
}
