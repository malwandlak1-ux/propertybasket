<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES "Upgrades That Add Thousands to Your Sale Price (& Ones That Don't)"
 * (Week 5 Friday slot) for Fri 31 Jul 2026, 07:00 SAST.
 *
 * status = published + FUTURE published_at => hidden by BlogPost::published()
 * until then, then auto-goes-live (no cron). Idempotent; keyed on slug, date
 * set only on first insert.
 *   php artisan db:seed --class=ValueAddingUpgradesBlogPostSeeder --force
 */
class ValueAddingUpgradesBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('ValueAddingUpgradesBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'home-improvements-that-add-value-south-africa';
        $scheduledFor = Carbon::create(2026, 7, 31, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">Not every rand you spend before selling comes back. Some upgrades add thousands to your sale price; others are money pits a buyer won't pay a cent extra for. Knowing the difference is how you sell for more without over-capitalising. Here are the <strong>home improvements that add value</strong> in South Africa — and the ones that don't.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • <strong>Paint, kitchens and bathrooms</strong> deliver the best returns, rand for rand.<br>
  • <strong>Kerb appeal and light</strong> lift every buyer's first impression cheaply.<br>
  • <strong>Solar and water resilience</strong> increasingly pay off with SA buyers.<br>
  • <strong>Pools, luxury finishes and over-personal choices</strong> rarely return what they cost.
</blockquote>

<h2>High-ROI: upgrades buyers pay for</h2>

<h3>A fresh coat of paint</h3>
<p>Nothing returns like paint. Neutral, modern colours throughout make a home feel clean, larger and cared-for — often adding far more to the perceived value than the few thousand rand it costs. It's the single highest-ROI pre-sale upgrade there is.</p>

<h3>Kitchen and bathroom refreshes</h3>
<p>Kitchens and bathrooms sell homes. You rarely need a full rip-out — new cupboard doors and handles, a modern tap, re-grouted tiles and updated lighting can transform the room for a fraction of a renovation. A tired kitchen drags the whole home's value down; a fresh one lifts it.</p>

<img src="https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=1200&q=80" alt="A South African homeowner making a high-return, sale-ready home improvement in 2026" style="width:100%;border-radius:12px;" />

<h3>Kerb appeal and light</h3>
<p>First impressions start at the gate. A tidy garden, a clean driveway, a fresh front door and good exterior lighting cost little and shape how a buyer feels before they even walk in. Inside, more light — cleaned windows, brighter fittings, mirrors — makes rooms feel bigger.</p>

<h3>Solar and water resilience</h3>
<p>With South Africa's energy and water realities, features that reduce reliance on the grid increasingly move the needle. A <strong>solar or backup-power setup</strong> and water storage are among the few bigger-ticket upgrades that buyers now actively value — and sometimes prioritise.</p>

<h2>Low-ROI: money pits before a sale</h2>

<h3>Swimming pools</h3>
<p>A pool is a lifestyle purchase, not an investment. Many buyers see maintenance cost and safety worry, not added value — installing one purely to sell rarely returns its cost.</p>

<h3>Luxury and over-personal finishes</h3>
<p>Top-of-the-range appliances, bold feature walls and highly personal design choices seldom return their cost. Buyers want a canvas they can make their own, not your taste at a premium. Renovate to a clean, broad-appeal standard — not to the ceiling.</p>

<h3>Over-capitalising for the street</h3>
<p>Spend so much that your home becomes the most expensive on the street and the street's ceiling caps what you can recover. Improve to fit your area, not beyond it.</p>

<h2>Spend where it counts</h2>
<p>Before a sale, prioritise the cheap, high-impact work — paint, presentation, small kitchen and bathroom refreshes, kerb appeal — and be cautious with big-ticket projects that won't return their cost. Pair the right upgrades with a <a href="/advice/how-to-sell-your-house-south-africa-2026">sale-ready checklist</a> and honest pricing, and you sell for more without over-spending.</p>

<blockquote>
  <strong>Need the work done right before you list?</strong> <a href="/properties">Find a vetted contractor on Property Basket</a> and get sale-ready with confidence.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>What home improvements add the most value in South Africa?</h3>
<p>Fresh neutral paint, kitchen and bathroom refreshes, kerb appeal and better lighting deliver the strongest returns rand for rand. Energy and water resilience — such as solar or backup power — increasingly add value with South African buyers.</p>

<h3>Do swimming pools add value to a home?</h3>
<p>Usually not enough to justify installing one purely to sell. Many buyers view a pool as ongoing cost and safety risk rather than added value, so it rarely returns its installation cost.</p>

<h3>Can I over-capitalise before selling?</h3>
<p>Yes. Spending so much that your home exceeds the ceiling price for your street means you're unlikely to recover the cost. Improve to a clean, broad-appeal standard that fits your area rather than renovating beyond it.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial or property advice. Returns on improvements vary by property and area — confirm with a property professional before undertaking major work.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = "Upgrades That Add Thousands to Your Sale Price (& Ones That Don't)";
        $post->excerpt     = 'Not every rand you spend before selling comes back. The home improvements that genuinely add value in South Africa — paint, kitchens, kerb appeal, solar — and the money pits buyers won\'t pay for.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Sellers', 'Renovation', 'Value'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("ValueAddingUpgradesBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
