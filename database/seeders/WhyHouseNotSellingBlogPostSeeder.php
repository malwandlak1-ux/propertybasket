<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES "Why Some Homes Sit on the Market Longer Than Others"
 * (Week 5 Wednesday slot) for Wed 29 Jul 2026, 07:00 SAST.
 *
 * status = published + FUTURE published_at => hidden by BlogPost::published()
 * until then, then auto-goes-live (no cron). Idempotent; keyed on slug, date
 * set only on first insert.
 *   php artisan db:seed --class=WhyHouseNotSellingBlogPostSeeder --force
 */
class WhyHouseNotSellingBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('WhyHouseNotSellingBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'why-is-my-house-not-selling-south-africa';
        $scheduledFor = Carbon::create(2026, 7, 29, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">Your neighbour's home sold in three weeks. Yours has been listed for three months. Same suburb, same street — so <strong>why is your house not selling</strong>? It almost always comes down to four levers, and the good news is that every one of them is fixable.</p>

<p>Here's how to diagnose a stale listing honestly, and what to change.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • <strong>Price</strong> is the number-one reason a home doesn't sell — and the easiest to misjudge.<br>
  • <strong>Photos and presentation</strong> decide whether buyers enquire at all.<br>
  • <strong>Marketing reach</strong> determines how many buyers ever see it.<br>
  • A listing gets its best interest early — a stale listing needs a genuine <strong>reset</strong>, not just patience.
</blockquote>

<h2>Reason 1: The price is wrong</h2>
<p>If a home is well-presented and marketed but still isn't selling, price is almost always the culprit. Buyers compare you against every similar listing, and an over-priced home simply gets passed over. The market tells you the truth through <strong>viewings and offers</strong>: lots of viewings but no offers usually means presentation or condition; <em>few viewings at all</em> usually means the price is scaring buyers off before they book. Re-check your price against recent <strong>sold</strong> comparables, not asking prices.</p>

<h2>Reason 2: The photos are letting it down</h2>
<p>Most buyers judge your home in a two-second scroll. Dark, cluttered or wonky photos get skipped no matter how lovely the home is in person. If your viewing numbers are low, look at your listing the way a buyer does: is the lead photo bright, wide and inviting? Fresh professional photography is often the single highest-return fix for a stale listing.</p>

<img src="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80" alt="A well-staged South African living room prepared to help a home sell faster" style="width:100%;border-radius:12px;" />

<h2>Reason 3: Presentation isn't helping buyers imagine living there</h2>
<p>Even with good photos, a cluttered or overly personal home makes buyers hesitate. Declutter, depersonalise, fix the small defects, and let light in. Staging isn't about spending big — it's about removing the reasons a buyer talks themselves out of an offer. Our <a href="/advice/how-to-sell-your-house-south-africa-2026">sale-ready checklist</a> walks through this step by step.</p>

<h2>Reason 4: Not enough buyers are seeing it</h2>
<p>A perfectly priced, beautifully presented home still won't sell if it's barely marketed. Ask where your listing actually appears and how many buyers it reaches. Narrow reach — one portal, a sign on the wall — quietly starves a listing of the buyer volume it needs. Wide, active marketing is what turns a good home into a sold one.</p>

<h2>How to reset a stale listing</h2>
<blockquote>
  ✔ Re-benchmark the <strong>price</strong> against recent solds<br>
  ✔ Re-shoot the <strong>photos</strong> and refresh the lead image<br>
  ✔ Declutter and <strong>re-stage</strong> the key rooms<br>
  ✔ Widen the <strong>marketing</strong> and relaunch as new<br>
  ✔ Read the <strong>feedback</strong> from viewings and act on it
</blockquote>

<blockquote>
  <strong>Think your listing has gone stale?</strong> <a href="/properties">Relist on Property Basket</a> and put your home back in front of active buyers.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>Why is my house not selling?</h3>
<p>The four usual causes are price, photos, presentation and marketing reach. Few viewings usually points to price or exposure; many viewings without offers usually points to condition or presentation. Diagnose using your viewing and offer numbers, then fix the specific lever.</p>

<h3>How long should it take to sell a house in South Africa?</h3>
<p>It varies by area and price band, but a well-priced, well-marketed home typically attracts its strongest interest in the first few weeks. A listing sitting far longer than comparable homes is usually signalling a price or presentation problem.</p>

<h3>Should I drop my price or relist?</h3>
<p>First check whether the issue is exposure and presentation — sometimes fresh photos, staging and wider marketing revive interest. If viewings are low despite good marketing, the price is likely the barrier and a realistic adjustment is the fastest fix.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute property or financial advice. Market conditions vary — confirm pricing and strategy with a property professional before acting.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'Why Some Homes Sit on the Market Longer Than Others';
        $post->excerpt     = 'Same suburb, same street — so why is your house not selling while your neighbour\'s sold in weeks? It comes down to four fixable levers: price, photos, presentation and marketing reach.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Sellers', 'Selling', 'Marketing'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("WhyHouseNotSellingBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
