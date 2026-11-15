import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorText } from '../../api';
import ContactActions from '../../components/ContactActions';
import DateTimeField from '../../components/DateTimeField';
import { Field, formStyles, Label, PrimaryButton, SecondaryButton, Sheet } from '../../components/form';
import ListingPicker, { ListingOption } from '../../components/ListingPicker';
import { Badge, Card, Fab, LoadState, SectionTitle, useTopPadding } from '../../components/ui';
import { fmtMoney } from '../../format';
import { colors, fonts, radius, spacing } from '../../theme';
import { usePage } from '../../usePage';

interface LeadCard {
  id: number;
  visitor_name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  listing_title: string | null;
  deal_value: number;
  is_hot: boolean;
  status: string;
  age_label: string;
  viewing_at: string | null;
  viewing_date: string | null;
  viewing_time: string | null;
}

interface Column {
  key: string;
  label: string;
  count: number;
  total_value: number;
  cards: LeadCard[];
}

interface Pipeline {
  columns: Column[];
  total_value: number;
  listings: ListingOption[];
}

const dotColors: Record<string, string> = {
  new: colors.ink400,
  qualified: colors.sky,
  viewing: colors.brand,
  offer: colors.warning,
  closed: colors.success,
  registered: colors.violet,
  disqualified: colors.danger,
};

/** Stages an agent may move a lead to (Registered is agency-only). */
const STAGES: { value: string; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'viewing', label: 'Viewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'closed', label: 'Closed won' },
  { value: 'lost', label: 'Lost' },
  { value: 'disqualified', label: 'Disqualified' },
];

const tomorrow = () => {
  const t = new Date(Date.now() + 86_400_000);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

export default function AgentPipelineScreen() {
  const topPadding = useTopPadding();
  const { data, error, refreshing, reload, onRefresh } = usePage<Pipeline>('/agent/pipeline');
  const [selected, setSelected] = useState<LeadCard | null>(null);
  const [adding, setAdding] = useState(false);

  if (!data) return <LoadState error={error} onRetry={reload} />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <View>
          <Text style={styles.title}>Pipeline</Text>
          <Text style={styles.sub}>
            Open pipeline value <Text style={styles.subStrong}>{fmtMoney(data.total_value)}</Text>
          </Text>
        </View>

        {data.columns.map((col) => (
          <Card key={col.key}>
            <View style={styles.colHeader}>
              <View style={styles.colTitleWrap}>
                <View style={[styles.dot, { backgroundColor: dotColors[col.key] ?? colors.ink400 }]} />
                <SectionTitle>{col.label}</SectionTitle>
                <Text style={styles.count}>{col.count}</Text>
              </View>
              <Text style={styles.colValue}>{fmtMoney(col.total_value)}</Text>
            </View>

            {col.cards.length === 0 ? (
              <Text style={styles.hint}>No deals in this stage.</Text>
            ) : (
              col.cards.map((c) => (
                <Pressable key={c.id} style={styles.leadCard} onPress={() => setSelected(c)} accessibilityRole="button">
                  <View style={{ flex: 1 }}>
                    <View style={styles.leadTop}>
                      <Text style={styles.itemTitle}>{c.visitor_name}</Text>
                      {c.is_hot ? <Badge tone="danger">HOT</Badge> : null}
                    </View>
                    <Text style={styles.hint} numberOfLines={1}>
                      {c.listing_title ?? 'No listing'} · {c.age_label}
                    </Text>
                    {c.viewing_at ? (
                      <View style={styles.viewingRow}>
                        <Ionicons name="calendar-outline" size={12} color={colors.brand600} />
                        <Text style={styles.viewingText}>{c.viewing_at}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.leadValue}>{fmtMoney(c.deal_value)}</Text>
                </Pressable>
              ))
            )}
          </Card>
        ))}
      </ScrollView>

      <Fab label="Add a lead" onPress={() => setAdding(true)} />

      <LeadSheet
        lead={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          setSelected(null);
          reload();
        }}
      />

      <AddLeadSheet
        visible={adding}
        listings={data.listings}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          reload();
        }}
      />
    </View>
  );
}

/* ---------- Lead details: contact, move stage, viewing ---------- */

