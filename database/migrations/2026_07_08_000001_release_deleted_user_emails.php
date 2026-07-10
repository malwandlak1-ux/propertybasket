<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Free up the email (and invite_token) of every already soft-deleted user
     * so those addresses can be re-registered. New deletes handle this inline
     * in Admin\UsersController::destroy(); this back-fills the existing rows.
     */
    public function up(): void
    {
        $trashed = DB::table('users')->whereNotNull('deleted_at')->get(['id', 'email']);

        foreach ($trashed as $u) {
            $released = User::releasedEmail($u->id, (string) $u->email);
            if ($released !== $u->email) {
                DB::table('users')->where('id', $u->id)->update([
                    'email'        => $released,
                    'invite_token' => null,
                ]);
            }
        }
    }

    public function down(): void
    {
        // Irreversible: the original addresses are intentionally released.
    }
};
