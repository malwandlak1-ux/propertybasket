import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorText } from '../../api';
import ContactActions from '../../components/ContactActions';
import { Chips, Field, formStyles, Label, PrimaryButton, SecondaryButton, Segmented, Sheet } from '../../components/form';
import { Badge, Card, Fab, LoadState } from '../../components/ui';
import { call } from '../../contact';
import { CHANNELS, channelLabel, CrmStackParams, OUTCOMES, outcomeLabel, PROSPECT_STATUSES, statusLabel, statusTone } from '../../crm';
import { fmtMoney } from '../../format';
import { colors, fonts, radius, spacing } from '../../theme';
import { usePage } from '../../usePage';

/* ---------- API shape (Agent/Crm/Farming `farm` prop) ---------- */

interface Prospect {
  id: number;
  unit: string | null;
  owner_name: string;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  status: string;
  est_value: number | null;
  response: string | null;
  next_action: string | null;
  notes: string | null;
  priority_note: string | null;
  inquiry_id: number | null;
}

interface Activity {
  id: number;
  channel: string;
  outcome: string | null;
  note: string | null;
  when: string;
}

type Farm =
  | { level: 'regions'; regions: { id: number; name: string; suburbs: number; schemes: number; prospects: number; contacted: number }[] }
  | { level: 'region'; region: { id: number; name: string }; suburbs: { id: number; name: string; signal: string | null; schemes: number }[] }
  | {
      level: 'suburb';
      suburb: { id: number; name: string; angle: string | null };
      schemes: { id: number; name: string; address: string | null; units_count: number | null; owners: number; contacted: number; warm: number }[];
    }
  | {
      level: 'scheme';
      scheme: { id: number; name: string; address: string | null; units_count: number | null };
      prospects: Prospect[];
      activities: Record<string, Activity[]>;
    };

interface FarmingPage {
  farm: Farm;
}

type Nav = NativeStackNavigationProp<CrmStackParams>;

const today = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

