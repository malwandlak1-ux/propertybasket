<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * PUBLISHES "Transfer Duty in 2026: Understanding the New R1.21m Threshold"
 * (Week 6 Friday slot) dated 2 Aug 2026, 07:10 SAST — published immediately.
 *
 * status = published + PAST published_at => live at once via BlogPost::published().
 * Idempotent; keyed on slug, date set only on first insert.
 *   php artisan db:seed --class=TransferDuty2026BlogPostSeeder --force
 */
class TransferDuty2026BlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('TransferDuty2026BlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'transfer-duty-south-africa-2026';
        $scheduledFor = Carbon::create(2026, 8, 2, 7, 10, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">Transfer duty is the tax you pay SARS to put a property in your name — and in 2026 the threshold below which you pay <strong>nothing</strong> rose to <strong>R1,210,000</strong>. If you're buying, understanding <strong>transfer duty in South Africa</strong> tells you exactly what the taxman adds to your purchase, and where the brackets kick in.</p>

<p>Here's how the 2026 brackets work, who now pays zero, and how to estimate duty on any price.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • <strong>No transfer duty</strong> is payable on properties up to <strong>R1,210,000</strong>.<br>
  • Above that, duty is <strong>progressive</strong> — you're only taxed on the value in each band.<br>
  • Transfer duty is <strong>separate</strong> from your bond and from conveyancing fees.<br>
  • It's normally payable <strong>upfront</strong>, in cash — budget for it early.
</blockquote>

<h2>The 2026 transfer duty brackets</h2>
<p>Transfer duty is charged in bands, so a higher price doesn't push your whole purchase into one rate — each slice of value is taxed at its own rate:</p>
<blockquote>
  • Up to <strong>R1,210,000</strong> — <strong>0%</strong> (no duty)<br>
  • R1,210,001 – R1,663,800 — <strong>3%</strong> of the value above R1,210,000<br>
  • R1,663,801 – R2,329,300 — a fixed amount + <strong>6%</strong> of the value above R1,663,800<br>
  • R2,329,301 – R2,994,800 — a fixed amount + <strong>8%</strong> of the value above R2,329,300<br>
  • R2,994,801 – R13,310,000 — a fixed amount + <strong>11%</strong> of the value above R2,994,800<br>
  • Above R13,310,000 — a fixed amount + <strong>13%</strong> of the value above R13,310,000
</blockquote>

<h2>Who now pays zero</h2>
<p>Because the zero-duty threshold sits at <strong>R1,210,000</strong>, a large share of first-time and entry-level buyers pay <strong>no transfer duty at all</strong>. If your purchase price is at or below R1.21m, that's one big cost struck off your buying budget — money better kept for your deposit and bond costs.</p>

<img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80" alt="A South African homebuyer calculating 2026 transfer duty on a property purchase" style="width:100%;border-radius:12px;" />

<h2>A quick example</h2>
<p>On a home bought for <strong>R1,500,000</strong>: the first R1,210,000 is duty-free, and duty of 3% applies only to the R290,000 above the threshold — roughly <strong>R8,700</strong>. On a R1,000,000 home, you'd pay <strong>nothing</strong>. Because the brackets are progressive, the marginal rate only touches the portion of the price inside each band.</p>

<h2>Don't forget the other buying costs</h2>
<p>Transfer duty is just one line in your cost of buying. You'll also pay <strong>conveyancing (transfer) attorney fees</strong>, <strong>bond registration costs</strong>, and deeds-office fees — usually all payable upfront, on top of your deposit. Our <a href="/advice/first-time-home-buyer-guide-south-africa-2026">first-time home buyer guide</a> lays out the full picture so nothing catches you short.</p>

<blockquote>
  <strong>Work out your real number.</strong> <a href="/calculator">Use the Property Basket calculator</a> to estimate transfer duty and total buying costs on any price.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>How much is transfer duty in South Africa in 2026?</h3>
<p>No transfer duty is payable on properties up to R1,210,000. Above that, duty is charged progressively — 3% on the band to R1,663,800, then rising through 6%, 8% and 11% to 13% on the highest-value band. You're taxed only on the value within each band.</p>

<h3>Who is exempt from transfer duty?</h3>
<p>Buyers whose purchase price is at or below the R1,210,000 threshold pay no transfer duty. Certain transactions where VAT applies instead (typically buying from a VAT-registered developer) also fall outside transfer duty.</p>

<h3>Is transfer duty included in my bond?</h3>
<p>No. Transfer duty, conveyancing fees and bond registration costs are separate from your home loan and are normally payable upfront in cash. Budget for them in addition to your deposit.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute tax, legal or financial advice. Transfer duty brackets are set by SARS and can change each tax year — confirm the current figures with SARS, a conveyancer, or the calculator before relying on them.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'Transfer Duty in 2026: Understanding the New R1.21m Threshold';
        $post->excerpt     = 'Transfer duty is the tax to put a property in your name — and in 2026 the zero-duty threshold rose to R1,210,000. How the 2026 brackets work, who now pays nothing, and how to estimate duty on any price.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Buyers', 'Market', 'Costs'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("TransferDuty2026BlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
