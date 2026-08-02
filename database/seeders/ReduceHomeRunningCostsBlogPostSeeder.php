<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES "Rising Municipal Costs: How to Cut Your Monthly Home Running Costs"
 * (Week 7 Friday slot) for Fri 14 Aug 2026, 07:00 SAST.
 *
 * status = published + FUTURE published_at => hidden by BlogPost::published()
 * until then, then auto-goes-live (no cron). Idempotent; keyed on slug, date
 * set only on first insert.
 *   php artisan db:seed --class=ReduceHomeRunningCostsBlogPostSeeder --force
 */
class ReduceHomeRunningCostsBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('ReduceHomeRunningCostsBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'reduce-monthly-housing-costs-south-africa';
        $scheduledFor = Carbon::create(2026, 8, 14, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">Your bond repayment is fixed-ish — but the <em>rest</em> of the cost of owning a home keeps climbing. Rates, levies, electricity, water and insurance quietly add thousands to your monthly outlay. The good news: much of it is controllable. Here's how to <strong>reduce your monthly housing costs in South Africa</strong> without moving.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • The bond is only part of the cost — <strong>rates, levies, utilities and insurance</strong> add up fast.<br>
  • <strong>Check your municipal valuation</strong> — an over-valuation inflates your rates for years.<br>
  • <strong>Energy and water efficiency</strong> deliver the fastest everyday savings.<br>
  • <strong>Re-shop your insurance</strong> annually — loyalty rarely pays.
</blockquote>

<h2>1. Challenge your municipal rates</h2>
<p>Your rates are based on the municipal <strong>valuation</strong> of your property — and valuations are often wrong. When the valuation roll is published, check yours against recent sales of comparable homes. If it's too high, you can lodge an <strong>objection</strong>. A successful challenge lowers your rates for years, not just once.</p>

<h2>2. Attack the electricity bill</h2>
<p>Electricity is where quick wins live. Switch to <strong>LED lighting</strong>, put your <strong>geyser on a timer</strong> (or fit a geyser blanket), and run heavy appliances off-peak. A geyser is often a third of a home's electricity use — taming it moves the needle immediately. For a bigger structural fix, weigh the <a href="/advice/does-solar-add-value-to-home-south-africa">solar equation</a>.</p>

<img src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80" alt="A South African homeowner reviewing municipal bills to cut monthly home running costs in 2026" style="width:100%;border-radius:12px;" />

<h2>3. Cut water waste</h2>
<p>With rising tariffs, water is a growing line item. Fix leaks fast (a dripping toilet wastes thousands of litres), fit <strong>low-flow</strong> aerators and shower heads, and consider a rainwater tank for the garden. Small fixes, compounding monthly.</p>

<h2>4. Re-shop your home insurance every year</h2>
<p>Insurers reward new customers and quietly creep up premiums for loyal ones. Once a year, <strong>get fresh quotes</strong> and ask your insurer to match — and make sure you're insured for the <em>replacement</em> value, not an outdated (over- or under-insured) figure. The same goes for sectional-title owners reviewing what the body corporate's cover already includes.</p>

<h2>5. Scrutinise your levies</h2>
<p>If you're in a sectional-title scheme or estate, your <strong>levy</strong> is a major monthly cost — and you have a say in it. Attend the AGM, read the budget, and question above-inflation increases. Well-run schemes keep reserves healthy without gouging owners.</p>

<h2>Small changes, big annual saving</h2>
<p>None of these is dramatic on its own, but together — a corrected rates bill, a tamed geyser, fixed leaks, re-shopped insurance and a scrutinised levy — they can save you thousands a year on the true cost of owning. Owning smart is as much about running costs as it is about the purchase price.</p>

<blockquote>
  <strong>Weighing up your true cost of owning?</strong> <a href="/calculator">Use the Property Basket calculator</a> to model repayments and costs on any property.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>How can I reduce my monthly home running costs in South Africa?</h3>
<p>Challenge an inflated municipal valuation to lower your rates, cut electricity use (LEDs, a geyser timer, off-peak appliances), fix water leaks and fit low-flow fittings, re-shop your home insurance annually, and scrutinise your sectional-title or estate levies.</p>

<h3>Can I lower my municipal rates?</h3>
<p>Yes. Rates are based on the municipal valuation of your home. If your valuation is higher than comparable recent sales suggest, you can lodge an objection when the valuation roll is published — a successful objection reduces your rates going forward.</p>

<h3>What's the fastest way to cut my electricity bill?</h3>
<p>Target the geyser — often around a third of household electricity — with a timer or blanket, switch to LED lighting, and run heavy appliances off-peak. These are low-cost changes with an immediate monthly effect.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial advice. Municipal processes, tariffs and insurance terms vary — confirm the specifics with your municipality, insurer or a professional before acting.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'Rising Municipal Costs: How to Cut Your Monthly Home Running Costs';
        $post->excerpt     = 'Your bond is fixed-ish, but rates, levies, electricity, water and insurance keep climbing. Practical, controllable ways to cut the true monthly cost of owning a home in South Africa in 2026.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Homeowners', 'Costs', 'Savings'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("ReduceHomeRunningCostsBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
