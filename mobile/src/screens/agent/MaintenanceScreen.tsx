import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import ContactActions from '../../components/ContactActions';
import { Label, SecondaryButton, Sheet } from '../../components/form';
import { Badge, Card, LoadState, useTopPadding } from '../../components/ui';
import { colors, fonts, spacing } from '../../theme';
import { usePage } from '../../usePage';

interface MaintenanceRequest {
  id: number;
  title: string;
  description: string | null;
  category: string;
  urgency: string;
  status: string;
  stage: string;
  photo_count: number;
  tenant: string | null;
  tenant_phone: string | null;
  property: string | null;
  suburb: string | null;
  preferred: string | null;
  time_slot: string | null;
  contractor: string | null;
  quote_count: number;
  created: string;
}

interface MaintenancePage {
  requests: MaintenanceRequest[];
}

type Tone = 'danger' | 'warning' | 'ink' | 'success' | 'sky' | 'brand' | 'violet';

const urgencyTone: Record<string, Tone> = { emergency: 'danger', high: 'warning', urgent: 'warning', medium: 'sky', low: 'ink' };
const stageTone: Record<string, Tone> = { new: 'brand', completed: 'success', done: 'success', closed: 'ink', cancelled: 'ink' };

const words = (s: string) => s.replace(/_/g, ' ').toUpperCase();

export default function AgentMaintenanceScreen() {
  const topPadding = useTopPadding();
  const { data, error, refreshing, reload, onRefresh } = usePage<MaintenancePage>('/agent/maintenance');
  const [selected, setSelected] = useState<MaintenanceRequest | null>(null);

  if (!data) return <LoadState error={error} onRetry={reload} />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {data.requests.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="construct-outline" size={36} color={colors.ink300} />
            <Text style={styles.emptyTitle}>No maintenance requests</Text>
            <Text style={styles.hintCenter}>Requests from tenants on your properties will show here.</Text>
          </View>
        ) : (
          data.requests.map((r) => (
            <Pressable key={r.id} onPress={() => setSelected(r)} accessibilityRole="button">
              <Card style={{ gap: spacing(2) }}>
                <View style={styles.badges}>
                  <Badge tone={urgencyTone[r.urgency] ?? 'ink'}>{words(r.urgency)}</Badge>
                  <Badge tone={stageTone[r.stage] ?? 'violet'}>{words(r.stage)}</Badge>
                  <Text style={styles.age}>{r.created}</Text>
                </View>
                <Text style={styles.title}>{r.title}</Text>
                <Text style={styles.hint} numberOfLines={1}>
                  {[r.property, r.tenant].filter(Boolean).join(' · ')}
                </Text>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Sheet visible={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? ''}>
        {selected ? (
          <>
            <View style={styles.badges}>
              <Badge tone={urgencyTone[selected.urgency] ?? 'ink'}>{words(selected.urgency)}</Badge>
              <Badge tone={stageTone[selected.stage] ?? 'violet'}>{words(selected.stage)}</Badge>
              <Badge tone="ink">{words(selected.category)}</Badge>
            </View>
            {selected.description ? <Text style={styles.body}>{selected.description}</Text> : null}
            <Detail label="PROPERTY" value={[selected.property, selected.suburb].filter(Boolean).join(' · ') || '—'} />
            <Detail label="TENANT" value={selected.tenant ?? '—'} />
            <ContactActions phone={selected.tenant_phone} />
            {selected.preferred ? (
              <Detail label="PREFERRED VISIT" value={[selected.preferred, selected.time_slot].filter(Boolean).join(' · ')} />
            ) : null}
            <Detail
              label="CONTRACTOR"
              value={selected.contractor ?? (selected.quote_count ? `${selected.quote_count} quote(s) received` : 'Not assigned yet')}
            />
            {selected.photo_count ? <Detail label="PHOTOS" value={`${selected.photo_count} attached (view on the website)`} /> : null}
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
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), flexWrap: 'wrap' },
  age: { marginLeft: 'auto', fontFamily: fonts.sans, fontSize: 11, color: colors.ink400 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink900 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
  hintCenter: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, textAlign: 'center' },
  body: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink700, lineHeight: 20 },
  value: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink800 },
  empty: { alignItems: 'center', gap: spacing(2), paddingVertical: spacing(16), paddingHorizontal: spacing(6) },
  emptyTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink800 },
});
