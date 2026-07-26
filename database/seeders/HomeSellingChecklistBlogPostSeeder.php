<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES "The 2026 Home-Selling Checklist: Get Your Property Sale-Ready"
 * (Week 5 Monday slot) for Mon 27 Jul 2026, 07:00 SAST.
 *
 * status = published + FUTURE published_at => hidden by BlogPost::published()
 * until then, then auto-goes-live (no cron). Idempotent; keyed on slug, date
 * set only on first insert.
 *   php artisan db:seed --class=HomeSellingChecklistBlogPostSeeder --force
 */
class HomeSellingChecklistBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('HomeSellingChecklistBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'how-to-sell-your-house-south-africa-2026';
        $scheduledFor = Carbon::create(2026, 7, 27, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">Selling your home in 2026 is part paperwork, part presentation and part pricing — and the order you do things in matters. Rush to list before the property is ready and you'll chase the market down. Get sale-ready first and you sell faster, for more. This is the complete, step-by-step guide to <strong>how to sell your house in South Africa</strong>.</p>

<p>Work through it top to bottom before your home goes live, and you'll list from a position of strength.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • Sort your <strong>compliance certificates</strong> early — they can hold up transfer.<br>
  • <strong>Price to the market</strong>, not to your mortgage — the first two weeks matter most.<br>
  • <strong>Presentation and photos</strong> decide how many buyers even enquire.<br>
  • Choose an <strong>agent</strong> on marketing reach and track record, not just commission.
</blockquote>

<h2>1. Get your compliance certificates in order</h2>
<p>South African transfers need valid compliance certificates — most commonly the <strong>electrical certificate of compliance (CoC)</strong>, and depending on the property, gas, electric-fence, plumbing (in some municipalities) and beetle certificates. These take time to arrange and can surface faults that need fixing, so start on day one. A deal that's ready to transfer is worth more than one snagged in admin.</p>

<h2>2. Price it right — from the start</h2>
<p>The most expensive mistake sellers make is over-pricing "to leave room to negotiate." Buyers are comparing you against every similar listing, and an overpriced home simply gets skipped — then goes stale. Study recent <strong>sold</strong> prices (not asking prices) for comparable homes in your suburb, and price into the market. Your strongest buyer interest comes in the <strong>first two weeks</strong>; you want the price right for that window. We cover the stale-listing trap in <a href="/advice/why-is-my-house-not-selling-south-africa">why some homes sit on the market longer</a>.</p>

<img src="https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80" alt="A sale-ready South African home presented for the 2026 selling season" style="width:100%;border-radius:12px;" />

<h2>3. Declutter, repair, and stage</h2>
<p>Buyers need to picture <em>their</em> life in the home, not yours. Declutter ruthlessly, fix the small stuff (dripping taps, sticking doors, tired paint), and deep-clean. You don't need a full renovation — you need the home to look cared for. If you're weighing bigger work, read our guide to <a href="/advice/home-improvements-that-add-value-south-africa">upgrades that add to your sale price</a> before spending.</p>

<h2>4. Invest in proper photography</h2>
<p>Almost every buyer meets your home online first. Bright, wide, professional <strong>photos</strong> are what turn a scroll into an enquiry — dark phone snaps quietly cost you viewings. Photograph in good light, with the home staged and tidy, and lead with your strongest room.</p>

<h2>5. Choose the right agent — and marketing reach</h2>
<p>The right agent prices honestly, markets widely, and communicates. Ask how and <em>where</em> they'll market your home, how many buyers they can reach, and for recent results in your area. The cheapest commission is a false economy if the listing barely gets seen.</p>

<h2>Your sale-ready checklist</h2>
<blockquote>
  ✔ Compliance certificates arranged<br>
  ✔ Priced against recent <strong>sold</strong> comparables<br>
  ✔ Decluttered, repaired and cleaned<br>
  ✔ Professional photos taken<br>
  ✔ Agent chosen on reach and record<br>
  ✔ Documents ready for a fast transfer
</blockquote>

<blockquote>
  <strong>Ready to sell?</strong> <a href="/properties">List your property on Property Basket</a> and put it in front of serious buyers from day one.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>What do I need to sell my house in South Africa?</h3>
<p>You'll need valid compliance certificates (typically an electrical CoC, plus gas, electric-fence or beetle certificates where applicable), your title deed details, and a marketing plan — professional photos, a market-based price, and an agent or platform to reach buyers.</p>

<h3>How do I price my home to sell?</h3>
<p>Price against recent sold prices for comparable homes in your suburb, not against asking prices or your outstanding bond. Over-pricing causes a listing to go stale; pricing into the market captures the strong buyer interest of the first two weeks.</p>

<h3>Do I need compliance certificates to sell?</h3>
<p>Yes. A property transfer in South Africa requires valid compliance certificates — most commonly an electrical certificate of compliance, and others such as gas or electric-fence certificates depending on the property. Arrange them early, as faults can delay transfer.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute legal, financial or property advice. Requirements vary by municipality and property — confirm the specifics with a conveyancer or property professional before acting.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'The 2026 Home-Selling Checklist: Get Your Property Sale-Ready';
        $post->excerpt     = 'Selling in 2026 is part paperwork, part presentation, part pricing — and order matters. The complete step-by-step guide to getting your South African home sale-ready before you list.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Sellers', 'Selling', 'Guide'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("HomeSellingChecklistBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
