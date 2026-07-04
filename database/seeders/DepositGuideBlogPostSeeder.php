<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES the "How Much Deposit Do You Really Need" advice article
 * (Week 2 Wednesday slot) for Wed 8 Jul 2026, 07:00 SAST.
 *
 * status = published + FUTURE published_at => BlogPost::published() keeps it
 * hidden until then, then it auto-goes-live (no cron). Idempotent; the
 * scheduled date is set only on first insert.
 *   php artisan db:seed --class=DepositGuideBlogPostSeeder --force
 */
class DepositGuideBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('DepositGuideBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'how-much-deposit-to-buy-a-home-south-africa-2026';
        $scheduledFor = Carbon::create(2026, 7, 8, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">"How much deposit do I need to buy a home?" is the question almost every South African buyer asks first. The honest answer in 2026: sometimes nothing at all — but a <strong>home loan deposit</strong> can dramatically lower your repayment and improve your chances of approval. Here's how deposits really work, how much to aim for, and how to save it faster.</p>

<p>This guide unpacks 100% bonds versus putting money down, shows the rand impact of different deposit sizes, and gives you a practical plan to build your deposit.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • Some banks offer <strong>100% bonds</strong> — a deposit isn't always required.<br>
  • But a deposit lowers your monthly repayment, improves approval odds and can earn a <strong>better interest rate</strong>.<br>
  • A common target is <strong>10%</strong> of the purchase price; 20% puts you in a very strong position.<br>
  • Budget for your deposit <em>plus</em> ~8–10% for once-off costs on top.
</blockquote>

<h2>Do you actually need a deposit?</h2>
<p>Not always. South African banks do approve <strong>100% home loans</strong> (bonds that cover the full purchase price), especially for first-time buyers with a strong credit profile and stable income. So it's entirely possible to buy without a lump sum saved. But "can" and "should" are different questions — and a deposit almost always works in your favour.</p>

<h2>How much deposit is "enough"?</h2>
<p>There's no legal minimum, but the more you put down, the smaller your loan and the lower your monthly repayment. Here's the effect of different deposits on a R1,000,000 home at a 10.5% prime rate over 20 years (approximate):</p>

<table style="border-collapse:collapse;width:100%;font-size:15px;margin:20px 0;">
  <thead>
    <tr style="background:#0f172a;color:#fff;text-align:left;">
      <th style="padding:11px 13px;">Deposit</th>
      <th style="padding:11px 13px;">Loan amount</th>
      <th style="padding:11px 13px;">Approx. monthly repayment</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:11px 13px;">R0 (100% bond)</td><td style="padding:11px 13px;">R1,000,000</td><td style="padding:11px 13px;">± R9,984</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0;background:#f8fafc;"><td style="padding:11px 13px;">R100,000 (10%)</td><td style="padding:11px 13px;">R900,000</td><td style="padding:11px 13px;color:#B8470A;font-weight:700;">± R8,986</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:11px 13px;">R200,000 (20%)</td><td style="padding:11px 13px;">R800,000</td><td style="padding:11px 13px;color:#B8470A;font-weight:700;">± R7,987</td></tr>
  </tbody>
</table>

<p>A 10% deposit shaves roughly R1,000 off your monthly repayment on a R1m home — around R12,000 a year, every year.</p>

<img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80" alt="Working out how much deposit is needed for a home loan in South Africa" style="width:100%;border-radius:12px;" />

<h2>Why a bigger deposit pays off</h2>
<ul>
  <li><strong>Lower repayments</strong> — you borrow less, so you pay less each month and less interest overall.</li>
  <li><strong>A better interest rate</strong> — a deposit lowers the bank's risk, which can earn you a rate below prime. Understanding <a href="/advice/repo-rate-vs-prime-rate-explained">how the repo and prime rate set your rate</a> helps here.</li>
  <li><strong>Stronger approval odds</strong> — a deposit signals financial discipline and improves your affordability.</li>
  <li><strong>A cushion against rate hikes</strong> — a smaller loan is easier to service if rates rise, as they did in <a href="/advice/how-the-2026-repo-rate-hike-changes-your-home-loan-repayments">May 2026</a>.</li>
</ul>

<h2>Don't forget the costs on top</h2>
<p>Your deposit is separate from the once-off costs of buying — transfer, bond registration and attorney fees. Budget roughly <strong>8–10% of the purchase price</strong> for those, in addition to your deposit. Our <a href="/advice/first-time-home-buyer-guide-south-africa-2026">first-time home buyer guide</a> breaks the full cost picture down.</p>

<p style="background:#FFF4EC;border:1px solid #FFE2CC;border-radius:12px;padding:14px 16px;">💡 <strong>See your numbers.</strong> Use the free <a href="/calculator">Property Basket bond calculator</a> to compare repayments with and without a deposit before you start house-hunting.</p>

<h2>How to save your deposit faster</h2>
<ul>
  <li><strong>Automate it</strong> — set up a debit order into a separate high-interest savings account on payday.</li>
  <li><strong>Cut one big expense</strong> — redirect it straight to your deposit fund.</li>
  <li><strong>Use windfalls</strong> — bonuses, tax refunds and 13th cheques accelerate your savings.</li>
  <li><strong>Keep it separate</strong> — out of sight, out of spending reach.</li>
</ul>

<blockquote>
  <strong>Know your budget before you shop.</strong> Run the numbers on the <a href="/calculator">bond calculator</a>, then <a href="/properties">browse homes</a> you can comfortably afford.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>Can I buy a house in South Africa with no deposit?</h3>
<p>Yes. Many South African banks offer 100% home loans, particularly to first-time buyers with a solid credit record and stable income, so you can buy without a deposit. A deposit is optional but lowers your repayment and can secure a better rate.</p>

<h3>How much deposit should I put down on a home?</h3>
<p>A common target is 10% of the purchase price, which noticeably lowers your monthly repayment and improves approval odds. A 20% deposit puts you in a very strong position for the best rates, but any amount helps.</p>

<h3>Is the deposit the only upfront cost?</h3>
<p>No. On top of your deposit, budget around 8–10% of the purchase price for once-off costs — transfer duty (R0 below R1,210,000 in 2026), transfer and bond registration attorney fees, and the bank initiation fee.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial advice. Rates and repayment figures are illustrative and subject to change — confirm current figures with your bank or bond originator before making decisions. Repayment examples assume a 20-year term at a 10.5% prime rate.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'How Much Deposit Do You Really Need to Buy a Home in 2026?';
        $post->excerpt     = "How much deposit do you need to buy a home in South Africa? From 100% bonds to 20% down — how deposits work, what they save you, and how to build yours faster in 2026.";
        $post->body        = $body;
        $post->cover_image = '/images/blog/deposit-cover.jpg';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Buying', 'Home Finance', 'First-Time Buyers'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("DepositGuideBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
