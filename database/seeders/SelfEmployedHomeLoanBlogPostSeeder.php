<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * PUBLISHES "The Home Loan Guide for the Self-Employed in South Africa"
 * (Week 6 Monday slot) dated 2 Aug 2026, 07:00 SAST — published immediately.
 *
 * status = published + PAST published_at => live at once via BlogPost::published().
 * Idempotent; keyed on slug, date set only on first insert.
 *   php artisan db:seed --class=SelfEmployedHomeLoanBlogPostSeeder --force
 */
class SelfEmployedHomeLoanBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('SelfEmployedHomeLoanBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'home-loan-self-employed-south-africa';
        $scheduledFor = Carbon::create(2026, 8, 2, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">If you're a freelancer, contractor or business owner, getting a bond can feel like the bank is speaking a different language. You <em>can</em> afford the repayment — but proving it takes more than a payslip. The good news: a <strong>home loan for the self-employed in South Africa</strong> is very much achievable once you know exactly what the banks want and how to present your income.</p>

<p>Here's the documentation checklist and the preparation that turns a "maybe" into an approval.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • Banks want <strong>proof of stable, provable income</strong> — not a single payslip.<br>
  • Expect to supply <strong>6 months' bank statements</strong> and up to <strong>2 years' financials</strong>.<br>
  • <strong>Separate business and personal</strong> finances well before you apply.<br>
  • A bigger <strong>deposit</strong> and clean credit make a self-employed application far stronger.
</blockquote>

<h2>The documents banks want from the self-employed</h2>
<p>Where a salaried buyer hands over a payslip, you'll need to build a fuller picture of your income:</p>
<blockquote>
  ✔ <strong>6 months' personal bank statements</strong><br>
  ✔ <strong>6 months' business bank statements</strong><br>
  ✔ Up to <strong>2 years' financial statements</strong> (signed by an accountant)<br>
  ✔ A <strong>letter from your accountant</strong> confirming income<br>
  ✔ Your latest <strong>SARS tax assessment (ITA34)</strong> and proof of tax compliance<br>
  ✔ ID, proof of residence, and a statement of assets and liabilities
</blockquote>

<h2>How banks assess self-employed income</h2>
<p>Lenders look for <strong>consistency and sustainability</strong>. They'll often average your income over 12–24 months, so one bumper month won't rescue an otherwise thin record — and one slow month won't sink a steady one. They also test <strong>affordability</strong>: your total monthly debt repayments, including the new bond, generally shouldn't exceed about 30% of your gross income.</p>

<img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80" alt="A self-employed South African preparing documents for a home loan application in 2026" style="width:100%;border-radius:12px;" />

<h2>Prepare before you apply</h2>

<h3>1. Separate business and personal money</h3>
<p>If your business and personal expenses flow through one account, banks can't see your real income. Run a proper business account and pay yourself a regular "salary" into your personal account — it makes your income legible and your application far stronger.</p>

<h3>2. Get your tax in order</h3>
<p>Under-declaring income to SARS to save tax quietly caps how much home you can buy — banks lend against <em>declared</em> income. Being <strong>tax compliant</strong>, with up-to-date returns, is one of the biggest levers a self-employed buyer has.</p>

<h3>3. Build a deposit and protect your credit</h3>
<p>A deposit of 10–20% reduces the bank's risk and your repayment, and it signals discipline. Pair it with a clean credit record — no missed accounts, low balances — and you change how the bank sees you. New to this? Our <a href="/advice/first-time-home-buyer-guide-south-africa-2026">first-time home buyer guide</a> covers the full cost picture.</p>

<h2>Apply through more than one bank</h2>
<p>Different banks weigh self-employed income differently, so a "no" from one is not a "no" from all. Applying to several (or using a bond originator) puts your application in front of multiple credit teams and improves both your odds and your rate. If one declines, don't stop — read our guide on <a href="/advice/home-loan-declined-what-to-do-south-africa">turning a bond decline into an approval</a>.</p>

<blockquote>
  <strong>Know what you can afford before you apply.</strong> <a href="/calculator">Use the Property Basket bond calculator</a> to size your repayment and deposit.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>Can I get a home loan if I'm self-employed in South Africa?</h3>
<p>Yes. You'll need to prove stable, sustainable income with bank statements, financial statements, an accountant's letter and SARS tax compliance rather than a payslip. Consistent, well-documented income and a deposit make approval very achievable.</p>

<h3>What documents do self-employed buyers need for a bond?</h3>
<p>Typically six months of personal and business bank statements, up to two years of signed financial statements, an accountant's letter confirming income, your latest SARS assessment and proof of tax compliance, plus ID and proof of residence.</p>

<h3>How do banks calculate self-employed income?</h3>
<p>Banks usually average your income over 12–24 months to test consistency, then apply an affordability rule — total monthly debt, including the new bond, generally shouldn't exceed around 30% of gross income.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial advice. Lending criteria vary by bank — confirm requirements with your bank, bond originator or a financial adviser before applying.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'The Home Loan Guide for the Self-Employed in South Africa';
        $post->excerpt     = 'Freelancer, contractor or business owner? A home loan is very achievable — once you prove your income the way banks want. The exact documents lenders demand, and how to present self-employed income for approval.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Buyers', 'Home Loans', 'Self-Employed'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("SelfEmployedHomeLoanBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
