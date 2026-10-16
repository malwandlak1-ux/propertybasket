<?php

namespace App\Support;

final class Phone
{
    /**
     * A South African mobile number as WhatsApp wants it: E.164 digits without
     * the plus ("27821234567"). Null for landlines (WhatsApp can't reach them)
     * and anything that isn't a valid SA number.
     */
    public static function waZa(?string $raw): ?string
    {
        $d = preg_replace('/[^\d+]/', '', (string) $raw);
        if ($d === '') {
            return null;
        }
        if (str_starts_with($d, '+')) {
            $d = substr($d, 1);
        } elseif (str_starts_with($d, '00')) {
            $d = substr($d, 2);
        } elseif (str_starts_with($d, '0')) {
            $d = '27' . substr($d, 1);
        }

        return preg_match('/^27[678]\d{8}$/', $d) ? $d : null;
    }

    /** "27821234567" → "082 123 4567" for display. */
    public static function local(string $wa): string
    {
        return str_starts_with($wa, '27') && strlen($wa) === 11
            ? '0' . substr($wa, 2, 2) . ' ' . substr($wa, 4, 3) . ' ' . substr($wa, 7)
            : '+' . $wa;
    }
}
