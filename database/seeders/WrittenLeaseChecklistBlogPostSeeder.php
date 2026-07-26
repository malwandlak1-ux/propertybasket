<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * PUBLISHES "Written Leases Are Now Mandatory: A Landlord's Checklist"
 * (Week 4 Wednesday slot) dated Wed 22 Jul 2026, 07:00 SAST.
 *
 * The scheduled date is in the past, so the post goes live immediately via
 * BlogPost::published(). Idempotent; keyed on slug, date set only on insert.
 *   php artisan db:seed --class=WrittenLeaseChecklistBlogPostSeeder --force
 */
class WrittenLeaseChecklistBlogPostSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::role('super_admin')->first() ?? User::first();

        if (! $author) {
            $this->command?->warn('WrittenLeaseChecklistBlogPostSeeder: no user found — skipping.');
            return;
        }

        $slug         = 'lease-agreement-requirements-south-africa-landlords';
        $scheduledFor = Carbon::create(2026, 7, 22, 7, 0, 0, 'Africa/Johannesburg');

        $body = <<<'BODY'
<p style="font-size:19px;color:#1e293b;font-weight:500;">Since the 2026 Rental Housing Amendment Act, a <strong>written lease is mandatory</strong> in South Africa the moment a tenant asks for one. But "having something in writing" isn't the same as having an <em>enforceable</em> lease. Get the <strong>lease agreement requirements in South Africa</strong> right and the document protects you; leave clauses out and it can quietly work against you.</p>

<p>Here's exactly what every 2026 lease must contain — and the clauses landlords most often forget.</p>

<blockquote>
  <strong>Key takeaways</strong><br>
  • A written lease is now <strong>required on request</strong> — no written lease can mean a <strong>R15,000 fine</strong>.<br>
  • The lease must name the <strong>parties, property, rent, deposit and duration</strong> to be enforceable.<br>
  • Spell out <strong>escalation, notice and maintenance</strong> — vague terms are read against the landlord.<br>
  • Attach a signed <strong>move-in inspection</strong> so the deposit is defensible later.
</blockquote>

<h2>The clauses your lease must contain</h2>
<p>An enforceable South African lease starts with the basics, clearly stated:</p>
<blockquote>
  ✔ <strong>The parties</strong> — full names and ID numbers of landlord and tenant<br>
  ✔ <strong>The property</strong> — the full address and what's included (parking, appliances)<br>
  ✔ <strong>The rent</strong> — the amount, the due date, and how to pay<br>
  ✔ <strong>The deposit</strong> — the amount and that it's held in an interest-bearing account<br>
  ✔ <strong>The lease period</strong> — start and end dates, and what happens on expiry<br>
  ✔ <strong>Signatures</strong> — signed and dated by both parties
</blockquote>

<h2>The clauses landlords forget — and regret</h2>

<h3>1. Annual escalation</h3>
<p>State the <strong>escalation percentage</strong> and when it applies. Without it, you can't lawfully raise the rent mid-lease, and you'll argue about it every renewal. A clear "8% on each anniversary" line ends the debate before it starts.</p>

<h3>2. Notice period</h3>
<p>Spell out the <strong>notice</strong> each party must give to end or not renew the lease — typically one calendar month, in writing. An unstated notice period is a gift to a tenant who wants to leave early.</p>

<img src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80" alt="A landlord and tenant reviewing the required clauses of a written lease agreement in South Africa" style="width:100%;border-radius:12px;" />

<h3>3. Maintenance responsibilities</h3>
<p>Say who fixes what. Structural and essential-service repairs sit with the landlord; day-to-day upkeep and tenant-caused damage sit with the tenant. Ambiguity here is read <em>against</em> the party who drafted the lease — usually you.</p>

<h3>4. The move-in inspection</h3>
<p>The Act leans hard on inspections. A <strong>signed move-in inspection</strong>, attached to the lease, records the property's condition on day one. It's the evidence that makes any future deposit deduction defensible — and its absence is why landlords lose deposit disputes. We explain the tenant's side in our guide to <a href="/advice/how-to-get-your-rental-deposit-back-south-africa">getting a deposit back</a>.</p>

<h3>5. House rules and use</h3>
<p>Pets, subletting, sectional-title conduct rules, and what the property may be used for. If it matters to you, it belongs in the lease — a rule that isn't written down isn't enforceable.</p>

<h2>Written, signed, and kept</h2>
<p>A lease only protects you if it's signed by both parties and you keep a copy you can produce on request. Digital, signed leases are fully valid in South Africa — and far easier to store, find and prove than a folder of paper.</p>

<blockquote>
  <strong>Generate a compliant lease in minutes.</strong> Property Basket builds leases with every required clause, captures signatures, and stores them against the tenancy. <a href="/properties">Get started</a>.
</blockquote>

<h2>Frequently asked questions</h2>

<h3>What must a lease agreement contain in South Africa?</h3>
<p>An enforceable lease must identify the parties and property and set out the rent, deposit, lease period and signatures. To avoid disputes it should also cover escalation, notice, maintenance responsibilities and a signed move-in inspection.</p>

<h3>Is a verbal lease legal in South Africa?</h3>
<p>A verbal lease can exist, but since the 2026 Rental Housing Amendment Act a landlord must provide a written lease on request, and failing to do so can result in a fine of up to R15,000. A written lease is also far easier to enforce.</p>

<h3>Are digital or e-signed leases valid?</h3>
<p>Yes. Electronically signed lease agreements are legally valid in South Africa, provided both parties agree to the terms. Digital leases are easier to store and produce as proof than paper copies.</p>

<p style="font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:26px;"><em>Disclaimer: This article is for general information and does not constitute legal advice. Confirm current lease requirements with a legal professional or your Rental Housing Tribunal before acting.</em></p>
BODY;

        $post = BlogPost::firstOrNew(['slug' => $slug]);
        $wasNew = ! $post->exists;

        $post->author_id   = $author->id;
        $post->title       = "Written Leases Are Now Mandatory: A Landlord's Checklist";
        $post->excerpt     = 'A written lease is mandatory in South Africa since 2026 — but only an enforceable one protects you. Here is every clause your lease must contain, and the ones landlords forget.';
        $post->body        = $body;
        $post->cover_image = 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80';
        $post->status      = 'published';

        if ($wasNew) {
            $post->published_at = $scheduledFor;
        }

        $post->save();

        $tagIds = collect(['Landlords', 'Legal', 'Leasing'])
            ->map(fn (string $name) => BlogTag::firstOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'color' => '#F26A1B'],
            )->id)
            ->all();

        $post->tags()->sync($tagIds);

        $state = $post->published_at && $post->published_at->isFuture()
            ? "scheduled for {$post->published_at->format('D d M Y H:i')} (SAST)"
            : 'live';

        $this->command?->info("WrittenLeaseChecklistBlogPostSeeder: \"{$post->title}\" — {$state} at /advice/{$slug}");
    }
}
