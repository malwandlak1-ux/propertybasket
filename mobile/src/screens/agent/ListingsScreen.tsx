import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, assetUrl, errorText } from '../../api';
import { Field, formStyles, PrimaryButton, SecondaryButton, Segmented, Sheet } from '../../components/form';
import { Badge, Card, Fab, LoadState, useTopPadding } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../theme';
import { usePage } from '../../usePage';

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
  sale_price: number | null;
  can_reactivate: boolean;
  can_mark_leased: boolean;
  can_mark_sold: boolean;
  can_delete: boolean;
}

interface ListingsPage {
  listings: Listing[];
  counts: { all: number; sale: number; rent: number; stay: number };
}

export type ListingsStackParams = {
  ListingsHome: undefined;
  ListingForm: { id?: number } | undefined;
};

type Filter = 'all' | 'sale' | 'rent';

const typeLabel: Record<string, string> = {
  for_sale: 'FOR SALE',
  long_term_rent: 'TO RENT',
  short_term_stay: 'SHORT STAY',
};

const statusTone = (s: string): 'success' | 'warning' | 'ink' | 'violet' | 'sky' =>
  s === 'available' ? 'success' : s === 'draft' ? 'warning' : s === 'sold' ? 'violet' : s === 'leased' ? 'sky' : 'ink';

const statusLabel = (s: string) => (s === 'leased' ? 'RENTED' : s.toUpperCase());

export default function AgentListingsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<ListingsStackParams>>();
  const topPadding = useTopPadding();
  const { data, error, refreshing, reload, onRefresh } = usePage<ListingsPage>('/agent/listings');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Listing | null>(null);

  // Coming back from the form: show the new or edited listing.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!data) return <LoadState error={error} onRetry={reload} />;

  const rows = data.listings.filter((l) =>
    filter === 'all' ? true : filter === 'sale' ? l.listing_type === 'for_sale' : l.listing_type === 'long_term_rent',
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <Text style={styles.title}>My listings</Text>

        <Segmented
          options={[
            { value: 'all', label: `All (${data.counts.all})` },
            { value: 'sale', label: `For sale (${data.counts.sale})` },
            { value: 'rent', label: `To rent (${data.counts.rent})` },
          ]}
          value={filter}
          onChange={setFilter}
        />

        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="home-outline" size={36} color={colors.ink300} />
            <Text style={styles.emptyTitle}>No listings here yet</Text>
            <Text style={styles.hintCenter}>Tap + to add a property. You can take the photos with your phone.</Text>
          </View>
        ) : (
          rows.map((l) => {
            const photo = assetUrl(l.primary_image);
            return (
              <Pressable key={l.id} onPress={() => setSelected(l)} accessibilityRole="button" accessibilityLabel={l.title}>
                <Card style={styles.listing}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
                  ) : (
                    <View style={[styles.photo, styles.photoFallback]}>
                      <Ionicons name="image-outline" size={36} color={colors.brand} />
                    </View>
                  )}
                  <View style={styles.body}>
                    <View style={styles.badges}>
                      <Badge tone="brand">{typeLabel[l.listing_type] ?? l.listing_type.toUpperCase()}</Badge>
                      <Badge tone={statusTone(l.status)}>{statusLabel(l.status)}</Badge>
                    </View>
                    <Text style={styles.itemTitle}>{l.title}</Text>
                    {l.address ? (
                      <Text style={styles.hint} numberOfLines={1}>
                        {l.address}
                      </Text>
                    ) : null}
                    <Text style={styles.price}>{l.price_label}</Text>
                    <Text style={styles.meta}>
                      {l.views} views · {l.inquiries} inquiries · {l.viewings} viewings · {l.days_on_market}d on market
                    </Text>
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Fab label="Add a listing" onPress={() => nav.navigate('ListingForm')} />

      <ActionsSheet
        listing={selected}
        onClose={() => setSelected(null)}
        onEdit={(id) => {
          setSelected(null);
          nav.navigate('ListingForm', { id });
        }}
        onChanged={() => {
          setSelected(null);
          reload();
        }}
      />
    </View>
  );
}

/* ---------- What you can do with one listing ---------- */

