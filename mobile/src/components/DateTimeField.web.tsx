import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { Label } from './form';

/** Web build (Expo web preview): the browser's own date / time input. */
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
  return (
    <View style={styles.wrap}>
      <Label>{label}</Label>
      {React.createElement('input', {
        type: mode,
        value,
        step: mode === 'time' ? 300 : undefined,
        'aria-label': label,
        onChange: (e: { target: { value: string } }) => e.target.value && onChange(e.target.value),
        style: {
          border: `1px solid ${colors.ink200}`,
          borderRadius: radius.md,
          padding: `${spacing(2.5)}px ${spacing(3)}px`,
          fontFamily: fonts.sansMedium,
          fontSize: 15,
          color: colors.ink900,
          background: colors.white,
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flex: 1, gap: spacing(1.5) } });
