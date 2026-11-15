import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api, errorText, PageResponse } from '../../api';
import DateTimeField from '../../components/DateTimeField';
import { Field, formStyles, Label, PrimaryButton, Segmented, Sheet } from '../../components/form';
import { Avatar, Badge, Card, SectionTitle, useTopPadding } from '../../components/ui';
import { call, email, whatsapp } from '../../contact';
import { fmtMoney } from '../../format';
import { colors, fonts, radius, shadowCard, spacing } from '../../theme';

/* ---------- API shape (Agent/Viewings Inertia props) ---------- */

interface Lead {
  id: number;
  visitor_name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  listing_title: string | null;
  deal_value: number;
  status: string;
  viewing_at: string | null;
}

interface Viewing {
  id: number;
  name: string;
  initials: string;
  date: string;
  time: string;
  listing: string;
  status: string;
  lead: Lead;
}

interface Reminder {
  id: number;
  title: string;
  notes: string | null;
  date: string;
  time: string;
  done: boolean;
  when?: string;
}

interface Day {
  label: string;
  date: number;
  iso: string;
  is_today: boolean;
}

interface CalendarData {
  cursor: string;
  period_label: string;
  prev_cursor: string;
  next_cursor: string;
  today_cursor: string;
  days: Day[];
  viewings: Viewing[];
  reminders: Reminder[];
  upcoming: { id: number; name: string; time: string; listing: string; lead: Lead }[];
  upcoming_reminders: Reminder[];
  listings: { id: number; label: string }[];
}

type Item = { kind: 'viewing'; time: string; v: Viewing } | { kind: 'reminder'; time: string; r: Reminder };

export type CalendarParams = { Calendar: { date?: string } | undefined };

const todayIso = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/* ---------- Screen ---------- */

