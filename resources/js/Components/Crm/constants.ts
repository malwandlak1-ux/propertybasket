// CRM vocabulary — mirrors App\Support\Crm on the server.

export type StatusKey =
    | 'not_contacted' | 'attempted' | 'contacted' | 'interested'
    | 'appraisal_booked' | 'listed' | 'not_interested' | 'lost';

export const STATUSES: { key: StatusKey; label: string; color: string }[] = [
    { key: 'not_contacted',    label: 'Not contacted',    color: '#A69E93' },
    { key: 'attempted',        label: 'Attempted',        color: '#F59E0B' },
    { key: 'contacted',        label: 'Contacted',        color: '#3B82F6' },
    { key: 'interested',       label: 'Interested',       color: '#10B981' },
    { key: 'appraisal_booked', label: 'Appraisal booked', color: '#14B8A6' },
    { key: 'listed',           label: 'Listed',           color: '#8B5CF6' },
    { key: 'not_interested',   label: 'Not interested',   color: '#7A736A' },
    { key: 'lost',             label: 'Lost',             color: '#EF4444' },
];
export const STATUS = Object.fromEntries(STATUSES.map((s) => [s.key, s])) as Record<StatusKey, (typeof STATUSES)[number]>;

export type ChannelKey = 'call' | 'whatsapp' | 'sms' | 'email' | 'social' | 'letter' | 'door' | 'referral' | 'other';

export const CHANNELS: { key: ChannelKey; label: string; short: string }[] = [
    { key: 'call',     label: 'Cold call',    short: 'Calls' },
    { key: 'whatsapp', label: 'WhatsApp',     short: 'WhatsApp' },
    { key: 'sms',      label: 'SMS',          short: 'SMS' },
    { key: 'email',    label: 'Email',        short: 'Email' },
    { key: 'social',   label: 'Social media', short: 'Social' },
    { key: 'letter',   label: 'Letter drop',  short: 'Letters' },
    { key: 'door',     label: 'Door knock',   short: 'Doors' },
    { key: 'referral', label: 'Referral',     short: 'Referrals' },
    { key: 'other',    label: 'Other',        short: 'Other' },
];
export const CHANNEL = Object.fromEntries(CHANNELS.map((c) => [c.key, c])) as Record<ChannelKey, (typeof CHANNELS)[number]>;

export type OutcomeKey = 'sent' | 'no_answer' | 'connected' | 'interested' | 'appointment' | 'not_interested';

export const OUTCOMES: { key: OutcomeKey; label: string }[] = [
    { key: 'no_answer',      label: 'No answer' },
    { key: 'sent',           label: 'Sent / no reply yet' },
    { key: 'connected',      label: 'Spoke / replied' },
    { key: 'interested',     label: 'Interested' },
    { key: 'appointment',    label: 'Appraisal booked' },
    { key: 'not_interested', label: 'Not interested' },
];
export const OUTCOME = Object.fromEntries(OUTCOMES.map((o) => [o.key, o])) as Record<OutcomeKey, (typeof OUTCOMES)[number]>;

// ── Shapes coming from CrmService ──────────────────────────────────────────

export type SuburbStats = {
    totalStock?: number; freeholdPct?: number; sectionalPct?: number; inEstatePct?: number;
    lsm?: string; income?: string; adults?: number; owners11?: number; owners50?: number;
    sellers11?: number; transfers12?: number; avgPrice12?: number; turnover?: number;
    ownerAge?: number[]; tenureSellers?: number[];
};

export type Suburb = {
    id: number; name: string; municipality: string | null; signal: string | null; angle: string | null;
    priority: number | null; stats: SuburbStats | null; custom: boolean; schemes?: number;
};

export type Activity = {
    id: number; channel: ChannelKey; outcome: OutcomeKey | null; quantity: number; note: string | null;
    occurred_on: string; when: string;
    prospect: { id: number; owner: string; unit: string | null; scheme_id: number } | null;
    agent: string | null;
};

export type Prospect = {
    id: number; unit: string | null; size: string | null; owner_name: string; owner_type: string | null;
    id_reg: string | null; multi_unit: string | null; phone1: string | null; phone2: string | null;
    email: string | null; priority_note: string | null; status: StatusKey; method: ChannelKey | null;
    contacted_on: string | null; est_value: number | null; response: string | null; next_action: string | null;
    notes: string | null; inquiry_id: number | null; agent: string | null;
};

export type Scheme = {
    id: number; name: string; scheme_number: string | null; erf: string | null; address: string | null;
    units_count: number | null; agent: string | null;
    owners?: number; contacted?: number; warm?: number;
};

export type Ref = { id: number; name: string };

export type Farm =
    | { level: 'regions'; regions: { id: number; name: string; suburbs: number; schemes: number; prospects: number; contacted: number }[] }
    | { level: 'region'; region: Ref; suburbs: Suburb[] }
    | { level: 'suburb'; region: Ref; suburb: Suburb; schemes: Scheme[] }
    | { level: 'scheme'; region: Ref; suburb: Suburb; scheme: Scheme; prospects: Prospect[]; activities: Record<string, Activity[]> };

export type Profile = { name: string; agency: string; phone: string | null };

// ── Formatting ─────────────────────────────────────────────────────────────

export const pct = (n?: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`);
export const numf = (n?: number | null) => (n == null ? '—' : Math.round(n).toLocaleString('en-ZA'));
export function money(n?: number | null) {
    if (n == null) return '—';
    if (n >= 1e6) return `R ${(n / 1e6).toFixed(1)}m`;
    if (n >= 1e3) return `R ${Math.round(n / 1e3)}k`;
    return `R ${Math.round(n).toLocaleString('en-ZA')}`;
}
export const moneyFull = (n?: number | null) => (n == null ? '—' : `R ${Math.round(n).toLocaleString('en-ZA')}`);

/** SA number → tel + wa.me forms (same rules as the farming dashboard). */
export function normPhone(p?: string | null): { disp: string; tel: string; wa: string } | null {
    if (!p) return null;
    const d = String(p).replace(/[^\d+]/g, '');
    let wa = d;
    if (wa.startsWith('+27')) wa = wa.slice(1);
    else if (wa.startsWith('0')) wa = '27' + wa.slice(1);
    wa = wa.replace(/\D/g, '');
    if (wa.length < 9) return null;
    return { disp: p.trim(), tel: d, wa };
}

export const isCompany = (t?: string | null) => /comp|trust|pty|cc\b|invest/i.test(t ?? '');

export const signalCls = (s?: string | null) =>
    ({ High: 'bg-success/15 text-success', Moderate: 'bg-warning/15 text-amber-700', Watch: 'bg-ink-100 text-ink-600', Excluded: 'bg-danger/10 text-danger' }[s ?? ''] ?? 'bg-ink-100 text-ink-500');