export default function AgentFarmingScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<CrmStackParams, 'Farming'>>();
  const p = route.params ?? {};

  const query = p.scheme ? `?scheme=${p.scheme}` : p.suburb ? `?suburb=${p.suburb}` : p.region ? `?region=${p.region}` : '';
  const { data, error, refreshing, reload, onRefresh } = usePage<FarmingPage>(`/agent/crm/farming${query}`);

  const [selected, setSelected] = useState<Prospect | null>(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<'all' | 'todo' | 'warm'>('all');

  useLayoutEffect(() => {
    nav.setOptions({ title: p.title ?? 'Property farming' });
  }, [nav, p.title]);

  const farm = data?.farm;

  const owners = useMemo(() => {
    if (farm?.level !== 'scheme') return [];
    if (filter === 'todo') return farm.prospects.filter((x) => ['not_contacted', 'attempted'].includes(x.status));
    if (filter === 'warm') return farm.prospects.filter((x) => ['interested', 'appraisal_booked', 'listed'].includes(x.status));
    return farm.prospects;
  }, [farm, filter]);

  if (!farm) return <LoadState error={error} onRetry={reload} />;

  const go = (params: CrmStackParams['Farming']) => nav.push('Farming', params);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {farm.level === 'regions' ? (
          <>
            <Text style={styles.lead}>Pick a region to see its suburbs and the schemes you are working.</Text>
            {farm.regions.map((r) => (
              <Row
                key={r.id}
                title={r.name}
                sub={`${r.suburbs} suburbs · ${r.schemes} schemes · ${r.prospects} owners`}
                right={r.prospects ? `${Math.round((r.contacted / r.prospects) * 100)}% worked` : undefined}
                onPress={() => go({ region: r.id, title: r.name })}
              />
            ))}
          </>
        ) : null}

        {farm.level === 'region' ? (
          farm.suburbs.length === 0 ? (
            <Empty text="No suburbs in this region yet. Suburbs are added on the website." />
          ) : (
            farm.suburbs.map((s) => (
              <Row
                key={s.id}
                title={s.name}
                sub={s.schemes ? `${s.schemes} scheme${s.schemes === 1 ? '' : 's'}` : 'No schemes yet'}
                right={s.signal ?? undefined}
                onPress={() => go({ suburb: s.id, title: s.name })}
              />
            ))
          )
        ) : null}

        {farm.level === 'suburb' ? (
          <>
            {farm.suburb.angle ? <Text style={styles.lead}>{farm.suburb.angle}</Text> : null}
            {farm.schemes.length === 0 ? (
              <Empty text="You have no schemes in this suburb yet. Add a scheme and import its owners on the website, then work them from here." />
            ) : (
              farm.schemes.map((s) => (
                <Row
                  key={s.id}
                  title={s.name}
                  sub={[s.address, `${s.owners} owners · ${s.contacted} contacted`].filter(Boolean).join(' · ')}
                  right={s.warm ? `${s.warm} warm` : undefined}
                  onPress={() => go({ scheme: s.id, title: s.name })}
                />
              ))
            )}
          </>
        ) : null}

        {farm.level === 'scheme' ? (
          <>
            {farm.scheme.address ? <Text style={styles.lead}>{farm.scheme.address}</Text> : null}
            <Segmented
              options={[
                { value: 'all', label: `All (${farm.prospects.length})` },
                { value: 'todo', label: 'To contact' },
                { value: 'warm', label: 'Warm' },
              ]}
              value={filter}
              onChange={setFilter}
            />
            {owners.length === 0 ? (
              <Empty text={farm.prospects.length ? 'No owners match this filter.' : 'No owners captured yet. Tap + to add one.'} />
            ) : (
              owners.map((o) => (
                <Pressable key={o.id} onPress={() => setSelected(o)} accessibilityRole="button" accessibilityLabel={o.owner_name}>
                  <Card style={styles.owner}>
                    <View style={styles.unit}>
                      <Text style={styles.unitText}>{o.unit ?? '—'}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.rowTitle}>{o.owner_name}</Text>
                      <Text style={styles.hint} numberOfLines={1}>
                        {o.next_action || o.phone1 || o.phone2 || 'No phone number'}
                      </Text>
                      <Badge tone={statusTone[o.status] ?? 'ink'}>{statusLabel(o.status).toUpperCase()}</Badge>
                    </View>
                    {o.phone1 || o.phone2 ? (
                      <Pressable
                        style={styles.quickCall}
                        onPress={() => call((o.phone1 || o.phone2)!)}
                        accessibilityRole="button"
                        accessibilityLabel={`Call ${o.owner_name}`}
                        hitSlop={6}
                      >
                        <Ionicons name="call" size={18} color={colors.brand600} />
                      </Pressable>
                    ) : null}
                  </Card>
                </Pressable>
              ))
            )}
          </>
        ) : null}
      </ScrollView>

      {farm.level === 'scheme' ? (
        <>
          <Fab label="Add an owner" onPress={() => setAdding(true)} />
          <OwnerSheet
            owner={selected}
            history={selected ? farm.activities[String(selected.id)] ?? [] : []}
            onClose={() => setSelected(null)}
            onChanged={() => {
              setSelected(null);
              reload();
            }}
          />
          <AddOwnerSheet
            visible={adding}
            schemeId={farm.scheme.id}
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              reload();
            }}
          />
        </>
      ) : null}
    </View>
  );
}

/* ---------- Pieces ---------- */

