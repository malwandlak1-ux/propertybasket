<?php

namespace App\Services\ListingImport;

use App\Models\Listing;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Adds photos to an imported listing: the first becomes the cover
 * (primary_image), the rest go to the gallery. Used by the browser upload
 * (photos from the ZIP) and by listings:fetch-photos (photo links in the export).
 */
class ListingPhotoStore
{
    public const MAX_PHOTOS = 50;

    private const MAX_BYTES = 10 * 1024 * 1024;

    /** DNS lookup (host → IPs); swapped out in tests. */
    public static ?\Closure $resolver = null;

    private const TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];

    public function count(Listing $listing): int
    {
        return ($listing->primary_image ? 1 : 0) + count($listing->gallery_images ?? []);
    }

    public function addUpload(Listing $listing, UploadedFile $file): bool
    {
        if ($this->count($listing) >= self::MAX_PHOTOS) {
            return false;
        }
        $path = $file->store("listings/{$listing->id}", 'public');

        return $this->attach($listing, Storage::url($path));
    }

    /** Download one photo link. Refuses non-images, oversized files and private/internal addresses. */
    public function addFromUrl(Listing $listing, string $url): bool
    {
        if ($this->count($listing) >= self::MAX_PHOTOS) {
            return false;
        }
        // Follow redirects by hand so every hop is checked against private addresses.
        $res = null;
        for ($hop = 0; $hop < 4; $hop++) {
            if (! self::isPublicUrl($url)) {
                return false;
            }
            $res = Http::timeout(20)->connectTimeout(8)->withOptions(['allow_redirects' => false])
                ->withUserAgent('PropertyBasket-ListingImport/1.0')->get($url);
            if (! in_array($res->status(), [301, 302, 303, 307, 308], true)) {
                break;
            }
            $next = (string) $res->header('Location');
            if ($next === '') {
                return false;
            }
            $url = str_starts_with($next, '/') ? preg_replace('#^(https?://[^/]+).*$#i', '$1', $url) . $next : $next;
        }
        if (! $res || ! $res->successful()) {
            return false;
        }
        $mime = strtolower(trim(explode(';', (string) $res->header('Content-Type'))[0]));
        $body = $res->body();
        if (! isset(self::TYPES[$mime]) || $body === '' || strlen($body) > self::MAX_BYTES || @getimagesizefromstring($body) === false) {
            return false;
        }
        $path = "listings/{$listing->id}/" . Str::random(40) . '.' . self::TYPES[$mime];
        Storage::disk('public')->put($path, $body);

        return $this->attach($listing, Storage::url($path));
    }

    private function attach(Listing $listing, string $url): bool
    {
        if (! $listing->primary_image) {
            $listing->primary_image = $url;
        } else {
            $listing->gallery_images = array_values(array_merge($listing->gallery_images ?? [], [$url]));
        }
        $listing->save();

        return true;
    }

    /** http(s) to a public host only — never localhost, private ranges or cloud metadata. */
    public static function isPublicUrl(string $url): bool
    {
        $parts = parse_url($url);
        if (! $parts || ! in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) || empty($parts['host'])) {
            return false;
        }
        $host = trim($parts['host'], '[]');
        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : ((self::$resolver ?? fn ($h) => gethostbynamel($h) ?: [])($host));
        if (! $ips) {
            return false;
        }
        foreach ($ips as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return false;
            }
        }

        return true;
    }
}
