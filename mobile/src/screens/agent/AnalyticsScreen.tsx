import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Segmented } from '../../components/form';
import { Card, LoadState, SectionTitle, useTopPadding } from '../../components/ui';
import { fmtMoney } from '../../format';
import { colors, fonts, radius, spacing } from '../../theme';
import { usePage } from '../../usePage';

interface Kpi {
  value: number;
  prev: number;
  delta: number | null;
}

interface AnalyticsPage {
  range: number;
  kpis: { leads: Kpi; viewings: Kpi; closed: Kpi; revenue: Kpi };
  funnel: { label: string; count: number; pct: number }[];
  lead_sources: { source: string; count: number; pct: number }[];
  top_listings: { label: string; sub: string | null; value: number }[];
  trend: { month: string; won: number; lost: number }[];
  max_trend: number;
  overall: { total_leads: number; conversion: number };
}

type Range = '7' | '30' | '90';

const TREND_HEIGHT = 90;

export default function AgentAnalyticsScreen() {
  const topPadding = useTopPadding();
  const [range, setRange] = useState<Range>('30');
  const { data, error, refreshing, reload, onRefresh } = usePage<AnalyticsPage>(`/agent/analytics?range=${range}`);

  if (!data) return <LoadState error={error} onRetry={reload} />;

  const maxTrend = Math.max(1, data.max_trend);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      <Segmented
        options={[
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days' },
          { value: '90', label: '90 days' },
        ]}
        value={range}
        onChange={setRange}
      />

      <View style={styles.kpis}>
        <Stat label="New leads" kpi={data.kpis.leads} />
        <Stat label="Viewings" kpi={data.kpis.viewings} />
        <Stat label="Deals closed" kpi={data.kpis.closed} />
        <Stat label="Deal value closed" kpi={data.kpis.revenue} money />
      </View>

      <Card style={styles.overall}>
        <View style={{ flex: 1 }}>
          <Text style={styles.big}>{data.overall.conversion}%</Text>
          <Text style={styles.hint}>of all your leads became deals</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.big}>{data.overall.total_leads}</Text>
          <Text style={styles.hint}>leads handled in total</Text>
        </View>
      </Card>

      <Card style={{ gap: spacing(2) }}>
        <SectionTitle>Pipeline funnel</SectionTitle>
        {data.funnel.map((f) => (
          <Bar key={f.label} label={f.label} right={String(f.count)} pct={f.pct} />
        ))}
      </Card>

      <Card style={{ gap: spacing(3) }}>
        <SectionTitle>Won and lost, last 6 months</SectionTitle>
        <View style={styles.trend} accessibilityLabel="Deals won and lost per month">
          {data.trend.map((m) => (
            <View key={m.month} style={styles.trendCol}>
              <View style={styles.trendBars}>
                <View style={[styles.trendBar, { height: (m.won / maxTrend) * TREND_HEIGHT, backgroundColor: colors.success }]} />
                <View style={[styles.trendBar, { height: (m.lost / maxTrend) * TREND_HEIGHT, backgroundColor: colors.ink300 }]} />
              </View>
              <Text style={styles.trendLabel}>{m.month}</Text>
            </View>
          ))}
        </View>
        <View style={styles.legend}>
          <Legend color={colors.success} label="Won" />
          <Legend color={colors.ink300} label="Lost" />
        </View>
      </Card>

      <Card style={{ gap: spacing(2) }}>
        <SectionTitle>Where leads come from</SectionTitle>
        {data.lead_sources.length === 0 ? (
          <Text style={styles.hint}>No leads in this period.</Text>
        ) : (
          data.lead_sources.map((s) => <Bar key={s.source} label={s.source} right={`${s.count} · ${s.pct}%`} pct={s.pct} />)
        )}
      </Card>

      <Card style={{ gap: spacing(1) }}>
        <SectionTitle>Listings bringing the most leads</SectionTitle>
        {data.top_listings.length === 0 ? (
          <Text style={styles.hint}>No leads on your listings in this period.</Text>
        ) : (
          data.top_listings.map((l, i) => (
            <View key={`${l.label}${i}`} style={styles.row}>
              <Text style={styles.rank}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {l.label}
                </Text>
                {l.sub ? <Text style={styles.hint}>{l.sub}</Text> : null}
              </View>
              <Text style={styles.rowValue}>{l.value}</Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function Stat({ label, kpi, money }: { label: string; kpi: Kpi; money?: boolean }) {
  const up = (kpi.delta ?? 0) >= 0;
  return (
    <Card style={styles.stat}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{money ? fmtMoney(kpi.value) : kpi.value}</Text>
      <Text style={[styles.delta, { color: kpi.delta === null ? colors.ink400 : up ? '#047857' : '#B91C1C' }]}>
        {kpi.delta === null ? 'No earlier data' : `${up ? '▲' : '▼'} ${Math.abs(kpi.delta)}% vs previous period`}
      </Text>
    </Card>
  );
}

function Bar({ label, right, pct }: { label: string; right: string; pct: number }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.barTop}>
        <Text style={styles.barLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.barRight}>{right}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, pct))}%` }]} />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.hint}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(10), gap: spacing(4) },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3) },
  stat: { flex: 1, minWidth: '45%' as unknown as number, gap: spacing(1) },
  statLabel: { fontFamily: fonts.sansSemiBold, fontSize: 10, letterSpacing: 0.6, color: colors.ink400 },
  statValue: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink900 },
  delta: { fontFamily: fonts.sansMedium, fontSize: 11 },
  overall: { flexDirection: 'row', gap: spacing(4) },
  big: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.brand600 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing(3) },
  barLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink700 },
  barRight: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink900 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.ink100, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.brand },
  trend: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing(3) },
  trendCol: { flex: 1, alignItems: 'center', gap: spacing(1) },
  trendBars: { height: TREND_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  trendBar: { width: 10, minHeight: 2, borderRadius: radius.sm },
  trendLabel: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.ink400 },
  legend: { flexDirection: 'row', gap: spacing(4) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(2.5), borderTopWidth: 1, borderTopColor: colors.ink100 },
  rank: { width: 20, fontFamily: fonts.displayBold, fontSize: 14, color: colors.ink400 },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink800 },
  rowValue: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink900 },
});
