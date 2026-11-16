import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, KpiCard, LoadState, SectionTitle, useTopPadding } from '../../components/ui';
import { channelLabel, CrmStackParams, outcomeLabel, statusLabel, statusTone } from '../../crm';
import { colors, fonts, radius, spacing } from '../../theme';
import { usePage } from '../../usePage';

interface CrmOverview {
  data: {
    days: number;
    kpis: { touches: number; connected: number; appointments: number; prospects: number; worked_pct: number; warm: number };
    funnel: { key: string; label: string; count: number }[];
    follow_ups: { id: number; owner: string; unit: string | null; scheme_id: number; scheme: string | null; status: string; next_action: string }[];
    recent: {
      id: number;
      channel: string;
      outcome: string | null;
      note: string | null;
      when: string;
      prospect: { owner: string; unit: string | null; scheme_id: number } | null;
    }[];
  };
}

export default function AgentCrmScreen() {
  const nav = useNavigation<NativeStackNavigationProp<CrmStackParams>>();
  const topPadding = useTopPadding();
  const { data, error, refreshing, reload, onRefresh } = usePage<CrmOverview>('/agent/crm');

  // Numbers change as contacts are logged in Farming.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!data) return <LoadState error={error} onRetry={reload} />;

  const d = data.data;
  const maxFunnel = Math.max(1, ...d.funnel.map((f) => f.count));

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      <View>
        <Text style={styles.title}>CRM</Text>
        <Text style={styles.hint}>Your outreach over the last {d.days} days</Text>
      </View>

      <Card style={{ padding: 0 }}>
        <Entry icon="map-outline" label="Property farming" hint={`${d.kpis.prospects} owners · ${d.kpis.worked_pct}% worked`} onPress={() => nav.navigate('Farming')} />
        <Entry icon="logo-whatsapp" label="WhatsApp inbox" hint="Replies from owners" border onPress={() => nav.navigate('WhatsApp')} />
      </Card>

      <View style={styles.kpis}>
        <KpiCard label="Touches" value={String(d.kpis.touches)} hint="Calls, messages, visits" />
        <KpiCard label="Conversations" value={String(d.kpis.connected)} hint="Owners who engaged" />
        <KpiCard label="Appraisals booked" value={String(d.kpis.appointments)} accent={colors.brand600} />
        <KpiCard label="Warm owners" value={String(d.kpis.warm)} hint="Interested or further" />
      </View>

      {d.follow_ups.length ? (
        <Card style={{ gap: spacing(1) }}>
          <SectionTitle>Follow-ups</SectionTitle>
          {d.follow_ups.map((f) => (
            <Pressable
              key={f.id}
              style={styles.row}
              onPress={() => nav.navigate('Farming', { scheme: f.scheme_id, title: f.scheme ?? 'Scheme' })}
              accessibilityRole="button"
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle}>
                  {f.owner}
                  {f.unit ? ` · Unit ${f.unit}` : ''}
                </Text>
                <Text style={styles.next}>{f.next_action}</Text>
                <Text style={styles.hint}>{f.scheme}</Text>
              </View>
              <Badge tone={statusTone[f.status] ?? 'ink'}>{statusLabel(f.status).toUpperCase()}</Badge>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <Card style={{ gap: spacing(2) }}>
        <SectionTitle>Owner funnel</SectionTitle>
        {d.kpis.prospects === 0 ? (
          <Text style={styles.hint}>No owners yet. Add a scheme's owners in Property farming to start tracking.</Text>
        ) : (
          d.funnel.map((f) => (
            <View key={f.key} style={{ gap: 4 }}>
              <View style={styles.funnelTop}>
                <Text style={styles.funnelLabel}>{f.label}</Text>
                <Text style={styles.funnelCount}>{f.count}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${Math.round((f.count / maxFunnel) * 100)}%` }]} />
              </View>
            </View>
          ))
        )}
      </Card>

      {d.recent.length ? (
        <Card style={{ gap: spacing(1) }}>
          <SectionTitle>Recent activity</SectionTitle>
          {d.recent.slice(0, 8).map((a) => (
            <View key={a.id} style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle}>
                  {channelLabel(a.channel)}
                  {a.prospect ? ` · ${a.prospect.owner}` : ''}
                </Text>
                <Text style={styles.hint}>{[outcomeLabel(a.outcome), a.note].filter(Boolean).join(' · ') || 'Logged'}</Text>
              </View>
              <Text style={styles.hint}>{a.when}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function Entry({
  icon,
  label,
  hint,
  border,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  border?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.entry, border && styles.entryBorder]} onPress={onPress} accessibilityRole="button">
      <View style={styles.entryIcon}>
        <Ionicons name={icon} size={20} color={colors.brand600} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.entryLabel}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.ink300} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(10), gap: spacing(4) },
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink900, letterSpacing: -0.3 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3) },
  entry: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), padding: spacing(4) },
  entryBorder: { borderTopWidth: 1, borderTopColor: colors.ink100 },
  entryIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  entryLabel: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink900 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.ink100,
  },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink800 },
  next: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.brand700 },
  funnelTop: { flexDirection: 'row', justifyContent: 'space-between' },
  funnelLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink700 },
  funnelCount: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink900 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.ink100, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.brand },
});
