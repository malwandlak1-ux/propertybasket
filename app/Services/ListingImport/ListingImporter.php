<?php

namespace App\Services\ListingImport;

use App\Models\Agency;
use App\Models\Listing;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Imports listings from another CRM's export (Entegral, Prop Data, a
 * spreadsheet...). The browser reads the file and maps its columns onto
 * Property Basket's fields; this class cleans each value up and creates or
 * updates the agency's listing.
 *
 * - A row is matched to an existing listing by the CRM's reference
 *   (external_ref), else by address + listing type, so importing the same
 *   file twice updates instead of duplicating.
 * - New listings that are on the market arrive as drafts unless the agency
 *   chose to publish straight away; sold / let / withdrawn ones keep that
 *   status (and so never show publicly).
 * - Photo links in the export are queued for listings:fetch-photos.
 */
class ListingImporter
{
    public const FIELDS = [
        'external_ref', 'title', 'listing_type', 'property_type', 'status', 'price', 'description',
        'address', 'suburb', 'city', 'province', 'postal_code', 'bedrooms', 'bathrooms', 'area_sqm',
        'latitude', 'longitude', 'agent_email', 'features', 'photo_urls',
    ];

    public const PROVINCES = [
        'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State',
        'Mpumalanga', 'Limpopo', 'North West', 'Northern Cape',
    ];

    private const MAX_PHOTO_URLS = 50;

    /**
     * @param  array<int, array<string, mixed>>  $rows  mapped rows (keys from FIELDS)
     * @param  array{default_listing_type?: string, default_agent_id?: int|null, publish?: bool, source?: string}  $options
     * @return array<int, array{row: int, id: int|null, action: string, error: string|null, title?: string, needs_photos?: bool, external_ref?: string|null}>
     */
    public function import(Agency $agency, array $rows, array $options = []): array
    {
        $agents = $agency->agents()->wherePivot('status', 'active')->get(['users.id', 'users.email'])
            ->mapWithKeys(fn ($u) => [mb_strtolower(trim($u->email)) => $u->id]);
        $defaultAgent = ($options['default_agent_id'] ?? null) && $agents->contains((int) $options['default_agent_id'])
            ? (int) $options['default_agent_id'] : null;
        $defaultType = in_array($options['default_listing_type'] ?? null, ['for_sale', 'long_term_rent'], true)
            ? $options['default_listing_type'] : 'for_sale';
        $publish = (bool) ($options['publish'] ?? false);
        $source = Str::limit(trim((string) ($options['source'] ?? 'spreadsheet')), 60, '') ?: 'spreadsheet';

        $results = [];
        foreach ($rows as $i => $raw) {
            $rowNo = (int) ($raw['_row'] ?? $i + 1);
            try {
                $results[] = ['row' => $rowNo] + $this->importRow($agency, $raw, $agents->all(), $defaultAgent, $defaultType, $publish, $source);
            } catch (\Throwable $e) {
                report($e);
                $results[] = ['row' => $rowNo, 'id' => null, 'action' => 'failed', 'error' => 'Could not save this row.'];
            }
        }

        return $results;
    }

