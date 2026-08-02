<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES "Does Solar Add Value to Your Home? The 2026 Numbers"
 * (Week 7 Monday slot) for Mon 10 Aug 2026, 07:00 SAST.
 *
 * status = published + FUTURE published_at => hidden by BlogPost::published()
 * until then, then auto-goes-live (no cron). Idempotent; keyed on slug, date
 * set only on first insert.
 *   php artisan db:seed --class=SolarAddsValueBlogPostSeeder --force
 */
class SolarAddsValueBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('SolarAddsValueBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'does-solar-add-value-to-home-south-africa';
        $scheduledFor = Carbon::create(2026, 8, 10, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">After years of load-shedding, South African buyers no longer see solar as a luxury — they see it as insurance. That shift shows up in the sale price. So <strong>does solar add value to a home in South Africa</strong>? Increasingly, yes — but how much you recover depends on the system, the paperwork, and how you market it.</p>

<p>Here are the 2026 numbers, the payback math, and how to turn your solar into a selling point.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • Solar-and-battery homes tend to sell for a <strong>premium of roughly 3–8%</strong>.<br>
  • A system with <strong>battery backup</strong> adds more value than panels alone.<br>
  • <strong>Documentation and compliance</strong> (including SSEG registration) protect that value.<br>
  • Solar also <strong>sells faster</strong> — energy security is now a top buyer priority.
</blockquote>

<h2>What solar actually adds to your sale price</h2>
<p>Estate agents and property data increasingly point to a <strong>3–8% price premium</strong> for homes with a proper solar-and-battery setup, with the biggest uplift where the system covers essential loads through an outage. On a R2m home, even a modest premium is tens of thousands of rand — often a meaningful chunk of what the system cost. Just as important, energy-secure homes <strong>attract more buyers and sell faster</strong>, which is value that doesn't show on the price tag.</p>

<h2>Panels vs panels-plus-battery</h2>
<p>Buyers value what solves their pain. Grid-tied panels that only work when the sun shines (and switch off during load-shedding) impress less than a system with a <strong>battery</strong> that keeps the lights, wifi and fridge running through an outage. If you're installing with resale in mind, backup capability is where the premium concentrates.</p>

<img src="https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80" alt="Solar panels on a South African home adding value ahead of a 2026 sale" style="width:100%;border-radius:12px;" />

<h2>Compliance is what protects the value</h2>
<p>A buyer (and their bank) will ask whether the installation is safe and legal. Keep the <strong>Certificate of Compliance</strong> for the electrical work, the installer's documentation, and — for grid-tied systems — proof of <strong>SSEG (Small-Scale Embedded Generation) registration</strong> with your municipality or Eskom. An undocumented, unregistered system is a red flag that can cost you the premium, or the sale.</p>

<h2>How to market solar when you sell</h2>
<p>Don't bury it in the amenities list. Lead with it: state the <strong>panel and battery size</strong>, what the system runs during an outage, and the <strong>monthly saving</strong> on the electricity bill. Buyers respond to concrete numbers — "keeps the whole home running for 6 hours, cuts the bill by ~R1,500/month" beats "solar installed." It's one of the highest-impact upgrades for resale — see our guide to <a href="/advice/home-improvements-that-add-value-south-africa">upgrades that add value</a>.</p>

<blockquote>
  <strong>Selling an energy-secure home?</strong> <a href="/properties">List it on Property Basket</a> and put your solar front and centre for buyers who are actively looking for it.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>Does solar increase property value in South Africa?</h3>
<p>Generally yes. Homes with a solar-and-battery system tend to command a premium of around 3–8% and sell faster, because energy security has become a top buyer priority. Battery backup adds more value than panels alone.</p>

<h3>Do I need to register my solar system to sell my home?</h3>
<p>For grid-tied systems you should have SSEG registration with your municipality or Eskom, plus a valid electrical Certificate of Compliance. Proper documentation reassures buyers and their banks and protects the value your system adds.</p>

<h3>Is solar worth it purely for resale?</h3>
<p>Installing solar only to sell rarely returns 100% of the cost immediately, but a battery-backed system narrows that gap, adds a price premium, and helps the home sell faster — while you enjoy the bill savings in the meantime.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial or property advice. Premiums vary by property and system — confirm registration and compliance requirements with your municipality, installer or a property professional.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'Does Solar Add Value to Your Home? The 2026 Numbers';
        $post->excerpt     = 'South African buyers now treat solar as insurance, not luxury — and it shows in the price. The 2026 numbers on the solar premium, the payback math, and how to market an energy-secure home when you sell.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Sellers', 'Solar', 'Value'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("SolarAddsValueBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
