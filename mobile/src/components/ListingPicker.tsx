import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { Field, Label } from './form';

export interface ListingOption {
  id: number;
  label: string;
}

/** Search-and-pick for one of the agent's listings (used when adding a lead or viewing). */
export default function ListingPicker({
  listings,
  value,
  onChange,
}: {
  listings: ListingOption[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [query, setQuery] = useState('');
  const chosen = listings.find((l) => l.id === value);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? listings.filter((l) => l.label.toLowerCase().includes(q)) : listings).slice(0, 6);
  }, [listings, query]);

  if (chosen) {
    return (
      <View style={styles.wrap}>
        <Label>LISTING</Label>
        <Pressable style={styles.chosen} onPress={() => onChange(null)} accessibilityRole="button">
          <Text style={styles.chosenText} numberOfLines={2}>
            {chosen.label}
          </Text>
          <Text style={styles.change}>Change</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Field label="LISTING" value={query} onChangeText={setQuery} placeholder="Search your listings" />
      {matches.map((l) => (
        <Pressable key={l.id} style={styles.option} onPress={() => onChange(l.id)} accessibilityRole="button">
          <Text style={styles.optionText} numberOfLines={1}>
            {l.label}
          </Text>
        </Pressable>
      ))}
      {matches.length === 0 ? <Text style={styles.none}>No listings match.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing(1.5) },
  chosen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brand50,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  chosenText: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink800 },
  change: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.brand600 },
  option: {
    borderWidth: 1,
    borderColor: colors.ink100,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    backgroundColor: colors.ink50,
  },
  optionText: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink700 },
  none: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink500 },
});
