import { Guide } from './types';

/** Agency (agency admin) dashboard guides. */
export const AGENCY_GUIDES: Guide[] = [
    // ── Getting started ────────────────────────────────────────────────
    {
        id: 'dashboard',
        category: 'Getting started',
        title: 'Your agency dashboard at a glance',
        summary: 'What the Dashboard shows and where to start.',
        steps: [
            'Open Dashboard in the menu on the left.',
            'The tiles show live listings, leads, pipeline value, commission and your next payout day.',
            'The red banner at the top appears when the agency FFC is missing or expired: listings are blocked until you fix it (see "Upload the agency FFC").',
            'Use the bell at the top right for notifications such as new leads, quotes and invoices.',
        ],
        link: { label: 'Open Dashboard', href: '/agency' },
    },
    {
        id: 'ffc',
        category: 'Getting started',
        title: 'Upload the agency FFC (EAAB & Compliance)',
        summary: 'Required by law before any listing can be marketed.',
        steps: [
            'Go to EAAB & Compliance.',
            'Enter the EAAB FFC number and the expiry date from your PPRA certificate.',
            'Choose the certificate file (PDF, JPG or PNG, up to 10 MB).',
            'Click Save certificate. The status in the summary strip turns Valid.',
        ],
        tips: ['Reminder emails are sent automatically 30 days before the certificate expires.'],
        link: { label: 'Open EAAB & Compliance', href: '/agency/compliance' },
    },
    {
        id: 'trust',
        category: 'Getting started',
        title: 'Set up the trust account',
        summary: 'The PPRA trust account where deposits and advance rent are held.',
        steps: [
            'Go to Trust Account.',
            'Under Bank Account choose the bank and account type, then enter the account holder, account number and branch code.',
            'Under Annual Auditor enter the auditor firm and IRBA practice number.',
            'Click Save trust account. It shows "In review" until the platform verifies it.',
        ],
        tips: ['Tenants see these details when they pay a deposit or rent by EFT on agency-managed leases.'],
        link: { label: 'Open Trust Account', href: '/agency/trust-account' },
    },
    {
        id: 'invite-agent',
        category: 'Getting started',
        title: 'Invite an agent',
        summary: 'Add agents to your team so they can list properties and work leads.',
        steps: [
            'Go to Agents and click Invite Agent.',
            'Enter the agent’s name and email and their commission split.',
            'Send the invite. The agent gets an email to set up their login and appears under Pending invitations.',
            'Once they accept, they appear in All Agents with their FFC status and Paystack link.',
        ],
        tips: ['Agents need a valid FFC of their own before they can create or edit listings.'],
        link: { label: 'Open Agents', href: '/agency/agents' },
    },

    // ── Listings & leads ───────────────────────────────────────────────
    {
        id: 'listing',
        category: 'Listings & leads',
        title: 'Capture a property for sale or rent',
        summary: 'Create a listing on behalf of the agency.',
        steps: [
            'Go to Listings & Leads and click New Listing.',
            'Step 1: choose For Sale or For Rent.',
            'Fill in the details, price, location, amenities and photos in the remaining steps.',
            'Choose the agent responsible, or leave it on round-robin.',
            'Save the listing. It appears in your listings and on the public site.',
        ],
        link: { label: 'Open Listings & Leads', href: '/agency/listings' },
    },
    {
        id: 'leads',
        category: 'Listings & leads',
        title: 'How leads are allocated',
        summary: 'Website enquiries are shared out to agents automatically.',
        steps: [
            'Go to Listings & Leads. The Lead Queue shows the most recent leads and who they went to.',
            'With round-robin on, each new lead goes to the next available agent in turn.',
            'Use Reassign agent on a lead to move it to someone else.',
            'Leads marked UNASSIGNED need an agent: assign one from the same screen.',
        ],
        link: { label: 'Open Listings & Leads', href: '/agency/listings' },
    },
    {
        id: 'pipeline',
        category: 'Listings & leads',
        title: 'Track deals and register a sale',
        summary: 'See every agent’s deals in one pipeline.',
        steps: [
            'Go to Pipeline. Deals move from New Lead through Qualified, Viewing and Offer to Closed.',
            'Filter by agent or by sales/rentals with the dropdowns at the top.',
            'When a deal is closed, click Register deal on its card. This finalises the deal and queues the agent’s commission.',
        ],
        link: { label: 'Open Pipeline', href: '/agency/pipeline' },
    },

    // ── People ─────────────────────────────────────────────────────────
    {
        id: 'tenants',
        category: 'Tenants & landlords',
        title: 'Manage tenants and deposits',
        summary: 'Every tenant placed by your agents, with deposit status.',
        steps: [
            'Go to Tenants. Use the search box or switch between Active and Archived.',
            'When a tenant’s deposit lands in the trust account, click Mark received on their card. The deposit moves from Due to Held.',
            'Archived tenants are your remarketing pool for new listings.',
        ],
        link: { label: 'Open Tenants', href: '/agency/tenants' },
    },
    {
        id: 'landlords',
        category: 'Tenants & landlords',
        title: 'Add a managed landlord and pay them',
        summary: 'Landlords who appointed you to manage their rentals.',
        steps: [
            'Go to Landlords and click + Add landlord. Enter their details and banking (used for payouts).',
            'Click + Link property on the landlord and choose the rental, then set the split of rent between landlord, agency and agent (must total 100%).',
            'Each month, click Run payment batch to record what is paid to each landlord and the agency and agent shares.',
            'Payout History lists every batch already run.',
        ],
        link: { label: 'Open Landlords', href: '/agency/landlords' },
    },
    {
        id: 'messages',
        category: 'Tenants & landlords',
        title: 'Message your team or send a broadcast',
        summary: 'Direct chats with agents and team-wide announcements.',
        steps: [
            'Go to Team Messages and pick a conversation to chat.',
            'Click New broadcast to send one message to every agent.',
        ],
        link: { label: 'Open Team Messages', href: '/agency/messages' },
    },

    // ── Maintenance ────────────────────────────────────────────────────
    {
        id: 'contractors',
        category: 'Maintenance',
        title: 'Add a contractor',
        summary: 'Keep your trusted contractors one click away.',
        steps: [
            'Go to Contractors and click Add Contractor.',
            'Enter the business and contact details, specialities and service areas, then save.',
            'They appear under My Contractors. The Marketplace tab lists other contractors on the platform.',
        ],
        link: { label: 'Open Contractors', href: '/agency/contractors' },
    },
    {
        id: 'maintenance',
        category: 'Maintenance',
        title: 'Get a repair quoted, approved and paid',
        summary: 'From a tenant’s request to a paid contractor.',
        steps: [
            'New tenant requests appear on Maintenance under Needs allocation.',
            'Click Request quote and choose a contractor, or Post to marketplace to let area contractors quote.',
            'Click Review quotes, then Accept the quote you want (others on the job are declined) or Reject it.',
            'The contractor schedules and completes the work, then submits an invoice.',
            'Pay contractor invoices from Commission & Payouts under Contractor Invoices.',
            'Rate the contractor on the completed job.',
        ],
        link: { label: 'Open Maintenance', href: '/agency/maintenance' },
    },

    // ── Money ──────────────────────────────────────────────────────────
    {
        id: 'commission',
        category: 'Money & reports',
        title: 'Approve commission and run payouts',
        summary: 'Pay agents their share of registered deals.',
        steps: [
            'Go to Commission & Payouts. Registered deals appear in the Payout Queue.',
            'Tick the rows and click Approve selected.',
            'On payout day, click Run Payout Batch to transfer each agent’s net commission.',
            'Agents need banking details or a Paystack link first; rows without one show NO PAYOUT METHOD.',
            'Payout Settings sets the cycle, payout day and the sale and rental commission structure.',
        ],
        link: { label: 'Open Commission & Payouts', href: '/agency/commissions' },
    },
    {
        id: 'reports',
        category: 'Money & reports',
        title: 'Read the financial reports',
        summary: 'Income, cash flow, trust balance and VAT in one place.',
        steps: [
            'Go to Financial Reports.',
            'The Income Statement Summary shows gross commission, agent payouts, VAT and net to agency.',
            'Cash Flow Trend compares money in and out over the last six months.',
            'Revenue Contribution by Agent shows each agent’s sales and rental value and commission.',
            'The VAT panel shows the current SARS period, amount and filing deadline.',
        ],
        link: { label: 'Open Financial Reports', href: '/agency/reports' },
    },

    // ── Account ────────────────────────────────────────────────────────
    {
        id: 'settings',
        category: 'Account',
        title: 'Update agency settings',
        summary: 'Profile, VAT, trust account, payouts, FFC and appearance.',
        steps: [
            'Go to Settings and pick a section on the left: General Profile, VAT & Tax, Trust Account, Payouts & Paystack, EAAB & Compliance or Appearance.',
            'Make your changes and click Save Changes.',
            'Appearance changes the dashboard colour and logo for you and your agents.',
        ],
        link: { label: 'Open Settings', href: '/agency/settings' },
    },
    {
        id: 'billing',
        category: 'Account',
        title: 'Change your subscription plan',
        summary: 'See your plan and switch to another.',
        steps: [
            'Go to Billing & Plan. The summary shows your plan, monthly cost and renewal date.',
            'Under Available Plans, click Switch to … on the plan you want and confirm.',
        ],
        link: { label: 'Open Billing & Plan', href: '/agency/billing' },
    },
];
