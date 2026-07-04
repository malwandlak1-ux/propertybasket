<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES "Rental Deposits: How to Get Your Full Deposit Back in 2026"
 * (Week 3 Wednesday slot) for Wed 15 Jul 2026, 07:00 SAST.
 *
 * status = published + FUTURE published_at => hidden until then, then auto-live
 * (no cron). Idempotent; scheduled date set only on first insert.
 *   php artisan db:seed --class=RentalDepositBackBlogPostSeeder --force
 */
class RentalDepositBackBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('RentalDepositBackBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'how-to-get-your-rental-deposit-back-south-africa';
        $scheduledFor = Carbon::create(2026, 7, 15, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">Few things frustrate tenants more than a landlord clinging to their deposit at move-out. The good news: South African law is firmly on your side, and the 2026 rules make a <strong>rental deposit return</strong> faster and clearer than ever. Here's exactly how to get your <strong>full deposit back</strong> — including the interest you're owed.</p>

<p>Follow these steps and you'll leave your rental with your money in hand, not tied up in a dispute.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • With no damage claim, your deposit must be refunded within about <strong>7 days</strong> of moving out.<br>
  • Your deposit sits in an <strong>interest-bearing account</strong> — you're owed the interest too.<br>
  • Landlords may only deduct for <strong>damage</strong>, not fair wear and tear.<br>
  • An <strong>incoming and outgoing inspection</strong> is your best protection.
</blockquote>

<h2>The deposit-return timeline</h2>
<p>When your lease ends and there's <strong>no dispute or damage claim</strong>, your landlord must refund your deposit — with interest — within roughly <strong>seven days</strong>. Where there is a damage claim, the landlord has a longer window and must back it up with receipts. Either way, they can't just keep the money indefinitely or without explanation.</p>

<h2>You're owed the interest, not just the deposit</h2>
<p>Your deposit must be held in an <strong>interest-bearing account</strong> for the whole lease, and the interest belongs to <em>you</em>. You're entitled to ask for proof of the interest earned at any point. So the amount coming back should be your original deposit <strong>plus</strong> that interest. This is one of the protections in the <a href="/advice/tenant-rights-2026-rental-housing-amendment-act">2026 Rental Housing Amendment Act</a>.</p>

<img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80" alt="A tenant checking their rental deposit refund and interest in South Africa" style="width:100%;border-radius:12px;" />

<h2>What a landlord can — and can't — deduct</h2>
<p>Landlords may only deduct for <strong>damage</strong> beyond normal use, plus any genuinely outstanding rent or utilities. They may <strong>not</strong> deduct for <strong>fair wear and tear</strong> — the ordinary ageing that comes with living in a home.</p>

<table style="border-collapse:collapse;width:100%;font-size:15px;margin:20px 0;">
  <thead>
    <tr style="background:#0f172a;color:#fff;text-align:left;">
      <th style="padding:11px 13px;">Fair wear &amp; tear (not deductible)</th>
      <th style="padding:11px 13px;">Damage (deductible)</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:11px 13px;">Faded paint, minor scuffs</td><td style="padding:11px 13px;">Holes in walls, crayon murals</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0;background:#f8fafc;"><td style="padding:11px 13px;">Worn carpet in walkways</td><td style="padding:11px 13px;">Burns, large stains or tears</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:11px 13px;">Loose door handle over time</td><td style="padding:11px 13px;">Broken windows or fittings</td></tr>
  </tbody>
</table>

<h2>The move-out checklist to get 100% back</h2>
<ul>
  <li><strong>Do an incoming inspection</strong> when you move in — photograph every defect and get it recorded, so you're not blamed for it later.</li>
  <li><strong>Clean thoroughly</strong> and undo any changes you made (fill picture holes, replace globes).</li>
  <li><strong>Request a joint outgoing inspection</strong> with the landlord or agent, and get the findings in writing.</li>
  <li><strong>Photograph the empty property</strong> on your last day, date-stamped.</li>
  <li><strong>Provide your banking details in writing</strong> and confirm the refund timeline.</li>
</ul>

<p style="background:#FFF4EC;border:1px solid #FFE2CC;border-radius:12px;padding:14px 16px;">💡 <strong>Documentation is everything.</strong> A tenant with dated photos and a signed inspection report almost always gets their full deposit back.</p>

<h2>What if the landlord won't pay?</h2>
<p>If your landlord withholds your deposit unfairly or misses the deadline, you can lodge a <strong>free complaint with your provincial Rental Housing Tribunal</strong>. Its rulings are legally binding, and unfair deductions rarely survive scrutiny when you've kept good records.</p>

<blockquote>
  <strong>Moving soon?</strong> Line up your next home on <a href="/properties">Property Basket</a> — and start it with a proper incoming inspection.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>How long does a landlord have to return my deposit in South Africa?</h3>
<p>Where there's no damage claim or dispute, your deposit (plus interest) must be refunded within about seven days of you moving out. If the landlord claims for damage, they have a longer window but must provide receipts to support the deduction.</p>

<h3>Can a landlord keep my deposit for normal wear and tear?</h3>
<p>No. Landlords may only deduct for actual damage beyond normal use, plus any outstanding rent or utilities. Fair wear and tear — faded paint, worn carpet in walkways, minor scuffs — is not deductible.</p>

<h3>Do I get interest on my rental deposit?</h3>
<p>Yes. Your deposit must be held in an interest-bearing account for the lease term, and the interest is yours. You can request proof of the interest earned, and it should be paid back to you along with the deposit.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute legal advice. Confirm current rules and deadlines with your Rental Housing Tribunal or a legal professional before acting.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'Rental Deposits: How to Get Your Full Deposit Back in 2026';
        $post->excerpt     = 'How to get your full rental deposit back in South Africa — the 7-day return rule, the interest you\'re owed, what landlords can and can\'t deduct, and the move-out checklist that protects your money.';
        $post->body        = $body;
        $post->cover_image = '/images/blog/deposit-back-cover.jpg';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Renting', 'Tenants', 'Legal'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("RentalDepositBackBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
