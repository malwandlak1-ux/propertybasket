<?php

namespace App\Http\Controllers\Agent\Concerns;

use App\Models\AgencyAgent;
use Illuminate\Http\Request;

trait ResolvesAgent
{
    protected function resolveAgentRecord(Request $request): AgencyAgent
    {
        $user = $request->user();

        $record = AgencyAgent::where('user_id', $user->id)
            ->with('agency')
            ->first();

        if (! $record) {
            abort(403, 'You are not linked to an agency.');
        }

        return $record;
    }
}
