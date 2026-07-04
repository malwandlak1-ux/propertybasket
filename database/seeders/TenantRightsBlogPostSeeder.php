<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * SCHEDULES "Your Rights Under the 2026 Rental Housing Amendment Act"
 * (Week 3 Monday slot) for Mon 13 Jul 2026, 07:00 SAST.
 *
 * status = published + FUTURE published_at => hidden by BlogPost::published()
 * until then, then auto-goes-live (no cron). Idempotent; scheduled date set
 * only on first insert.
 *   php artisan db:seed --class=TenantRightsBlogPostSeeder --force
 */
class TenantRightsBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('TenantRightsBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'tenant-rights-2026-rental-housing-amendment-act';
        $scheduledFor = Carbon::create(2026, 7, 13, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">If you rent your home in South Africa, 2026 brought you real new protections. The <strong>Rental Housing Amendment Act</strong> tightened the rules landlords must follow — from written leases to how your deposit is handled. Knowing your <strong>tenant rights under the 2026 Rental Housing Act</strong> means you can spot when a landlord is out of line and stand your ground.</p>

<p>Here are the key rights every South African tenant should know this year, and what to do if they're ignored.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • Your lease must now be <strong>in writing</strong> — verbal leases are no longer good enough.<br>
  • Your deposit must sit in an <strong>interest-bearing account</strong>, and you're entitled to the interest.<br>
  • Landlords must give <strong>24 hours' written notice</strong> before entering for inspections.<br>
  • Your home must meet basic <strong>habitability standards</strong>, and non-compliant landlords face fines up to <strong>R15,000</strong>.
</blockquote>

<h2>1. Written leases are now mandatory</h2>
<p>Under the amended Act, a landlord must provide a <strong>written lease agreement</strong> on request, and a verbal agreement is no longer sufficient. A written lease protects you: it fixes the rent, the escalation, the deposit amount and the notice period in black and white, so there's no "he said, she said" later. If your landlord won't put it in writing, that's a red flag.</p>

<h2>2. Your deposit must earn interest — and be returned quickly</h2>
<p>Your landlord must place your deposit in an <strong>interest-bearing account</strong> for the duration of the lease, and you can ask for proof of the interest earned at any time. When you move out with no disputes, the deposit (plus interest) must be returned within a set, short window — around <strong>seven days</strong> where there's no damage claim. We cover how to protect your deposit in our guide on <a href="/advice/how-to-get-your-rental-deposit-back-south-africa">getting your full deposit back</a>.</p>

<img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80" alt="A South African tenant reviewing their rights under the 2026 Rental Housing Amendment Act" style="width:100%;border-radius:12px;" />

<h2>3. Landlords must give notice before entering</h2>
<p>Your rented home is your private space. A landlord (or agent) must give you at least <strong>24 hours' written notice</strong> before entering for an inspection or maintenance, except in a genuine emergency. They can't simply arrive unannounced.</p>

<h2>4. Your home must be "habitable"</h2>
<p>The Act sets clearer standards for what makes a dwelling fit to live in — structural soundness, weatherproofing, and reliable access to essential services like water, electricity and sanitation. A landlord can't rent out a home that fails these basics and expect you to simply cope.</p>

<h2>5. Non-compliant landlords face real fines</h2>
<p>The amendments put teeth behind the rules: a landlord who fails to provide a written agreement when asked can face a fine of up to <strong>R15,000</strong>. That's a strong incentive for landlords to do things properly — and leverage for you if they don't.</p>

<h2>What to do if your rights are breached</h2>
<p>If a landlord ignores these rules — withholds your deposit unfairly, enters without notice, or won't fix an unsafe home — you can lodge a complaint with your provincial <strong>Rental Housing Tribunal</strong>. It's a free dispute-resolution body, and its rulings are legally binding. Keep records: your written lease, photos, and any written communication.</p>

<blockquote>
  <strong>Renting your next home?</strong> <a href="/properties">Browse verified rentals on Property Basket</a> and start your tenancy on the right footing — with a proper written lease.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>Does my landlord have to give me a written lease in South Africa?</h3>
<p>Yes. Under the 2026 Rental Housing Amendment Act, a landlord must provide a written lease agreement on request, and a landlord who fails to do so can face a fine of up to R15,000. A written lease protects both parties by recording the rent, deposit, escalation and notice terms.</p>

<h3>Can my landlord enter my home without notice?</h3>
<p>No. Except in a genuine emergency, a landlord or agent must give at least 24 hours' written notice before entering the property for an inspection or maintenance.</p>

<h3>Where can I complain if my landlord breaks the rules?</h3>
<p>You can lodge a free complaint with your provincial Rental Housing Tribunal. It resolves disputes between landlords and tenants — over deposits, unlawful entry, unsafe conditions and more — and its rulings are legally binding.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute legal advice. Rental law is applied at provincial level — confirm the current rules and procedures with your Rental Housing Tribunal or a legal professional before acting.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'Your Rights Under the 2026 Rental Housing Amendment Act';
        $post->excerpt     = 'The 2026 Rental Housing Amendment Act gave South African tenants real new protections — written leases, interest-bearing deposits, 24-hour notice and habitability standards. Know your rights.';
        $post->body        = $body;
        $post->cover_image = '/images/blog/tenant-rights-cover.jpg';
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

        $this->command?->info("TenantRightsBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
