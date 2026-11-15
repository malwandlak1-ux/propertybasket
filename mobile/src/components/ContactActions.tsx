import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { call, email as sendEmail, whatsapp } from '../contact';
import { colors, fonts, radius, spacing } from '../theme';

/** Call / WhatsApp / Email buttons for a person; shows only what they have. */
export default function ContactActions({ phone, email }: { phone?: string | null; email?: string | null }) {
  if (!phone && !email) {
    return <Text style={styles.none}>No contact details on file.</Text>;
  }
  return (
    <View style={styles.row}>
      {phone ? <Action icon="call" label="Call" onPress={() => call(phone)} /> : null}
      {phone ? <Action icon="logo-whatsapp" label="WhatsApp" onPress={() => whatsapp(phone)} /> : null}
      {email ? <Action icon="mail" label="Email" onPress={() => sendEmail(email)} /> : null}
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.action} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={colors.brand600} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing(3) },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: spacing(1),
    paddingVertical: spacing(3),
    borderRadius: radius.md,
    backgroundColor: colors.brand50,
  },
  text: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.brand700 },
  none: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
});
