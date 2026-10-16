// Ported from Property Farming/Farming-Dashboard.html — the 6-approach
// farming playbook (call + email scripts) and the standard value-report message.

export type Approach = { id: number; name: string; desc: string; point: string; call: string; subject: string; email: string };

export const PLAYBOOK: Approach[] = [
    {
        "id": 1,
        "name": "Farm 11yr+ owners",
        "desc": "Owners who've held 11+ years — the most reliable seller pool in the farm.",
        "point": "You've built up serious equity, the market is high, and well-kept homes here are scarce — test the water with zero obligation.",
        "call": "Good morning, is this [Owner name]? My name is [Your name] from [Agency] — I specialise in [Suburb], so I'll be brief. I noticed you've owned your home here for a good number of years, which usually means you're sitting on significant equity, especially at today's prices. I'm not calling to pressure you to sell — I reach out to owners like you because well-priced [Suburb] homes are genuinely scarce and in demand. Would you be open to a free, no-obligation valuation, just so you know what your property is worth today? ... Wonderful — would [day] or [day] suit you better?\n\nIf hesitant: \"Even if selling isn't on your mind, knowing your current value helps with insurance, rates and estate planning. It only takes about 20 minutes.\"",
        "subject": "What your [Suburb] home is worth in today's market",
        "email": "Hi [Owner name],\n\nI'm [Your name], a property specialist focused on [Suburb]. Homes that have been well cared for over many years are exactly what today's buyers are competing for — and stock is tight.\n\nI'd like to offer you a free, no-obligation valuation so you have an accurate picture of your home's current worth, whether you sell now, later, or not at all (it's useful for estate and financial planning too).\n\nReply with a good time this week and I'll take care of the rest.\n\nWarm regards,\n[Your name] · [Agency] · [phone]"
    },
    {
        "id": 2,
        "name": "Downsizing & estate pipeline",
        "desc": "Older owner bases where sales come from downsizing and deceased estates.",
        "point": "A simpler, lock-up-and-go lifestyle frees up time and capital — and I handle the whole move, discreetly, start to finish.",
        "call": "Hello [Owner name], this is [Your name] from [Agency] — I work exclusively in [Suburb]. I help a lot of homeowners think through their next chapter, whether that's downsizing to something more manageable or supporting family with an estate. I look after the whole process discreetly, from valuation to transfer, so it's as stress-free as possible. Is a smaller, easier-to-run home something that might appeal to you or someone in your family at this stage? ... I'd be glad to have a relaxed, no-pressure chat about your options whenever suits.\n\nExecutor variant: \"If you're handling a property in [Suburb] as part of an estate, I also assist executors with valuations and sales — I can make that part simple for you.\"",
        "subject": "A simpler move, handled from start to finish",
        "email": "Dear [Owner name],\n\nI'm [Your name] from [Agency], specialising in [Suburb]. Many long-time owners reach a point where a large home becomes more upkeep than it's worth — and a smaller, lock-up-and-go lifestyle frees up both time and capital.\n\nI guide clients gently through every step: valuation, preparing the home, marketing and transfer, with no obligation to proceed. If downsizing (now or down the line) is something you or your family are weighing up, I'd welcome a private conversation.\n\nAnd if you're an executor handling a [Suburb] property, I assist estates with valuations and sales too.\n\nKind regards,\n[Your name] · [Agency] · [phone]"
    },
    {
        "id": 3,
        "name": "Absentee landlords",
        "desc": "Sectional-title-heavy suburbs — owners who live elsewhere and let their unit.",
        "point": "A free yield review shows if you're leaving rent on the table — and if managing tenants remotely is tiring, it's a strong sellers' market for investor stock.",
        "call": "Hi [Owner name], [Your name] here from [Agency] — I specialise in [Suburb], particularly the investment and sectional-title market. I believe you own a unit here but live elsewhere, so I'm guessing it's tenanted. Two quick things I help landlords with: first, a free rental-yield review to check you're getting market rent; and second, if managing tenants from a distance has become a hassle, [Suburb] is a strong market for investor stock right now, with buyers happy to take over existing leases. Would a quick, no-cost yield review be useful to you?",
        "subject": "Is your [Suburb] rental still working for you?",
        "email": "Hi [Owner name],\n\nI'm [Your name] from [Agency], focused on the [Suburb] investment market. Managing a rental remotely can quietly eat into your returns.\n\nI offer landlords a free rental-yield review — a simple check that you're charging market rent and that the numbers still stack up. And if you've been thinking of cashing out, demand for investment units in [Suburb] is strong, with buyers who'll happily take over an existing lease.\n\nEither way, I can give you the figures. Shall I send through a yield review this week?\n\nRegards,\n[Your name] · [Agency] · [phone]"
    },
    {
        "id": 4,
        "name": "Distressed / motivated sellers",
        "desc": "Owners who may need to sell quickly and privately (arrears, execution, life events).",
        "point": "A discreet, fast, dignified exit — best price achievable in the shortest time, handled quietly. (Never reference their debt directly.)",
        "call": "Hello [Owner name], my name is [Your name] from [Agency], I work right here in [Suburb]. I reach out to homeowners who may be weighing up their options and would want to sell quickly and privately, for whatever reason. If that's ever relevant for you, I specialise in getting the best possible price in the shortest time, and I handle everything with complete discretion. There's absolutely no obligation — would a confidential chat about your options be helpful, or may I leave you my direct number in case it's ever useful?\n\nTone note: stay warm and respectful. Do not mention arrears, banks or repossession — let the owner raise it.",
        "subject": "A discreet, fast option if you ever need it",
        "email": "Hi [Owner name],\n\nI'm [Your name], a [Suburb] property specialist with [Agency]. Sometimes circumstances change and a homeowner needs to sell quickly and privately.\n\nIf that's ever your situation, I can help you secure the best price achievable in the shortest time, managing the entire process with complete discretion. No pressure and no obligation — I simply want you to know you have a straightforward, dignified option and someone in your corner.\n\nMy direct line is [phone], any time.\n\nKind regards,\n[Your name] · [Agency]"
    },
    {
        "id": 5,
        "name": "Prioritise by liquidity",
        "desc": "High-turnover suburbs where homes are selling fast — ride the momentum.",
        "point": "One of the most active markets in the area — homes are moving and buyers are competing. Know your number so you can act while it's hot.",
        "call": "Hi [Owner name], [Your name] from [Agency] — I focus on [Suburb]. I'm calling because [Suburb] is one of the most active markets in the area right now: homes are selling quickly and buyer demand is strong. That makes it a great time to know exactly where you stand. I'd love to offer you a free, current valuation so that if you ever decide to move, you're ready to act while the market's in your favour. Could I pop round on [day]?",
        "subject": "[Suburb] is moving fast — know your number",
        "email": "Hi [Owner name],\n\n[Your name] here from [Agency], your local [Suburb] specialist. [Suburb] is seeing some of the strongest sales activity in the area — well-presented homes are going quickly and buyers are competing.\n\nIf a move is anywhere on your horizon, the smart first step is knowing your home's current value so you can act decisively. I'd be glad to prepare a free, no-obligation valuation.\n\nJust reply with a good time and I'll sort it out.\n\nBest,\n[Your name] · [Agency] · [phone]"
    },
    {
        "id": 6,
        "name": "Recent-buyer churn",
        "desc": "Suburbs with a high share of sellers who owned under 5 years — quick resale.",
        "point": "Staying in touch as a useful contact — plans change fast (family, job, upgrade), and I want to be your first call, with a value update whenever you're curious.",
        "call": "Hi [Owner name], this is [Your name] from [Agency] — I specialise in [Suburb]. I like to stay in touch with owners who bought here fairly recently, just to be a useful local contact. How are you finding the home? ... The reason I ask is that life moves fast — a growing family, a new job, an upgrade — and plans can change sooner than expected. If that ever happens, I'd love to be your first call. And if you're curious, I can tell you what your home is likely worth now versus what you paid. Would that be helpful?",
        "subject": "Settling in? Here's your home's value update",
        "email": "Hi [Owner name],\n\nI'm [Your name] from [Agency], the local specialist for [Suburb]. You bought here not too long ago — I hope you're loving it.\n\nI like to keep recent buyers updated on local values, because plans can change quickly (a bigger family, a relocation, an upgrade). If a move ever comes up, I'd be glad to be your first call — and I'm happy to share what your home is likely worth today versus your purchase price.\n\nNo obligation at all, just here when you need me.\n\nWarm regards,\n[Your name] · [Agency] · [phone]"
    }
];

export const DEFAULT_MESSAGE = {
    "subject": "Your free [Suburb] home-value report",
    "body": "Hi [Owner name],\n\nI'm [Your name], a property specialist focused on [Suburb]. I put together current-market value reports for local homeowners — a clear picture of what your property is likely worth today, based on recent sales in your area and current buyer demand.\n\nIt's free, it's yours to keep, and there's no obligation whatsoever.\n\nWould you like me to prepare one and send it through? If yes, provide me with your email and I will forward it right away."
};
