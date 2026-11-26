import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { api, errorText } from '../../api';
import { useAuth } from '../../auth';
import { Field, formStyles, PrimaryButton } from '../../components/form';
import { Card, LoadState, SectionTitle, useTopPadding } from '../../components/ui';
import { colors, fonts, spacing } from '../../theme';
import { usePage } from '../../usePage';

interface SettingsPage {
  profile: { name: string; email: string; phone: string | null };
  notifications: { channels: Record<string, string>; values: Record<string, boolean> };
  banking: { bank_account_holder: string | null; bank_account_number: string | null; paystack_recipient_code: string | null };
}

/** Save button state for one card: busy, then a short "Saved" or the error. */
function useSaver() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(fn: () => Promise<{ message?: string } | unknown>, after?: () => void) {
    setBusy(true);
    setNote(null);
    try {
      const res = (await fn()) as { message?: string };
      setNote({ ok: true, text: res?.message ?? 'Saved.' });
      after?.();
    } catch (e) {
      setNote({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  return { busy, note, run };
}

function Note({ note }: { note: { ok: boolean; text: string } | null }) {
  if (!note) return null;
  return <Text style={note.ok ? styles.ok : formStyles.error}>{note.text}</Text>;
}

export default function AgentSettingsScreen() {
  const topPadding = useTopPadding();
  const { refresh } = useAuth();
  const { data, error, refreshing, reload, onRefresh } = usePage<SettingsPage>('/agent/settings');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const profile = useSaver();
  const notify = useSaver();
  const password = useSaver();

  useEffect(() => {
    if (!data) return;
    setName(data.profile.name);
    setEmail(data.profile.email);
    setPhone(data.profile.phone ?? '');
    setPrefs(data.notifications.values);
  }, [data]);

  if (!data) return <LoadState error={error} onRetry={reload} />;

  const bankingSet = !!(data.banking.bank_account_number || data.banking.paystack_recipient_code);

  function togglePref(key: string, value: boolean) {
    const before = prefs;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    // Saved straight away, like a phone's own settings; the switch snaps back if the save fails.
    notify.run(async () => {
      try {
        return await api.post('/agent/settings/notifications', { channels: updated });
      } catch (e) {
        setPrefs(before);
        throw e;
      }
    });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <Card style={styles.card}>
          <SectionTitle>Profile</SectionTitle>
          <Field label="NAME" value={name} onChangeText={setName} />
          <Field label="EMAIL" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Field label="PHONE" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Note note={profile.note} />
          <PrimaryButton
            title="Save profile"
            busy={profile.busy}
            onPress={() => profile.run(() => api.post('/agent/settings/profile', { name: name.trim(), email: email.trim(), phone: phone.trim() || null }), refresh)}
          />
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Notifications</SectionTitle>
          {Object.entries(data.notifications.channels).map(([key, label]) => (
            <View key={key} style={styles.switchRow}>
              <Text style={styles.switchLabel}>{label}</Text>
              <Switch
                value={!!prefs[key]}
                onValueChange={(v) => togglePref(key, v)}
                trackColor={{ true: colors.brand, false: colors.ink200 }}
                thumbColor={colors.white}
                accessibilityLabel={label}
              />
            </View>
          ))}
          <Note note={notify.note} />
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Change password</SectionTitle>
          <Field label="CURRENT PASSWORD" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" />
          <Field label="NEW PASSWORD (8+ CHARACTERS)" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" />
          <Field label="REPEAT NEW PASSWORD" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" />
          <Note note={password.note} />
          <PrimaryButton
            title="Update password"
            busy={password.busy}
            disabled={!current || !next || !confirm}
            onPress={() =>
              password.run(
                () => api.post('/agent/settings/password', { current_password: current, password: next, password_confirmation: confirm }),
                () => {
                  setCurrent('');
                  setNext('');
                  setConfirm('');
                },
              )
            }
          />
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Commission banking</SectionTitle>
          <Text style={styles.body}>
            {bankingSet
              ? 'Your payout details are on file. Commission payouts go to that account.'
              : 'No payout account on file yet. Your agency can’t pay commission until you add one.'}
          </Text>
          <Text style={styles.hint}>For security, bank details are added and changed on the website under Settings.</Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), paddingBottom: spacing(12), gap: spacing(4) },
  card: { gap: spacing(3) },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), minHeight: 44 },
  switchLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink800 },
  body: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink800, lineHeight: 20 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500, lineHeight: 18 },
  ok: { fontFamily: fonts.sansMedium, fontSize: 13, color: '#047857' },
});
