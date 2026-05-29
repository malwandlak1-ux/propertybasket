<?php

namespace App\Http\Controllers\Contractor\Concerns;

use App\Models\Contractor;
use Illuminate\Http\Request;

trait ResolvesContractor
{
    /**
     * Resolve the Contractor record for the currently authenticated user.
     * Aborts 403 if the user has no contractor profile.
     */
    protected function resolveContractor(Request $request): Contractor
    {
        $contractor = Contractor::where('user_id', $request->user()->id)
            ->with('user')
            ->first();

        if (! $contractor) {
            abort(403, 'No contractor profile is linked to your account.');
        }

        return $contractor;
    }

    /**
     * Sidebar badge counts (open requests, active jobs, unread messages).
     */
    protected function sidebarCounts(Contractor $contractor): array
    {
        $userId = $contractor->user_id;

        return [
            // "To Commence" — assigned but not yet started
            'requests' => \App\Models\MaintenanceRequest::where('assigned_to', $userId)
                ->where('status', 'open')
                ->count(),
            // In progress + completed (awaiting invoice payment)
            'active_jobs' => \App\Models\MaintenanceRequest::where('assigned_to', $userId)
                ->whereIn('status', ['in_progress', 'completed'])
                ->count(),
            'messages' => \App\Models\Conversation::whereJsonContains('participants', $userId)
                ->whereHas('messages', function ($q) use ($userId) {
                    $q->where('sender_id', '!=', $userId)->whereNull('read_at');
                })
                ->count(),
        ];
    }
}
