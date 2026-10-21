<?php

namespace App\Services\WhatsApp;

use App\Models\WhatsAppAccount;
use Carbon\CarbonImmutable;

/**
 * When business-initiated (campaign) WhatsApp messages may go out.
 *
 * The platform schedule (config whatsapp.schedule) follows the Consumer
 * Protection Act direct-marketing regulations: weekdays 08:00–20:00,
 * Saturdays 09:00–13:00, never on Sundays or South African public holidays.
 * An agent can narrow it on their own number (send_from / send_until /
 * send_saturdays) but never widen it. Replies inside the 24h window are not
 * direct marketing and aren't gated by this.
 */
class SendSchedule
{
    private const TZ = 'Africa/Johannesburg';

    /** The [from, until] window for that day, or null when nothing may be sent. */
    public static function windowFor(?WhatsAppAccount $account, CarbonImmutable $day): ?array
    {
        $day = $day->setTimezone(self::TZ);
        $cfg = config('whatsapp.schedule');

        if (! ($cfg['public_holidays'] ?? false) && self::publicHoliday($day)) {
            return null;
        }
        $legal = match ((int) $day->isoWeekday()) {
            6       => $cfg['saturday'] ?? null,
            7       => $cfg['sunday'] ?? null,
            default => $cfg['weekdays'] ?? null,
        };
        if (! $legal) {
            return null;
        }
        if ($account && $day->isoWeekday() === 6 && $account->send_saturdays === false) {
            return null;
        }

        return self::dayRule($account, $legal);
    }

    public static function isOpen(?WhatsAppAccount $account, ?CarbonImmutable $at = null): bool
    {
        $at = ($at ?? CarbonImmutable::now())->setTimezone(self::TZ);
        $w = self::windowFor($account, $at);
        $t = $at->format('H:i');

        return $w !== null && $t >= $w[0] && $t < $w[1];
    }

    /** The next moment sending is allowed (now if already open), or null if never within two weeks. */
    public static function nextOpen(?WhatsAppAccount $account, ?CarbonImmutable $at = null): ?CarbonImmutable
    {
        $at = ($at ?? CarbonImmutable::now())->setTimezone(self::TZ);
        if (self::isOpen($account, $at)) {
            return $at;
        }
        for ($i = 0; $i <= 14; $i++) {
            $day = $at->addDays($i)->startOfDay();
            $w = self::windowFor($account, $day);
            if (! $w) {
                continue;
            }
            $start = $day->setTimeFromTimeString($w[0]);
            if ($start->greaterThan($at)) {
                return $start;
            }
        }

        return null;
    }

    /** e.g. "today at 08:00", "tomorrow at 09:00", "Mon 27 Oct at 08:00". */
    public static function label(?CarbonImmutable $when): string
    {
        if (! $when) {
            return 'when your sending hours allow';
        }
        $now = CarbonImmutable::now(self::TZ);
        $day = match (true) {
            $when->isSameDay($now)          => 'today',
            $when->isSameDay($now->addDay()) => 'tomorrow',
            default                          => $when->format('D j M'),
        };

        return "{$day} at " . $when->format('H:i');
    }

    /** Sending hours for display: one line per day group plus the next open slot. */
    public static function describe(?WhatsAppAccount $account): array
    {
        $line = fn (?array $w) => $w ? "{$w[0]}–{$w[1]}" : 'No sending';
        $cfg = config('whatsapp.schedule');

        return [
            'weekdays'  => $line(self::dayRule($account, $cfg['weekdays'] ?? null)),
            'saturday'  => $line($account && $account->send_saturdays === false ? null : self::dayRule($account, $cfg['saturday'] ?? null)),
            'sunday'    => $line(self::dayRule($account, $cfg['sunday'] ?? null)),
            'holidays'  => ($cfg['public_holidays'] ?? false) ? 'Allowed' : 'No sending',
            'next_open' => self::label(self::nextOpen($account)),
            'open_now'  => self::isOpen($account),
        ];
    }

    private static function dayRule(?WhatsAppAccount $account, ?array $legal): ?array
    {
        if (! $legal) {
            return null;
        }
        $from = max($legal[0], $account?->send_from ?: '00:00');
        $until = min($legal[1], $account?->send_until ?: '24:00');

        return $from < $until ? [$from, $until] : null;
    }

    /** South African public holiday name for that date (Public Holidays Act, incl. the Sunday→Monday rule). */
    public static function publicHoliday(CarbonImmutable $day): ?string
    {
        $y = (int) $day->year;
        $fixed = [
            '01-01' => "New Year's Day", '03-21' => 'Human Rights Day', '04-27' => 'Freedom Day',
            '05-01' => "Workers' Day", '06-16' => 'Youth Day', '08-09' => "National Women's Day",
            '09-24' => 'Heritage Day', '12-16' => 'Day of Reconciliation', '12-25' => 'Christmas Day',
            '12-26' => 'Day of Goodwill',
        ];
        $holidays = [];
        foreach ($fixed as $md => $name) {
            $d = CarbonImmutable::parse("{$y}-{$md}", self::TZ);
            $holidays[$d->toDateString()] = $name;
            if ($d->isoWeekday() === 7) {
                $holidays[$d->addDay()->toDateString()] ??= "{$name} (observed)";
            }
        }
        $easter = self::easterSunday($y);
        $holidays[$easter->subDays(2)->toDateString()] = 'Good Friday';
        $holidays[$easter->addDay()->toDateString()] = 'Family Day';

        return $holidays[$day->setTimezone(self::TZ)->toDateString()] ?? null;
    }

    /** Gregorian Easter Sunday (anonymous algorithm — no ext-calendar needed). */
    private static function easterSunday(int $y): CarbonImmutable
    {
        $a = $y % 19; $b = intdiv($y, 100); $c = $y % 100; $d = intdiv($b, 4); $e = $b % 4;
        $f = intdiv($b + 8, 25); $g = intdiv($b - $f + 1, 3); $h = (19 * $a + $b - $d - $g + 15) % 30;
        $i = intdiv($c, 4); $k = $c % 4; $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
        $m = intdiv($a + 11 * $h + 22 * $l, 451);
        $month = intdiv($h + $l - 7 * $m + 114, 31);
        $dayOfMonth = (($h + $l - 7 * $m + 114) % 31) + 1;

        return CarbonImmutable::create($y, $month, $dayOfMonth, 0, 0, 0, self::TZ);
    }
}
