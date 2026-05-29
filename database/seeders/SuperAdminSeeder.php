<?php

namespace Database\Seeders;

use App\Enums\Role as RoleEnum;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::updateOrCreate(
            ['email' => 'admin@propertybasket.local'],
            [
                'name' => 'Property Basket Admin',
                'password' => Hash::make('password'),
                'role' => RoleEnum::SuperAdmin,
                'status' => UserStatus::Active,
                'email_verified_at' => now(),
            ]
        );

        $user->syncRoles([RoleEnum::SuperAdmin->value]);
    }
}
