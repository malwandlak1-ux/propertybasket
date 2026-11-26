import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import ContactActions from '../../components/ContactActions';
import { Label, SecondaryButton, Segmented, Sheet } from '../../components/form';
import { Avatar, Badge, Card, LoadState, useTopPadding } from '../../components/ui';
import { fmtMoneyFull } from '../../format';
import { colors, fonts, spacing } from '../../theme';
import { usePage } from '../../usePage';

interface TenantRow {
  lease_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  initials: string;
  listing_title: string;
  listing_addr: string;
  monthly_rent: number;
  start_date: string | null;
  end_date: string | null;
  lease_status: string;
  days_to_expiry: number | null;
}

interface TenantsPage {
  active: TenantRow[];
  archived: TenantRow[];
  counts: { active: number; archived: number };
}

/** Lease-end warning: red inside 30 days, amber inside 90. */
function expiry(t: TenantRow): { tone: 'danger' | 'warning' | 'success' | 'ink'; text: string } | null {
  if (t.days_to_expiry === null) return null;
  if (t.days_to_expiry < 0) return { tone: 'ink', text: 'ENDED' };
  if (t.days_to_expiry <= 30) return { tone: 'danger', text: `${t.days_to_expiry} DAYS LEFT` };
  if (t.days_to_expiry <= 90) return { tone: 'warning', text: `${t.days_to_expiry} DAYS LEFT` };
  return { tone: 'success', text: 'ACTIVE' };
}

export default function AgentTenantsScreen() {
  const topPadding = useTopPadding();
  const { data, error, refreshing, reload, onRefresh } = usePage<TenantsPage>('/agent/tenants');
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [selected, setSelected] = useState<TenantRow | null>(null);

  if (!data) return <LoadState error={error} onRetry={reload} />;

  const rows = tab === 'active' ? data.active : data.archived;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <Segmented
          options={[
            { value: 'active', label: `Active (${data.counts.active})` },
            { value: 'archived', label: `Past (${data.counts.archived})` },
          ]}
          value={tab}
          onChange={setTab}
        />

        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={36} color={colors.ink300} />
            <Text style={styles.emptyTitle}>{tab === 'active' ? 'No active tenants' : 'No past tenants'}</Text>
            <Text style={styles.hint}>Tenants appear here once a lease you manage is signed.</Text>
          </View>
        ) : (
          rows.map((t) => {
            const e = expiry(t);
            return (
              <Pressable key={t.lease_id} onPress={() => setSelected(t)} accessibilityRole="button">
                <Card style={styles.card}>
                  <Avatar initials={t.initials} size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.name}>{t.name}</Text>
                    <Text style={styles.hintLeft} numberOfLines={1}>
                      {t.listing_title}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.rent}>{fmtMoneyFull(t.monthly_rent)} / month</Text>
                      {e ? <Badge tone={e.tone}>{e.text}</Badge> : null}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.ink300} />
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Sheet visible={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''}>
        {selected ? (
          <>
            <ContactActions phone={selected.phone} email={selected.email} />
            <Detail label="PROPERTY" value={[selected.listing_title, selected.listing_addr].filter(Boolean).join(' · ')} />
            <Detail label="RENT" value={`${fmtMoneyFull(selected.monthly_rent)} per month`} />
            <Detail label="LEASE" value={`${selected.start_date ?? '—'} to ${selected.end_date ?? 'open-ended'}`} />
            {selected.days_to_expiry !== null && selected.days_to_expiry >= 0 ? (
              <Detail label="ENDS IN" value={`${selected.days_to_expiry} days`} />
            ) : null}
            <SecondaryButton title="Close" onPress={() => setSelected(null)} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: spacing(1) }}>
      <Label>{label}</Label>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(10), gap: spacing(3) },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink900 },
  hint: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, textAlign: 'center' },
  hintLeft: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: spacing(1), flexWrap: 'wrap' },
  rent: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink800 },
  value: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink800 },
  empty: { alignItems: 'center', gap: spacing(2), paddingVertical: spacing(16), paddingHorizontal: spacing(6) },
  emptyTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink800 },
});
