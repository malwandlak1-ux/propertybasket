<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * PUBLISHES "How Your Neighbourhood Affects Property Value & Resale"
 * (Week 8 Friday slot) dated Fri 21 Aug 2026, 07:00 SAST.
 *
 * The scheduled date is in the past, so the post goes live immediately via
 * BlogPost::published(). Idempotent; keyed on slug, date set only on insert.
 *   php artisan db:seed --class=NeighbourhoodValueBlogPostSeeder --force
 */
class NeighbourhoodValueBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('NeighbourhoodValueBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'neighbourhood-property-value-south-africa';
        $scheduledFor = Carbon::create(2026, 8, 21, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">You can renovate a kitchen, but you can't move a house. The suburb you buy into shapes your daily life <em>and</em> what your home is worth when you sell. Learning to read <strong>how a neighbourhood affects property value</strong> is the difference between a home that grows with you and one that quietly holds you back.</p>

<p>Here are the seven things to check before you commit to any area.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • <strong>Good schools</strong> underpin demand and resale — even for buyers without kids.<br>
  • <strong>Safety and security</strong> are the first thing most buyers screen for.<br>
  • <strong>Amenities and access</strong> to work, shops and transport drive desirability.<br>
  • <strong>Infrastructure and upkeep</strong> signal whether an area is rising or sliding.
</blockquote>

<h2>1. Schools</h2>
<p>Proximity to good schools is one of the most durable drivers of property value. Family buyers pay for catchment areas, and that demand supports prices and resale even when you don't have children yourself. A strong school nearby is a value anchor.</p>

<h2>2. Safety and security</h2>
<p>For most South African buyers, safety is the first filter. Low crime, an active neighbourhood watch, and visible security infrastructure lift demand and value; a reputation for crime does the opposite, fast. It's worth checking crime stats and talking to residents, not just the agent.</p>

<h2>3. Amenities and convenience</h2>
<p>Shops, restaurants, medical care, gyms and green space make an area livable — and desirable. The closer and better the amenities, the deeper the buyer pool when you sell. Walkability and lifestyle increasingly command a premium.</p>

<img src="https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80" alt="A South African suburb whose schools, security and amenities shape property value in 2026" style="width:100%;border-radius:12px;" />

<h2>4. Access and transport</h2>
<p>How easily can you reach work, major routes and public transport? Commute time is a daily tax, and buyers price it in. Good access to economic hubs — a key driver behind <a href="/advice/reverse-semigration-gauteng-2026">the return to Gauteng</a> — widens demand and protects value.</p>

<h2>5. Infrastructure and municipal upkeep</h2>
<p>Reliable water, electricity, working streetlights and maintained roads signal a well-run area on the up. Potholes, failing infrastructure and neglect signal the opposite. The state of the public realm is a leading indicator of where prices are heading.</p>

<h2>6. Development and zoning</h2>
<p>What's planned nearby can lift your value — or dent it. A new shopping centre or upgraded road can be a boost; unwanted high-density development or industrial rezoning can weigh on prices. Check the municipality's plans before you buy.</p>

<h2>7. The trajectory of the area</h2>
<p>Is the suburb improving or sliding? New businesses opening, homes being renovated and young families moving in point up; boarded shops and long-stale listings point down. You're not just buying a house — you're buying into a direction of travel.</p>

<blockquote>
  <strong>Buying soon?</strong> <a href="/properties">Explore listings by area on Property Basket</a> and read the suburb before you commit.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>How does a neighbourhood affect property value?</h3>
<p>Schools, safety, amenities, transport access, infrastructure, planned development and the area's overall trajectory all shape demand — and demand sets value and resale. A great house in a declining area underperforms a good house in a rising one.</p>

<h3>What should I check before buying in an area?</h3>
<p>Check the schools, crime and security, nearby amenities, commute and transport access, the state of municipal infrastructure, any planned developments or rezoning, and whether the suburb is improving or declining.</p>

<h3>Do good schools really raise house prices?</h3>
<p>Yes. Proximity to sought-after schools is a durable driver of demand and value, because family buyers pay a premium for catchment areas — which supports resale even for buyers without school-age children.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute property or financial advice. Confirm area-specific facts — crime stats, school catchments, municipal plans — with the relevant authorities before acting.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'How Your Neighbourhood Affects Property Value & Resale';
        $post->excerpt     = 'You can renovate a kitchen, but you can\'t move a house. The seven things — schools, safety, amenities, access, infrastructure and more — to check about a suburb before you commit, and how each shapes resale.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Buyers', 'Market', 'Value'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("NeighbourhoodValueBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
