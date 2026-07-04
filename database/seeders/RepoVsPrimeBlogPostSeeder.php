<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Publishes the "Repo Rate vs Prime Rate" advice article (Week 1 Friday slot
 * of the 90-day content plan). Evergreen explainer that complements and
 * cross-links the "2026 repo rate hike" post.
 *
 * Idempotent: keyed on slug, preserves the original publish date on re-run.
 *   php artisan db:seed --class=RepoVsPrimeBlogPostSeeder --force
 */
class RepoVsPrimeBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('RepoVsPrimeBlogPostSeeder: no user found to attribute the post to — skipping.');
            return;
        }

        $slug = 'repo-rate-vs-prime-rate-explained';

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">If you own property in South Africa, two numbers quietly decide what you pay every month: the <strong>repo rate</strong> and the <strong>prime rate</strong>. People use them interchangeably, but they're not the same thing — and understanding the difference between the <strong>repo rate vs the prime rate</strong> helps you read the news, plan your budget, and know exactly what a South African Reserve Bank announcement means for your home loan.</p>

<p>This is a plain-English guide: what each rate is, why prime is always higher than repo, how the two flow through to your monthly bond repayment, and what it all means for buyers, homeowners and savers in 2026.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • The <strong>repo rate</strong> is what the Reserve Bank charges banks; the <strong>prime rate</strong> is what banks charge you.<br>
  • Prime = repo + 3.5%. In 2026 that's a repo rate of <strong>7%</strong> and a prime rate of <strong>10.5%</strong>.<br>
  • Your home loan is priced <em>relative</em> to prime (e.g. "prime minus 0.5%"), so when repo moves, your repayment moves.<br>
  • The Reserve Bank reviews the repo rate roughly every two months — about six times a year.
</blockquote>

<h2>First, what is the repo rate?</h2>
<p>The <strong>repo rate</strong> (short for "repurchase rate") is the interest rate at which the South African Reserve Bank (SARB) lends money to commercial banks. It's the Reserve Bank's main tool for managing inflation: raising the repo rate makes borrowing more expensive and cools spending, while cutting it makes borrowing cheaper and encourages activity.</p>
<p>In 2026 the repo rate sits at <strong>7%</strong>, after the SARB raised it by 25 basis points in May — its first increase since 2023. You can always check the current figure on the <a href="https://www.resbank.co.za/en/home/what-we-do/monetary-policy/repo-rate" target="_blank" rel="noopener nofollow">South African Reserve Bank's website</a>.</p>

<h2>And what is the prime lending rate?</h2>
<p>The <strong>prime rate</strong> is the interest rate that commercial banks charge their lowest-risk customers. It's the benchmark banks use to price most consumer loans — home loans, vehicle finance and overdrafts. Because banks borrow from the Reserve Bank at the repo rate and then lend to you, prime is always higher: that gap is how banks cover their costs and risk.</p>
<p>With the repo rate at 7%, the prime rate in 2026 is <strong>10.5%</strong>.</p>

<h2>The magic number: why prime = repo + 3.5%</h2>
<p>In South Africa the prime rate is set at a fixed margin of <strong>3.5 percentage points above the repo rate</strong>. This spread is an industry convention, so the two rates always move together in lockstep. When the SARB changes the repo rate, banks change prime by the same amount, almost immediately:</p>

<table style="border-collapse:collapse;width:100%;font-size:15px;margin:20px 0;">
  <thead>
    <tr style="background:#0f172a;color:#fff;text-align:left;">
      <th style="padding:11px 13px;">Repo rate</th>
      <th style="padding:11px 13px;">Prime rate (repo + 3.5%)</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:11px 13px;">6.75%</td><td style="padding:11px 13px;">10.25%</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0;background:#f8fafc;"><td style="padding:11px 13px;color:#B8470A;font-weight:700;">7.00% (2026)</td><td style="padding:11px 13px;color:#B8470A;font-weight:700;">10.50% (2026)</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:11px 13px;">7.25%</td><td style="padding:11px 13px;">10.75%</td></tr>
  </tbody>
</table>

<img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80" alt="Calculator and financial paperwork illustrating how the repo rate and prime rate affect a South African home loan" style="width:100%;border-radius:12px;" />