    private function importRow(Agency $agency, array $raw, array $agents, ?int $defaultAgent, string $defaultType, bool $publish, string $source): array
    {
        $ref = $this->text($raw['external_ref'] ?? null, 100);
        $type = self::listingType($raw['listing_type'] ?? null) ?? $defaultType;
        $price = self::money($raw['price'] ?? null);
        $address = $this->text($raw['address'] ?? null, 255);
        $suburb = $this->text($raw['suburb'] ?? null, 120);
        $propertyType = self::propertyType($raw['property_type'] ?? null);
        $bedrooms = self::int($raw['bedrooms'] ?? null, 50);
        $title = $this->text($raw['title'] ?? null, 200)
            ?: self::autoTitle($bedrooms, $propertyType, $suburb ?: $this->text($raw['city'] ?? null, 120), $type);

        if (! $ref && ! $address && ! $this->text($raw['title'] ?? null, 200)) {
            return ['id' => null, 'action' => 'skipped', 'error' => 'No reference, title or address.'];
        }
        if ($price === null) {
            return ['id' => null, 'action' => 'skipped', 'error' => 'No price.', 'title' => $title];
        }

        $email = mb_strtolower(trim((string) ($raw['agent_email'] ?? '')));
        $agentId = ($email !== '' ? ($agents[$email] ?? null) : null) ?? $defaultAgent;

        $fields = array_filter([
            'title'         => $title,
            'description'   => $this->text($raw['description'] ?? null, 5000),
            'listing_type'  => $type,
            'property_type' => $propertyType,
            'sale_price'    => $type === 'for_sale' ? $price : null,
            'monthly_rent'  => $type === 'long_term_rent' ? $price : null,
            'address'       => $address,
            'suburb'        => $suburb,
            'city'          => $this->text($raw['city'] ?? null, 120),
            'province'      => self::province($raw['province'] ?? null),
            'postal_code'   => $this->text($raw['postal_code'] ?? null, 12),
            'bedrooms'      => $bedrooms,
            'bathrooms'     => self::decimal($raw['bathrooms'] ?? null, 50),
            'area_sqm'      => self::decimal($raw['area_sqm'] ?? null, 10_000_000),
            'latitude'      => self::coordinate($raw['latitude'] ?? null, 90),
            'longitude'     => self::coordinate($raw['longitude'] ?? null, 180),
            'amenities'     => self::features($raw['features'] ?? null),
            'agent_id'      => $agentId,
        ], fn ($v) => $v !== null && $v !== []);
        // Keep the price columns consistent with the type even when one is null.
        $fields['sale_price'] = $type === 'for_sale' ? $price : null;
        $fields['monthly_rent'] = $type === 'long_term_rent' ? $price : null;

        $crmStatus = self::status($raw['status'] ?? null); // available|sold|leased|archived|null
        $urls = self::photoUrls($raw['photo_urls'] ?? null);

        return DB::transaction(function () use ($agency, $ref, $address, $type, $fields, $crmStatus, $publish, $source, $urls) {
            $existing = $this->match($agency, $ref, $address, $type);

            if ($existing) {
                $existing->fill($fields);
                // The CRM says it sold / let / was withdrawn: follow it. Otherwise leave our status alone.
                if (in_array($crmStatus, ['sold', 'leased', 'archived'], true)) {
                    $existing->status = $crmStatus;
                }
                $existing->forceFill(['external_ref' => $ref ?? $existing->external_ref, 'imported_at' => now()]);
                $needsPhotos = ! $existing->primary_image;
                if ($needsPhotos && $urls) {
                    $existing->pending_photo_urls = $urls;
                }
                $existing->save();

                return ['id' => $existing->id, 'action' => 'updated', 'error' => null, 'title' => $existing->title,
                    'needs_photos' => $needsPhotos, 'external_ref' => $existing->external_ref];
            }

            $status = match ($crmStatus) {
                'sold', 'leased', 'archived' => $crmStatus,
                default => $publish ? 'available' : 'draft',
            };
            $listing = Listing::create($fields + [
                'ulid'              => (string) Str::ulid(),
                'owner_type'        => Agency::class,
                'owner_id'          => $agency->id,
                'slug'              => $this->uniqueSlug($fields['title']),
                'listing_structure' => 'single_unit',
                'status'            => $status,
                'external_ref'      => $ref,
                'import_source'     => $source,
                'imported_at'       => now(),
                'pending_photo_urls' => $urls ?: null,
            ]);

            return ['id' => $listing->id, 'action' => 'created', 'error' => null, 'title' => $listing->title,
                'needs_photos' => true, 'external_ref' => $ref];
        });
    }

    private function match(Agency $agency, ?string $ref, ?string $address, string $type): ?Listing
    {
        $q = fn () => Listing::forAgency($agency)->lockForUpdate();
        if ($ref) {
            return $q()->where('external_ref', $ref)->first();
        }
        if ($address) {
            return $q()->whereNull('external_ref')->where('listing_type', $type)
                ->whereRaw('LOWER(address) = ?', [mb_strtolower($address)])->first();
        }

        return null;
    }

    // ── Value clean-up (public + static so the tests and other importers can use them) ──

    public static function listingType(mixed $v): ?string
    {
        $s = mb_strtolower(trim((string) $v));
        if ($s === '') {
            return null;
        }
        if (preg_match('/\brent|\blet\b|\blease|rental/', $s)) {
            return 'long_term_rent';
        }
        if (preg_match('/sale|sell|buy/', $s)) {
            return 'for_sale';
        }

        return null;
    }

    public static function propertyType(mixed $v): string
    {
        $s = mb_strtolower(trim((string) $v));

        return match (true) {
            $s === '' => 'other',
            (bool) preg_match('/town ?house|cluster|simplex|duplex|semi/', $s) => 'townhouse',
            (bool) preg_match('/apartment|flat|unit|sectional|penthouse|studio|loft/', $s) => 'apartment',
            (bool) preg_match('/commercial|office|retail|industrial|warehouse|factory|shop|business/', $s) => 'commercial',
            (bool) preg_match('/land|vacant|plot|stand|erf/', $s) => 'land',
            (bool) preg_match('/house|home|freehold|residential|villa|cottage/', $s) => 'house',
            default => 'other',
        };
    }

    /** CRM status → ours; null when the row is (or says nothing but is) on the market. */
    public static function status(mixed $v): ?string
    {
        $s = mb_strtolower(trim((string) $v));

        return match (true) {
            $s === '' => null,
            (bool) preg_match('/\bsold\b|transferred|registered/', $s) => 'sold',
            (bool) preg_match('/\blet\b|rented|leased|occupied/', $s) => 'leased',
            (bool) preg_match('/withdrawn|expired|cancel|inactive|archived|off.?market|deleted/', $s) => 'archived',
            default => 'available',
        };
    }

