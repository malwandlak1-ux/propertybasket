<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * PUBLISHES "Reverse Semigration: Why Buyers Are Returning to Gauteng"
 * (Week 8 Wednesday slot) dated Wed 19 Aug 2026, 07:00 SAST.
 *
 * The scheduled date is in the past, so the post goes live immediately via
 * BlogPost::published(). Idempotent; keyed on slug, date set only on insert.
 *   php artisan db:seed --class=ReverseSemigrationGautengBlogPostSeeder --force
 */
class ReverseSemigrationGautengBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('ReverseSemigrationGautengBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'reverse-semigration-gauteng-2026';
        $scheduledFor = Carbon::create(2026, 8, 19, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">The Cape exodus, it turns out, has a return ticket. After years of buyers heading for the coast, 2026 is seeing a quiet counter-trend: <strong>reverse semigration to Gauteng</strong>. Jobs and value are pulling people back inland — and for buyers, that's opening up some of the best-value opportunities in the country.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • <strong>Jobs and income</strong> remain concentrated in Gauteng — the economic engine still hums.<br>
  • Your rand simply <strong>buys more home</strong> inland than on the coast.<br>
  • Renewed demand is showing in specific <strong>suburbs and price points</strong>.<br>
  • For value buyers, Gauteng in 2026 is a <strong>buyer's opportunity</strong>.
</blockquote>

<h2>Why buyers are moving back inland</h2>
<p>The pull that sent people to the Cape was lifestyle. The pull bringing some back is economic. Gauteng remains South Africa's job and business hub, and for many households the reality of earning is inland even if the dream is coastal. When the daily commute, the career and the school fees all point to Johannesburg or Pretoria, the maths of a Cape home stops working — and a move back makes sense.</p>

<h2>Your money goes further</h2>
<p>The single biggest driver is value. After years of Cape price premiums, the same budget buys a noticeably bigger, better-located home in Gauteng. For a family trading Cape square-metreage for inland space — or a first-time buyer priced out of the coast — the value gap is compelling. It's the mirror image of the <a href="/advice/semigration-western-cape-2026">Western Cape premium</a>.</p>

<img src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80" alt="A Gauteng suburb drawing renewed buyer demand through reverse semigration in 2026" style="width:100%;border-radius:12px;" />

<h2>Where the demand is returning</h2>
<p>Reverse semigration isn't uniform — it concentrates where value meets convenience. Established suburbs with good schools, security and access to work nodes are seeing renewed interest, as are well-priced sectional-title and cluster developments that offer lock-up-and-go living. If you're buying to return, target areas with strong fundamentals and easy access to the economic hubs.</p>

<h2>A buyer's opportunity</h2>
<p>For value-focused buyers, the inland market in 2026 rewards patience and research. With more stock and less bidding pressure than the peak Cape years, there's room to negotiate and to choose well. Read the suburb carefully — our guide to <a href="/advice/neighbourhood-property-value-south-africa">how your neighbourhood affects value</a> shows what to check before you commit.</p>

<blockquote>
  <strong>Looking inland?</strong> <a href="/properties">Explore Gauteng value buys on Property Basket</a> and see how much more your budget stretches.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>What is reverse semigration?</h3>
<p>Reverse semigration is the trend of South African buyers moving back to Gauteng after the years-long wave of relocation to the coast. It's driven mainly by jobs, income and the better property value the inland market offers.</p>

<h3>Is Gauteng property good value in 2026?</h3>
<p>Relative to the coast, generally yes. After years of Western Cape price premiums, the same budget buys a larger, often better-located home in Gauteng, and there is typically more stock and less bidding pressure — a buyer-friendly combination.</p>

<h3>Which Gauteng areas are seeing renewed demand?</h3>
<p>Demand is concentrating in established suburbs with good schools, security and access to work nodes, and in well-priced sectional-title and cluster developments offering lock-up-and-go convenience. Focus on areas with strong fundamentals and easy access to economic hubs.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial or property advice. Market trends vary and change over time — confirm current conditions with a property professional before acting.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'Reverse Semigration: Why Buyers Are Returning to Gauteng';
        $post->excerpt     = 'The Cape exodus has a return ticket. In 2026 jobs and value are pulling buyers back to Gauteng — where the rand buys more home. The suburbs and price points seeing renewed demand.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Buyers', 'Market', 'Gauteng'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("ReverseSemigrationGautengBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
