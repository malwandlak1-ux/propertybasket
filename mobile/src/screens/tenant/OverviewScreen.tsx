import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, PageResponse } from '../../api';
import { useAuth } from '../../auth';
import { Avatar, Badge, Card, DataScreen, SectionTitle } from '../../components/ui';
import { fmtMoneyFull } from '../../format';
import { colors, fonts, radius, spacing } from '../../theme';

interface Overview {
  tenant: { name: string; initials: string };
  lease: {
    address: string;
    suburb: string | null;
    city: string | null;
    monthly_rent: number;
    end_date: string;
    progress_pct: number;
    months_remaining: number;
  };
  next_due: {
    amount: number;
    due_date: string;
    days_remaining: number;
    arrears_total: number;
    has_arrears: boolean;
  };
  streak: number;
  deposit: {
    status: string;
    is_due: boolean;
    amount_deposited: number;
    accrued_interest: number;
    total_held: number;
  };
  open_maintenance: {
    title: string;
    status: string;
    urgency: string;
    logged_human: string;
    contractor: { name: string; initials: string } | null;
  } | null;
  recent_payments: { id: number; label: string; paid_at: string | null; amount: number }[];
  agent: { name: string; initials: string; agency: string | null; phone: string | null } | null;
}

export default function TenantOverviewScreen() {
  const { user } = useAuth();
  const fetcher = useCallback(
    () => api.get<PageResponse<Overview>>('/tenant/overview').then((r) => r.data),
    [],
  );

  return (
    <DataScreen fetcher={fetcher}>
      {(d) => (
        <>
          <Text style={styles.greeting}>Hi {user?.name.split(' ')[0]} 👋</Text>
          <Text style={styles.address}>
            {d.lease.address}
            {d.lease.suburb ? ` · ${d.lease.suburb}` : ''}
          </Text>

          {/* Amount due — hero card, brand gradient feel */}
          <Card style={styles.dueCard}>
            <Text style={styles.dueLabel}>AMOUNT DUE</Text>
            <Text style={styles.dueAmount}>{fmtMoneyFull(d.next_due.amount)}</Text>
            <Text style={styles.dueMeta}>
              Due {d.next_due.due_date}
              {d.next_due.days_remaining < 0
                ? ` · ${Math.abs(d.next_due.days_remaining)} days overdue`
                : ` · in ${d.next_due.days_remaining} days`}
            </Text>
            {d.next_due.has_arrears ? (
              <View style={styles.arrears}>
                <Text style={styles.arrearsText}>
                  Includes {fmtMoneyFull(d.next_due.arrears_total)} arrears — pay-and-stay applies
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Streak + deposit */}
          <View style={styles.row}>
            <Card style={styles.half}>
              <Text style={styles.smallLabel}>ON-TIME STREAK</Text>
              <Text style={styles.bigStat}>{d.streak} 🔥</Text>
              <Text style={styles.hint}>consecutive months</Text>
            </Card>
            <Card style={styles.half}>
              <Text style={styles.smallLabel}>DEPOSIT {d.deposit.is_due ? 'DUE' : 'HELD'}</Text>
              <Text style={styles.bigStat}>
                {fmtMoneyFull(d.deposit.is_due ? d.deposit.amount_deposited : d.deposit.total_held)}
              </Text>
              <Text style={styles.hint}>
                {d.deposit.is_due
                  ? 'payable to trust account'
                  : `incl. ${fmtMoneyFull(d.deposit.accrued_interest)} interest`}
              </Text>
            </Card>
          </View>

          {/* Lease progress */}
          <Card>
            <SectionTitle>Lease term</SectionTitle>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${d.lease.progress_pct}%` }]} />
            </View>
            <Text style={styles.hint}>
              {d.lease.progress_pct}% elapsed · {d.lease.months_remaining} months remaining · ends{' '}
              {d.lease.end_date}
            </Text>
          </Card>

          {/* Open maintenance */}
          {d.open_maintenance ? (
            <Card>
              <SectionTitle>Open maintenance</SectionTitle>
              <View style={styles.maintRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{d.open_maintenance.title}</Text>
                  <Text style={styles.hint}>
                    Logged {d.open_maintenance.logged_human}
                    {d.open_maintenance.contractor ? ` · ${d.open_maintenance.contractor.name}` : ''}
                  </Text>
                </View>
                <Badge tone={d.open_maintenance.urgency === 'emergency' ? 'danger' : 'warning'}>
                  {d.open_maintenance.status.replace(/_/g, ' ').toUpperCase()}
                </Badge>
              </View>
            </Card>
          ) : null}

          {/* Recent payments */}
          <Card>
            <SectionTitle>Recent payments</SectionTitle>
            {d.recent_payments.length === 0 ? (
              <Text style={styles.hint}>No payments yet.</Text>
            ) : (
              d.recent_payments.map((p) => (
                <View key={p.id} style={styles.payRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{p.label}</Text>
                    <Text style={styles.hint}>{p.paid_at}</Text>
                  </View>
                  <Text style={styles.payAmount}>{fmtMoneyFull(p.amount)}</Text>
                </View>
              ))
            )}
          </Card>

          {/* Agent */}
          {d.agent ? (
            <Card style={styles.agentCard}>
              <Avatar initials={d.agent.initials} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{d.agent.name}</Text>
                <Text style={styles.hint}>
                  {d.agent.agency ?? 'Your agent'}
                  {d.agent.phone ? ` · ${d.agent.phone}` : ''}
                </Text>
              </View>
            </Card>
          ) : null}
        </>
      )}
    </DataScreen>
  );
}

const styles = StyleSheet.create({
  greeting: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink900, letterSpacing: -0.3 },
  address: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, marginTop: -spacing(2) },
  dueCard: { backgroundColor: colors.ink900, gap: spacing(1) },
  dueLabel: { fontFamily: fonts.sansSemiBold, fontSize: 10, letterSpacing: 1, color: colors.brand100 },
  dueAmount: { fontFamily: fonts.displayBold, fontSize: 34, color: colors.white, letterSpacing: -0.5 },
  dueMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink300 },
  arrears: {
    marginTop: spacing(2),
    backgroundColor: 'rgba(242,106,27,0.18)',
    borderRadius: radius.md,
    padding: spacing(2.5),
  },
  arrearsText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.brand100 },
  row: { flexDirection: 'row', gap: spacing(4) },
  half: { flex: 1, gap: 2 },
  smallLabel: { fontFamily: fonts.sansSemiBold, fontSize: 10, letterSpacing: 0.6, color: colors.ink400 },
  bigStat: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink900 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500, marginTop: spacing(1) },
  progressTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.ink100,
    marginTop: spacing(3),
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: radius.full, backgroundColor: colors.brand },
  maintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), marginTop: spacing(3) },
  itemTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink800 },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink100,
  },
  payAmount: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.success },
  agentCard: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
});