function LeadSheet({ lead, onClose, onChanged }: { lead: LeadCard | null; onClose: () => void; onChanged: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [date, setDate] = useState(tomorrow());
  const [time, setTime] = useState('10:00');

  useEffect(() => {
    setErr(null);
    setScheduling(false);
    setDate(lead?.viewing_date ?? tomorrow());
    setTime(lead?.viewing_time ?? '10:00');
  }, [lead]);

  if (!lead) return <Sheet visible={false} onClose={onClose} title="" children={null} />;

  const locked = lead.status === 'registered';

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const move = (status: string) => run(() => api.patch(`/agent/pipeline/leads/${lead.id}/status`, { status }));
  const saveViewing = () =>
    run(() => api.patch(`/agent/pipeline/leads/${lead.id}/viewing`, { viewing_date: date, viewing_time: time }));
  const clearViewing = () =>
    run(() => api.patch(`/agent/pipeline/leads/${lead.id}/viewing`, { viewing_date: null, viewing_time: null }));

  return (
    <Sheet visible onClose={onClose} title={lead.visitor_name}>
      <Text style={styles.hint}>
        {lead.listing_title ?? 'No listing'} · {fmtMoney(lead.deal_value)}
      </Text>

      <ContactActions phone={lead.phone} email={lead.email} />

      {lead.message ? (
        <View style={{ gap: spacing(1) }}>
          <Label>MESSAGE</Label>
          <Text style={styles.body}>{lead.message}</Text>
        </View>
      ) : null}

      {/* Viewing */}
      <View style={{ gap: spacing(2) }}>
        <Label>VIEWING</Label>
        {scheduling ? (
          <>
            <View style={formStyles.row}>
              <DateTimeField label="DATE" mode="date" value={date} onChange={setDate} />
              <DateTimeField label="TIME" mode="time" value={time} onChange={setTime} />
            </View>
            <PrimaryButton title="Save viewing" onPress={saveViewing} busy={busy} />
          </>
        ) : (
          <View style={styles.viewingBox}>
            <Text style={[styles.itemTitle, { flex: 1 }]}>{lead.viewing_at ?? 'Not scheduled'}</Text>
            {lead.viewing_at ? (
              <Text style={styles.linkDanger} onPress={clearViewing}>
                Remove
              </Text>
            ) : null}
            <Text style={styles.link} onPress={() => setScheduling(true)}>
              {lead.viewing_at ? 'Change' : 'Schedule'}
            </Text>
          </View>
        )}
      </View>

      {/* Stage */}
      <View style={{ gap: spacing(2) }}>
        <Label>{locked ? 'STAGE' : 'MOVE TO STAGE'}</Label>
        {locked ? (
          <Text style={styles.hint}>Registered by your agency. This deal is locked.</Text>
        ) : (
          <View style={styles.chips}>
            {STAGES.map((s) => {
              const active = lead.status === s.value;
              return (
                <Pressable
                  key={s.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => !active && move(s.value)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {err ? <Text style={formStyles.error}>{err}</Text> : null}

      <SecondaryButton title="Close" onPress={onClose} />
    </Sheet>
  );
}

/* ---------- Add a lead ---------- */

function AddLeadSheet({
  visible,
  listings,
  onClose,
  onSaved,
}: {
  visible: boolean;
  listings: ListingOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [listingId, setListingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [mail, setMail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setListingId(null);
    setName('');
    setMail('');
    setPhone('');
    setMessage('');
    setErr(null);
  }, [visible]);

  async function save() {
    if (!listingId) {
      setErr('Choose the listing this lead is interested in.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.post('/agent/pipeline/leads', {
        listing_id: listingId,
        name,
        email: mail,
        phone: phone || null,
        message: message || null,
      });
      onSaved();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="New lead">
      <ListingPicker listings={listings} value={listingId} onChange={setListingId} />
      <Field label="NAME" value={name} onChangeText={setName} />
      <Field label="EMAIL" value={mail} onChangeText={setMail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="PHONE (OPTIONAL)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="NOTE (OPTIONAL)" value={message} onChangeText={setMessage} multiline />
      {err ? <Text style={formStyles.error}>{err}</Text> : null}
      <PrimaryButton title="Add lead" onPress={save} busy={busy} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(24), gap: spacing(4) },
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink900, letterSpacing: -0.3 },
  sub: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, marginTop: 2 },
  subStrong: { fontFamily: fonts.sansBold, color: colors.ink900 },
  colHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(2) },
  colTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  dot: { width: 8, height: 8, borderRadius: 4 },
  count: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.ink500,
    backgroundColor: colors.ink100,
    borderRadius: radius.full,
    paddingHorizontal: spacing(2),
    paddingVertical: 1,
    overflow: 'hidden',
  },
  colValue: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.ink500 },
  leadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.ink50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ink100,
    padding: spacing(3),
    marginTop: spacing(2),
  },
  leadTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  itemTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink800 },
  leadValue: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink900 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500, marginTop: 2 },
  body: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink700 },
  viewingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), marginTop: spacing(1) },
  viewingText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.brand700 },
  viewingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(4),
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.brand600 },
  linkDanger: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  chip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ink200,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  chipActive: { backgroundColor: colors.brand50, borderColor: colors.brand },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink500 },
  chipTextActive: { color: colors.brand700 },
});
