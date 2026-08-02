<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES "Solar for Rental Properties: Boost Yield, Cut Vacancies"
 * (Week 7 Wednesday slot) for Wed 12 Aug 2026, 07:00 SAST.
 *
 * status = published + FUTURE published_at => hidden by BlogPost::published()
 * until then, then auto-goes-live (no cron). Idempotent; keyed on slug, date
 * set only on first insert.
 *   php artisan db:seed --class=SolarRentalPropertyBlogPostSeeder --force
 */
class SolarRentalPropertyBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('SolarRentalPropertyBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'solar-rental-property-south-africa';
        $scheduledFor = Carbon::create(2026, 8, 12, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">Tenants have started shopping for power security the way they shop for a second bathroom. A <strong>solar rental property in South Africa</strong> now rents faster, holds tenants longer, and can command a higher rent — turning an energy headache into a yield advantage. Here's the landlord's case for solar, the ROI, and the compliance you can't skip.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • Solar-ready rentals <strong>let faster</strong> and suffer <strong>fewer vacancies</strong>.<br>
  • You can recover the cost through a modest <strong>rent premium</strong> over time.<br>
  • Grid-tied systems need <strong>SSEG registration</strong> and a Certificate of Compliance.<br>
  • Structure the deal so <strong>who pays for what</strong> is crystal clear in the lease.
</blockquote>

<h2>Why solar cuts vacancies</h2>
<p>A vacant month is pure loss. In a market where tenants fear load-shedding and rising electricity costs, a home that keeps working through an outage stands out in the listings and gets snapped up first. Lower vacancy and longer tenancies are where solar quietly pays for itself — a property that never sits empty earns its premium every month.</p>

<h2>The ROI: rent premium + retention</h2>
<p>Two things drive the return. First, a <strong>rent premium</strong>: tenants will often pay more for a home with reliable power and lower running costs, letting you recover the install over time. Second, <strong>retention</strong>: good tenants stay in a comfortable, low-cost home, saving you the re-letting, cleaning and void costs that eat into yield. Model both when you weigh the spend.</p>

<img src="https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80" alt="A solar-ready rental property in South Africa that lets faster and cuts vacancies in 2026" style="width:100%;border-radius:12px;" />

<h2>Get the compliance right</h2>
<p>For a grid-tied system you must register it as <strong>Small-Scale Embedded Generation (SSEG)</strong> with your municipality or Eskom, and hold a valid electrical <strong>Certificate of Compliance</strong>. Skipping registration risks penalties and complicates any future sale. Treat compliance as part of the install, not an afterthought — it also protects you in any dispute with the municipality or a tenant.</p>

<h2>Structure it in the lease</h2>
<p>Be explicit about how solar changes the deal. Spell out whether the rent includes the benefit, how electricity is billed, and who maintains the system. Clarity here prevents disputes later — and a clear, compliant <a href="/advice/lease-agreement-requirements-south-africa-landlords">written lease</a> is your protection either way. Pair it with solid <a href="/advice/tenant-screening-south-africa-2026">tenant screening</a> and you've built a low-risk, high-demand rental.</p>

<blockquote>
  <strong>Got a solar-ready rental?</strong> <a href="/properties">List it on Property Basket</a> and reach the tenants who are searching specifically for reliable power.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>Is solar worth it for a rental property in South Africa?</h3>
<p>Often yes. Solar-ready rentals tend to let faster, suffer fewer vacancies, and can command a rent premium — so the system is recovered through higher occupancy and rent over time, rather than upfront. Battery backup adds the most tenant appeal.</p>

<h3>Do I need to register solar on a rental property?</h3>
<p>For grid-tied systems, yes — you need SSEG registration with your municipality or Eskom plus a valid electrical Certificate of Compliance. Registration keeps you penalty-free and protects the property's value and any future sale.</p>

<h3>Can I recover solar costs through rent?</h3>
<p>Yes, over time. Tenants will typically pay more for lower running costs and reliable power, and longer tenancies reduce void and re-letting costs. Set out clearly in the lease how solar affects the rent and electricity billing.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute financial, legal or property advice. Confirm SSEG registration and compliance requirements with your municipality or Eskom, and lease terms with a professional, before acting.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'Solar for Rental Properties: Boost Yield, Cut Vacancies';
        $post->excerpt     = 'Tenants now shop for power security like a second bathroom. Why a solar rental lets faster and holds tenants longer, the ROI through rent premium and retention, and the SSEG compliance you cannot skip.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Landlords', 'Solar', 'Yield'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("SolarRentalPropertyBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