function Row({ title, sub, right, onPress }: { title: string; sub: string; right?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={styles.rowCard}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.hint}>{sub}</Text>
        </View>
        {right ? <Text style={styles.right}>{right}</Text> : null}
        <Ionicons name="chevron-forward" size={16} color={colors.ink300} />
      </Card>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="map-outline" size={36} color={colors.ink300} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

/** One owner: contact them, log what happened, move their status, hand off to the pipeline. */
function OwnerSheet({
  owner,
  history,
  onClose,
  onChanged,
}: {
  owner: Prospect | null;
  history: Activity[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<'view' | 'log' | 'status'>('view');
  const [channel, setChannel] = useState('call');
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setMode('view');
    setChannel('call');
    setOutcome('');
    setNote('');
    setNext(owner?.next_action ?? '');
    setErr(null);
  }, [owner]);

  if (!owner) return <Sheet visible={false} onClose={onClose} title="" children={null} />;

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

  const logContact = () =>
    run(async () => {
      // The follow-up reminder lives on the owner record. Save it first, so the
      // contact log that follows applies the server's own status progression.
      if (next.trim() !== (owner.next_action ?? '')) {
        await api.patch(`/agent/crm/prospects/${owner.id}`, {
          owner_name: owner.owner_name,
          unit: owner.unit,
          phone1: owner.phone1,
          phone2: owner.phone2,
          email: owner.email,
          est_value: owner.est_value,
          notes: owner.notes,
          priority_note: owner.priority_note,
          response: owner.response,
          next_action: next.trim() || null,
          status: owner.status,
        });
      }
      await api.post('/agent/crm/activities', {
        prospect_id: owner.id,
        channel,
        outcome: outcome || null,
        note: note.trim() || null,
        occurred_on: today(),
      });
    });

  return (
    <Sheet visible onClose={onClose} title={owner.owner_name}>
      <View style={styles.sheetMeta}>
        <Badge tone={statusTone[owner.status] ?? 'ink'}>{statusLabel(owner.status).toUpperCase()}</Badge>
        <Text style={styles.hint}>
          {owner.unit ? `Unit ${owner.unit}` : 'No unit'}
          {owner.est_value ? ` · est. ${fmtMoney(owner.est_value)}` : ''}
        </Text>
      </View>

      {mode === 'view' ? (
        <>
          <ContactActions phone={owner.phone1 || owner.phone2} email={owner.email} />
          {owner.phone1 && owner.phone2 ? (
            <Text style={styles.link} onPress={() => call(owner.phone2!)}>
              Call second number {owner.phone2}
            </Text>
          ) : null}

          {owner.next_action ? <Detail label="NEXT ACTION" value={owner.next_action} highlight /> : null}
          {owner.response ? <Detail label="LAST RESPONSE" value={owner.response} /> : null}
          {owner.priority_note ? <Detail label="PRIORITY" value={owner.priority_note} /> : null}
          {owner.notes ? <Detail label="NOTES" value={owner.notes} /> : null}

          {history.length ? (
            <View style={{ gap: spacing(1) }}>
              <Label>HISTORY</Label>
              {history.slice(0, 5).map((a) => (
                <Text key={a.id} style={styles.history}>
                  {a.when} · {channelLabel(a.channel)}
                  {a.outcome ? ` · ${outcomeLabel(a.outcome)}` : ''}
                  {a.note ? ` · ${a.note}` : ''}
                </Text>
              ))}
            </View>
          ) : null}

          {err ? <Text style={formStyles.error}>{err}</Text> : null}

          <PrimaryButton title="Log a contact" onPress={() => setMode('log')} />
          <SecondaryButton title="Change status" onPress={() => setMode('status')} />
          {owner.inquiry_id ? (
            <Text style={styles.onPipeline}>Already on your pipeline</Text>
          ) : (
            <Pressable
              style={[styles.pipelineBtn, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={() => run(() => api.post(`/agent/crm/prospects/${owner.id}/pipeline`))}
              accessibilityRole="button"
            >
              <Ionicons name="funnel-outline" size={16} color={colors.brand700} />
              <Text style={styles.pipelineText}>Send to pipeline as a seller lead</Text>
            </Pressable>
          )}
        </>
      ) : null}

      {mode === 'log' ? (
        <>
          <View style={styles.gap}>
            <Label>HOW DID YOU REACH OUT?</Label>
            <Chips options={CHANNELS} selected={[channel]} onToggle={setChannel} />
          </View>
          <View style={styles.gap}>
            <Label>WHAT HAPPENED?</Label>
            <Chips options={OUTCOMES} selected={[outcome]} onToggle={(o) => setOutcome(o === outcome ? '' : o)} />
          </View>
          <Field label="NOTE (OPTIONAL)" value={note} onChangeText={setNote} multiline placeholder="e.g. Wants a valuation after month-end" />
          <Field label="NEXT ACTION (OPTIONAL)" value={next} onChangeText={setNext} placeholder="e.g. Call back Friday 10:00" />
          {err ? <Text style={formStyles.error}>{err}</Text> : null}
          <PrimaryButton title="Save contact" onPress={logContact} busy={busy} />
          <SecondaryButton title="Back" onPress={() => setMode('view')} />
        </>
      ) : null}

      {mode === 'status' ? (
        <>
          <Chips
            options={PROSPECT_STATUSES}
            selected={[owner.status]}
            onToggle={(s) => s !== owner.status && run(() => api.patch(`/agent/crm/prospects/${owner.id}/status`, { status: s }))}
          />
          {err ? <Text style={formStyles.error}>{err}</Text> : null}
          <SecondaryButton title="Back" onPress={() => setMode('view')} />
        </>
      ) : null}
    </Sheet>
  );
}

function Detail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ gap: spacing(1) }}>
      <Label>{label}</Label>
      <Text style={[styles.value, highlight && { color: colors.brand700, fontFamily: fonts.sansSemiBold }]}>{value}</Text>
    </View>
  );
}

