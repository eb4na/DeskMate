import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { BakeryColors, BakeryRadii, BakeryShadow, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type VerifyMode = 'login' | 'signup';

export default function VerifyCodeScreen() {
  const { email, mode } = useLocalSearchParams<{ email?: string; mode?: VerifyMode }>();
  const { continueAsGuest } = useAuth();
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const normalizedEmail = typeof email === 'string' ? email : '';
  const verifyMode: VerifyMode = mode === 'signup' ? 'signup' : 'login';

  const inputStyle = {
    borderWidth: 1.5,
    borderColor: colors.backgroundSelected,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center' as const,
  };

  const sendCode = async () => {
    if (!normalizedEmail) {
      setErrorMessage('Missing email address. Go back and try again.');
      return false;
    }

    if (verifyMode !== 'signup') {
      setErrorMessage('Login uses your password now. Go back and sign in there.');
      return false;
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
    });

    if (error) {
      setErrorMessage(error.message);
      return false;
    }

    return true;
  };

  const handleVerify = async () => {
    if (!normalizedEmail) {
      setErrorMessage('Missing email address. Go back and try again.');
      return;
    }

    const token = code.trim();
    if (!token) {
      setErrorMessage('Enter the verification code from your email.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

            const {
              data: { session },
              error,
            } = await supabase.auth.verifyOtp({
              email: normalizedEmail,
              token,
              type: 'email',
            });

    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    setSuccessMessage(session ? 'You are in. Opening DeskMate...' : 'Code verified.');
    setSubmitting(false);
    router.replace('/');
  };

  const handleResend = async () => {
    setResending(true);
    setErrorMessage('');
    setSuccessMessage('');
    const ok = await sendCode();
    if (ok) {
      setSuccessMessage('A fresh code is on the way.');
    }
    setResending(false);
  };

  const handleGuest = () => {
    continueAsGuest();
    router.replace('/');
  };

  return (
    <ThemedView style={[styles.container, styles.screenBackground]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <SafeAreaView style={styles.safeArea}>
            <ThemedView style={styles.hero}>
              <ThemedText style={styles.heroEmoji}>🧁</ThemedText>
              <ThemedText type="subtitle" style={styles.title}>
                Verify your email
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                Enter the verification code sent to {normalizedEmail || 'your email'}.
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Verification code</ThemedText>
              <TextInput
                style={inputStyle}
                value={code}
                onChangeText={(text) => setCode(text.replace(/\s+/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                placeholder="123456"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                onSubmitEditing={handleVerify}
              />

              {errorMessage ? (
                <ThemedText type="small" style={styles.errorText}>
                  {errorMessage}
                </ThemedText>
              ) : null}

              {successMessage ? (
                <ThemedText type="small" style={styles.successText}>
                  {successMessage}
                </ThemedText>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || submitting) && styles.pressed,
                ]}
                onPress={handleVerify}
                disabled={submitting}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {submitting ? 'Verifying...' : 'Verify code'}
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.secondaryButton, (pressed || resending) && styles.pressed]}
                onPress={handleResend}
                disabled={resending}>
                <ThemedText type="smallBold" style={styles.secondaryButtonText}>
                  {resending ? 'Sending...' : 'Resend verification code'}
                </ThemedText>
              </Pressable>
            </ThemedView>

            <ThemedView style={styles.linkActions}>
              <Pressable onPress={() => router.back()} style={styles.linkRow}>
                <ThemedText type="smallBold" style={styles.linkText}>
                  Back
                </ThemedText>
              </Pressable>
              <Pressable onPress={handleGuest} style={styles.linkRow}>
                <ThemedText type="smallBold" style={styles.linkText}>
                  Continue as guest
                </ThemedText>
              </Pressable>
            </ThemedView>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenBackground: { backgroundColor: BakeryColors.frosting },
  scrollContent: { flexGrow: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  hero: { gap: Spacing.two },
  heroEmoji: { textAlign: 'center', fontSize: 48, lineHeight: 56 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', lineHeight: 20 },
  card: {
    borderRadius: BakeryRadii.panel,
    padding: Spacing.four,
    gap: Spacing.two,
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  primaryButton: {
    marginTop: Spacing.one,
    backgroundColor: BakeryColors.honey,
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: { color: BakeryColors.cocoaDark },
  secondaryButton: {
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    backgroundColor: BakeryColors.cream,
  },
  secondaryButtonText: { color: BakeryColors.cocoa },
  linkActions: { gap: Spacing.one },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  linkText: { color: BakeryColors.mocha },
  errorText: { color: BakeryColors.danger, lineHeight: 20 },
  successText: { color: BakeryColors.success, lineHeight: 20 },
  pressed: { opacity: 0.85 },
});
