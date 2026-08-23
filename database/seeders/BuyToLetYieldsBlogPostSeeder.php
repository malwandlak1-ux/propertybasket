<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES "Buy-to-Let in 2026: Where the Best Rental Yields Are"
 * (Week 9 Wednesday slot) for Wed 26 Aug 2026, 07:00 SAST.
 *
 * status = published + FUTURE published_at => hidden by BlogPost::published()
 * until then, then auto-goes-live (no cron). Idempotent; keyed on slug, date
 * set only on first insert.
 *   php artisan db:seed --class=BuyToLetYieldsBlogPostSeeder --force
 */
class BuyToLetYieldsBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('BuyToLetYieldsBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'buy-to-let-south-africa-rental-yield';
        $scheduledFor = Carbon::create(2026, 8, 26, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">With rental vacancies near record lows, <strong>buy-to-let in South Africa</strong> is having a moment. But a full rental market doesn't automatically mean a good investment — the returns live in the details of <em>where</em> and <em>what</em> you buy. Here's where the numbers actually work in 2026, and how to spot a yield that's real rather than flattering.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • <strong>Low vacancies</strong> make well-chosen rentals easier to fill and hold.<br>
  • Yield is about the <strong>rent-to-price ratio</strong>, not the headline price.<br>
  • <strong>Smaller units near demand</strong> (transport, work, campuses) often out-yield big homes.<br>
  • Always judge on <strong>net</strong> yield, after the real costs of ownership.
</blockquote>

<h2>Why buy-to-let works in 2026</h2>
<p>Tight rental supply and strong tenant demand mean well-located rentals fill quickly and stay filled. Low vacancy is the foundation of a buy-to-let return — an empty month erases weeks of profit, so the ability to keep a unit tenanted matters as much as the rent itself. Pair that market with good <a href="/advice/tenant-screening-south-africa-2026">tenant screening</a> and you've de-risked the biggest threats to yield.</p>

<h2>Where the yields are</h2>
<p>The best yields rarely come from the most expensive homes. They tend to come from <strong>affordable, high-demand units</strong>: smaller apartments and townhouses near transport nodes, universities, hospitals and major work hubs, where rent is high relative to purchase price. A modest flat that's always occupied can out-earn a luxury home that yields little and sits empty between tenants.</p>

<img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80" alt="A buy-to-let investment property in South Africa delivering strong rental yield in 2026" style="width:100%;border-radius:12px;" />

<h2>How to judge a deal</h2>
<p>Run the yield before you fall for the finishes. <strong>Gross yield</strong> = annual rent ÷ purchase price. But the number that matters is <strong>net yield</strong>, after levies, rates, insurance, maintenance and vacancy allowance — it's usually a good deal lower than gross. A property advertised on a shiny gross figure can disappoint once the real costs bite. We break the maths down fully in <a href="/advice/rental-yield-calculation-south-africa">gross vs net yield explained</a>.</p>

<h2>Features that protect yield</h2>
<p>Beyond location, the details that keep a unit let and low-cost lift your real return: reliable power and water (solar and backup increasingly matter — see <a href="/advice/solar-rental-property-south-africa">solar for rentals</a>), secure access, low levies, and a layout that suits the target tenant. Buy for the tenant you want, not the home you'd live in.</p>

<blockquote>
  <strong>Hunting for yield?</strong> <a href="/properties">Search investment property on Property Basket</a> and compare the numbers, not just the photos.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>Is buy-to-let a good investment in South Africa in 2026?</h3>
<p>It can be, helped by low rental vacancies and strong tenant demand. But returns depend on buying the right unit in the right place at the right price — judged on net yield after costs — and on keeping it well-tenanted through good screening and management.</p>

<h3>Where are the best rental yields?</h3>
<p>Typically in affordable, high-demand units — smaller apartments and townhouses near transport, universities, hospitals and work nodes — where rent is high relative to purchase price and vacancy is low. Luxury homes often yield less and sit empty longer.</p>

<h3>What is a good rental yield?</h3>
<p>It varies by area and property type, but focus on net yield (after levies, rates, insurance, maintenance and vacancy), not the gross headline. A modest, reliably tenanted unit with a solid net yield usually beats a pricey one with a flattering gross figure.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial or investment advice. Yields vary and returns are not guaranteed — confirm figures and run your own numbers with a professional before investing.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'Buy-to-Let in 2026: Where the Best Rental Yields Are';
        $post->excerpt     = 'With vacancies near record lows, buy-to-let is having a moment — but a full market doesn\'t mean a good investment. Where the numbers actually work in 2026, and how to spot a real yield from a flattering one.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Landlords', 'Investing', 'Yield'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("BuyToLetYieldsBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
