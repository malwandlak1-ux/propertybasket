import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadowCard, spacing } from '../theme';

/** White card with the site's shadow-soft. */
export function Card({ style, children }: { style?: ViewStyle; children: React.ReactNode }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function KpiCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.kpiValue, accent ? { color: accent } : null]}>{value}</Text>
      {hint ? <Text style={styles.kpiHint}>{hint}</Text> : null}
    </Card>
  );
}

const badgePalette: Record<string, { bg: string; fg: string }> = {
  brand: { bg: colors.brand50, fg: colors.brand600 },
  success: { bg: '#ECFDF5', fg: '#047857' },
  warning: { bg: '#FFFBEB', fg: '#B45309' },
  danger: { bg: '#FEF2F2', fg: '#B91C1C' },
  ink: { bg: colors.ink100, fg: colors.ink500 },
  sky: { bg: '#F0F9FF', fg: '#0369A1' },
  violet: { bg: '#F5F3FF', fg: '#6D28D9' },
};

export function Badge({ tone = 'ink', children }: { tone?: keyof typeof badgePalette; children: React.ReactNode }) {
  const p = badgePalette[tone] ?? badgePalette.ink;
  return (
    <View style={[styles.badge, { backgroundColor: p.bg }]}>
      <Text style={[styles.badgeText, { color: p.fg }]}>{children}</Text>
    </View>
  );
}

export function Avatar({ initials, size = 40 }: { initials: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brand100,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.sansBold, color: colors.brand700, fontSize: size * 0.36 }}>
        {initials}
      </Text>
    </View>
  );
}

/**
 * Data-backed screen shell: loads via `fetcher`, shows spinner / error state,
 * pull-to-refresh, and the site's ink-50 page background.
 */
export function DataScreen<T>({
  fetcher,
  children,
}: {
  fetcher: () => Promise<T>;
  children: (data: T, reload: () => void) => React.ReactNode;
}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Keeps content clear of the iOS notch / Dynamic Island and Android
  // edge-to-edge status bar (headers are hidden, so screens own the top inset).
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await fetcher());
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    }
  }, [fetcher]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <Text style={styles.retry} onPress={load}>
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

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.pageContent, { paddingTop: insets.top + spacing(4) }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      {children(data, load)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  pageContent: { padding: spacing(4), paddingBottom: spacing(10), gap: spacing(4) },
  center: {
    flex: 1,
    backgroundColor: colors.ink50,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(6),
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing(4),
    ...shadowCard,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.ink800,
    letterSpacing: -0.16,
  },
  kpiCard: { flex: 1, minWidth: '45%' as unknown as number, gap: spacing(1) },
  kpiLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.ink400,
  },
  kpiValue: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink900 },
  kpiHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.ink500 },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing(2),
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: { fontFamily: fonts.sansSemiBold, fontSize: 10, letterSpacing: 0.4 },
  errorTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink800 },
  errorBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink500,
    textAlign: 'center',
    marginTop: spacing(2),
  },
  retry: {
    marginTop: spacing(4),
    color: colors.brand600,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
  },
});
