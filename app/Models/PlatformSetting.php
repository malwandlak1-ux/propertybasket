<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlatformSetting extends Model
{
    protected $fillable = ['key', 'value'];

    protected function casts(): array
    {
        return [
            'value' => 'array',
        ];
    }

    /**
     * Fetch a setting value, falling back to $default if absent.
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        return static::where('key', $key)->first()?->value ?? $default;
    }

    /**
     * Upsert a setting value.
     */
    public static function set(string $key, mixed $value): self
    {
        return static::updateOrCreate(['key' => $key], ['value' => $value]);
    }

    /**
     * Delete a setting row (used by Reset flows).
     */
    public static function forget(string $key): void
    {
        static::where('key', $key)->delete();
    }
}
