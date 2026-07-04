<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Publishes the "2026 Repo Rate Hike" advice article.
 *
 * Idempotent: keyed on slug, so re-running updates the content in place
 * without duplicating or resetting the original publish date. Run with:
 *   php artisan db:seed --class=RepoRateBlogPostSeeder --force
 */
class RepoRateBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('RepoRateBlogPostSeeder: no user found to attribute the post to — skipping.');
            return;
        }

        $slug = 'how-the-2026-repo-rate-hike-changes-your-home-loan-repayments';

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">If you have a home loan — or you're about to apply for one — the <strong>2026 repo rate hike</strong> deserves your attention. In May 2026 the South African Reserve Bank (SARB) raised the repo rate to <strong>7%</strong>, pushing the prime lending rate to <strong>10.5%</strong>. It's the first increase since 2023, and it's already showing up on bond statements across the country.</p>

<p>So what does an interest rate increase on a home loan in South Africa actually cost you each month? And if you're a first-time buyer, does it change whether 2026 is a good time to buy? This guide breaks down the real rand impact, explains the difference between the repo and prime rate, and gives you five practical ways to protect your budget.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • The repo rate is now <strong>7%</strong> and prime is <strong>10.5%</strong> after the May 2026 hike.<br>
  • The 0.25% increase adds roughly <strong>R167/month</strong> to a R1m bond, <strong>R251</strong> to R1.5m, and <strong>R334</strong> to R2m (20-year term).<br>
  • Higher rates mean banks approve <strong>smaller</strong> bonds — your buying power drops as rates rise.<br>
  • You can soften the blow with a bigger deposit, a sub-prime rate, and pre-approval before you shop.
</blockquote>

<h2>What actually happened to the repo rate in 2026?</h2>
<p>After a run of cuts through late 2025, the SARB's Monetary Policy Committee reversed course and lifted the repo rate by 25 basis points to <strong>7%</strong> in May 2026, citing renewed inflation risk. Because banks price home loans off the prime lending rate — which sits at repo plus 3.5% — prime moved to <strong>10.5%</strong>.</p>
<p>For context, this is the first upward move since 2023, ending a period of gradual relief for borrowers. You can always confirm the latest decision directly on the <a href="https://www.resbank.co.za/en/home/what-we-do/monetary-policy/repo-rate" target="_blank" rel="noopener nofollow">South African Reserve Bank's website</a>.</p>

<h2>Repo rate vs prime rate — the 30-second version</h2>
<p>These two terms get used interchangeably, but they're different:</p>
<ul>
  <li><strong>Repo rate (7%)</strong> — the rate the Reserve Bank charges commercial banks to borrow money.</li>
  <li><strong>Prime rate (10.5%)</strong> — the rate banks charge their best customers, calculated as repo + 3.5%.</li>
</ul>
<p>Your home loan is usually priced <em>relative</em> to prime — for example "prime minus 0.5%". So when the repo rate moves, your monthly repayment moves with it.</p>

<h2>What the hike adds to your monthly home loan repayment</h2>
<p>Here's the part that matters most. The table below shows the approximate monthly repayment before and after the hike, comparing prime at 10.25% to the new 10.5%, on a 20-year bond with no deposit:</p>

<table style="border-collapse:collapse;width:100%;font-size:15px;margin:20px 0;">
  <thead>
    <tr style="background:#0f172a;color:#fff;text-align:left;">
      <th style="padding:11px 13px;">Bond amount</th>
      <th style="padding:11px 13px;">At 10.25% (before)</th>
      <th style="padding:11px 13px;">At 10.5% (after)</th>
      <th style="padding:11px 13px;">Monthly increase</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:11px 13px;">R1,000,000</td><td style="padding:11px 13px;">R9,817</td><td style="padding:11px 13px;">R9,984</td><td style="padding:11px 13px;color:#B8470A;font-weight:700;">+R167</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0;background:#f8fafc;"><td style="padding:11px 13px;">R1,500,000</td><td style="padding:11px 13px;">R14,726</td><td style="padding:11px 13px;">R14,977</td><td style="padding:11px 13px;color:#B8470A;font-weight:700;">+R251</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:11px 13px;">R2,000,000</td><td style="padding:11px 13px;">R19,635</td><td style="padding:11px 13px;">R19,969</td><td style="padding:11px 13px;color:#B8470A;font-weight:700;">+R334</td></tr>
  </tbody>
</table>

<p>It may not sound dramatic, but on a R1.5 million bond that's roughly <strong>R3,000 extra per year</strong> — money that could have gone towards your emergency fund, rates and levies, or your bond's capital. Over a full 20-year term, small rate changes compound into serious sums.</p>

<p style="background:#FFF4EC;border:1px solid #FFE2CC;border-radius:12px;padding:14px 16px;">💡 <strong>Run your own numbers.</strong> These figures are illustrative. Your actual repayment depends on your approved rate, term and deposit. Use the free <a href="/calculator">Property Basket bond calculator</a> to get a figure tailored to your situation.</p>

