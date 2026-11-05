import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth';
import { colors, fonts, radius, shadowCard, spacing } from '../theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e?.message ?? 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your Property Basket account</Text>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.co.za"
            placeholderTextColor={colors.ink400}
          />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.ink400}
            onSubmitEditing={submit}
          />

          <Pressable
            style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.brand600 }]}
            onPress={submit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footer}>South Africa's property platform · propertybasket.co.za</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink50 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing(6) },
  logo: { width: 190, height: 56, alignSelf: 'center', marginBottom: spacing(6) },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    color: colors.ink900,
    textAlign: 'center',
    letterSpacing: -0.26,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink500,
    textAlign: 'center',
    marginTop: spacing(1),
    marginBottom: spacing(6),
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing(6),
    gap: spacing(2),
    ...shadowCard,
  },
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
  button: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
    marginTop: spacing(4),
  },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.white },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    padding: spacing(3),
  },
  errorText: { color: '#B91C1C', fontFamily: fonts.sansMedium, fontSize: 13 },
  footer: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink400,
    textAlign: 'center',
    marginTop: spacing(6),
  },
});
