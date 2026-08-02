<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * PUBLISHES "Bond Declined? How to Turn a 'No' Into a Future 'Yes'"
 * (Week 6 Wednesday slot) dated 2 Aug 2026, 07:05 SAST — published immediately.
 *
 * status = published + PAST published_at => live at once via BlogPost::published().
 * Idempotent; keyed on slug, date set only on first insert.
 *   php artisan db:seed --class=BondDeclinedBlogPostSeeder --force
 */
class BondDeclinedBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('BondDeclinedBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'home-loan-declined-what-to-do-south-africa';
        $scheduledFor = Carbon::create(2026, 8, 2, 7, 5, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">A declined bond application stings — but it is almost never the end of the road. A "no" today is really a "not yet," and it comes with information you can act on. If your <strong>home loan was declined</strong>, here's why it happens and a practical 90-day plan to fix your profile and re-apply with confidence.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • A decline is usually about <strong>affordability, credit or documentation</strong> — all fixable.<br>
  • You're entitled to know <strong>why</strong> — ask the bank for the reason.<br>
  • A focused <strong>90-day plan</strong> can meaningfully improve your profile.<br>
  • Different banks decide differently — <strong>re-apply widely</strong>, don't give up.
</blockquote>

<h2>Why bonds get declined</h2>
<p>Most declines come down to one of four things:</p>
<blockquote>
  ✖ <strong>Affordability</strong> — your existing debt leaves too little room for the repayment<br>
  ✖ <strong>Credit record</strong> — missed payments, judgments or a thin credit history<br>
  ✖ <strong>Deposit</strong> — too little cash to reduce the bank's risk<br>
  ✖ <strong>Documentation</strong> — income that couldn't be clearly proven
</blockquote>
<p>The first step is simple: <strong>ask the bank why</strong>. You're entitled to the reason, and it tells you exactly what to fix.</p>

<h2>Your 90-day plan to turn a 'no' into a 'yes'</h2>

<h3>Days 1–30: Diagnose and stop the bleeding</h3>
<p>Pull your <strong>free credit report</strong> and read it carefully — dispute anything wrong. Stop applying for new credit (each application leaves a mark). List your debts smallest to largest and stop any missed payments cold; payment history is the single biggest driver of your score.</p>

<img src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80" alt="A South African buyer rebuilding their credit profile after a declined home loan in 2026" style="width:100%;border-radius:12px;" />

<h3>Days 31–60: Reduce debt and lift your score</h3>
<p>Attack short-term debt — store cards, personal loans, overdrafts. Getting balances well below their limits improves your <strong>credit utilisation</strong>, which lenders watch closely. Every account you clear also frees up affordability for the bond repayment. Keep paying everything on time, every time.</p>

<h3>Days 61–90: Build your deposit and your case</h3>
<p>Channel the money you were putting toward debt into a <strong>deposit</strong>. Even 10% dramatically strengthens an application. Get your documents in order — payslips or, if you work for yourself, the full pack in our <a href="/advice/home-loan-self-employed-south-africa">self-employed home loan guide</a>. Then re-apply.</p>

<h2>Re-apply — to more than one bank</h2>
<p>Banks weigh risk differently, so a decline from one is not a verdict from all. Apply to several, or use a bond originator to submit to multiple lenders at once. With a cleaner profile and a deposit, the bank that said no in spring may well say yes in winter.</p>

<blockquote>
  <strong>Rebuild toward the right number.</strong> <a href="/calculator">Use the bond calculator</a> to set a realistic target repayment and deposit before you re-apply.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>Why was my home loan declined?</h3>
<p>The most common reasons are affordability (too much existing debt), a weak or thin credit record, too small a deposit, or income that couldn't be clearly documented. Ask the bank for the specific reason — you're entitled to it, and it tells you what to fix.</p>

<h3>How long should I wait before re-applying for a bond?</h3>
<p>There's no fixed waiting period, but re-applying only makes sense once you've addressed the reason for the decline. A focused 90-day plan to reduce debt, fix your credit and build a deposit is often enough to change the outcome.</p>

<h3>Does a declined application hurt my credit score?</h3>
<p>Each credit application leaves an enquiry on your record, and many in a short time can lower your score. Avoid scattering applications; fix your profile first, then apply to a few lenders in a focused window.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial advice. Confirm your options with your bank, a bond originator or a registered financial adviser before acting.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = "Bond Declined? How to Turn a 'No' Into a Future 'Yes'";
        $post->excerpt     = 'A declined bond is a "not yet", not a dead end. Why home loans get rejected, and a practical 90-day plan to fix your affordability, credit and deposit — then re-apply with confidence.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Buyers', 'Home Loans', 'Credit'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("BondDeclinedBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