function ActionsSheet({
  listing,
  onClose,
  onEdit,
  onChanged,
}: {
  listing: Listing | null;
  onClose: () => void;
  onEdit: (id: number) => void;
  onChanged: () => void;
}) {
  // Sold / delete need a second, deliberate tap before anything is sent.
  const [confirm, setConfirm] = useState<'sold' | 'delete' | null>(null);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setConfirm(null);
    setErr(null);
    setPrice(listing?.sale_price ? String(Math.round(listing.sale_price)) : '');
  }, [listing]);

  if (!listing) return <Sheet visible={false} onClose={onClose} title="" children={null} />;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const base = `/agent/listings/${listing.id}`;

  return (
    <Sheet visible onClose={onClose} title={listing.title}>
      <Text style={styles.hint}>
        {listing.price_label} · {statusLabel(listing.status).toLowerCase()}
      </Text>

      {confirm === 'sold' ? (
        <>
          <Text style={styles.confirmText}>
            Recording the sale takes this listing off the public site and puts your commission in the agency payout queue.
            This can't be undone from the app.
          </Text>
          <Field label="FINAL SALE PRICE (R)" value={price} onChangeText={(t) => setPrice(t.replace(/[^\d]/g, ''))} keyboardType="number-pad" />
          {err ? <Text style={formStyles.error}>{err}</Text> : null}
          <PrimaryButton title="Confirm sale" busy={busy} onPress={() => run(() => api.post(`${base}/mark-sold`, { sale_price: price || null }))} />
          <SecondaryButton title="Back" onPress={() => setConfirm(null)} />
        </>
      ) : confirm === 'delete' ? (
        <>
          <Text style={styles.confirmText}>
            Delete "{listing.title}"? It will be removed from your list and from the public site.
          </Text>
          {err ? <Text style={formStyles.error}>{err}</Text> : null}
          <Pressable style={[styles.dangerBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={() => run(() => api.del(base))} accessibilityRole="button">
            <Text style={styles.dangerBtnText}>Yes, delete listing</Text>
          </Pressable>
          <SecondaryButton title="Back" onPress={() => setConfirm(null)} />
        </>
      ) : (
        <>
          <ActionRow icon="create-outline" label="Edit details and photos" onPress={() => onEdit(listing.id)} />
          {listing.can_mark_sold ? <ActionRow icon="ribbon-outline" label="Mark as sold" onPress={() => setConfirm('sold')} /> : null}
          {listing.can_mark_leased ? (
            <ActionRow
              icon="key-outline"
              label="Mark as rented"
              hint="Takes it off the public site. No lease is created."
              disabled={busy}
              onPress={() => run(() => api.post(`${base}/mark-leased`))}
            />
          ) : null}
          {listing.can_reactivate ? (
            <ActionRow
              icon="refresh-outline"
              label="Put back on the market"
              hint="Ends any current lease on this listing."
              disabled={busy}
              onPress={() => run(() => api.post(`${base}/reactivate`))}
            />
          ) : null}
          {listing.can_delete ? <ActionRow icon="trash-outline" label="Delete listing" danger onPress={() => setConfirm('delete')} /> : null}
          {err ? <Text style={formStyles.error}>{err}</Text> : null}
          <SecondaryButton title="Close" onPress={onClose} />
        </>
      )}
    </Sheet>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  danger,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const tint = danger ? colors.danger : colors.brand600;
  return (
    <Pressable style={[styles.action, disabled && { opacity: 0.6 }]} onPress={onPress} disabled={disabled} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={tint} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionText, danger && { color: colors.danger }]}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.ink300} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(24), gap: spacing(4) },
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink900, letterSpacing: -0.3 },
  listing: { padding: 0, overflow: 'hidden' },
  photo: { width: '100%', height: 150 },
  photoFallback: { backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing(4), gap: spacing(1) },
  badges: { flexDirection: 'row', gap: spacing(2) },
  itemTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink800, marginTop: spacing(1) },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
  hintCenter: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, textAlign: 'center' },
  price: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.brand600, marginTop: spacing(1) },
  meta: { fontFamily: fonts.sans, fontSize: 11, color: colors.ink400, marginTop: spacing(1) },
  empty: { alignItems: 'center', gap: spacing(2), paddingVertical: spacing(16), paddingHorizontal: spacing(6) },
  emptyTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink800 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.md,
    padding: spacing(3.5),
  },
  actionText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink800 },
  confirmText: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink700, lineHeight: 20 },
  dangerBtn: { backgroundColor: colors.danger, borderRadius: radius.md, paddingVertical: spacing(3.5), alignItems: 'center' },
  dangerBtnText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.white },
});
