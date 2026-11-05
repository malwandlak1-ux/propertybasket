import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, PageResponse } from '../../api';
import { Avatar, Badge, Card, DataScreen, KpiCard, SectionTitle } from '../../components/ui';
import { fmtMoney } from '../../format';
import { colors, fonts, radius, spacing } from '../../theme';

interface Overview {
  agent: { name: string; initials: string; agency_name: string; ffc_expires_at: string | null };
  kpis: {
    active_listings: number;
    open_leads: number;
    ytd_commission: number;
    conversion_rate: number;
  };
  pipeline_snapshot: { label: string; count: number; value: number; color: string }[];
  pipeline_stats: { total_value: number; max_value: number; win_rate: number; avg_deal_size: number };
  today_schedule: { id: number; name: string; time: string | null; listing_title: string }[];
  hot_leads: { id: number; name: string; initials: string; status: string; deal_value: number }[];
}

export default function AgentOverviewScreen() {
  const fetcher = useCallback(
    () => api.get<PageResponse<Overview>>('/agent/overview').then((r) => r.data),
    [],
  );

  return (
    <DataScreen fetcher={fetcher}>
      {(d) => (
        <>
          <Text style={styles.greeting}>Hi {d.agent.name.split(' ')[0]} 👋</Text>
          <Text style={styles.sub}>{d.agent.agency_name}</Text>

          <View style={styles.kpiGrid}>
            <KpiCard label="Active listings" value={`${d.kpis.active_listings}`} />
            <KpiCard label="Open leads" value={`${d.kpis.open_leads}`} />
            <KpiCard label="YTD commission" value={fmtMoney(d.kpis.ytd_commission)} accent={colors.brand600} />
            <KpiCard label="Conversion" value={`${d.kpis.conversion_rate}%`} />
          </View>

          <Card>
            <SectionTitle>Pipeline snapshot</SectionTitle>
            <View style={{ marginTop: spacing(3), gap: spacing(2.5) }}>
              {d.pipeline_snapshot.map((s) => {
                const pct = Math.min(100, Math.round((s.value / Math.max(1, d.pipeline_stats.max_value)) * 100));
                const barColor = s.color === 'success' ? colors.success : colors.brand;
                return (
                  <View key={s.label}>
                    <View style={styles.snapHeader}>
                      <Text style={styles.snapLabel}>
                        {s.label} · {s.count}
                      </Text>
                      <Text style={styles.snapValue}>{fmtMoney(s.value)}</Text>
                    </View>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: barColor }]} />
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.stat}>
                Win rate <Text style={styles.statValue}>{d.pipeline_stats.win_rate}%</Text>
              </Text>
              <Text style={styles.stat}>
                Avg deal <Text style={styles.statValue}>{fmtMoney(d.pipeline_stats.avg_deal_size)}</Text>
              </Text>
            </View>
          </Card>

          <Card>
            <SectionTitle>Today's schedule</SectionTitle>
            {d.today_schedule.length === 0 ? (
              <Text style={styles.hint}>No viewings scheduled today.</Text>
            ) : (
              d.today_schedule.map((v) => (
                <View key={v.id} style={styles.schedRow}>
                  <View style={styles.timePill}>
                    <Text style={styles.timeText}>{v.time ?? '—'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{v.name}</Text>
                    <Text style={styles.hint}>{v.listing_title}</Text>
                  </View>
                </View>
              ))
            )}
          </Card>

          <Card>
            <SectionTitle>Hot leads</SectionTitle>
            {d.hot_leads.length === 0 ? (
              <Text style={styles.hint}>No hot leads right now.</Text>
            ) : (
              d.hot_leads.map((l) => (
                <View key={l.id} style={styles.leadRow}>
                  <Avatar initials={l.initials} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{l.name}</Text>
                    <Badge tone="brand">{l.status.toUpperCase()}</Badge>
                  </View>
                  <Text style={styles.leadValue}>{fmtMoney(l.deal_value)}</Text>
                </View>
              ))
            )}
          </Card>

          {d.agent.ffc_expires_at ? (
            <Text style={styles.ffc}>FFC valid until {d.agent.ffc_expires_at}</Text>
          ) : null}
        </>
      )}
    </DataScreen>
  );
}

const styles = StyleSheet.create({
  greeting: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink900, letterSpacing: -0.3 },
  sub: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, marginTop: -spacing(2) },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(4) },
  snapHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  snapLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.ink700 },
  snapValue: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.ink500 },
  track: { height: 6, borderRadius: radius.full, backgroundColor: colors.ink100, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.full },
  statsRow: {
    flexDirection: 'row',
    gap: spacing(6),
    marginTop: spacing(4),
    paddingTop: spacing(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink100,
  },
  stat: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
  statValue: { fontFamily: fonts.sansBold, color: colors.ink900 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500, marginTop: spacing(1) },
  itemTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink800 },
  schedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), marginTop: spacing(3) },
  timePill: {
    backgroundColor: colors.brand50,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
  },
  timeText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.brand700 },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), marginTop: spacing(3) },
  leadValue: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink900 },
  ffc: { fontFamily: fonts.sans, fontSize: 11, color: colors.ink400, textAlign: 'center' },
});
