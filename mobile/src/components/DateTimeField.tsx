import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { Label } from './form';

/**
 * Date ('YYYY-MM-DD') or time ('HH:MM') picker using the phone's own dialog.
 * Values stay plain strings so the API gets wall-clock SAST time with no
 * timezone conversion. The web build uses DateTimeField.web.tsx instead.
 */
export default function DateTimeField({
  label,
  mode,
  value,
  onChange,
}: {
  label: string;
  mode: 'date' | 'time';
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const asDate = (): Date => {
    if (mode === 'date') {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, (m ?? 1) - 1, d ?? 1);
    }
    const [h, min] = value.split(':').map(Number);
    const t = new Date();
    t.setHours(h ?? 9, min ?? 0, 0, 0);
    return t;
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  function handle(e: DateTimePickerEvent, picked?: Date) {
    if (Platform.OS === 'android') setOpen(false);
    if (e.type !== 'set' || !picked) return;
    onChange(
      mode === 'date'
        ? `${picked.getFullYear()}-${pad(picked.getMonth() + 1)}-${pad(picked.getDate())}`
        : `${pad(picked.getHours())}:${pad(picked.getMinutes())}`,
    );
  }

  const display =
    mode === 'date'
      ? asDate().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : value;

  return (
    <View style={styles.wrap}>
      <Label>{label}</Label>
      <Pressable style={styles.box} onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <Text style={styles.value}>{display}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={asDate()}
          mode={mode}
          is24Hour
          minuteInterval={5}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handle}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing(1.5) },
  box: {
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
    backgroundColor: colors.white,
  },
  value: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink900 },
});
