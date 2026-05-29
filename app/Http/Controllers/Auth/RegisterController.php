<?php

namespace App\Http\Controllers\Auth;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Contractor;
use App\Models\Landlord;
use App\Models\User;
use App\Notifications\WelcomeUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RegisterController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Auth/Register');
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'role' => ['required', Rule::in(['agency', 'landlord', 'contractor'])],
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:180', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'terms_accepted' => ['accepted'],

            // Role-specific
            'business_name' => ['required_if:role,agency,contractor', 'nullable', 'string', 'max:160'],
            'compliance_number' => ['required_if:role,agency,contractor', 'nullable', 'string', 'max:80'],
        ]);

        $role = match ($data['role']) {
            'agency' => Role::AgencyAdmin,
            'landlord' => Role::Landlord,
            'contractor' => Role::Contractor,
        };

        $user = DB::transaction(function () use ($data, $role) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => Hash::make($data['password']),
                'role' => $role,
                'status' => UserStatus::Pending,
            ]);

            $user->assignRole($role->value);

            match ($role) {
                Role::AgencyAdmin => Agency::create([
                    'user_id' => $user->id,
                    'name' => $data['business_name'],
                    'slug' => Str::slug($data['business_name']).'-'.Str::random(6),
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'eaab_ffc_number' => $data['compliance_number'] ?? null,
                    'status' => 'pending',
                ]),
                Role::Landlord => Landlord::create([
                    'user_id' => $user->id,
                ]),
                Role::Contractor => Contractor::create([
                    'user_id' => $user->id,
                    'business_name' => $data['business_name'],
                    'cipc_number' => $data['compliance_number'] ?? null,
                    'status' => 'pending',
                ]),
            };

            return $user;
        });

        Auth::login($user);
        $request->session()->regenerate();

        // Welcome email (role-specific guidance).
        $user->notify(new WelcomeUser($user));

        return redirect()->route('dashboard');
    }
}
