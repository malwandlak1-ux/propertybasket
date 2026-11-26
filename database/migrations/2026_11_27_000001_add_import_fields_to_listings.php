<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Listings imported from another CRM's export (Entegral, Prop Data, ...).
 * external_ref is that CRM's listing reference: re-importing the same file
 * updates the listing instead of creating a duplicate.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listings', function (Blueprint $t) {
            $t->string('external_ref', 100)->nullable()->after('slug');
            $t->string('import_source', 60)->nullable()->after('external_ref');
            $t->timestamp('imported_at')->nullable()->after('import_source');
            // Photo links from the export, downloaded in the background by listings:fetch-photos.
            $t->json('pending_photo_urls')->nullable()->after('gallery_images');
            $t->index(['owner_type', 'owner_id', 'external_ref'], 'listings_owner_external_ref_index');
        });
    }

    public function down(): void
    {
        Schema::table('listings', function (Blueprint $t) {
            $t->dropIndex('listings_owner_external_ref_index');
            $t->dropColumn(['external_ref', 'import_source', 'imported_at', 'pending_photo_urls']);
        });
    }
};
