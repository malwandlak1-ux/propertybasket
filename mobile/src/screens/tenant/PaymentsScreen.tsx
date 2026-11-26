import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, PageResponse } from '../../api';
import { Badge, Card, DataScreen, KpiCard, SectionTitle } from '../../components/ui';
import { fmtMoney, fmtMoneyFull } from '../../format';
import { colors, fonts, spacing } from '../../theme';

interface Payments {
  kpis: { total_paid: number; count: number; streak: number; outstanding: number };
  rows: {
    id: number;
    date: string;
    description: string;
    method: string | null;
    status: string;
    status_label: string;
    amount: number;
  }[];
  upcoming: {
    id: number | null;
    period_label: string;
    due_date: string;
    days_remaining: number;
    amount: number;
    is_overdue: boolean;
  }[];
}

const statusTone = (s: string): 'success' | 'warning' | 'danger' | 'ink' =>
  s === 'paid' ? 'success' : s === 'overdue' ? 'danger' : s === 'pending' ? 'warning' : 'ink';

export default function TenantPaymentsScreen() {
  const fetcher = useCallback(
    () => api.get<PageResponse<Payments>>('/tenant/payments').then((r) => r.data),
    [],
  );

  return (
    <DataScreen fetcher={fetcher}>
      {(d) => (
        <>
          <Text style={styles.title}>Payments</Text>

          <View style={styles.kpiRow}>
            <KpiCard label="Total paid" value={fmtMoney(d.kpis.total_paid)} hint={`${d.kpis.count} payments`} />
            <KpiCard
              label="Outstanding"
              value={fmtMoneyFull(d.kpis.outstanding)}
              accent={d.kpis.outstanding > 0 ? colors.danger : colors.success}
              hint={d.kpis.outstanding > 0 ? 'settle to stay current' : 'all settled'}
            />
          </View>

          <Card>
            <SectionTitle>Due now</SectionTitle>
            {d.upcoming.map((u, i) => (
              <View key={`${u.id ?? 'next'}-${i}`} style={styles.dueRow}>
              <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{u.period_label}</Text>
                  <Text style={styles.hint}>
                    Due {u.due_date}
                    {u.is_overdue ? ` · ${Math.abs(u.days_remaining)} days overdue` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.amount, u.is_overdue && { color: colors.danger }]}>
                    {fmtMoneyFull(u.amount)}
                  </Text>
                  {u.is_overdue ? <Badge tone="danger">OVERDUE</Badge> : null}
                </View>
              </View>
            ))}
          </Card>

          <Card>
            <SectionTitle>History</SectionTitle>
            {d.rows.map((r) => (
              <View key={r.id} style={styles.histRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{r.description}</Text>
                  <Text style={styles.hint}>
                    {r.date}
                    {r.method ? ` · ${r.method.replace(/_/g, ' ')}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.amount}>{fmtMoneyFull(r.amount)}</Text>
                  <Badge tone={statusTone(r.status)}>{r.status_label}</Badge>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}
    </DataScreen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink900, letterSpacing: -0.3 },
  kpiRow: { flexDirection: 'row', gap: spacing(4) },
  itemTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink800 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500, marginTop: 2 },
  amount: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink900 },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink100,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink100,
  },
});
