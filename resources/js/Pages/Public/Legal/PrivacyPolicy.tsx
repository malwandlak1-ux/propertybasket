import { Head } from '@inertiajs/react';
import { LegalShell, LegalMeta } from './_Shell';

type Props = { meta: LegalMeta };

export default function PrivacyPolicy({ meta }: Props) {
    return (
        <LegalShell
            title="Privacy Policy"
            subtitle={`How ${meta.company_name} collects, uses and protects your personal information.`}
            meta={meta}
        >
            <Head title="Privacy Policy" />

            <p>
                This Privacy Policy explains how {meta.company_name} ("we", "us", "Property Basket") handles personal information processed through propertybasket.co.za and the Property Basket dashboards. It is written to comply with the <strong>Protection of Personal Information Act, 4 of 2013</strong> ("POPIA") of the {meta.jurisdiction}.
            </p>

            <h2>1. Who we are</h2>
            <p>
                {meta.company_name} is the operator of the Property Basket platform — a multi-sided proptech marketplace connecting estate agencies, real-estate agents, landlords, tenants, buyers and maintenance contractors across South Africa. We act as the <strong>Responsible Party</strong> under POPIA for personal information collected through our platform.
            </p>
            <p>
                Our Information Officer can be reached at <a href={`mailto:${meta.information_officer}`}>{meta.information_officer}</a>.
            </p>

            <h2>2. What information we collect</h2>
            <p>The categories of personal information we process depend on the role you hold on the platform:</p>
            <h3>2.1 All users</h3>
            <ul>
                <li>Name, email address, phone number, profile photo</li>
                <li>Account credentials (passwords are stored only as cryptographic hashes — never in plain text)</li>
                <li>Device, browser and IP information collected automatically when you use the site</li>
                <li>Communications you send through our messaging or inquiry forms</li>
            </ul>
            <h3>2.2 Agencies and agents</h3>
            <ul>
                <li>Business details — registered name, head-office address, VAT registration number</li>
                <li>PPRA Fidelity Fund Certificate ("FFC") number, expiry date and certificate file</li>
                <li>Trust account details — bank, account number, branch code, auditor and practice number — collected pursuant to Section 54 of the Property Practitioners Act</li>
                <li>Commission split arrangements and lead allocation preferences</li>
            </ul>
            <h3>2.3 Landlords</h3>
            <ul>
                <li>South African ID number and FICA verification documents</li>
                <li>Bank account details for rental payouts</li>
                <li>Property and listing information you choose to publish</li>
            </ul>
            <h3>2.4 Tenants</h3>
            <ul>
                <li>Lease application information, ID number for credit and affordability checks where applicable</li>
                <li>Rental payment history processed via our payment partner</li>
                <li>Debit order mandates you authorise</li>
                <li>Maintenance request details and supporting media (photos, descriptions)</li>
            </ul>
            <h3>2.5 Contractors</h3>
            <ul>
                <li>Business name, CIPC registration, tax clearance and insurance certificates</li>
                <li>Bank account details for invoice payouts</li>
                <li>Service areas, specialities, ratings and job history on the platform</li>
            </ul>

            <h2>3. How we collect it</h2>
            <p>We collect personal information:</p>
            <ul>
                <li>Directly from you when you register, complete forms, upload documents or message other users</li>
                <li>From an agency or landlord who invites you to the platform (e.g. tenant onboarding)</li>
                <li>From third-party services we integrate with, such as Paystack (payment authorisation tokens) and the Hostinger infrastructure that hosts the platform</li>
                <li>Automatically through standard web logs and analytics cookies</li>
            </ul>

            <h2>4. Why we collect it (lawful purposes)</h2>
            <ul>
                <li><strong>Performance of contract</strong> — to operate your account, list properties, take rental payments, run inspections, allocate maintenance jobs and produce receipts</li>
                <li><strong>Legal obligation</strong> — to comply with FICA verification for landlords, FFC verification for agents under the Property Practitioners Act, and tax invoicing</li>
                <li><strong>Legitimate interest</strong> — to protect the platform from fraud, abuse and to improve our service</li>
                <li><strong>Consent</strong> — for marketing communications and optional cookies (which you may withdraw at any time)</li>
            </ul>

            <h2>5. Who we share it with</h2>
            <p>We do not sell your personal information. We share specific information only as needed:</p>
            <ul>
                <li><strong>Other users you transact with</strong> — for example, your name and contact details when you inquire about a listing</li>
                <li><strong>Service providers ("Operators" under POPIA)</strong> — payment processing (Paystack), email delivery, file storage (Hostinger), error monitoring. They process your data only on our instructions and under written contract.</li>
                <li><strong>Regulators and law-enforcement</strong> — where required by court order or applicable law</li>
                <li><strong>In a business sale or merger</strong> — your information may transfer with the business; you'll be notified before any change of Responsible Party</li>
            </ul>

            <h2>6. Cross-border transfers</h2>
            <p>
                Our primary hosting is provided by Hostinger International with infrastructure in Europe. POPIA permits cross-border transfers where the receiving country provides adequate protection or where you have consented. By using the platform you consent to this transfer.
            </p>

            <h2>7. How long we keep it</h2>
            <ul>
                <li>Active account data — for as long as your account is active</li>
                <li>Closed account profile data — up to 7 years after closure to comply with financial-record-keeping obligations</li>
                <li>Lease and payment records — minimum 5 years per the Tax Administration Act</li>
                <li>FFC and FICA documentation — minimum 5 years per the Property Practitioners Act and FIC Act</li>
                <li>Marketing preferences — until you opt out</li>
            </ul>

            <h2>8. How we secure it</h2>
            <ul>
                <li>HTTPS/TLS encryption for all data in transit</li>
                <li>Passwords stored as bcrypt hashes</li>
                <li>Role-based access control — each user only sees what their role permits</li>
                <li>Encrypted session cookies (HttpOnly, Secure, SameSite=Lax)</li>
                <li>Daily backups with point-in-time database snapshots</li>
                <li>Audit logging for sensitive admin actions</li>
            </ul>

            <h2>9. Your POPIA rights</h2>
            <p>Subject to POPIA, you have the right to:</p>
            <ul>
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion (subject to our legal retention obligations above)</li>
                <li>Object to processing for direct-marketing purposes</li>
                <li>Lodge a complaint with the Information Regulator at inforeg@justice.gov.za</li>
            </ul>
            <p>
                Exercise these rights through the <a href="/privacy-portal">Privacy Portal</a> — we'll acknowledge within 3 business days and respond fully within 30 days.
            </p>

            <h2>10. Cookies</h2>
            <p>
                We use essential cookies to keep you logged in and remember your session. Optional analytics cookies help us understand how visitors use the site; you may decline these at any time without losing functionality.
            </p>

            <h2>11. Children</h2>
            <p>
                The platform is not directed at children under 18. We do not knowingly collect personal information from minors. If you believe a minor's information has been provided to us, contact our Information Officer for prompt deletion.
            </p>

            <h2>12. Updates</h2>
            <p>
                We may update this Privacy Policy from time to time. Material changes will be communicated by email and posted with a revised "Last updated" date at the top of this page. Continued use of the platform after the effective date constitutes acceptance.
            </p>

            <h2>13. Contact</h2>
            <p>
                Information Officer: <a href={`mailto:${meta.information_officer}`}>{meta.information_officer}</a><br />
                Support: <a href={`mailto:${meta.support_email}`}>{meta.support_email}</a> · <a href={`tel:${meta.support_phone}`}>{meta.support_phone}</a>
            </p>
        </LegalShell>
    );
}
