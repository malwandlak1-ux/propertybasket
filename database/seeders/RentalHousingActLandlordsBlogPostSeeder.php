<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * PUBLISHES "What the 2026 Rental Housing Act Means for Landlords"
 * (Week 4 Monday slot) dated Mon 20 Jul 2026, 07:00 SAST.
 *
 * The scheduled date is in the past, so the post goes live immediately via
 * BlogPost::published(). Idempotent; keyed on slug, date set only on insert.
 *   php artisan db:seed --class=RentalHousingActLandlordsBlogPostSeeder --force
 */
class RentalHousingActLandlordsBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('RentalHousingActLandlordsBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'rental-housing-act-2026-landlords';
        $scheduledFor = Carbon::create(2026, 7, 20, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">2026 changed the rules of the game for South African landlords. The amended <strong>Rental Housing Act</strong> turned a set of "best practices" into hard legal duties — with fines of up to <strong>R15,000</strong> for getting them wrong. If you let property, understanding the <strong>Rental Housing Act 2026 for landlords</strong> is no longer optional; it's how you protect your income and stay out of the Tribunal.</p>

<p>This is your landlord readiness audit: the new compliance duties, the money at stake, and a short checklist to get right before your next lease.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • A <strong>written lease</strong> is now mandatory on request — failing to provide one risks a <strong>R15,000 fine</strong>.<br>
  • Deposits must sit in an <strong>interest-bearing account</strong>, with the interest owed to the tenant.<br>
  • You must give <strong>24 hours' written notice</strong> before entering an occupied property.<br>
  • Move-in and move-out <strong>inspections</strong> are your best defence in any deposit dispute.
</blockquote>

<h2>1. Written leases: your first line of defence</h2>
<p>The amended Act requires you to provide a <strong>written lease agreement</strong> whenever a tenant asks for one — and a verbal arrangement no longer cuts it. Beyond compliance, a written lease is what protects <em>you</em>: it fixes the rent, the annual escalation, the deposit and the notice period, so a dispute is settled by the document, not by memory. Treat the written lease as standard on every tenancy, not something you produce only when challenged.</p>

<h2>2. Deposit handling has real rules now</h2>
<p>You must place each tenant's deposit in an <strong>interest-bearing account</strong> for the duration of the lease, and the interest earned belongs to the tenant. When the lease ends with no damage claim, the deposit plus interest must be refunded within roughly <strong>seven days</strong>; where there's a claim, you have a little longer but must back it with itemised costs. Handling deposits properly — and documenting them — is the single biggest source of avoidable landlord-tenant disputes.</p>

<img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80" alt="A South African landlord handing over keys after signing a compliant written lease in 2026" style="width:100%;border-radius:12px;" />

<h2>3. Notice and access: the property is the tenant's home</h2>
<p>Once a tenant moves in, you can't simply arrive to inspect or do maintenance. You must give at least <strong>24 hours' written notice</strong> before entering, except in a genuine emergency such as a burst geyser. Build this into your routine: schedule inspections in writing, and keep the message as proof.</p>

<h2>4. Habitability: you can't let an unsafe home</h2>
<p>The Act sets clearer standards for a dwelling that's fit to live in — structural soundness, weatherproofing, and reliable access to water, electricity and sanitation. A property that fails these basics isn't rentable, and a tenant who reports it has the law behind them. Fixing issues promptly is cheaper than a Tribunal ruling.</p>

<h2>5. The R15,000 reason to comply</h2>
<p>The amendments put money behind the rules. A landlord who won't provide a written agreement on request can be fined up to <strong>R15,000</strong>, and repeat or serious breaches escalate from there. Compliance isn't just risk avoidance — a landlord who runs a tight, lawful tenancy attracts better tenants and keeps them longer.</p>

<h2>Your 2026 landlord compliance checklist</h2>
<p>Before your next lease starts, confirm you can tick every box:</p>
<blockquote>
  ✔ A <strong>written lease</strong> ready for every tenant<br>
  ✔ Deposit in an <strong>interest-bearing account</strong>, interest tracked<br>
  ✔ A <strong>move-in inspection</strong> completed and signed<br>
  ✔ A written process for <strong>24-hour notice</strong> before access<br>
  ✔ The property meets <strong>habitability</strong> standards<br>
  ✔ A plan to refund deposits <strong>within the deadline</strong>
</blockquote>

<blockquote>
  <strong>Let Property Basket handle the compliance heavy lifting.</strong> Generate compliant leases, hold deposits correctly and run move-in inspections in one place. <a href="/properties">See how it works</a>.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>Do landlords have to provide a written lease in South Africa in 2026?</h3>
<p>Yes. Under the amended Rental Housing Act, a landlord must provide a written lease agreement on request, and failing to do so can result in a fine of up to R15,000. A written lease also protects the landlord by recording the rent, deposit, escalation and notice terms.</p>

<h3>What must a landlord do with a tenant's deposit?</h3>
<p>The deposit must be kept in an interest-bearing account for the duration of the lease, with the interest owed to the tenant. It must be refunded — plus interest, less any itemised, justified deductions — within the statutory window after the tenant moves out.</p>

<h3>Can a landlord be fined under the Rental Housing Act?</h3>
<p>Yes. Non-compliance — such as refusing to provide a written lease — can attract fines up to R15,000, and disputes can be taken to the provincial Rental Housing Tribunal, whose rulings are legally binding.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute legal advice. Rental law is applied at provincial level — confirm the current rules and procedures with your Rental Housing Tribunal or a legal professional before acting.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'What the 2026 Rental Housing Act Means for Landlords';
        $post->excerpt     = 'The 2026 Rental Housing Act turned landlord best practice into legal duty — written leases, interest-bearing deposits, 24-hour notice and R15,000 fines. Here is your landlord readiness audit.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Landlords', 'Legal', 'Compliance'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("RentalHousingActLandlordsBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
