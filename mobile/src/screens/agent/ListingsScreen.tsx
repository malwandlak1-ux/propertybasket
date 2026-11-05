import React, { useCallback } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { api, PageResponse } from '../../api';
import { Badge, Card, DataScreen } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../theme';

interface Listing {
  id: number;
  title: string;
  address: string | null;
  listing_type: string;
  status: string;
  price_label: string;
  days_on_market: number;
  views: number;
  inquiries: number;
  viewings: number;
  primary_image: string | null;
}

interface Listings {
  agent: { name: string };
  listings: Listing[];
  counts: { all: number; sale: number; rent: number; stay: number };
}

const typeLabel: Record<string, string> = {
  for_sale: 'FOR SALE',
  long_term_rent: 'TO RENT',
  short_term_stay: 'SHORT STAY',
};

const statusTone = (s: string): 'success' | 'warning' | 'ink' =>
  s === 'available' ? 'success' : s === 'draft' ? 'warning' : 'ink';

export default function AgentListingsScreen() {
  const fetcher = useCallback(
    () => api.get<PageResponse<Listings>>('/agent/listings').then((r) => r.data),
    [],
  );

  return (
    <DataScreen fetcher={fetcher}>
      {(d) => (
        <>
          <Text style={styles.title}>My listings</Text>
          <Text style={styles.sub}>
            {d.counts.all} total · {d.counts.sale} for sale · {d.counts.rent} rentals · {d.counts.stay}{' '}
            short stay
          </Text>

          {d.listings.map((l) => (
            <Card key={l.id} style={styles.listing}>
              {l.primary_image ? (
                <Image source={{ uri: l.primary_image }} style={styles.photo} resizeMode="cover" />
              ) : (
                <View style={[styles.photo, styles.photoFallback]}>
                  <Text style={styles.photoEmoji}>🏡</Text>
                </View>
              )}
              <View style={styles.body}>
                <View style={styles.badges}>
                  <Badge tone="brand">{typeLabel[l.listing_type] ?? l.listing_type.toUpperCase()}</Badge>
                  <Badge tone={statusTone(l.status)}>{l.status.toUpperCase()}</Badge>
                </View>
                <Text style={styles.itemTitle}>{l.title}</Text>
                {l.address ? (
                  <Text style={styles.hint} numberOfLines={1}>
                    {l.address}
                  </Text>
                ) : null}
                <Text style={styles.price}>{l.price_label}</Text>
                <Text style={styles.meta}>
                  {l.views} views · {l.inquiries} inquiries · {l.viewings} viewings ·{' '}
                  {l.days_on_market}d on market
                </Text>
              </View>
            </Card>
          ))}
        </>
      )}
    </DataScreen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink900, letterSpacing: -0.3 },
  sub: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, marginTop: -spacing(2) },
  listing: { padding: 0, overflow: 'hidden' },
  photo: { width: '100%', height: 150 },
  photoFallback: { backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  photoEmoji: { fontSize: 40 },
  body: { padding: spacing(4), gap: spacing(1) },
  badges: { flexDirection: 'row', gap: spacing(2) },
  itemTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink800, marginTop: spacing(1) },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
  price: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.brand600, marginTop: spacing(1) },
  meta: { fontFamily: fonts.sans, fontSize: 11, color: colors.ink400, marginTop: spacing(1) },
});
