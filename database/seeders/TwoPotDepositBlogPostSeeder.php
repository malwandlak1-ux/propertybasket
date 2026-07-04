<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES the "Two-Pot Savings for a Deposit" advice article
 * (Week 2 Friday slot) for Fri 10 Jul 2026, 07:00 SAST.
 *
 * status = published + FUTURE published_at => hidden by BlogPost::published()
 * until then, then auto-goes-live (no cron). Idempotent; scheduled date set
 * only on first insert.
 *   php artisan db:seed --class=TwoPotDepositBlogPostSeeder --force
 */
class TwoPotDepositBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('TwoPotDepositBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'two-pot-retirement-savings-home-deposit';
        $scheduledFor = Carbon::create(2026, 7, 10, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">Since the <strong>two-pot retirement system</strong> launched in September 2024, South Africans can access part of their retirement savings before retirement — and many are asking whether they can use that money as a <strong>home deposit</strong>. The short answer is yes. The better question is: <em>should</em> you? This guide weighs up the smart-versus-risky trade-off.</p>

<p>We'll explain how the two-pot system works, how a withdrawal for a deposit actually plays out, the tax you'll pay, the long-term cost, and when it does — and doesn't — make sense.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • The two-pot system splits contributions into an accessible <strong>savings pot</strong> and a locked <strong>retirement pot</strong>.<br>
  • You can withdraw from the savings pot <strong>once per tax year</strong> — which could fund a deposit.<br>
  • Withdrawals are <strong>taxed at your marginal income tax rate</strong>, and you lose future compound growth.<br>
  • It can work for a serious, well-planned purchase — but it's rarely a first resort.
</blockquote>

<h2>What is the two-pot retirement system?</h2>
<p>Introduced on 1 September 2024, the two-pot system changed how retirement contributions are split:</p>
<ul>
  <li><strong>Savings pot</strong> — roughly one-third of your contributions go here, and you can access it <strong>once per tax year</strong> (subject to a minimum withdrawal amount).</li>
  <li><strong>Retirement pot</strong> — the remaining two-thirds are preserved and can't be touched until you retire.</li>
</ul>
<p>The idea is to give people access to some emergency cash while protecting the bulk of their retirement savings for the long term.</p>

<h2>Can you use it for a home deposit?</h2>
<p>Yes. A withdrawal from your savings pot is cash in your pocket, so it can go towards a <a href="/advice/how-much-deposit-to-buy-a-home-south-africa-2026">home loan deposit</a> or the once-off costs of buying. For a buyer who's been struggling to save a lump sum, it can look like an obvious shortcut onto the property ladder.</p>

<img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80" alt="Weighing up whether to use two-pot retirement savings for a home deposit in South Africa" style="width:100%;border-radius:12px;" />

<h2>The catch: tax and lost growth</h2>
<p>Before you tap your savings pot, understand the true cost:</p>
<ul>
  <li><strong>You're taxed on the withdrawal</strong> — savings-pot withdrawals are added to your income and taxed at your <strong>marginal tax rate</strong>. Withdraw R100,000 and, depending on your bracket, a big chunk goes to SARS rather than your deposit.</li>
  <li><strong>You lose decades of compound growth</strong> — money taken out today isn't invested for your retirement, and the compounding you forfeit can be worth far more than the amount withdrawn.</li>
  <li><strong>It's a one-shot per year</strong> — using it for a deposit means it's not there for a genuine emergency later in the tax year.</li>
</ul>

<h2>When it might make sense — and when to avoid it</h2>
<p><strong>It might make sense</strong> if buying now (rather than in a few years) meaningfully improves your life, you've done the maths on the tax, and the property is a sound long-term purchase within your budget.</p>
<p><strong>Think twice</strong> if the withdrawal only covers the deposit but leaves you short on the <a href="/advice/first-time-home-buyer-guide-south-africa-2026">other costs of buying</a>, if it pushes you into a home you can't comfortably afford at a 10.5% prime rate, or if you're raiding retirement savings simply to buy sooner than you need to.</p>

<h2>Smarter alternatives to consider first</h2>
<ul>
  <li><strong>A 100% bond</strong> — many banks lend the full purchase price, so you may not need a lump-sum deposit at all.</li>
  <li><strong>A dedicated savings plan</strong> — even a few months of disciplined saving avoids the tax hit entirely.</li>
  <li><strong>Speak to a bond originator</strong> — they'll show you what you qualify for before you touch your retirement.</li>
</ul>

<blockquote>
  <strong>Do the maths before you decide.</strong> Compare repayments with and without a deposit on the <a href="/calculator">Property Basket bond calculator</a>, and chat to a bond originator about a 100% bond first.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>Can I use my two-pot retirement savings for a home deposit?</h3>
<p>Yes. You can withdraw from your savings pot once per tax year and use the cash for a home deposit or buying costs. The withdrawal is taxed at your marginal income tax rate, and it reduces your future retirement savings.</p>

<h3>Is it taxed if I withdraw from my two-pot savings pot?</h3>
<p>Yes. Savings-pot withdrawals are added to your taxable income and taxed at your marginal rate, so a portion of any amount you withdraw goes to SARS rather than towards your deposit.</p>

<h3>Is using retirement savings for a deposit a good idea?</h3>
<p>It depends. It can make sense for a well-planned purchase within your budget, but you lose long-term compound growth and pay tax on the withdrawal. Often a 100% bond or a short, disciplined savings plan is a better route — speak to a financial adviser first.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information only and does not constitute financial or tax advice. Withdrawing from retirement savings has long-term consequences — consult a qualified financial adviser and confirm current tax rules with SARS before making any decision.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'Using Your Two-Pot Savings for a Deposit: Smart or Risky?';
        $post->excerpt     = 'Can you use your two-pot retirement savings for a home deposit in South Africa? How it works, the tax you pay, the long-term cost, and when it makes sense — or doesn\'t.';
        $post->body        = $body;
        $post->cover_image = '/images/blog/two-pot-cover.jpg';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Buying', 'Finance', 'Home Finance'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("TwoPotDepositBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
