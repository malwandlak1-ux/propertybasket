import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { assetUrl } from '../../api';
import { Label, Segmented } from '../../components/form';
import { Badge, Card, Fab, LoadState, SectionTitle, useTopPadding } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../theme';
import { usePage } from '../../usePage';

export type InspectionType = 'move_in' | 'move_out';

/** The inspection screens added to the "More" stack. */
export type InspectionStackParams = {
  InspectionDetail: { id: number };
  InspectionForm: { type: InspectionType; leaseId?: number };
};

type Nav = NativeStackNavigationProp<InspectionStackParams>;

interface InspectionCard {
  id: number;
  listing: string;
  tenant: string;
  date: string;
  rooms_total: number;
  photo_count: number;
  tenant_signed: boolean;
}

interface InspectionsPage {
  move_in: InspectionCard[];
  move_out: InspectionCard[];
  upcoming: { lease_id: number; listing: string; tenant: string; start_date: string }[];
  counts: { move_in: number; move_out: number };
}

const typeLabel = (t: string) => (t === 'move_out' ? 'Move-out' : 'Move-in');

const conditionTone: Record<string, 'success' | 'sky' | 'warning' | 'danger'> = {
  excellent: 'success',
  good: 'sky',
  fair: 'warning',
  poor: 'danger',
};

/* ---------- List ---------- */

export default function AgentInspectionsScreen() {
  const nav = useNavigation<Nav>();
  const topPadding = useTopPadding();
  const { data, error, refreshing, reload, onRefresh } = usePage<InspectionsPage>('/agent/inspections');
  const [type, setType] = useState<InspectionType>('move_in');

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!data) return <LoadState error={error} onRetry={reload} />;

  const rows = type === 'move_in' ? data.move_in : data.move_out;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {data.upcoming.length ? (
          <Card style={{ gap: spacing(1) }}>
            <SectionTitle>Move-ins this week</SectionTitle>
            {data.upcoming.map((u) => (
              <Pressable
                key={u.lease_id}
                style={styles.upcoming}
                onPress={() => nav.navigate('InspectionForm', { type: 'move_in', leaseId: u.lease_id })}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {u.listing}
                  </Text>
                  <Text style={styles.hint}>
                    {u.tenant} · starts {u.start_date}
                  </Text>
                </View>
                <Text style={styles.link}>Inspect</Text>
              </Pressable>
            ))}
          </Card>
        ) : null}

        <Segmented
          options={[
            { value: 'move_in', label: `Move-in (${data.counts.move_in})` },
            { value: 'move_out', label: `Move-out (${data.counts.move_out})` },
          ]}
          value={type}
          onChange={setType}
        />

        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={36} color={colors.ink300} />
            <Text style={styles.emptyTitle}>No {typeLabel(type).toLowerCase()} inspections yet</Text>
            <Text style={styles.hintCenter}>Tap + to do one on site. You can photograph each room with your phone.</Text>
          </View>
        ) : (
          rows.map((r) => (
            <Pressable key={r.id} onPress={() => nav.navigate('InspectionDetail', { id: r.id })} accessibilityRole="button">
              <Card style={styles.card}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {r.listing}
                  </Text>
                  <Text style={styles.hint}>
                    {r.tenant} · {r.date}
                  </Text>
                  <Text style={styles.hint}>
                    {r.rooms_total} rooms · {r.photo_count} photos
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.ink300} />
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Fab label={`New ${typeLabel(type).toLowerCase()} inspection`} onPress={() => nav.navigate('InspectionForm', { type })} />
    </View>
  );
}

/* ---------- Detail (read-only: inspections can't be edited after completion) ---------- */

interface InspectionDetailPage {
  inspection: {
    id: number;
    type: string;
    rooms: { name: string; condition: string; notes: string | null; photos?: string[] }[];
    agent_signed_at: string | null;
    agent_signature: string | null;
    tenant_signed_at: string | null;
    created_at: string | null;
  };
  lease: { tenant_name: string | null; start_date: string | null; end_date: string | null };
  listing: { title: string | null; address: string };
}

export function AgentInspectionDetailScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<InspectionStackParams, 'InspectionDetail'>>();
  const { data, error, refreshing, reload, onRefresh } = usePage<InspectionDetailPage>(`/agent/inspections/${route.params.id}`);
  const [zoom, setZoom] = useState<string | null>(null);

  const type = data?.inspection.type;
  useLayoutEffect(() => {
    if (type) nav.setOptions({ title: `${typeLabel(type)} inspection` });
  }, [nav, type]);

  if (!data) return <LoadState error={error} onRetry={reload} />;

  const { inspection, lease, listing } = data;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <Card style={{ gap: spacing(2) }}>
          <Text style={styles.title}>{listing.title ?? 'Property'}</Text>
          {listing.address ? <Text style={styles.hint}>{listing.address}</Text> : null}
          <Text style={styles.body}>
            Tenant: {lease.tenant_name ?? '—'} · Lease {lease.start_date ?? '—'} to {lease.end_date ?? 'open-ended'}
          </Text>
          <Text style={styles.hint}>Completed {inspection.created_at ?? '—'}</Text>
        </Card>

        {inspection.rooms.map((room, i) => (
          <Card key={`${room.name}${i}`} style={{ gap: spacing(2) }}>
            <View style={styles.roomHead}>
              <Text style={[styles.rowTitle, { flex: 1 }]}>{room.name}</Text>
              <Badge tone={conditionTone[room.condition] ?? 'sky'}>{room.condition.toUpperCase()}</Badge>
            </View>
            {room.notes ? <Text style={styles.body}>{room.notes}</Text> : null}
            {room.photos?.length ? (
              <View style={styles.thumbs}>
                {room.photos.map((p) => {
                  const uri = assetUrl(p)!;
                  return (
                    <Pressable key={p} onPress={() => setZoom(uri)} accessibilityRole="imagebutton" accessibilityLabel={`${room.name} photo`}>
                      <Image source={{ uri }} style={styles.thumb} />
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.hint}>No photos</Text>
            )}
          </Card>
        ))}

        <Card style={{ gap: spacing(2) }}>
          <Label>SIGNED</Label>
          <Text style={styles.body}>
            Agent: {inspection.agent_signature ?? '—'}
            {inspection.agent_signed_at ? ` · ${inspection.agent_signed_at}` : ''}
          </Text>
          <Text style={styles.body}>Tenant: {inspection.tenant_signed_at ? `signed ${inspection.tenant_signed_at}` : 'not signed yet'}</Text>
          <Text style={styles.hint}>The PDF report can be downloaded from Inspections on the website.</Text>
        </Card>
      </ScrollView>

      {zoom ? (
        <Pressable style={styles.zoom} onPress={() => setZoom(null)} accessibilityRole="button" accessibilityLabel="Close photo">
          <Image source={{ uri: zoom }} style={styles.zoomImage} resizeMode="contain" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(24), gap: spacing(3) },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.ink900 },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink900 },
  body: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink700, lineHeight: 20 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
  hintCenter: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, textAlign: 'center' },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.brand600 },
  upcoming: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(2.5), borderTopWidth: 1, borderTopColor: colors.ink100 },
  empty: { alignItems: 'center', gap: spacing(2), paddingVertical: spacing(14), paddingHorizontal: spacing(6) },
  emptyTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink800, textAlign: 'center' },
  roomHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  thumb: { width: 76, height: 76, borderRadius: radius.sm, backgroundColor: colors.ink100 },
  zoom: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,11,15,0.92)', alignItems: 'center', justifyContent: 'center' },
  zoomImage: { width: '100%', height: '80%' },
});
