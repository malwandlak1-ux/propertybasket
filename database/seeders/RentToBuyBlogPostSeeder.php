<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES "Rent-to-Buy in South Africa: From Tenant to Homeowner"
 * (Week 3 Friday slot) for Fri 17 Jul 2026, 07:00 SAST.
 *
 * status = published + FUTURE published_at => hidden until then, then auto-live
 * (no cron). Idempotent; scheduled date set only on first insert.
 *   php artisan db:seed --class=RentToBuyBlogPostSeeder --force
 */
class RentToBuyBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('RentToBuyBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'rent-to-buy-south-africa-tenant-to-homeowner';
        $scheduledFor = Carbon::create(2026, 7, 17, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">For tenants who feel stuck renting — unable to save a deposit or qualify for a bond just yet — <strong>rent-to-buy in South Africa</strong> can look like the perfect bridge from tenant to homeowner. And it can be. But it's a structure with real trade-offs, and going in with your eyes open is everything. Here's how rent-to-buy actually works, the pros, and the risks to watch.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • Rent-to-buy lets you <strong>rent now and buy later</strong>, often with part of your rent credited towards the purchase.<br>
  • It buys you time to <strong>save a deposit or repair your credit</strong> while living in the home.<br>
  • The purchase price is usually <strong>fixed upfront</strong> — good if prices rise, risky if they fall.<br>
  • Read the contract carefully: <strong>option fees and rent premiums are often non-refundable</strong>.
</blockquote>

<h2>What is rent-to-buy?</h2>
<p>Rent-to-buy (also called rent-to-own or a lease-option) is an agreement where you rent a property for an agreed period with the <strong>option — or obligation — to buy it</strong> at the end. It's aimed at people who want to own but aren't quite ready to secure a home loan today.</p>

<h2>How it works</h2>
<ul>
  <li><strong>An agreed purchase price</strong> — usually locked in at the start, so you know exactly what you'll pay later.</li>
  <li><strong>An option fee</strong> — an upfront amount that secures your right to buy (often credited to the price, but check if it's refundable).</li>
  <li><strong>A rent premium</strong> — you may pay slightly above market rent, with the extra portion credited towards your future deposit.</li>
  <li><strong>A set timeframe</strong> — commonly one to three years, by which point you arrange a bond and complete the purchase.</li>
</ul>

<img src="https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80" alt="A South African home available through a rent-to-buy arrangement" style="width:100%;border-radius:12px;" />

<h2>The pros</h2>
<ul>
  <li><strong>Time to get bond-ready</strong> — save a deposit and improve your credit while living in the home you plan to own.</li>
  <li><strong>A price locked in today</strong> — if the market rises, you still pay the agreed figure.</li>
  <li><strong>Try before you buy</strong> — you live in the home and neighbourhood before committing fully.</li>
  <li><strong>Rent that works for you</strong> — part of it builds towards ownership rather than vanishing.</li>
</ul>

<h2>The risks to watch</h2>
<ul>
  <li><strong>Non-refundable money</strong> — if you don't buy at the end, option fees and rent premiums are often lost.</li>
  <li><strong>You still need to qualify later</strong> — if you can't secure a bond by the deadline, you could forfeit the deal. Getting <a href="/advice/first-time-home-buyer-guide-south-africa-2026">bond-ready as a first-time buyer</a> is essential.</li>
  <li><strong>A fixed price cuts both ways</strong> — if the market falls, you may be locked into paying more than the home is worth.</li>
  <li><strong>Contract complexity</strong> — terms vary widely, so have the agreement checked before you sign.</li>
</ul>

<h2>Is rent-to-buy right for you?</h2>
<p>It suits a disciplined buyer who has a clear path to qualifying for a bond and simply needs time. If that's you, it can genuinely fast-track ownership. But it's not the only route: a <a href="/advice/how-much-deposit-to-buy-a-home-south-africa-2026">100% bond or a focused savings plan</a> may get you there without the extra fees. Weigh them up honestly.</p>

<blockquote>
  <strong>Ready to explore your options?</strong> Chat to a bond originator about what you'd qualify for, and <a href="/properties">browse homes on Property Basket</a> to see what's within reach.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>How does rent-to-buy work in South Africa?</h3>
<p>You rent a property for an agreed period with the option or obligation to buy it at a price usually fixed upfront. You typically pay an option fee and sometimes a rent premium, with part of your payments credited towards the eventual purchase, giving you time to save a deposit or qualify for a bond.</p>

<h3>Is rent-to-buy a good idea?</h3>
<p>It can be, for a disciplined buyer with a clear path to qualifying for a home loan who just needs time. The risks are that option fees and rent premiums are often non-refundable if you don't buy, and a fixed price can work against you if the market falls. Always have the contract reviewed.</p>

<h3>What happens if I can't get a bond at the end of a rent-to-buy deal?</h3>
<p>If you can't secure a home loan by the agreed deadline, you may forfeit the option fee and any credited rent premium and lose the right to buy. That's why getting bond-ready — saving a deposit and building your credit — during the rental period is so important.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial or legal advice. Rent-to-buy contracts vary widely — have any agreement reviewed by a legal professional and confirm the terms before signing.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'Rent-to-Buy in South Africa: From Tenant to Homeowner';
        $post->excerpt     = 'Rent-to-buy in South Africa explained — how rent-to-own works, the pros, and the risks to watch before you sign. A realistic look at the path from tenant to homeowner.';
        $post->body        = $body;
        $post->cover_image = '/images/blog/rent-to-buy-cover.jpg';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Renting', 'Buying', 'Tenants'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("RentToBuyBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
