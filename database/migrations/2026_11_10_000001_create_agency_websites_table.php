<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agency websites — one generated site per agency, served on
 * {subdomain}.{SITES_BASE_DOMAIN} and optionally a custom domain.
 * Listings are NOT copied here: the site reads the shared listings table
 * through Listing::publiclyVisible(), so sold/leased listings disappear
 * from the main portal and the agency site at the same time.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agency_websites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('subdomain', 63)->unique();
            $table->string('custom_domain', 253)->nullable()->unique();
            $table->string('domain_status', 16)->default('none'); // none|pending|verified|live
            $table->timestamp('domain_verified_at')->nullable();
            $table->string('template', 16)->default('portal');   // portal|minimal
            $table->string('status', 16)->default('draft');       // draft|published
            $table->string('primary_color', 7)->nullable();
            $table->string('accent_color', 7)->nullable();
            $table->string('hero_image')->nullable();
            $table->string('hero_heading', 160)->nullable();
            $table->string('tagline', 200)->nullable();
            $table->text('about')->nullable();
            $table->json('social_links')->nullable();
            $table->string('seo_title', 70)->nullable();
            $table->string('seo_description', 170)->nullable();
            $table->boolean('show_agents')->default(true);
            $table->string('analytics_id', 40)->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        Schema::table('agency_agents', function (Blueprint $table) {
            $table->string('public_slug', 120)->nullable()->after('user_id');
            $table->text('bio')->nullable()->after('public_slug');
            $table->boolean('show_on_website')->default(true)->after('bio');
            $table->unique(['agency_id', 'public_slug']);
        });

        Schema::table('inquiries', function (Blueprint $table) {
            $table->foreignId('agency_website_id')->nullable()->after('source')
                ->constrained('agency_websites')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inquiries', function (Blueprint $table) {
            $table->dropConstrainedForeignId('agency_website_id');
        });
        Schema::table('agency_agents', function (Blueprint $table) {
            $table->dropUnique(['agency_id', 'public_slug']);
            $table->dropColumn(['public_slug', 'bio', 'show_on_website']);
        });
        Schema::dropIfExists('agency_websites');
    }
};