    /** "R 1 250 000", "R1,250,000.00", "1250000", "R 8 500 pm" → float. */
    public static function money(mixed $v): ?float
    {
        if (is_int($v) || is_float($v)) {
            return $v > 0 ? (float) $v : null;
        }
        $s = preg_replace('/\s+/u', '', (string) $v);
        $s = preg_replace('/[^0-9.,]/', '', $s);
        if ($s === '') {
            return null;
        }
        // "1,250,000.50" → drop thousands commas; "1250000,50" → decimal comma.
        if (preg_match('/,\d{2}$/', $s) && ! str_contains($s, '.')) {
            $s = str_replace(',', '.', $s);
        }
        $s = str_replace(',', '', $s);
        if (substr_count($s, '.') > 1) {
            $s = str_replace('.', '', substr($s, 0, strrpos($s, '.'))) . substr($s, strrpos($s, '.'));
        }
        $n = (float) $s;

        return $n > 0 && $n < 10_000_000_000 ? round($n, 2) : null;
    }

    public static function int(mixed $v, int $max): ?int
    {
        $n = self::decimal($v, $max);

        return $n === null ? null : (int) floor($n);
    }

    public static function decimal(mixed $v, float $max): ?float
    {
        if ($v === null || $v === '') {
            return null;
        }
        $s = str_replace(',', '.', preg_replace('/[^0-9.,]/', '', (string) $v));
        if ($s === '' || ! is_numeric($s)) {
            return null;
        }
        $n = (float) $s;

        return $n >= 0 && $n <= $max ? $n : null;
    }

    public static function coordinate(mixed $v, float $limit): ?float
    {
        if ($v === null || $v === '' || ! is_numeric(trim((string) $v))) {
            return null;
        }
        $n = (float) trim((string) $v);

        return abs($n) <= $limit && $n != 0.0 ? $n : null;
    }

    public static function province(mixed $v): ?string
    {
        $s = preg_replace('/[^a-z]/', '', mb_strtolower((string) $v));
        if ($s === '') {
            return null;
        }
        $aliases = ['gp' => 'Gauteng', 'wc' => 'Western Cape', 'kzn' => 'KwaZulu-Natal', 'natal' => 'KwaZulu-Natal',
            'ec' => 'Eastern Cape', 'fs' => 'Free State', 'ofs' => 'Free State', 'mp' => 'Mpumalanga', 'lp' => 'Limpopo',
            'nw' => 'North West', 'nc' => 'Northern Cape'];
        if (isset($aliases[$s])) {
            return $aliases[$s];
        }
        foreach (self::PROVINCES as $p) {
            if (preg_replace('/[^a-z]/', '', mb_strtolower($p)) === $s) {
                return $p;
            }
        }

        return null;
    }

    /** "Pool, Garden; Garage | Borehole" → ['Pool', 'Garden', 'Garage', 'Borehole'] */
    public static function features(mixed $v): array
    {
        if (is_array($v)) {
            $parts = $v;
        } else {
            $parts = preg_split('/[,;|\n]+/', (string) $v) ?: [];
        }

        return collect($parts)->map(fn ($p) => Str::limit(trim((string) $p), 80, ''))
            ->filter(fn ($p) => $p !== '' && ! in_array(mb_strtolower($p), ['yes', 'no', 'true', 'false', '0', '1'], true))
            ->unique(fn ($p) => mb_strtolower($p))->take(40)->values()->all();
    }

    /** Photo links separated by spaces, commas, semicolons, pipes or new lines; http(s) only. */
    public static function photoUrls(mixed $v): array
    {
        $parts = is_array($v) ? $v : (preg_split('/[\s,;|]+/', (string) $v) ?: []);

        return collect($parts)->map(fn ($u) => trim((string) $u))
            ->filter(fn ($u) => preg_match('#^https?://#i', $u) && strlen($u) <= 1000 && filter_var($u, FILTER_VALIDATE_URL))
            ->unique()->take(self::MAX_PHOTO_URLS)->values()->all();
    }

    public static function autoTitle(?int $beds, string $propertyType, ?string $place, string $listingType): string
    {
        $kind = ['apartment' => 'apartment', 'house' => 'house', 'townhouse' => 'townhouse',
            'commercial' => 'commercial property', 'land' => 'vacant land', 'other' => 'property'][$propertyType];
        $t = ($beds && ! in_array($propertyType, ['land', 'commercial'], true) ? "{$beds} bedroom " : '') . $kind;
        $t .= $listingType === 'long_term_rent' ? ' to rent' : ' for sale';

        return Str::ucfirst($t . ($place ? " in {$place}" : ''));
    }

    private function text(mixed $v, int $max): ?string
    {
        $s = trim(preg_replace('/[ \t]+/u', ' ', (string) $v));

        return $s === '' ? null : Str::limit($s, $max, '');
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'listing';
        $slug = $base;
        $i = 2;
        while (Listing::withTrashed()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }
}
