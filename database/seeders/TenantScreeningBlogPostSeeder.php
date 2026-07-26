<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * PUBLISHES "How to Screen Tenants & Avoid Bad Payers in 2026"
 * (Week 4 Friday slot) dated Fri 24 Jul 2026, 07:00 SAST.
 *
 * The scheduled date is in the past, so the post goes live immediately via
 * BlogPost::published(). Idempotent; keyed on slug, date set only on insert.
 *   php artisan db:seed --class=TenantScreeningBlogPostSeeder --force
 */
class TenantScreeningBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('TenantScreeningBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'tenant-screening-south-africa-2026';
        $scheduledFor = Carbon::create(2026, 7, 24, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">One bad tenant can wipe out a year of rental profit. Missed rent, damage, and a drawn-out eviction cost far more than the vacancy you were trying to fill. The good news: most bad payers are predictable. Solid <strong>tenant screening in South Africa</strong> — done consistently and lawfully — is the cheapest insurance a landlord can buy.</p>

<p>Here's a practical, 2026-ready screening process, plus the red flags that reliably predict missed rent.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • Screen every applicant the <strong>same way</strong> — consistency is both fairer and legally safer.<br>
  • A <strong>credit check</strong> plus <strong>affordability ratio</strong> catches most risk before it signs.<br>
  • Rent should be no more than about <strong>30% of net income</strong>.<br>
  • <strong>Verify</strong> income and references — don't take documents at face value.
</blockquote>

<h2>1. Start with an application and consent</h2>
<p>Use a standard application form for every prospective tenant, and get <strong>written consent</strong> to run a credit and background check — this is required under POPIA. Collect ID, proof of income, and current and previous landlord references. Screening everyone identically protects you against any claim of unfair discrimination.</p>

<h2>2. Run a credit check</h2>
<p>A credit report shows judgments, defaults, and how the applicant manages existing debt. You're not looking for perfection — you're looking for a <strong>pattern</strong>. A recent rental default or multiple judgments is a far stronger warning sign than a single old blemish.</p>

<h2>3. Do the affordability maths</h2>
<p>The most useful number in screening is the <strong>rent-to-income ratio</strong>. As a rule of thumb, monthly rent should sit at or below <strong>30% of net (take-home) income</strong>. An applicant stretching to 45% will feel every interest-rate rise and unexpected cost — and rent is often the first thing to slip.</p>

<img src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80" alt="A South African landlord reviewing tenant screening documents and affordability figures in 2026" style="width:100%;border-radius:12px;" />

<h2>4. Verify income — don't just read it</h2>
<p>Payslips and bank statements can be edited. Cross-check them: do three months of bank statements show a salary matching the payslip? For self-employed applicants, ask for bank statements and recent invoices rather than a single letter. A quick verification call to an employer costs minutes and catches fabrications.</p>

<h2>5. Call the previous landlord — not just the current one</h2>
<p>A current landlord might give a glowing reference to move a problem tenant on. The <strong>previous</strong> landlord has no such incentive. Ask specifics: Did they pay on time? Did they leave the place in good condition? Would you rent to them again?</p>

<h2>The red flags that predict missed rent</h2>
<blockquote>
  ⚠ Rent above ~<strong>40% of net income</strong><br>
  ⚠ A <strong>recent rental default</strong> or eviction<br>
  ⚠ <strong>Reluctance</strong> to give consent or provide bank statements<br>
  ⚠ Income that <strong>doesn't match</strong> the lifestyle or the application<br>
  ⚠ <strong>Pressure</strong> to skip checks and "just sign today"<br>
  ⚠ No contactable <strong>previous landlord</strong>
</blockquote>

<h2>Screen consistently, decide on evidence</h2>
<p>The landlords who avoid bad payers aren't lucky — they run the same checks on everyone and decide on the numbers, not a gut feeling in a viewing. Pair good screening with a <a href="/advice/lease-agreement-requirements-south-africa-landlords">compliant written lease</a> and a signed move-in inspection, and you've removed most of the risk before the tenant gets the keys.</p>

<blockquote>
  <strong>Screen and place tenants on Property Basket.</strong> Collect applications, run checks and sign compliant leases in one place. <a href="/properties">List your property</a>.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>How do I screen a tenant in South Africa?</h3>
<p>Use a standard application, get written consent under POPIA, then run a credit check, verify income against bank statements, calculate the rent-to-income ratio, and call both the current and previous landlord. Screen every applicant the same way.</p>

<h3>What percentage of income should rent be?</h3>
<p>As a guideline, monthly rent should be no more than about 30% of a tenant's net (take-home) income. Applicants stretching well beyond that are more likely to miss payments when costs rise.</p>

<h3>Do I need a tenant's permission to run a credit check?</h3>
<p>Yes. Under POPIA you need the applicant's written consent before running a credit or background check. Getting consent as a standard part of your application form keeps your screening lawful and consistent.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute legal or financial advice. Tenant screening must comply with POPIA and fair-housing principles — confirm your process with a legal professional before acting.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = 'How to Screen Tenants & Avoid Bad Payers in 2026';
        $post->excerpt     = 'One bad tenant can wipe out a year of rental profit — and most are predictable. A practical, POPIA-compliant tenant screening process for South African landlords, plus the red flags that predict missed rent.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Landlords', 'Renting', 'Screening'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("TenantScreeningBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
