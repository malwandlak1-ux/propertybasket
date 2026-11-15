import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, KpiCard, LoadState, SectionTitle, useTopPadding } from '../../components/ui';
import { fmtMoney, fmtMoneyFull } from '../../format';
import { colors, fonts, radius, spacing } from '../../theme';
import { usePage } from '../../usePage';

interface CommissionPage {
  agent: { split_pct: number };
  stats: {
    ytd_earned: number;
    annual_target: number;
    target_pct: number;
    pipeline_value: number;
    pending_payout: number;
    next_payout: string | null;
  };
  monthly_chart: { month: string; earned: number; target: number; is_current: boolean; is_future: boolean }[];
  max_bar: number;
  ledger: {
    id: number;
    date: string;
    description: string;
    type_label: string;
    gross: number;
    split_pct: number;
    agent_net: number;
    status: string;
    blocked_reason: string | null;
    paid_at: string | null;
  }[];
}

const statusTone: Record<string, 'success' | 'warning' | 'danger' | 'sky' | 'ink'> = {
  paid: 'success',
  approved: 'sky',
  pending: 'warning',
  blocked: 'danger',
};

const CHART_HEIGHT = 110;

export default function AgentCommissionScreen() {
  const topPadding = useTopPadding();
  const { data, error, refreshing, reload, onRefresh } = usePage<CommissionPage>('/agent/commission');

  if (!data) return <LoadState error={error} onRetry={reload} />;

  const { stats } = data;
  const max = Math.max(data.max_bar, 1);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      <View style={styles.kpis}>
        <KpiCard label="Earned this year" value={fmtMoney(stats.ytd_earned)} hint={`${stats.target_pct}% of ${fmtMoney(stats.annual_target)} target`} accent={colors.brand600} />
        <KpiCard label="Pending payout" value={fmtMoney(stats.pending_payout)} hint={stats.next_payout ? `Next payout ${stats.next_payout}` : undefined} />
        <KpiCard label="In your pipeline" value={fmtMoney(stats.pipeline_value)} hint="If open deals close" />
        <KpiCard label="Your split" value={`${data.agent.split_pct}%`} hint="Of gross commission" />
      </View>

      <Card style={{ gap: spacing(3) }}>
        <SectionTitle>Last 12 months</SectionTitle>
        <View style={styles.chart} accessibilityLabel="Commission earned per month">
          {data.monthly_chart.map((m, i) => {
            const h = Math.round((Math.min(m.earned, max) / max) * CHART_HEIGHT);
            return (
              <View key={`${m.month}${i}`} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      { height: Math.max(h, m.earned > 0 ? 3 : 0), backgroundColor: m.is_current ? colors.brand : colors.brand100 },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, m.is_current && { color: colors.brand700, fontFamily: fonts.sansBold }]}>
                  {m.month.slice(0, 1)}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      <Card style={{ gap: spacing(1) }}>
        <SectionTitle>Commission ledger</SectionTitle>
        {data.ledger.length === 0 ? (
          <Text style={styles.hint}>No commission recorded yet.</Text>
        ) : (
          data.ledger.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {row.description}
                </Text>
                <Text style={styles.hint}>
                  {row.date} · {row.type_label} · {row.split_pct}% of {fmtMoneyFull(row.gross)}
                </Text>
                {row.blocked_reason ? <Text style={styles.blocked}>On hold: {row.blocked_reason.replace(/_/g, ' ')}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: spacing(1) }}>
                <Text style={styles.amount}>{fmtMoneyFull(row.agent_net)}</Text>
                <Badge tone={statusTone[row.status] ?? 'ink'}>{row.status.toUpperCase()}</Badge>
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(10), gap: spacing(4) },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3) },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing(1.5) },
  barCol: { flex: 1, alignItems: 'center', gap: spacing(1) },
  barTrack: { height: CHART_HEIGHT, width: '100%', justifyContent: 'flex-end', backgroundColor: colors.ink50, borderRadius: radius.sm },
  bar: { width: '100%', borderRadius: radius.sm },
  barLabel: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.ink400 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.ink100,
  },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink800 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
  blocked: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.danger },
  amount: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink900 },
});