<h2>Why a higher rate shrinks your buying power</h2>
<p>The hidden effect of rising rates isn't just a bigger repayment — it's a smaller approval. Banks assess affordability based on what your monthly repayment will be. When rates rise, the same monthly instalment now services a smaller loan.</p>
<p>As a rough rule of thumb, a 1% change in interest rates shifts buying power by around 10–12%. A household that qualified for a R1.65 million bond at a lower rate might now be capped closer to R1.5 million. If you're house-hunting, that can quietly move certain suburbs or property types out of reach — so it pays to <a href="/calculator">check your affordability</a> early.</p>

<img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80" alt="Calculator and finance documents used to work out home loan repayments after the 2026 interest rate hike in South Africa" style="width:100%;border-radius:12px;" />

<h2>5 ways to protect your budget after the rate hike</h2>

<h3>1. Negotiate a rate below prime</h3>
<p>You don't have to accept prime. A strong credit profile, a clean repayment history and a deposit give you leverage to negotiate "prime minus" — even 0.5% below prime can save you thousands over the life of the loan. Applying through multiple banks (or a bond originator) puts them in competition for your business.</p>

<h3>2. Put down a bigger deposit</h3>
<p>A larger deposit reduces the amount you borrow, lowers your monthly repayment, and signals lower risk to the bank — which can earn you a better rate.</p>

<h3>3. Get pre-approved before you shop</h3>
<p>Pre-approval tells you exactly what you can afford <em>at today's rates</em>, so you shop with confidence and avoid falling for a home you can no longer be approved for. It also makes your offer stronger in the seller's eyes.</p>

<h3>4. Fix part of your repayment</h3>
<p>Some banks let you fix the interest rate on a portion of your bond for a set period. You'll typically pay slightly more upfront, but it shields part of your repayment from further hikes — useful if you value certainty over the lowest possible rate.</p>

<h3>5. Pay a little extra into your bond</h3>
<p>Even small additional payments into your home loan reduce the capital faster and cut the total interest you pay. An extra R500 a month on a R1.5m bond can shave years and tens of thousands of rands off the term.</p>

<h2>What it means for first-time buyers</h2>
<p>Here's the encouraging part: despite the hike, first-time buyers now account for nearly <strong>half of all bond applications</strong> in South Africa — the defining property trend of 2026. Two things are helping:</p>
<ul>
  <li>The <strong>transfer duty exemption has risen to R1,210,000</strong>, meaning buyers pay zero transfer duty below that price. See the official brackets on <a href="https://www.sars.gov.za/tax-rates/transfer-duty/" target="_blank" rel="noopener nofollow">the SARS transfer duty page</a>.</li>
  <li>Average deposits required by first-time buyers have eased compared with a year ago, lowering the barrier to entry.</li>
</ul>

<h2>Should you still buy in 2026?</h2>
<p>A rate hike is rarely a reason to abandon a home purchase on its own. Property remains a long-term asset, prices are forecast to rise around 4–5% over 2026, and rentals are tight with vacancies near record lows — meaning the alternative to buying (renting) is also getting more expensive. The smarter move isn't to wait indefinitely; it's to buy <em>within a realistic budget</em> that accounts for today's rates and leaves room for future ones.</p>
<p>Browse what's currently on the market and filter by your true affordability on <a href="/properties">Property Basket's listings</a>, and lean on a verified agent to guide your offer.</p>

<blockquote>
  <strong>See your real repayment in 30 seconds.</strong> Don't guess what the rate hike costs you — <a href="/calculator">open the Property Basket bond calculator</a> and check exactly what you can afford today.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>What is the repo rate in South Africa in 2026?</h3>
<p>After the South African Reserve Bank's increase in May 2026, the repo rate is 7% and the prime lending rate is 10.5%. It was the first rate hike since 2023.</p>

<h3>How much does the 2026 repo rate hike add to my home loan?</h3>
<p>On a 20-year bond, the 0.25% increase adds roughly R167 per month to a R1 million bond, about R251 to a R1.5 million bond, and about R334 to a R2 million bond. Your exact figure depends on your approved rate, term and deposit.</p>

<h3>Should I still buy a home in South Africa in 2026?</h3>
<p>For many buyers, yes. First-time buyers make up nearly half of all bond applications, the transfer duty exemption has risen to R1.21 million, and getting pre-approved helps you buy within a realistic budget at current rates.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial advice. Interest rates, repayment figures and tax thresholds are illustrative and subject to change — confirm current figures with the SARB, SARS and your bank or bond originator before making decisions. Rand repayment examples assume a 20-year term and no deposit.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);

        $post->author_id   = $author->id;
        $post->title       = 'How the 2026 Repo Rate Hike Changes Your Home Loan Repayments';
        $post->excerpt     = 'The SARB raised the repo rate to 7% in 2026. See exactly what it adds to your home loan repayments on a R1m, R1.5m and R2m bond — plus 5 practical ways to protect your budget.';
        $post->body        = $body;
        $post->cover_image = '/images/blog/repo-rate-cover.jpg';
        $post->status      = 'published';
        $post->published_at = $post->published_at ?? Carbon::now(); // preserve original date on re-run
        $post->save();

        $tagIds = collect(['Buying', 'Home Finance', 'Interest Rates'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $this->command?->info("RepoRateBlogPostSeeder: published \"{$post->title}\" at /advice/{$slug}");
    }
}
