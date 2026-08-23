<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * PUBLISHES "Semigration in 2026: Is the Western Cape Still Worth It?"
 * (Week 8 Monday slot) dated Mon 17 Aug 2026, 07:00 SAST.
 *
 * The scheduled date is in the past, so the post goes live immediately via
 * BlogPost::published(). Idempotent; keyed on slug, date set only on insert.
 *   php artisan db:seed --class=SemigrationWesternCapeBlogPostSeeder --force
 */
class SemigrationWesternCapeBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('SemigrationWesternCapeBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'semigration-western-cape-2026';
        $scheduledFor = Carbon::create(2026, 8, 17, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">For the better part of a decade, the story was one-way: pack up inland, head for the coast. But in 2026 the picture is more nuanced. <strong>Semigration to the Western Cape</strong> is cooling from its frenzy — yet the Cape still commands a premium and still sells fast. So is it still worth it? Here's an honest read of the numbers before you commit your life to a moving truck.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • Western Cape demand is <strong>cooling but resilient</strong> — not crashing.<br>
  • Cape homes still carry a <strong>price premium</strong> and tend to <strong>sell faster</strong>.<br>
  • The <strong>lifestyle-vs-cost trade-off</strong> is sharper than it was five years ago.<br>
  • <strong>Where</strong> in the Cape you buy matters more than ever.
</blockquote>

<h2>The state of semigration in 2026</h2>
<p>The great migration south hasn't stopped — it's normalised. The pandemic-era surge that pushed Cape prices to eye-watering levels has eased, but the fundamentals that drew people (lifestyle, governance, safety perceptions) still pull. The result: steady, resilient demand rather than a feeding frenzy. For a buyer, that's arguably <em>better</em> — less bidding-war pressure, more room to choose well.</p>

<h2>You still pay a premium</h2>
<p>Western Cape property continues to trade at a premium to comparable inland homes, and well-located Cape stock still sells faster than the national average. That premium is the price of demand — but it also supports resale, which matters if your move might not be permanent. Buy in a sought-after node and the market tends to protect your value.</p>

<img src="https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&w=1200&q=80" alt="A Western Cape coastal home in 2026, weighing up whether semigration still pays off" style="width:100%;border-radius:12px;" />

<h2>The trade-off is sharper now</h2>
<p>The maths has shifted. Cape prices are high, and the cost of living — from rates to schooling to everyday expenses — is real. Weigh the lifestyle gain honestly against what the same budget buys you inland, and against the income you can actually earn from the Cape. For some the trade is clearly worth it; for others, 2026 is the year the sums stopped adding up. That reckoning is exactly why some buyers are heading back — see <a href="/advice/reverse-semigration-gauteng-2026">reverse semigration to Gauteng</a>.</p>

<h2>Where you buy is everything</h2>
<p>"The Western Cape" isn't one market. Established, well-run, amenity-rich areas hold value and sell quickly; over-supplied or poorly-located pockets can leave you exposed. Read the suburb before you commit — schools, security, infrastructure and future development all shape both your daily life and your resale, as we cover in <a href="/advice/neighbourhood-property-value-south-africa">how your neighbourhood affects value</a>.</p>

<blockquote>
  <strong>Thinking Cape?</strong> <a href="/properties">Browse Western Cape listings on Property Basket</a> and compare what your budget really buys.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>Is semigration to the Western Cape still worth it in 2026?</h3>
<p>For many buyers, yes — but the case is more nuanced than it was. Demand has cooled from its peak while remaining resilient, prices still carry a premium, and homes still sell faster than average. The lifestyle gain must be weighed honestly against higher costs and what your budget buys inland.</p>

<h3>Are Western Cape house prices still rising?</h3>
<p>Growth has slowed from the pandemic-era surge to a steadier pace. The Cape still commands a premium to comparable inland areas, and well-located stock continues to sell quickly, which supports resale value.</p>

<h3>Where should I buy in the Western Cape?</h3>
<p>Location within the Cape matters more than ever. Established, well-run, amenity-rich suburbs tend to hold value and sell fast, while over-supplied or poorly located areas carry more resale risk. Assess schools, security, infrastructure and development plans before committing.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial or property advice. Market conditions vary by area and change over time — confirm current figures with a property professional before acting.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'Semigration in 2026: Is the Western Cape Still Worth It?';
        $post->excerpt     = 'The one-way move south has normalised. Western Cape demand is cooling but resilient — still a premium, still fast sales. An honest read of the 2026 numbers before you commit to the move.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Buyers', 'Market', 'Western Cape'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("SemigrationWesternCapeBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
