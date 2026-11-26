<?php

namespace App\Console\Commands;

use App\Models\Listing;
use App\Services\ListingImport\ListingPhotoStore;
use Illuminate\Console\Command;

/**
 * Downloads the photo links that came with imported listings, a few at a
 * time, so a big import never blocks a web request. Links that fail are
 * dropped (the agency can add photos by hand).
 */
class FetchListingPhotos extends Command
{
    protected $signature = 'listings:fetch-photos {--limit=30 : Max photos this run}';

    protected $description = 'Download photo links from imported listings';

    public function handle(ListingPhotoStore $photos): int
    {
        $budget = max(1, (int) $this->option('limit'));
        $saved = 0;
        $failed = 0;

        Listing::whereNotNull('pending_photo_urls')->orderBy('imported_at')->limit(50)->get()
            ->each(function (Listing $listing) use ($photos, &$budget, &$saved, &$failed) {
                $queue = $listing->pending_photo_urls ?? [];
                while ($budget > 0 && $queue) {
                    $url = array_shift($queue);
                    $budget--;
                    try {
                        $photos->addFromUrl($listing, $url) ? $saved++ : $failed++;
                    } catch (\Throwable $e) {
                        $failed++;
                    }
                    $listing->forceFill(['pending_photo_urls' => $queue ?: null])->save();
                }

                return $budget > 0;
            });

        $this->info("{$saved} listing photos saved, {$failed} skipped.");

        return self::SUCCESS;
    }
}
