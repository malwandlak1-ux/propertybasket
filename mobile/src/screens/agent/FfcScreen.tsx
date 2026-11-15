import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Label } from '../../components/form';
import { Card, LoadState, useTopPadding } from '../../components/ui';
import { colors, fonts, spacing } from '../../theme';
import { usePage } from '../../usePage';

interface FfcPage {
  ffc: {
    state: string; // valid | expiring | expired | missing
    days_left: number | null;
    ffc_number: string | null;
    ffc_expires_at: string | null;
    has_certificate: boolean;
  };
}

const STATES: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; title: string }> = {
  valid: { icon: 'shield-checkmark', color: '#047857', bg: '#ECFDF5', title: 'Your FFC is valid' },
  expiring: { icon: 'warning', color: '#B45309', bg: '#FFFBEB', title: 'Your FFC expires soon' },
  expired: { icon: 'close-circle', color: '#B91C1C', bg: '#FEF2F2', title: 'Your FFC has expired' },
  missing: { icon: 'alert-circle', color: '#B91C1C', bg: '#FEF2F2', title: 'No FFC on file' },
};

function longDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AgentFfcScreen() {
  const topPadding = useTopPadding();
  const { data, error, refreshing, reload, onRefresh } = usePage<FfcPage>('/agent/ffc');

  if (!data) return <LoadState error={error} onRetry={reload} />;

  const { ffc } = data;
  const s = STATES[ffc.state] ?? STATES.missing;
  const blocked = ffc.state === 'expired' || ffc.state === 'missing';

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      <View style={[styles.banner, { backgroundColor: s.bg }]}>
        <Ionicons name={s.icon} size={36} color={s.color} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: s.color }]}>{s.title}</Text>
          {ffc.days_left !== null && ffc.days_left >= 0 ? (
            <Text style={[styles.bannerSub, { color: s.color }]}>{ffc.days_left} days left</Text>
          ) : null}
        </View>
      </View>

      {blocked ? (
        <Text style={styles.warn}>
          Until a current certificate is uploaded you can view your dashboard but can't add leads, schedule viewings or make
          other changes.
        </Text>
      ) : null}

      <Card style={{ gap: spacing(4) }}>
        <Row label="FFC NUMBER" value={ffc.ffc_number ?? 'Not captured'} />
        <Row label="EXPIRES" value={longDate(ffc.ffc_expires_at)} />
        <Row label="CERTIFICATE" value={ffc.has_certificate ? 'Uploaded' : 'Not uploaded'} />
      </Card>

      <Text style={styles.note}>
        To upload a new certificate or change your FFC number, use FFC & Compliance on the website dashboard. Uploading from
        the app is coming in a later update.
      </Text>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: spacing(1) }}>
      <Label>{label}</Label>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(10), gap: spacing(4) },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), borderRadius: 16, padding: spacing(4) },
  bannerTitle: { fontFamily: fonts.displayBold, fontSize: 18 },
  bannerSub: { fontFamily: fonts.sansMedium, fontSize: 13, marginTop: 2 },
  warn: { fontFamily: fonts.sansMedium, fontSize: 13, color: '#B91C1C', lineHeight: 19 },
  value: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink900 },
  note: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, lineHeight: 19 },
});
