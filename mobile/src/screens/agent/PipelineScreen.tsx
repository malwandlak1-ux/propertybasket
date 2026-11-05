import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, PageResponse } from '../../api';
import { Badge, Card, DataScreen, SectionTitle } from '../../components/ui';
import { fmtMoney } from '../../format';
import { colors, fonts, radius, spacing } from '../../theme';

interface LeadCard {
  id: number;
  visitor_name: string;
  email: string;
  phone: string | null;
  listing_title: string | null;
  deal_value: number;
  is_hot: boolean;
  status: string;
  age_label: string;
}

interface Column {
  key: string;
  label: string;
  count: number;
  total_value: number;
  cards: LeadCard[];
}

interface Pipeline {
  agent: { name: string; agency_name: string };
  columns: Column[];
  total_value: number;
}

const dotColors: Record<string, string> = {
  new: colors.ink400,
  qualified: colors.sky,
  viewing: colors.brand,
  offer: colors.warning,
  closed: colors.success,
  registered: colors.violet,
};

/** Statuses an agent may move a lead to (registered is agency-only). */
const MOVABLE = ['new', 'contacted', 'qualified', 'viewing', 'offer', 'closed', 'lost'];

export default function AgentPipelineScreen() {
  const insets = useSafeAreaInsets();
  const [reloadKey, setReloadKey] = useState(0);
  const fetcher = useCallback(
    () => api.get<PageResponse<Pipeline>>('/agent/pipeline').then((r) => r.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reloadKey],
  );

  const [selected, setSelected] = useState<LeadCard | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  async function moveTo(status: string) {
    if (!selected) return;
    try {
      setMoveError(null);
      await api.patch(`/agent/pipeline/leads/${selected.id}/status`, { status });
      setSelected(null);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      setMoveError(e?.message ?? 'Could not move lead.');
    }
  }

  return (
    <>
      <DataScreen fetcher={fetcher}>
        {(d) => (
          <>
            <Text style={styles.title}>Pipeline</Text>
            <Text style={styles.sub}>
              Open pipeline value <Text style={styles.subStrong}>{fmtMoney(d.total_value)}</Text>
            </Text>

            {d.columns.map((col) => (
              <Card key={col.key}>
                <View style={styles.colHeader}>
                  <View style={styles.colTitleWrap}>
                    <View style={[styles.dot, { backgroundColor: dotColors[col.key] ?? colors.ink400 }]} />
                    <SectionTitle>{col.label}</SectionTitle>
                    <Text style={styles.count}>{col.count}</Text>
                  </View>
                  <Text style={styles.colValue}>{fmtMoney(col.total_value)}</Text>
                </View>

                {col.cards.length === 0 ? (
                  <Text style={styles.hint}>No deals in this stage.</Text>
                ) : (
                  col.cards.map((c) => (
                    <Pressable key={c.id} style={styles.leadCard} onPress={() => setSelected(c)}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.leadTop}>
                          <Text style={styles.itemTitle}>{c.visitor_name}</Text>
                          {c.is_hot ? <Badge tone="danger">HOT 🔥</Badge> : null}
                        </View>
                        <Text style={styles.hint} numberOfLines={1}>
                          {c.listing_title ?? 'No listing'} · {c.age_label}
                        </Text>
                      </View>
                      <Text style={styles.leadValue}>{fmtMoney(c.deal_value)}</Text>
                    </Pressable>
                  ))
                )}
              </Card>
            ))}
          </>
        )}
      </DataScreen>

      {/* Lead details + move sheet (mobile version of drag-and-drop) */}
      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(6) }]}>
            {selected ? (
              <ScrollView contentContainerStyle={{ gap: spacing(2) }}>
                <Text style={styles.sheetTitle}>{selected.visitor_name}</Text>
                <Text style={styles.hint}>
                  {selected.listing_title ?? 'No listing'} · {fmtMoney(selected.deal_value)}
                </Text>
                <Text style={styles.hint}>
                  {selected.email}
                  {selected.phone ? ` · ${selected.phone}` : ''}
                </Text>

                {moveError ? <Text style={styles.error}>{moveError}</Text> : null}

                <Text style={styles.label}>MOVE TO STAGE</Text>
                <View style={styles.chips}>
                  {MOVABLE.map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.chip, selected.status === s && styles.chipActive]}
                      onPress={() => moveTo(s)}
                    >
                      <Text style={[styles.chipText, selected.status === s && styles.chipTextActive]}>
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.closeText}>Close</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink900, letterSpacing: -0.3 },
  sub: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink500, marginTop: -spacing(2) },
  subStrong: { fontFamily: fonts.sansBold, color: colors.ink900 },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(2),
  },
  colTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  dot: { width: 8, height: 8, borderRadius: 4 },
  count: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.ink500,
    backgroundColor: colors.ink100,
    borderRadius: radius.full,
    paddingHorizontal: spacing(2),
    paddingVertical: 1,
    overflow: 'hidden',
  },
  colValue: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.ink500 },
  leadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.ink50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ink100,
    padding: spacing(3),
    marginTop: spacing(2),
  },
  leadTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  itemTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink800 },
  leadValue: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink900 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,11,15,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing(6),
    maxHeight: '80%',
  },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.ink900 },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.ink500,
    marginTop: spacing(3),
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  chip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ink200,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  chipActive: { backgroundColor: colors.brand50, borderColor: colors.brand },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.ink500 },
  chipTextActive: { color: colors.brand700 },
  closeBtn: {
    marginTop: spacing(4),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ink200,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  closeText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink700 },
  error: { color: colors.danger, fontFamily: fonts.sansMedium, fontSize: 13 },
});
