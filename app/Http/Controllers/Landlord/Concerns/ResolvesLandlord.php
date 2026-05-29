<?php

namespace App\Http\Controllers\Landlord\Concerns;

use App\Models\Landlord;
use Illuminate\Http\Request;

trait ResolvesLandlord
{
    /**
     * Resolve the Landlord record for the currently authenticated user.
     * Aborts 403 if the user has no landlord profile.
     */
    protected function resolveLandlord(Request $request): Landlord
    {
        $landlord = Landlord::where('user_id', $request->user()->id)
            ->with(['user', 'listings'])
            ->first();

        if (! $landlord) {
            abort(403, 'No landlord profile is linked to your account.');
        }

        return $landlord;
    }
}