function AddOwnerSheet({
  visible,
  schemeId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  schemeId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [mail, setMail] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setUnit('');
    setPhone1('');
    setPhone2('');
    setMail('');
    setValue('');
    setErr(null);
  }, [visible]);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/agent/crm/schemes/${schemeId}/prospects`, {
        owner_name: name.trim(),
        unit: unit.trim() || null,
        phone1: phone1.trim() || null,
        phone2: phone2.trim() || null,
        email: mail.trim() || null,
        est_value: value || null,
        status: 'not_contacted',
      });
      onSaved();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Add an owner">
      <Field label="REGISTERED OWNER" value={name} onChangeText={setName} autoCapitalize="characters" />
      <View style={formStyles.row}>
        <View style={{ flex: 1 }}>
          <Field label="UNIT" value={unit} onChangeText={setUnit} />
        </View>
        <View style={{ flex: 2 }}>
          <Field label="EST. VALUE (R)" value={value} onChangeText={(t) => setValue(t.replace(/[^\d]/g, ''))} keyboardType="number-pad" />
        </View>
      </View>
      <Field label="PHONE" value={phone1} onChangeText={setPhone1} keyboardType="phone-pad" />
      <Field label="SECOND PHONE (OPTIONAL)" value={phone2} onChangeText={setPhone2} keyboardType="phone-pad" />
      <Field label="EMAIL (OPTIONAL)" value={mail} onChangeText={setMail} keyboardType="email-address" autoCapitalize="none" />
      {err ? <Text style={formStyles.error}>{err}</Text> : null}
      <PrimaryButton title="Add owner" onPress={save} busy={busy} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(24), gap: spacing(3) },
  lead: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, lineHeight: 19 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink900 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
  right: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.brand700, maxWidth: 110, textAlign: 'right' },
  owner: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  unit: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: spacing(2),
    borderRadius: radius.md,
    backgroundColor: colors.ink100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitText: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.ink700 },
  quickCall: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: spacing(2), paddingVertical: spacing(14), paddingHorizontal: spacing(6) },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, textAlign: 'center', lineHeight: 19 },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  gap: { gap: spacing(2) },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.brand600 },
  value: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink800, lineHeight: 20 },
  history: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500, lineHeight: 18 },
  onPipeline: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.success, textAlign: 'center' },
  pipelineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    borderRadius: radius.md,
    backgroundColor: colors.brand50,
    paddingVertical: spacing(3),
  },
  pipelineText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.brand700 },
});
