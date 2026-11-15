import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '../theme';

/** Upper-case field label, as on the website's forms. */
export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput placeholderTextColor={colors.ink400} style={[styles.input, input.multiline && styles.multiline]} {...input} />
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  busy,
  disabled,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.primary, (disabled || busy) && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
    >
      {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable style={styles.secondary} onPress={onPress} accessibilityRole="button">
      <Text style={styles.secondaryText}>{title}</Text>
    </Pressable>
  );
}

/** Two-or-more option toggle (e.g. Reminder | Viewing). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          style={[styles.segment, value === o.value && styles.segmentActive]}
          onPress={() => onChange(o.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === o.value }}
        >
          <Text style={[styles.segmentText, value === o.value && styles.segmentTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Bottom sheet over a dimmed backdrop; tapping the backdrop closes it. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing(6) }]}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>{title}</Text>
            <ScrollView contentContainerStyle={{ gap: spacing(3) }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const formStyles = StyleSheet.create({
  error: { color: colors.danger, fontFamily: fonts.sansMedium, fontSize: 13 },
  row: { flexDirection: 'row', gap: spacing(3) },
});

const styles = StyleSheet.create({
  label: { fontFamily: fonts.sansSemiBold, fontSize: 10, letterSpacing: 0.8, color: colors.ink500 },
  field: { gap: spacing(1.5) },
  input: {
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink900,
    backgroundColor: colors.white,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
  },
  primaryText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.white },
  secondary: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ink200,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  secondaryText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink700 },
  segmented: { flexDirection: 'row', backgroundColor: colors.ink100, borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, paddingVertical: spacing(2), borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.white },
  segmentText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink500 },
  segmentTextActive: { color: colors.brand700 },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,11,15,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing(5),
    paddingTop: spacing(2),
    maxHeight: '88%',
    gap: spacing(3),
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.ink200 },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.ink900 },
});
