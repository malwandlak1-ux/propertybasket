<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES "Sectional Title vs Freehold vs Cluster: Which Should You Buy?"
 * (Week 9 Monday slot) for Mon 24 Aug 2026, 07:00 SAST.
 *
 * status = published + FUTURE published_at => hidden by BlogPost::published()
 * until then, then auto-goes-live (no cron). Idempotent; keyed on slug, date
 * set only on first insert.
 *   php artisan db:seed --class=SectionalTitleVsFreeholdBlogPostSeeder --force
 */
class SectionalTitleVsFreeholdBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('SectionalTitleVsFreeholdBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'sectional-title-vs-freehold-south-africa';
        $scheduledFor = Carbon::create(2026, 8, 24, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">Two homes at the same price can come with completely different lives attached. <strong>Sectional title, freehold and cluster</strong> aren't just legal labels — they decide who fixes the roof, who sets the rules, what you pay every month, and how easily you'll sell. Getting the ownership type right for <em>you</em> matters as much as getting the house right.</p>

<p>Here's how the three compare on the things that actually affect your wallet and your weekends.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • <strong>Freehold</strong> = full control, full responsibility, no levies.<br>
  • <strong>Sectional title</strong> = shared costs and rules, less maintenance hassle, monthly levies.<br>
  • <strong>Cluster/estate</strong> = a middle path — your own stand, plus shared security and amenities.<br>
  • Match the <strong>ownership type to your lifestyle</strong>, not just the price.
</blockquote>

<h2>Freehold: you own it all</h2>
<p>With <strong>freehold</strong> (full title), you own the house and the land it sits on outright. You make the rules, you keep the garden how you like, and there are <strong>no levies</strong>. The flip side: every repair, every insurance policy and all the security are <strong>your</strong> problem and your cost. Freehold suits buyers who want control and space and don't mind the responsibility.</p>

<h2>Sectional title: shared everything</h2>
<p>In a <strong>sectional-title</strong> scheme (typically flats and townhouses) you own your section plus an undivided share of the common property. A <strong>body corporate</strong> maintains the shared areas and buildings insurance, funded by your monthly <strong>levy</strong>. You trade some control (conduct rules, pets, alterations) for far less maintenance hassle. It suits lock-up-and-go living — but read the body corporate's finances before you buy, as we note in the <a href="/advice/reduce-monthly-housing-costs-south-africa">running-costs guide</a>.</p>

<img src="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80" alt="Comparing sectional title, freehold and cluster home ownership in South Africa in 2026" style="width:100%;border-radius:12px;" />

<h2>Cluster and estate: the middle path</h2>
<p>A <strong>cluster home</strong> or estate blends the two: you usually own your own stand and house (like freehold), but within a managed development that provides shared <strong>security, amenities and upkeep</strong> for a levy. You get space and a degree of control <em>plus</em> convenience and security — at a levy cost and within the estate's rules. It's a popular fit for families who want security without apartment living.</p>

<h2>How to choose</h2>
<blockquote>
  ✔ Want <strong>control and space</strong>, happy to maintain it → <strong>freehold</strong><br>
  ✔ Want <strong>low-hassle, lock-up-and-go</strong>, fine with rules → <strong>sectional title</strong><br>
  ✔ Want <strong>security + space</strong> with shared upkeep → <strong>cluster/estate</strong>
</blockquote>
<p>Whatever you choose, factor the <strong>levy</strong> into your affordability from day one — it's a permanent monthly cost, not an optional extra.</p>

<blockquote>
  <strong>Know what suits you?</strong> <a href="/properties">Filter listings by property type on Property Basket</a> and compare like with like.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>What's the difference between sectional title and freehold?</h3>
<p>Freehold means you own the house and land outright, with full control and no levies but full responsibility for maintenance, insurance and security. Sectional title means you own your section plus a share of common property, with a body corporate handling shared maintenance and insurance funded by a monthly levy.</p>

<h3>Is a cluster home freehold or sectional title?</h3>
<p>Cluster homes are usually full-title (you own your stand and house) but sit within a managed estate that provides shared security, amenities and upkeep for a levy. It's a middle path between freehold independence and sectional-title convenience.</p>

<h3>Which property type is best to buy?</h3>
<p>It depends on your lifestyle. Choose freehold for control and space, sectional title for low-maintenance lock-up-and-go living, and cluster/estate for security and space with shared upkeep. Always factor any levy into your monthly affordability.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute legal, financial or property advice. Confirm scheme rules, levies and title details with the body corporate, managing agent or a conveyancer before buying.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'Sectional Title vs Freehold vs Cluster: Which Should You Buy?';
        $post->excerpt     = 'Two homes at the same price can come with completely different lives attached. How sectional title, freehold and cluster compare on levies, control, maintenance and resale — and how to match the type to you.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Buyers', 'Property Types', 'Guide'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("SectionalTitleVsFreeholdBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
