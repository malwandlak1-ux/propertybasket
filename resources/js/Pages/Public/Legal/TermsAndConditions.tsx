import { Head } from '@inertiajs/react';
import { LegalShell, LegalMeta } from './_Shell';

type Props = { meta: LegalMeta };

export default function TermsAndConditions({ meta }: Props) {
    return (
        <LegalShell
            title="Terms and Conditions"
            subtitle={`The agreement that governs your use of Property Basket.`}
            meta={meta}
        >
            <Head title="Terms and Conditions" />

            <p>
                These Terms and Conditions ("Terms") are entered into between {meta.company_name} and any person or business that uses the Property Basket platform. By creating an account or transacting through the platform, you agree to be bound by these Terms.
            </p>

            <h2>1. Acceptance</h2>
            <p>
                Using any part of propertybasket.co.za, the dashboards, or our APIs constitutes acceptance of these Terms and the linked <a href="/privacy-policy">Privacy Policy</a>. If you are using the platform on behalf of an agency, landlord business or contractor company, you warrant that you have authority to bind that entity.
            </p>

            <h2>2. Definitions</h2>
            <ul>
                <li><strong>"Platform"</strong> — the Property Basket website, dashboards and mobile experiences operated by us.</li>
                <li><strong>"Agency"</strong> — an EAAB/PPRA-registered property practitioner business that subscribes to the Platform.</li>
                <li><strong>"Agent"</strong> — a natural-person estate agent operating under an Agency.</li>
                <li><strong>"Landlord"</strong> — a private property owner who lists properties through the Platform.</li>
                <li><strong>"Tenant"</strong> — a person leasing a property advertised on the Platform.</li>
                <li><strong>"Contractor"</strong> — a maintenance service provider registered on the Platform.</li>
                <li><strong>"User"</strong> — any of the above.</li>
            </ul>

            <h2>3. Account and registration</h2>
            <p>
                You must register accurately and keep your information current. You are responsible for safeguarding your password and for all activity that occurs under your account. Notify us immediately at <a href={`mailto:${meta.support_email}`}>{meta.support_email}</a> if you suspect unauthorised access.
            </p>
            <p>
                We may suspend or close accounts that breach these Terms, are inactive for extended periods, or where we have reasonable grounds to suspect fraud.
            </p>

            <h2>4. Roles and responsibilities</h2>
            <h3>4.1 Agencies and Agents</h3>
            <ul>
                <li>Must hold a valid Fidelity Fund Certificate ("FFC") issued by the PPRA and upload proof to the Platform. Listings will be gated when the FFC is missing or expired.</li>
                <li>Must operate a trust account compliant with Section 54 of the Property Practitioners Act, with disclosed bank details and a registered practice auditor.</li>
                <li>Are responsible for the accuracy of every listing they publish.</li>
                <li>Are responsible for their commission split arrangements with each agent.</li>
            </ul>
            <h3>4.2 Landlords</h3>
            <ul>
                <li>Must complete FICA verification before publishing listings, accepting payments, or signing leases.</li>
                <li>Warrant that they have the right to lease the property and that all listing content (photos, descriptions, pricing) is accurate.</li>
                <li>Acknowledge that they remain the Responsible Party for tenant-related decisions notwithstanding any tooling the Platform provides.</li>
            </ul>
            <h3>4.3 Tenants and buyers</h3>
            <ul>
                <li>Must provide accurate information when applying for a lease or submitting offers.</li>
                <li>Are responsible for honouring authorised debit-order mandates and timely rent payments.</li>
                <li>May exercise consumer-protection rights under the Consumer Protection Act and the Rental Housing Act regardless of these Terms.</li>
            </ul>
            <h3>4.4 Contractors</h3>
            <ul>
                <li>Must keep CIPC registration, tax-clearance and insurance documentation current. The Platform may suspend marketplace access when documents lapse.</li>
                <li>Are independent service providers — we do not employ contractors, and contractors are not our agents.</li>
                <li>Are responsible for the quality and warranty of their work directly to the engaging Agency or Landlord.</li>
            </ul>

            <h2>5. Payments and Paystack</h2>
            <p>
                All payments on the Platform are processed by <strong>Paystack Payments (Pty) Ltd</strong>. By transacting, you agree to Paystack's terms in addition to ours.
            </p>
            <ul>
                <li>Subscription fees are charged in advance. Cancelling does not entitle you to a pro-rata refund for the current billing period.</li>
                <li>Rent payments transit through the receiving Agency's trust account. The Platform records the transaction but does not act as a payment institution.</li>
                <li>Contractor invoices, once accepted by an Agency or Landlord, are settled via Paystack transfer 1–2 business days after authorisation.</li>
                <li>Failed payments may be retried. Repeated failures may result in account suspension.</li>
            </ul>

            <h2>6. Listings and user content</h2>
            <p>
                You retain ownership of content you upload (photos, descriptions, documents). By uploading you grant us a non-exclusive, royalty-free, worldwide licence to host, reproduce, display and distribute that content as needed to operate the Platform.
            </p>
            <p>
                You may not upload content that is unlawful, infringes a third party's rights, contains misleading information, or that you do not have the right to publish.
            </p>

            <h2>7. Prohibited conduct</h2>
            <ul>
                <li>Misrepresentation of identity, qualifications, or property ownership</li>
                <li>Circumventing FFC, FICA or marketplace verification checks</li>
                <li>Routing payments outside the Platform to avoid platform fees ("bypassing")</li>
                <li>Unsolicited commercial messaging (spam) to other users</li>
                <li>Reverse-engineering, scraping at scale, or interfering with Platform infrastructure</li>
            </ul>

            <h2>8. Fees</h2>
            <p>
                Current subscription pricing and contractor platform-fee rates are displayed in your dashboard's Billing tab and on <a href="/calculator">our public pages</a>. Fees may change with at least 30 days' notice; changes apply prospectively from the start of your next billing period.
            </p>

            <h2>9. Intellectual property</h2>
            <p>
                The Property Basket name, logo, look-and-feel and the underlying software are owned by {meta.company_name}. Nothing in these Terms grants you a licence to our IP beyond what is necessary to use the Platform.
            </p>

            <h2>10. Disputes between users</h2>
            <p>
                The Platform is a marketplace facilitator — we are not party to lease, sale or service contracts between users. Disputes (commission disputes, lease disagreements, contractor quality complaints) must be resolved directly between the affected parties. We may, at our discretion, provide transaction records or other neutral information to assist resolution.
            </p>

            <h2>11. Limitation of liability</h2>
            <p>
                To the maximum extent permitted by law, our aggregate liability arising out of or relating to the Platform is limited to the fees you have paid to us in the 12 months preceding the event giving rise to the claim. We are not liable for indirect, incidental or consequential losses (including loss of profit, business or data).
            </p>
            <p>
                Nothing in these Terms limits liability that cannot lawfully be limited under South African consumer-protection or data-protection law.
            </p>

            <h2>12. Indemnity</h2>
            <p>
                You agree to indemnify and hold {meta.company_name} harmless from third-party claims arising out of: (a) your breach of these Terms; (b) inaccurate content you publish; (c) your violation of any applicable law; or (d) infringement of any third party's rights.
            </p>

            <h2>13. Termination</h2>
            <p>
                Either party may terminate the agreement at any time. We may suspend or terminate immediately for material breach, fraud, or non-payment. On termination, your access ends but our retention obligations and accrued payment obligations survive.
            </p>

            <h2>14. Changes to these Terms</h2>
            <p>
                We may amend these Terms from time to time. Material changes will be notified by email and posted with a revised "Last updated" date. Continued use after the effective date constitutes acceptance.
            </p>

            <h2>15. Governing law and jurisdiction</h2>
            <p>
                These Terms are governed by the laws of the {meta.jurisdiction}. Disputes that cannot be settled by negotiation will be referred to the relevant Magistrate's or High Court in the jurisdiction in which {meta.company_name} is registered, without prejudice to any consumer-protection rights of natural persons.
            </p>

            <h2>16. Contact</h2>
            <p>
                Support: <a href={`mailto:${meta.support_email}`}>{meta.support_email}</a> · <a href={`tel:${meta.support_phone}`}>{meta.support_phone}</a><br />
                Information Officer (POPIA): <a href={`mailto:${meta.information_officer}`}>{meta.information_officer}</a>
            </p>
        </LegalShell>
    );
}
