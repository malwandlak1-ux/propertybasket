<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES the "First-Time Home Buyer Guide 2026" advice article
 * (Week 2 Monday slot of the 90-day content plan) for Mon 6 Jul 2026, 07:00 SAST.
 *
 * Because status = published with a FUTURE published_at, BlogPost::published()
 * keeps it hidden from /advice until that moment, then it auto-goes-live — no
 * cron. Idempotent: keyed on slug; the scheduled date is only set on first
 * insert, so re-running never reschedules or duplicates.
 *   php artisan db:seed --class=FirstTimeBuyerBlogPostSeeder --force
 */
class FirstTimeBuyerBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('FirstTimeBuyerBlogPostSeeder: no user found to attribute the post to — skipping.');
            return;
        }

        $slug         = 'first-time-home-buyer-guide-south-africa-2026';
        $scheduledFor = Carbon::create(2026, 7, 6, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">Becoming a <strong>first-time home buyer in South Africa</strong> is one of the biggest financial moves you'll ever make — and in 2026 first-time buyers make up nearly <strong>half of all bond applications</strong>. But the sticker price on a listing is only part of the story. This guide breaks down the <em>real</em> costs of buying your first home, with rand figures, so there are no nasty surprises at the transfer desk.</p>

<p>We'll cover what you can actually afford, how much deposit you need, the once-off costs beyond the purchase price, a worked example, and a step-by-step checklist to get you from browsing to keys.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • First-time buyers are ~<strong>half of all bond applications</strong> in South Africa in 2026.<br>
  • You pay <strong>zero transfer duty</strong> on homes priced at <strong>R1,210,000 or below</strong>.<br>
  • Budget for costs <em>beyond</em> the price — bond registration, transfer &amp; attorney fees can add <strong>R50,000–R70,000</strong> on a R1m home.<br>
  • Get pre-approved first so you shop within a realistic budget at today's rates.
</blockquote>

<h2>Start with what you can afford — not the asking price</h2>
<p>Before you fall in love with a listing, work out what a bank will actually approve. With the prime lending rate at 10.5% in 2026, your monthly repayment is higher than it was a year ago, and banks assess affordability on that repayment. Getting <strong>pre-approved</strong> tells you your true budget and makes your offer stronger. Start with the free <a href="/calculator">Property Basket bond calculator</a>, and read how rates affect you in our guide to <a href="/advice/how-the-2026-repo-rate-hike-changes-your-home-loan-repayments">the 2026 repo rate hike</a>.</p>

<h2>The deposit — how much do you really need?</h2>
<p>Some banks offer 100% bonds to strong first-time applicants, but a deposit of even 5–10% lowers your monthly repayment, improves your approval odds, and can earn you a better interest rate. On a R1,000,000 home, a 10% deposit is R100,000 — so the sooner you start saving, the better. Not sure how the numbers work? Understanding the <a href="/advice/repo-rate-vs-prime-rate-explained">difference between the repo and prime rate</a> helps you see how your rate is set.</p>

<img src="https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80" alt="A modern South African starter home — the kind of property first-time buyers target in 2026" style="width:100%;border-radius:12px;" />

<h2>The costs first-time buyers forget</h2>
<p>These once-off costs are separate from your deposit and catch many buyers off guard:</p>
<ul>
  <li><strong>Transfer duty</strong> — a government tax on property transfers. In 2026 you pay <strong>R0 on homes priced R1,210,000 or below</strong>; above that it's charged on a sliding scale. See the official brackets on <a href="https://www.sars.gov.za/tax-rates/transfer-duty/" target="_blank" rel="noopener nofollow">the SARS transfer duty page</a>.</li>
  <li><strong>Transfer (conveyancing) fees</strong> — paid to the transferring attorney to register the property in your name.</li>
  <li><strong>Bond registration costs</strong> — paid to the bond attorney to register your home loan at the Deeds Office.</li>
  <li><strong>Bank initiation fee</strong> — a once-off fee to set up the home loan (often around R6,000).</li>
  <li><strong>Ongoing monthly costs</strong> — municipal rates, sectional-title levies, homeowner's &amp; bond insurance, and maintenance.</li>
  <li><strong>Moving costs</strong> — removals, connections and the odd repair.</li>
</ul>

<h2>A worked example: buying a R1,000,000 first home</h2>
<p>Here's roughly what the once-off costs look like on a R1,000,000 property (excluding your deposit). These are <strong>approximate 2026 figures</strong> — your attorney will give exact quotes:</p>

<table style="border-collapse:collapse;width:100%;font-size:15px;margin:20px 0;">
  <thead>
    <tr style="background:#0f172a;color:#fff;text-align:left;">
      <th style="padding:11px 13px;">Cost</th>
      <th style="padding:11px 13px;">Approximate amount</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:11px 13px;">Transfer duty (below R1.21m)</td><td style="padding:11px 13px;color:#10B981;font-weight:700;">R0</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0;background:#f8fafc;"><td style="padding:11px 13px;">Transfer / conveyancing fees</td><td style="padding:11px 13px;">± R26,000</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:11px 13px;">Bond registration costs</td><td style="padding:11px 13px;">± R28,000</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0;background:#f8fafc;"><td style="padding:11px 13px;">Bank initiation fee</td><td style="padding:11px 13px;">± R6,000</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:11px 13px;"><strong>Total once-off (excl. deposit)</strong></td><td style="padding:11px 13px;color:#B8470A;font-weight:700;">± R60,000</td></tr>
  </tbody>
</table>

<p style="background:#FFF4EC;border:1px solid #FFE2CC;border-radius:12px;padding:14px 16px;">💡 <strong>Plan for the extras.</strong> As a rule of thumb, set aside <strong>8–10% of the purchase price</strong> for costs on top of your deposit. Use the <a href="/calculator">bond &amp; cost calculator</a> to estimate your own numbers.</p>

<h2>The good news for first-time buyers in 2026</h2>
<p>It's a genuinely encouraging market for first-timers. First-time buyers now account for close to half of all bond applications, the transfer-duty exemption has climbed to R1,210,000 (protecting entry-level buyers), and the average deposit required has eased compared with a year ago — lowering the barrier to getting onto the property ladder.</p>

<h2>Your first-home buying checklist</h2>
<ul>
  <li><strong>1. Check affordability &amp; get pre-approved</strong> — know your real budget.</li>
  <li><strong>2. Save for your deposit + costs</strong> — deposit plus ~8–10% for fees.</li>
  <li><strong>3. House-hunt within budget</strong> — <a href="/properties">browse listings</a> and filter by price.</li>
  <li><strong>4. Make an offer</strong> — sign an Offer to Purchase with the right conditions.</li>
  <li><strong>5. Bond &amp; transfer</strong> — the bank and attorneys handle registration.</li>
  <li><strong>6. Registration &amp; keys</strong> — the property is registered in your name. Congratulations!</li>
</ul>

<blockquote>
  <strong>Ready to see what you can afford?</strong> Run your numbers on the <a href="/calculator">Property Basket bond calculator</a>, then <a href="/properties">browse homes</a> in your budget.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>How much does it cost to buy a house in South Africa in 2026, beyond the price?</h3>
<p>Beyond your deposit, budget roughly 8–10% of the purchase price for once-off costs: transfer/conveyancing fees, bond registration costs and the bank initiation fee. On a R1,000,000 home that's about R60,000, with transfer duty at R0 because the price is below the R1,210,000 threshold.</p>

<h3>Do first-time buyers pay transfer duty in South Africa?</h3>
<p>Transfer duty is based on price, not on whether you're a first-time buyer. In 2026, any buyer pays zero transfer duty on a property priced at R1,210,000 or below, which benefits first-time buyers most since many entry-level homes fall under that threshold.</p>

<h3>How much deposit do I need as a first-time buyer?</h3>
<p>Some banks approve 100% bonds for strong applicants, so a deposit isn't always required — but putting down 5–10% lowers your repayment, improves your approval odds and can secure a better interest rate.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial advice. Costs and tax thresholds are illustrative and subject to change — confirm current figures with SARS, your attorney and your bank or bond originator before making decisions.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'First-Time Home Buyer Guide South Africa 2026: The Real Costs';
        $post->excerpt     = 'The real costs of buying your first home in South Africa in 2026 — deposit, transfer duty, bond registration and attorney fees broken down with rand figures, plus a step-by-step checklist.';
        $post->body        = $body;
        $post->cover_image = '/images/blog/first-time-buyer-cover.jpg';
        $post->status      = 'published';

        // Scheduled: only set the go-live date on first insert so re-running the
        // seeder never reschedules an already-created (or already-live) post.
        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Buying', 'First-Time Buyers', 'Home Finance'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("FirstTimeBuyerBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
