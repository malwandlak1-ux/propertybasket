import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, PageResponse } from '../../api';
import { Badge, Card, DataScreen, SectionTitle } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../theme';

interface MaintItem {
  id: number;
  title: string;
  description: string;
  category: string;
  urgency: string;
  status: string;
  logged_at: string | null;
  completed_at: string | null;
  contractor: { name: string } | null;
}

interface Maintenance {
  active: MaintItem[];
  past: MaintItem[];
}

const CATEGORIES = ['plumbing', 'electrical', 'appliances', 'structural', 'garden', 'other'];
const URGENCIES = ['low', 'medium', 'high', 'emergency'];

const statusTone = (s: string): 'success' | 'warning' | 'sky' | 'ink' =>
  s === 'completed' || s === 'paid' ? 'success' : s === 'in_progress' ? 'sky' : 'warning';

function RequestRow({ item }: { item: MaintItem }) {
  return (
    <View style={styles.reqRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.hint}>
          {item.category} · logged {item.logged_at}
          {item.contractor ? ` · ${item.contractor.name}` : ''}
        </Text>
      </View>
      <Badge tone={statusTone(item.status)}>{item.status.replace(/_/g, ' ').toUpperCase()}</Badge>
    </View>
  );
}

export default function TenantMaintenanceScreen() {
  const insets = useSafeAreaInsets();
  const [reloadKey, setReloadKey] = useState(0);
  const fetcher = useCallback(
    () => api.get<PageResponse<Maintenance>>('/tenant/maintenance').then((r) => r.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reloadKey],
  );

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('plumbing');
  const [urgency, setUrgency] = useState('medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/tenant/maintenance', { title, description, category, urgency });
      setOpen(false);
      setTitle('');
      setDescription('');
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      const fieldErrors = e?.errors ? Object.values(e.errors as Record<string, string[]>).flat() : [];
      setError(fieldErrors[0] ?? e?.message ?? 'Could not submit request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DataScreen fetcher={fetcher}>
        {(d) => (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Maintenance</Text>
              <Pressable style={styles.newBtn} onPress={() => setOpen(true)}>
                <Text style={styles.newBtnText}>+ New request</Text>
              </Pressable>
            </View>

            <Card>
              <SectionTitle>Active</SectionTitle>
              {d.active.length === 0 ? (
                <Text style={styles.hint}>No open requests — everything's working. 🎉</Text>
              ) : (
                d.active.map((r) => <RequestRow key={r.id} item={r} />)
              )}
            </Card>

            <Card>
              <SectionTitle>Completed</SectionTitle>
              {d.past.length === 0 ? (
                <Text style={styles.hint}>Nothing here yet.</Text>
              ) : (
                d.past.map((r) => <RequestRow key={r.id} item={r} />)
              )}
            </Card>
          </>
        )}
      </DataScreen>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing(6) }]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing(2) }}>
              <Text style={styles.modalTitle}>New maintenance request</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Text style={styles.label}>TITLE</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Kitchen tap leaking"
                placeholderTextColor={colors.ink400}
              />

              <Text style={styles.label}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="Describe the problem…"
                placeholderTextColor={colors.ink400}
              />

              <Text style={styles.label}>CATEGORY</Text>
              <View style={styles.chips}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.chip, category === c && styles.chipActive]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>URGENCY</Text>
              <View style={styles.chips}>
                {URGENCIES.map((u) => (
                  <Pressable
                    key={u}
                    style={[styles.chip, urgency === u && styles.chipActive]}
                    onPress={() => setUrgency(u)}
                  >
                    <Text style={[styles.chipText, urgency === u && styles.chipTextActive]}>{u}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setOpen(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.submitBtn} onPress={submit} disabled={busy}>
                  {busy ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.submitText}>Submit request</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink900, letterSpacing: -0.3 },
  newBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.full,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  newBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.white },
  itemTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink800 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500, marginTop: 2 },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink100,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(11,11,15,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing(6),
    maxHeight: '88%',
  },
  modalTitle: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.ink900, marginBottom: spacing(2) },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.ink500,
    marginTop: spacing(2),
  },
  input: {
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink900,
    backgroundColor: colors.ink50,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  chip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ink200,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.brand50, borderColor: colors.brand },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.ink500 },
  chipTextActive: { color: colors.brand700 },
  modalActions: { flexDirection: 'row', gap: spacing(3), marginTop: spacing(4) },
  cancelBtn: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ink200,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  cancelText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink700 },
  submitBtn: {
    flex: 2,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  submitText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.white },
  error: { color: colors.danger, fontFamily: fonts.sansMedium, fontSize: 13 },
});
