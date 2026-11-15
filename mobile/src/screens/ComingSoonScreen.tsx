import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme';

/** Placeholder for agent tabs that are in v1 scope but not built yet. */
export default function ComingSoonScreen() {
  const route = useRoute();
  return (
    <View style={styles.wrap}>
      <Ionicons name="construct-outline" size={40} color={colors.brand} />
      <Text style={styles.title}>{route.name} is on its way</Text>
      <Text style={styles.body}>
        This tab is coming in an upcoming app update. Until then it's available on the website dashboard.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(8), gap: spacing(3), backgroundColor: colors.ink50 },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.ink900, textAlign: 'center' },
  body: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink500, textAlign: 'center', lineHeight: 20 },
});
