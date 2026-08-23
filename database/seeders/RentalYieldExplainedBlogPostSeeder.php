<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES "Rental Yield Explained: Gross vs Net & Why It Matters"
 * (Week 9 Friday slot) for Fri 28 Aug 2026, 07:00 SAST.
 *
 * status = published + FUTURE published_at => hidden by BlogPost::published()
 * until then, then auto-goes-live (no cron). Idempotent; keyed on slug, date
 * set only on first insert.
 *   php artisan db:seed --class=RentalYieldExplainedBlogPostSeeder --force
 */
class RentalYieldExplainedBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('RentalYieldExplainedBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'rental-yield-calculation-south-africa';
        $scheduledFor = Carbon::create(2026, 8, 28, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">"This place yields 7%!" — maybe. Once the costs bite, that same property might really return closer to 4.8%. If you're investing in property, the single most important number you can calculate is <strong>rental yield</strong> — and knowing the difference between <strong>gross and net</strong> is what separates a good buy from an expensive lesson.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • <strong>Gross yield</strong> = annual rent ÷ purchase price — the headline figure.<br>
  • <strong>Net yield</strong> subtracts the real running costs — the figure that matters.<br>
  • A ~<strong>7% gross</strong> yield can fall to ~<strong>4.8% net</strong> once costs are counted.<br>
  • Always compare investments on <strong>net</strong>, and stress-test for vacancy.
</blockquote>

<h2>Gross yield: the headline number</h2>
<p>Gross yield is the simple one, and the one agents quote:</p>
<blockquote>
  <strong>Gross yield = (annual rent ÷ purchase price) × 100</strong>
</blockquote>
<p>Buy a flat for R1,000,000 that rents for R7,000 a month (R84,000 a year) and the gross yield is <strong>8.4%</strong>. Useful for a quick comparison — but it ignores every cost of actually owning the place.</p>

<h2>Net yield: the number that pays you</h2>
<p>Net yield subtracts the real costs of ownership before dividing by the price:</p>
<blockquote>
  <strong>Net yield = ((annual rent − annual costs) ÷ purchase price) × 100</strong>
</blockquote>
<p>Those costs add up fast: levies, municipal rates, insurance, maintenance and repairs, letting/management fees, and a <strong>vacancy allowance</strong> for the months a unit sits empty. This is why a property advertised at a ~7% gross yield can deliver closer to <strong>4.8% net</strong> once everything is counted — a difference that decides whether the deal actually works.</p>

<img src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80" alt="Calculating gross versus net rental yield on a South African investment property in 2026" style="width:100%;border-radius:12px;" />

<h2>A worked example</h2>
<p>Take that R1,000,000 flat renting at R7,000/month (R84,000/year), gross yield 8.4%. Now subtract annual costs — say R12,000 levies, R6,000 rates, R3,600 insurance, R6,000 maintenance, R6,700 management, and a one-month vacancy allowance (~R7,000). That's roughly <strong>R41,300</strong> in costs, leaving <strong>R42,700</strong> net. Net yield: about <strong>4.3%</strong>. Same property, very different story — and now you can compare it fairly against other options, including simply leaving the money in the bank.</p>

<h2>Use net yield to make the call</h2>
<p>Always compare properties on <strong>net</strong> yield, and stress-test it: what happens to your return if the unit is empty for two months, or a big repair lands? A deal that only works at 100% occupancy isn't a deal — it's a gamble. Where to find the strongest starting yields is covered in <a href="/advice/buy-to-let-south-africa-rental-yield">where the best rental yields are</a>.</p>

<blockquote>
  <strong>Run your own numbers.</strong> <a href="/calculator">Use the Property Basket calculator</a> to model repayments and costs before you buy.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>How do you calculate rental yield in South Africa?</h3>
<p>Gross yield = (annual rent ÷ purchase price) × 100. Net yield = ((annual rent − annual costs) ÷ purchase price) × 100, where costs include levies, rates, insurance, maintenance, management fees and a vacancy allowance. Net yield is the figure that reflects your real return.</p>

<h3>What's the difference between gross and net rental yield?</h3>
<p>Gross yield uses rent and price only. Net yield subtracts the real costs of ownership, so it's always lower — a ~7% gross yield can become ~4.8% net once levies, rates, insurance, maintenance, management and vacancy are counted.</p>

<h3>What is a good net rental yield?</h3>
<p>It varies by area and property type, but always judge deals on net yield and stress-test for vacancy and repairs. A reliably tenanted unit with a solid net yield beats a headline gross figure that collapses once costs and empty months are included.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial or investment advice. The figures are illustrative — run your own numbers with actual costs and confirm with a professional before investing.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'Rental Yield Explained: Gross vs Net & Why It Matters';
        $post->excerpt     = 'That "7% yield" might really be 4.8% once costs bite. The yield maths every property investor must know — gross vs net, a worked South African example, and why net is the only number that pays you.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Landlords', 'Investing', 'Yield'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("RentalYieldExplainedBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
