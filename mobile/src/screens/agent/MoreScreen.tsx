import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth';
import { Avatar, Card } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../theme';

/** Agent tabs that live under "More" (same names as the website sidebar). */
export const MORE_ITEMS = [
  { name: 'Leads', icon: 'funnel-outline' },
  { name: 'Messages', icon: 'chatbubbles-outline' },
  { name: 'Tenants', icon: 'people-outline' },
  { name: 'Inspections', icon: 'clipboard-outline' },
  { name: 'Maintenance', icon: 'construct-outline' },
  { name: 'Commission', icon: 'cash-outline' },
  { name: 'Analytics', icon: 'stats-chart-outline' },
  { name: 'FFC & Compliance', icon: 'shield-checkmark-outline' },
  { name: 'Settings', icon: 'settings-outline' },
  { name: 'Help & Support', icon: 'help-buoy-outline' },
] as const;

export type MoreStackParams = { More: undefined; Conversation: { id: number; title: string } } & { [K in (typeof MORE_ITEMS)[number]['name']]: undefined };

export default function MoreScreen() {
  const nav = useNavigation<NativeStackNavigationProp<MoreStackParams>>();
  const { user, logout } = useAuth();

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {user ? (
        <Card style={styles.profile}>
          <Avatar initials={user.initials} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.meta}>{user.email}</Text>
          </View>
        </Card>
      ) : null}

      <Card style={{ padding: 0 }}>
        {MORE_ITEMS.map((item, i) => (
          <Pressable
            key={item.name}
            style={[styles.row, i > 0 && styles.rowBorder]}
            onPress={() => nav.navigate(item.name)}
            accessibilityRole="button"
          >
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={18} color={colors.brand600} />
            </View>
            <Text style={styles.rowText}>{item.name}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.ink300} />
          </Pressable>
        ))}
      </Card>

      <Pressable style={styles.logout} onPress={logout} accessibilityRole="button">
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink50 },
  content: { padding: spacing(4), gap: spacing(4), paddingBottom: spacing(10) },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  name: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.ink900 },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingHorizontal: spacing(4), paddingVertical: spacing(3.5) },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.ink100 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink800 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    paddingVertical: spacing(3.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: colors.white,
  },
  logoutText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.danger },
});
