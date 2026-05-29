<?php

namespace App\Http\Controllers\Agency\Concerns;

use App\Models\Agency;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

trait ResolvesAgency
{
    protected function resolveAgency(Request $request): Agency
    {
        $user = $request->user();
        $agency = Agency::where('user_id', $user->id)->first()
            ?? Agency::whereHas('agents', fn ($q) => $q->where('users.id', $user->id))->first();

        if (! $agency) {
            throw new HttpException(403, 'You are not linked to an agency.');
        }

        return $agency;
    }
}
