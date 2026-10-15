<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A landlord's integration API key (read-only access to their financial
 * data for another system). The plain key is only returned once, on create.
 */
class ApiKey extends Model
{
    public const SCOPE_STATEMENTS = 'statements:read';

    protected $fillable = ['landlord_id', 'created_by', 'name', 'prefix', 'key_hash', 'scopes', 'last_used_at', 'last_used_ip', 'revoked_at'];

    protected $hidden = ['key_hash'];

    protected function casts(): array
    {
        return [
            'scopes'       => 'array',
            'last_used_at' => 'datetime',
            'revoked_at'   => 'datetime',
        ];
    }

    public function landlord(): BelongsTo
    {
        return $this->belongsTo(Landlord::class);
    }

    /**
     * Create a key; returns [model, plain key]. The plain key is not stored.
     *
     * @return array{0: self, 1: string}
     */
    public static function issue(Landlord $landlord, string $name, ?int $createdBy = null): array
    {
        $plain = 'pbk_' . Str::random(40);

        $key = self::create([
            'landlord_id' => $landlord->id,
            'created_by'  => $createdBy,
            'name'        => $name,
            'prefix'      => substr($plain, 0, 12),
            'key_hash'    => hash('sha256', $plain),
            'scopes'      => [self::SCOPE_STATEMENTS],
        ]);

        return [$key, $plain];
    }

    public static function findActive(string $plain): ?self
    {
        if (! str_starts_with($plain, 'pbk_')) {
            return null;
        }

        return self::where('key_hash', hash('sha256', $plain))->whereNull('revoked_at')->first();
    }

    public function can(string $scope): bool
    {
        return in_array($scope, $this->scopes ?? [], true);
    }
}
