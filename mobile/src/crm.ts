/** CRM vocabulary — mirrors App\Support\Crm on the server (keys must match). */

export const PROSPECT_STATUSES: { value: string; label: string }[] = [
  { value: 'not_contacted', label: 'Not contacted' },
  { value: 'attempted', label: 'Attempted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'interested', label: 'Interested' },
  { value: 'appraisal_booked', label: 'Appraisal booked' },
  { value: 'listed', label: 'Listed' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'lost', label: 'Lost' },
];

export const CHANNELS: { value: string; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'door', label: 'Door knock' },
  { value: 'letter', label: 'Letter drop' },
  { value: 'social', label: 'Social media' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
];

export const OUTCOMES: { value: string; label: string }[] = [
  { value: 'no_answer', label: 'No answer' },
  { value: 'sent', label: 'Sent, no reply yet' },
  { value: 'connected', label: 'Spoke / replied' },
  { value: 'interested', label: 'Interested' },
  { value: 'appointment', label: 'Appraisal booked' },
  { value: 'not_interested', label: 'Not interested' },
];

export type Tone = 'ink' | 'sky' | 'warning' | 'brand' | 'success' | 'violet' | 'danger';

export const statusTone: Record<string, Tone> = {
  not_contacted: 'ink',
  attempted: 'warning',
  contacted: 'sky',
  interested: 'brand',
  appraisal_booked: 'violet',
  listed: 'success',
  not_interested: 'danger',
  lost: 'danger',
};

export const statusLabel = (s: string) => PROSPECT_STATUSES.find((x) => x.value === s)?.label ?? s.replace(/_/g, ' ');
export const channelLabel = (c: string | null) => CHANNELS.find((x) => x.value === c)?.label ?? c ?? '';
export const outcomeLabel = (o: string | null) => OUTCOMES.find((x) => x.value === o)?.label ?? o ?? '';

export type CrmStackParams = {
  CrmHome: undefined;
  Farming: { region?: number; suburb?: number; scheme?: number; title?: string } | undefined;
  WhatsApp: undefined;
  WhatsAppChat: { phone: string; title: string };
};
