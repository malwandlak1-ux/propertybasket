<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Contractor\Concerns\ResolvesContractor;
use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
use App\Http\Controllers\Tenant\Concerns\ResolvesTenant;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Help & Support pages: how-to guides per role (content lives in resources/js/help). */
class HelpController extends Controller
{
    use ResolvesContractor, ResolvesLandlord, ResolvesTenant;

    public function landlord(Request $request): Response
    {
        $this->resolveLandlord($request);

        return Inertia::render('Landlord/Help', ['support_email' => self::supportEmail()]);
    }

    public function contractor(Request $request): Response
    {
        $this->resolveContractor($request);

        return Inertia::render('Contractor/Help', ['support_email' => self::supportEmail()]);
    }

    public function tenant(Request $request): Response
    {
        $lease = $this->resolveLease($request);

        return Inertia::render('Tenant/Help', [
            'lease'      => ['address' => trim($lease->listing?->address ?? $lease->listing?->title ?? '')],
            'managed_by' => $lease->agency?->name ?? $lease->landlord?->name,
        ]);
    }

    private static function supportEmail(): ?string
    {
        $email = (string) (config('edition.support_email') ?: config('mail.from.address'));

        // Never send people to an address nobody reads.
        if (preg_match('/^(no-?reply|do-?not-?reply)@/i', $email)) {
            return null;
        }

        return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
    }
}
