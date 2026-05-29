<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DemoBlogSeeder extends Seeder
{
    public function run(): void
    {
        $author = User::where('email', 'admin@propertybasket.local')->first()
            ?? User::orderBy('id')->first();

        if (! $author) return;

        $tags = collect([
            ['name' => 'Tenants',     'color' => '#10B981'],
            ['name' => 'Landlords',   'color' => '#5B3DF5'],
            ['name' => 'Agents',      'color' => '#F59E0B'],
            ['name' => 'Contractors', 'color' => '#EF4444'],
            ['name' => 'Market',      'color' => '#3B82F6'],
            ['name' => 'Compliance',  'color' => '#EC4899'],
        ])->mapWithKeys(fn ($t) => [
            $t['name'] => BlogTag::firstOrCreate(
                ['slug' => Str::slug($t['name'])],
                ['name' => $t['name'], 'color' => $t['color']],
            )->id,
        ]);

        $posts = [
            [
                'title'   => 'A first-time tenant\'s guide to renting in South Africa',
                'excerpt' => 'Deposits, rental escalations, your CSOS rights, and the paperwork landlords are obliged to give you.',
                'tags'    => ['Tenants'],
                'body'    => <<<'HTML'
<p>Renting your first place in South Africa? Here's the short, no-nonsense version of what you need to know before you sign.</p>
<h2>1. The lease must be in writing if you ask</h2>
<p>Under the <strong>Rental Housing Act</strong> a landlord must give you a written lease on request — verbal agreements are still legal but verge on unenforceable when things go sour.</p>
<h2>2. Deposit limits</h2>
<p>There's no statutory cap on the deposit itself, but the landlord must hold it in an interest-bearing account and pay you the interest when the lease ends.</p>
<h2>3. The incoming and outgoing inspection</h2>
<p>By law the landlord must do a joint inspection with you before you move in and again before you move out. Skipping either means the landlord forfeits the right to deduct from your deposit later.</p>
<blockquote>If your agent or landlord won't do the inspection, document the property's condition yourself with date-stamped photos and email them to the agent.</blockquote>
<h2>4. Escalation clauses</h2>
<p>Most South African leases include a 7–10% annual escalation. Negotiate it before you sign — it compounds quickly over a 24-month lease.</p>
HTML,
            ],
            [
                'title'   => 'How landlords should screen tenants — fairly and legally',
                'excerpt' => 'Affordability checks, credit bureaus, references, and the POPIA rules you absolutely cannot ignore.',
                'tags'    => ['Landlords', 'Compliance'],
                'body'    => <<<'HTML'
<p>A bad tenant can cost you a year of rent and a court order. Here's a screening framework that's defensible if you're ever audited and fair to your applicants.</p>
<h2>The basic four checks</h2>
<ul>
    <li><strong>Affordability:</strong> rent should sit at or below 30% of gross monthly income.</li>
    <li><strong>Credit bureau:</strong> a TPN, Experian or TransUnion pull. Charge the applicant the cost (with their written consent).</li>
    <li><strong>Employment letter:</strong> on the employer's letterhead, dated, confirming role + salary.</li>
    <li><strong>Two reference calls:</strong> previous landlord and a personal reference.</li>
</ul>
<h2>POPIA: the part most landlords get wrong</h2>
<p>Storing applicants' IDs and credit reports for unsuccessful applications is a <strong>POPIA violation</strong>. Delete everything within 30 days of a "no" decision and document the deletion.</p>
<h2>Anti-discrimination</h2>
<p>You may not refuse a tenant on the grounds of race, religion, language, marital status or sexual orientation. You <em>may</em> refuse on objective grounds — credit score, affordability, references — as long as you apply the criteria consistently to every applicant.</p>
HTML,
            ],
            [
                'title'   => 'The 2026 outlook: where SA property values are heading',
                'excerpt' => 'Interest-rate trajectory, semigration trends, the Cape vs Joburg gap, and where smart money is moving.',
                'tags'    => ['Market', 'Agents'],
                'body'    => <<<'HTML'
<p>Three forces are shaping property prices in 2026: the SARB's rate path, ongoing semigration, and a quietly recovering rental market.</p>
<h2>Interest rates</h2>
<p>With the repo rate holding at 7.25% through Q1 and consensus pointing to a 50bp cut by Q3, buyer affordability is the strongest it's been since 2022. Expect a modest uptick in transfers in the under-R2m segment.</p>
<h2>Cape Town keeps pulling ahead</h2>
<p>The price gap between Cape Town and Johannesburg has widened to roughly 38% on comparable suburbs. Atlantic Seaboard listings now spend an average of just 19 days on market.</p>
<h2>Rental yields stabilising</h2>
<p>Gross rental yields across major metros have settled in the 6.5–8% band. The arbitrage opportunity is in the <strong>R1.2–1.8m</strong> bracket where investor demand still hasn't caught up with rental demand.</p>
HTML,
            ],
            [
                'title'   => 'Maintenance contractors: how to price a job competitively',
                'excerpt' => 'Materials markup, labour rates, callout fees, and a worked example you can copy.',
                'tags'    => ['Contractors'],
                'body'    => <<<'HTML'
<p>Quoting too low loses money. Quoting too high loses the job. Here's the structure most established trades use in South Africa.</p>
<h2>The four line items every quote should have</h2>
<ol>
    <li><strong>Callout fee:</strong> R350–R500 in the major metros, usually credited against the job if the customer accepts.</li>
    <li><strong>Labour:</strong> billed in 30-minute increments. R450–R650 per hour for general handyman, R750–R900 for plumbers and electricians.</li>
    <li><strong>Materials:</strong> at cost plus 15–25% markup (covers your time sourcing them).</li>
    <li><strong>VAT:</strong> 15% if you're VAT-registered. List it as a separate line — never hidden in the totals.</li>
</ol>
<h2>Worked example: replacing a 150L geyser</h2>
<ul>
    <li>Geyser (Kwikot 150L): R6,200</li>
    <li>Materials markup (20%): R1,240</li>
    <li>Labour (3.5 hrs @ R750): R2,625</li>
    <li>Callout: included</li>
    <li><strong>Subtotal: R10,065 · VAT: R1,510 · Total: R11,575</strong></li>
</ul>
<p>Add a 12-month workmanship warranty in the quote notes — it's the single biggest reason agencies pick one contractor over another.</p>
HTML,
            ],
            [
                'title'   => 'FFC renewals: don\'t lose your right to operate',
                'excerpt' => 'The PPRA Fidelity Fund Certificate, why it expires every December, and the 30-day cliff edge.',
                'tags'    => ['Agents', 'Compliance'],
                'body'    => <<<'HTML'
<p>If your FFC lapses you can't legally market or transact property in South Africa — even for one day. Here's what every agent needs to have on their calendar.</p>
<h2>The annual cycle</h2>
<p>All Fidelity Fund Certificates issued by the PPRA expire on <strong>31 December</strong> regardless of when you applied. Renewals open 1 October and PPRA's stated turnaround is 21 working days — assume 30.</p>
<h2>The 30-day cliff</h2>
<p>Property Basket sends two automated reminders: one at 30 days before expiry and one at 7 days. After expiry, the platform blocks all listing-create and quote-accept actions until a renewed certificate is uploaded.</p>
<h2>What PPRA wants from you</h2>
<ul>
    <li>Current tax clearance certificate</li>
    <li>Proof of CPD compliance (15 points minimum)</li>
    <li>Agency-level FFC if you're an agency principal</li>
    <li>Renewal fee proof of payment</li>
</ul>
HTML,
            ],
        ];

        foreach ($posts as $i => $p) {
            $slug = Str::slug($p['title']);
            $publishedAt = now()->subDays(($i + 1) * 4);

            $post = BlogPost::updateOrCreate(
                ['slug' => $slug],
                [
                    'author_id'    => $author->id,
                    'title'        => $p['title'],
                    'excerpt'      => $p['excerpt'],
                    'body'         => $p['body'],
                    'status'       => 'published',
                    'published_at' => $publishedAt,
                    'view_count'   => rand(40, 2400),
                ],
            );

            $post->tags()->sync(
                collect($p['tags'])->map(fn ($name) => $tags[$name])->all()
            );
        }
    }
}
