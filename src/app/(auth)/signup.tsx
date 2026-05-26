import { router } from 'expo-router';
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
import { BakeryColors, BakeryRadii, BakeryShadow, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { authCallbackUrl, supabase } from '@/lib/supabase';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [existingAccountMessage, setExistingAccountMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const normalizedEmail = email.trim().toLowerCase();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const inputStyle = {
    borderWidth: 1.5,
    borderColor: colors.backgroundSelected,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    fontSize: 16,
  };

  const handleSignup = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setErrorMessage('Enter an email and password to create your account.');
      setExistingAccountMessage('');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Use at least 6 characters for your password.');
      setExistingAccountMessage('');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    setExistingAccountMessage('');

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: authCallbackUrl },
    });

    if (error) {
      if (/user already registered/i.test(error.message)) {
        setExistingAccountMessage('That email already has a DeskMate account. Sign in instead.');
      } else {
        setErrorMessage(error.message);
      }
      setSubmitting(false);
      return;
    }

    const looksLikeExistingAccount =
      Array.isArray(data.user?.identities) && data.user.identities.length === 0;

    setSubmitting(false);

    if (looksLikeExistingAccount || data.user?.email_confirmed_at) {
      setExistingAccountMessage(
        'That email already has a DeskMate account. Sign in instead. If you still need a code, use Resend verification from the login screen.',
      );
      return;
    }

    router.push({ pathname: '/verify-code', params: { email: normalizedEmail, mode: 'signup' } });
  };

  return (
    <ThemedView style={[styles.container, styles.screenBackground]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <SafeAreaView style={styles.safeArea}>
            <ThemedView style={styles.hero}>
              <ThemedText style={styles.heroEmoji}>🍰</ThemedText>
              <ThemedText type="subtitle" style={styles.title}>
                Create account
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                Open your own study bakery corner. Your focus data still stays local in the app for
                now.
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Email</ThemedText>
              <TextInput
                style={inputStyle}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="next"
              />

              <ThemedText type="smallBold">Password</ThemedText>
              <TextInput
                style={inputStyle}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                onSubmitEditing={handleSignup}
              />

              {errorMessage ? (
                <ThemedText type="small" style={styles.errorText}>
                  {errorMessage}
                </ThemedText>
              ) : null}

              {!errorMessage && existingAccountMessage ? (
                <ThemedText type="small" style={styles.noticeText}>
                  {existingAccountMessage}
                </ThemedText>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || submitting) && styles.pressed,
                ]}
                onPress={handleSignup}
                disabled={submitting}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {submitting ? 'Creating account...' : 'Create account'}
                </ThemedText>
              </Pressable>

              {existingAccountMessage ? (
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                  onPress={() =>
                    router.replace({
                      pathname: '/login',
                      params: {
                        email: normalizedEmail,
                        notice: 'This email already has an account. Sign in with your password instead.',
                      },
                    })
                  }>
                  <ThemedText type="smallBold" style={styles.secondaryButtonText}>
                    Go to sign in
                  </ThemedText>
                </Pressable>
              ) : null}

              <ThemedText type="small" themeColor="textSecondary" style={styles.helperText}>
                We&apos;ll create your account, then send an email verification step before first login.
              </ThemedText>
            </ThemedView>

            <Pressable onPress={() => router.replace('/login')} style={styles.linkRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Already have an account?
              </ThemedText>
              <ThemedText type="smallBold" style={styles.linkText}>
                Sign in
              </ThemedText>
            </Pressable>
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
  helperText: { textAlign: 'center', lineHeight: 20 },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  linkText: { color: BakeryColors.mocha },
  errorText: { color: BakeryColors.danger, lineHeight: 20 },
  noticeText: { color: BakeryColors.success, lineHeight: 20 },
  pressed: { opacity: 0.85 },
});
