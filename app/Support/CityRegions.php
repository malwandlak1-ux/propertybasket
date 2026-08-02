<?php

namespace App\Support;

/**
 * Metro grouping for the public site.
 *
 * Several distinct municipal "cities" in Gauteng belong to the same metro in
 * the way buyers think about them. This maps a region label -> the member
 * cities that roll up into it, so the Explore Cities tiles and the
 * /properties city filter can present (and search) a single metro.
 *
 * Listings keep their real `city` value in the DB (e.g. "Boksburg"); the
 * grouping happens only at read time here.
 */
class CityRegions
{
    /** Region label => member cities that roll up into it. */
    public const REGIONS = [
        'Johannesburg' => [
            'Johannesburg', 'Midrand', 'Sandton', 'Randburg', 'Roodepoort', 'Soweto',
            'Boksburg', 'Benoni', 'Germiston', 'Kempton Park', 'Springs', 'Brakpan',
            'Alberton', 'Edenvale', 'Krugersdorp', 'Randfontein',
        ],
        'Pretoria' => [
            'Pretoria', 'Centurion', 'Akasia',
        ],
    ];

    /**
     * The region label a given city rolls up into.
     * Returns the city unchanged if it isn't a member of any region.
     */
    public static function regionFor(string $city): string
    {
        foreach (self::REGIONS as $region => $members) {
            foreach ($members as $member) {
                if (strcasecmp($member, $city) === 0) {
                    return $region;
                }
            }
        }

        return $city;
    }

    /**
     * The member cities for a region label.
     * Returns [$value] when the value is not a known region label, so callers
     * can treat plain cities and regions uniformly.
     */
    public static function membersOf(string $value): array
    {
        foreach (self::REGIONS as $region => $members) {
            if (strcasecmp($region, $value) === 0) {
                return $members;
            }
        }

        return [$value];
    }
}