export default function AgentCalendarScreen() {
  const route = useRoute<RouteProp<CalendarParams, 'Calendar'>>();
  const topPadding = useTopPadding();

  const [cursor, setCursor] = useState<string>(route.params?.date ?? todayIso());
  const [selected, setSelected] = useState<string>(route.params?.date ?? todayIso());
  const [data, setData] = useState<CalendarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [lead, setLead] = useState<Lead | null>(null);
  const [adding, setAdding] = useState(false);

  // A push notification tap can send us to a specific day.
  useEffect(() => {
    if (route.params?.date) {
      setCursor(route.params.date);
      setSelected(route.params.date);
    }
  }, [route.params?.date]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const r = await api.get<PageResponse<CalendarData>>(`/agent/calendar?view=week&cursor=${cursor}`);
      setData(r.data);
      // Keep the selected day inside the visible week.
      if (!r.data.days.some((d) => d.iso === selected)) {
        const today = r.data.days.find((d) => d.is_today);
        setSelected(today?.iso ?? r.data.days[0].iso);
      }
    } catch (e) {
      setError(errorText(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const dayItems = useMemo<Item[]>(() => {
    if (!data) return [];
    const items: Item[] = [
      ...data.viewings.filter((v) => v.date === selected).map((v) => ({ kind: 'viewing' as const, time: v.time, v })),
      ...data.reminders.filter((r) => r.date === selected).map((r) => ({ kind: 'reminder' as const, time: r.time, r })),
    ];
    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [data, selected]);

  const busyDays = useMemo(() => {
    const s = new Set<string>();
    data?.viewings.forEach((v) => s.add(v.date));
    data?.reminders.forEach((r) => !r.done && s.add(r.date));
    return s;
  }, [data]);

  async function toggle(r: Reminder) {
    // Optimistic tick; reload either way so the list matches the server.
    setData((d) => d && { ...d, reminders: d.reminders.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)) });
    try {
      await api.patch(`/agent/calendar/reminders/${r.id}`);
    } catch (e) {
      notify(errorText(e));
    }
    load();
  }

  function remove(r: Reminder) {
    const go = async () => {
      try {
        await api.del(`/agent/calendar/reminders/${r.id}`);
      } catch (e) {
        notify(errorText(e));
      }
      load();
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm(`Delete reminder "${r.title}"?`)) go();
      return;
    }
    Alert.alert('Delete reminder?', r.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  }

  if (error && !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Couldn't load your calendar</Text>
        <Text style={styles.hint}>{error}</Text>
        <Text style={styles.link} onPress={load}>
          Try again
        </Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const selectedDay = data.days.find((d) => d.iso === selected);
  const hasUpcoming = data.upcoming.length + data.upcoming_reminders.length > 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Header + week navigation */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Calendar</Text>
            <Text style={styles.hint}>{data.period_label}</Text>
          </View>
          <IconBtn icon="chevron-back" label="Previous week" onPress={() => setCursor(data.prev_cursor)} />
          <Pressable
            style={styles.todayBtn}
            onPress={() => {
              setCursor(data.today_cursor);
              setSelected(data.today_cursor);
            }}
          >
            <Text style={styles.todayText}>Today</Text>
          </Pressable>
          <IconBtn icon="chevron-forward" label="Next week" onPress={() => setCursor(data.next_cursor)} />
        </View>

        {/* Week strip */}
        <View style={styles.week}>
          {data.days.map((d) => {
            const active = d.iso === selected;
            return (
              <Pressable
                key={d.iso}
                style={[styles.day, active && styles.dayActive, !active && d.is_today && styles.dayToday]}
                onPress={() => setSelected(d.iso)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${d.label} ${d.date}`}
              >
                <Text style={[styles.dayLabel, active && styles.dayTextActive]}>{d.label}</Text>
                <Text style={[styles.dayDate, active && styles.dayTextActive]}>{d.date}</Text>
                <View style={[styles.dayDot, busyDays.has(d.iso) && { backgroundColor: active ? colors.white : colors.brand }]} />
              </Pressable>
            );
          })}
        </View>

        {/* Selected day agenda */}
        <Card style={{ gap: spacing(2) }}>
          <SectionTitle>
            {selectedDay?.is_today ? 'Today' : selectedDay ? `${selectedDay.label} ${selectedDay.date}` : 'Day'}
          </SectionTitle>
          {dayItems.length === 0 ? (
            <Text style={styles.hint}>Nothing scheduled. Tap + to add a viewing or reminder.</Text>
          ) : (
            dayItems.map((it) =>
              it.kind === 'viewing' ? (
                <Pressable key={`v${it.v.id}`} style={styles.item} onPress={() => setLead(it.v.lead)}>
                  <Text style={styles.time}>{it.time}</Text>
                  <Avatar initials={it.v.initials} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{it.v.name}</Text>
                    <Text style={styles.hint} numberOfLines={1}>
                      Viewing · {it.v.listing}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.ink400} />
                </Pressable>
              ) : (
                <View key={`r${it.r.id}`} style={styles.item}>
                  <Text style={styles.time}>{it.time}</Text>
                  <Pressable
                    onPress={() => toggle(it.r)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: it.r.done }}
                    accessibilityLabel={`Mark ${it.r.title} done`}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={it.r.done ? 'checkmark-circle' : 'ellipse-outline'}
                      size={30}
                      color={it.r.done ? colors.success : colors.ink300}
                    />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, it.r.done && styles.done]}>{it.r.title}</Text>
                    <Text style={styles.hint} numberOfLines={2}>
                      Reminder{it.r.notes ? ` · ${it.r.notes}` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => remove(it.r)} hitSlop={8} accessibilityLabel={`Delete ${it.r.title}`}>
                    <Ionicons name="trash-outline" size={18} color={colors.ink400} />
                  </Pressable>
                </View>
              ),
            )
          )}
        </Card>

        {/* Coming up after this week */}
        {hasUpcoming ? (
          <Card style={{ gap: spacing(2) }}>
            <SectionTitle>Coming up</SectionTitle>
            {data.upcoming.map((u) => (
              <Pressable key={`u${u.id}`} style={styles.upRow} onPress={() => setLead(u.lead)}>
                <Badge tone="brand">VIEWING</Badge>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{u.name}</Text>
                  <Text style={styles.hint} numberOfLines={1}>
                    {u.time} · {u.listing}
                  </Text>
                </View>
              </Pressable>
            ))}
            {data.upcoming_reminders.map((r) => (
              <View key={`ur${r.id}`} style={styles.upRow}>
                <Badge tone="violet">REMINDER</Badge>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{r.title}</Text>
                  <Text style={styles.hint}>{r.when}</Text>
                </View>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setAdding(true)} accessibilityRole="button" accessibilityLabel="Add viewing or reminder">
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>

      <LeadSheet lead={lead} onClose={() => setLead(null)} />

      <AddSheet
        visible={adding}
        defaultDate={selected}
        listings={data.listings}
        onClose={() => setAdding(false)}
        onSaved={(date) => {
          setAdding(false);
          setCursor(date);
          setSelected(date);
          load();
        }}
      />
    </View>
  );
}

/* ---------- Pieces ---------- */

function notify(msg: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(msg);
  } else {
    Alert.alert(msg);
  }
}

function IconBtn({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.iconBtn} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={18} color={colors.ink700} />
    </Pressable>
  );
}

function LeadSheet({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  return (
    <Sheet visible={!!lead} onClose={onClose} title={lead?.visitor_name ?? ''}>
      {lead ? (
        <>
          <Text style={styles.hint}>
            {lead.listing_title ?? 'No listing'}
            {lead.deal_value ? ` · ${fmtMoney(lead.deal_value)}` : ''}
          </Text>
          {lead.viewing_at ? (
            <View style={styles.whenRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.brand600} />
              <Text style={styles.itemTitle}>Viewing {lead.viewing_at}</Text>
            </View>
          ) : null}
          <View style={formStyles.row}>
            {lead.phone ? <Action icon="call" label="Call" onPress={() => call(lead.phone!)} /> : null}
            {lead.phone ? <Action icon="logo-whatsapp" label="WhatsApp" onPress={() => whatsapp(lead.phone!)} /> : null}
            {lead.email ? <Action icon="mail" label="Email" onPress={() => email(lead.email!)} /> : null}
          </View>
          {!lead.phone && !lead.email ? <Text style={styles.hint}>No contact details on this lead.</Text> : null}
          {lead.message ? (
            <View style={{ gap: spacing(1) }}>
              <Label>MESSAGE</Label>
              <Text style={styles.body}>{lead.message}</Text>
            </View>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

function Action({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.action} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={colors.brand600} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function AddSheet({
  visible,
  defaultDate,
  listings,
  onClose,
  onSaved,
}: {
  visible: boolean;
  defaultDate: string;
  listings: { id: number; label: string }[];
  onClose: () => void;
  onSaved: (date: string) => void;
}) {
  const [kind, setKind] = useState<'reminder' | 'viewing'>('reminder');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('09:00');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [listingId, setListingId] = useState<number | null>(null);
  const [listingQuery, setListingQuery] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [mail, setMail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Fresh form each time the sheet opens, on the day the agent is looking at.
  useEffect(() => {
    if (!visible) return;
    setDate(defaultDate);
    setTime('09:00');
    setTitle('');
    setNotes('');
    setListingId(null);
    setListingQuery('');
    setName('');
    setPhone('');
    setMail('');
    setErr(null);
  }, [visible, defaultDate]);

  const matches = useMemo(() => {
    const q = listingQuery.trim().toLowerCase();
    return (q ? listings.filter((l) => l.label.toLowerCase().includes(q)) : listings).slice(0, 6);
  }, [listings, listingQuery]);

  const chosen = listings.find((l) => l.id === listingId);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      if (kind === 'reminder') {
        await api.post('/agent/calendar/reminders', { title, notes: notes || null, remind_at: `${date} ${time}` });
      } else {
        await api.post('/agent/calendar/viewings', {
          listing_id: listingId,
          name,
          phone: phone || null,
          email: mail || null,
          scheduled_at: `${date} ${time}`,
        });
      }
      onSaved(date);
    } catch (e) {
      setErr(kind === 'viewing' && !listingId ? 'Choose a listing for the viewing.' : errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={kind === 'reminder' ? 'New reminder' : 'Schedule a viewing'}>
      <Segmented
        options={[
          { value: 'reminder', label: 'Reminder' },
          { value: 'viewing', label: 'Viewing' },
        ]}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setErr(null);
        }}
      />

      <View style={formStyles.row}>
        <DateTimeField label="DATE" mode="date" value={date} onChange={setDate} />
        <DateTimeField label="TIME" mode="time" value={time} onChange={setTime} />
      </View>

      {kind === 'reminder' ? (
        <>
          <Field label="WHAT TO DO" value={title} onChangeText={setTitle} placeholder="e.g. Call Mrs Dlamini back" />
          <Field label="NOTES (OPTIONAL)" value={notes} onChangeText={setNotes} multiline />
        </>
      ) : (
        <>
          <View style={{ gap: spacing(1.5) }}>
            {chosen ? (
              <>
                <Label>LISTING</Label>
                <Pressable style={styles.chosen} onPress={() => setListingId(null)}>
                  <Text style={[styles.itemTitle, { flex: 1 }]} numberOfLines={2}>
                    {chosen.label}
                  </Text>
                  <Text style={styles.link}>Change</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Field label="LISTING" value={listingQuery} onChangeText={setListingQuery} placeholder="Search your listings" />
                {matches.map((l) => (
                  <Pressable key={l.id} style={styles.option} onPress={() => setListingId(l.id)}>
                    <Text style={styles.body} numberOfLines={1}>
                      {l.label}
                    </Text>
                  </Pressable>
                ))}
                {matches.length === 0 ? <Text style={styles.hint}>No listings match.</Text> : null}
              </>
            )}
          </View>
          <Field label="CLIENT NAME" value={name} onChangeText={setName} />
          <Field label="PHONE" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label="EMAIL (OPTIONAL)" value={mail} onChangeText={setMail} keyboardType="email-address" autoCapitalize="none" />
        </>
      )}

      {err ? <Text style={formStyles.error}>{err}</Text> : null}

      <PrimaryButton title={kind === 'reminder' ? 'Set reminder' : 'Schedule viewing'} onPress={save} busy={busy} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(24), gap: spacing(4) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink50, padding: spacing(6), gap: spacing(2) },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink900, letterSpacing: -0.3 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
  body: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink700 },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.brand600 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowCard,
  },
  todayBtn: {
    height: 36,
    paddingHorizontal: spacing(3),
    borderRadius: radius.md,
    backgroundColor: colors.white,
    justifyContent: 'center',
    ...shadowCard,
  },
  todayText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink700 },
  week: { flexDirection: 'row', gap: spacing(1.5) },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing(2),
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 2,
  },
  dayActive: { backgroundColor: colors.brand },
  dayToday: { borderColor: colors.brand },
  dayLabel: { fontFamily: fonts.sansSemiBold, fontSize: 10, color: colors.ink500, letterSpacing: 0.4 },
  dayDate: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.ink900 },
  dayTextActive: { color: colors.white },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2.5),
    borderTopWidth: 1,
    borderTopColor: colors.ink100,
  },
  time: { width: 42, fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink700 },
  itemTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink800 },
  done: { textDecorationLine: 'line-through', color: colors.ink400 },
  upRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(1.5) },
  fab: {
    position: 'absolute',
    right: spacing(5),
    bottom: spacing(5),
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand700,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: spacing(1),
    paddingVertical: spacing(3),
    borderRadius: radius.md,
    backgroundColor: colors.brand50,
  },
  actionText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.brand700 },
  chosen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brand50,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  option: {
    borderWidth: 1,
    borderColor: colors.ink100,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    backgroundColor: colors.ink50,
  },
});