<h2>How the repo rate becomes your monthly bond repayment</h2>
<p>Here's the chain that turns a Reserve Bank decision into a number on your bank statement:</p>
<ul>
  <li><strong>1. The SARB sets the repo rate</strong> — say 7%.</li>
  <li><strong>2. Banks set prime</strong> at repo + 3.5% — so 10.5%.</li>
  <li><strong>3. Your home loan is priced relative to prime</strong> — a strong applicant might get "prime minus 0.5%" (10%), while a higher-risk one pays "prime plus 1%" (11.5%).</li>
  <li><strong>4. That rate determines your repayment</strong> — and if it's a variable-rate bond (most are), your monthly instalment changes whenever prime changes.</li>
</ul>
<p>So the rate you personally pay is prime <em>plus or minus</em> the margin your bank agreed with you. That's why two people with the same size bond can pay very different amounts — and why it pays to negotiate. We break the rand impact down in our guide to <a href="/advice/how-the-2026-repo-rate-hike-changes-your-home-loan-repayments">how the 2026 repo rate hike changes your home loan repayments</a>.</p>

<h2>How often does the repo rate change?</h2>
<p>The SARB's Monetary Policy Committee (MPC) meets roughly every two months — about six times a year — to decide whether to raise, cut or hold the repo rate. Each announcement is closely watched because it flows straight through to prime and, in turn, to millions of home loan repayments. If you have a bond, those meeting dates are worth marking on your calendar.</p>

<h2>What it means for you</h2>
<h3>If you're buying a home</h3>
<p>A higher prime rate means banks approve smaller bonds, because your repayment on any given amount is larger. Getting pre-approved tells you what you qualify for <em>at today's rates</em> — use the free <a href="/calculator">Property Basket bond calculator</a> to see your repayment before you shop.</p>

<h3>If you already have a bond</h3>
<p>On a variable-rate home loan, every repo move changes your instalment. Building a small buffer into your budget — and paying a little extra into your bond when rates are low — cushions you against future hikes.</p>

<h3>If you're a saver</h3>
<p>It's not all bad news when rates rise: higher rates generally mean better returns on savings accounts and fixed deposits, so cash in the bank works a little harder.</p>

<blockquote>
  <strong>Stay ahead of the next move.</strong> Rate decisions land roughly every two months. Follow the <a href="/advice">Property Basket Advice hub</a> for plain-English updates, and check your numbers anytime with the <a href="/calculator">bond calculator</a>.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>What is the difference between the repo rate and the prime rate?</h3>
<p>The repo rate is the interest rate the South African Reserve Bank charges commercial banks to borrow money. The prime rate is the rate banks charge their best customers, set at the repo rate plus 3.5%. In 2026 the repo rate is 7% and the prime rate is 10.5%.</p>

<h3>Why is the prime rate 3.5% higher than the repo rate?</h3>
<p>The 3.5 percentage-point gap is a South African banking convention. It covers the banks' operating costs, risk and profit margin between borrowing from the Reserve Bank and lending to consumers, so prime always sits 3.5% above the repo rate and the two move together.</p>

<h3>How often does the repo rate change in South Africa?</h3>
<p>The Reserve Bank's Monetary Policy Committee reviews the repo rate about six times a year — roughly every two months — and can raise it, cut it, or leave it unchanged at each meeting.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial advice. Interest rates are illustrative and subject to change — confirm current figures with the SARB and your bank or bond originator before making decisions.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);

        $post->author_id    = $author->id;
        $post->title        = 'Repo Rate vs Prime Rate: What Every Property Owner Should Know';
        $post->excerpt      = "Repo rate vs prime rate — what's the difference, and how do they decide your home loan repayment? A plain-English guide for South African property owners in 2026.";
        $post->body         = $body;
        $post->cover_image  = '/images/blog/repo-vs-prime-cover.jpg';
        $post->status       = 'published';
        $post->published_at = $post->published_at ?? Carbon::now(); // preserve original date on re-run
        $post->save();

        $tagIds = collect(['Finance', 'Interest Rates', 'Home Owners'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $this->command?->info("RepoVsPrimeBlogPostSeeder: published \"{$post->title}\" at /advice/{$slug}");
    }
}
