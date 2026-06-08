import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Image as RNImage,
  Keyboard,
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
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/i18n';

const LOGIN_BG = require('@/assets/images/auth/login-bg.png');

export default function LoginScreen() {
  const { email: emailParam, notice } = useLocalSearchParams<{ email?: string; notice?: string }>();
  const { continueAsGuest } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState(typeof emailParam === 'string' ? emailParam : '');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const noticeMessage = typeof notice === 'string' ? notice : '';

  const inputStyle = {
    borderWidth: 1.5,
    borderColor: colors.backgroundSelected,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    fontSize: 16,
  };

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setErrorMessage('Enter your email and password to continue.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setErrorMessage(
        /email not confirmed|email_not_confirmed/i.test(error.message)
          ? t('errors.emailNotVerified')
          : /invalid login credentials/i.test(error.message)
            ? t('errors.invalidCredentials')
            : error.message,
      );
      setSubmitting(false);
      return;
    }

    if (!data.session) {
      setErrorMessage(t('errors.signInFailed'));
      setSubmitting(false);
      return;
    }

    // One device per account: signing in here revokes sessions on other devices.
    try {
      await supabase.auth.signOut({ scope: 'others' });
    } catch {
      // Non-fatal — the local session is still valid.
    }

    // Blur any focused field so iOS tears down the keyboard/input views
    // before this screen unmounts (prevents stranded input artifacts).
    Keyboard.dismiss();
    router.replace('/');
    setSubmitting(false);
  };

  const handleGuest = () => {
    Keyboard.dismiss();
    continueAsGuest();
    router.replace('/');
  };

  return (
    <ThemedView style={[styles.container, styles.screenBackground]}>
      <RNImage source={LOGIN_BG} style={styles.bg} resizeMode="cover" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <SafeAreaView style={styles.safeArea}>
            <ThemedView style={styles.hero}>
              <ThemedText style={styles.heroEmoji}>🥐</ThemedText>
              <ThemedText type="subtitle" style={styles.title}>
                {t('auth.welcomeBack')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                {t('auth.tagline')} {t('auth.guestNote')}
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
                textContentType="password"
                placeholder="Enter your password"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              {errorMessage ? (
                <ThemedText type="small" style={styles.errorText}>
                  {errorMessage}
                </ThemedText>
              ) : null}

              {!errorMessage && noticeMessage ? (
                <ThemedText type="small" style={styles.noticeText}>
                  {noticeMessage}
                </ThemedText>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || submitting) && styles.pressed,
                ]}
                onPress={handleLogin}
                disabled={submitting}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {submitting ? 'Signing in...' : 'Sign In'}
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                onPress={handleGuest}>
                <ThemedText type="smallBold" style={styles.secondaryButtonText}>
                  Continue as guest
                </ThemedText>
              </Pressable>

              <ThemedText type="small" themeColor="textSecondary" style={styles.guestNote}>
                Guest mode keeps your progress on this device so you can start studying right away.
              </ThemedText>

              <ThemedView style={styles.supportLinks}>
                <Pressable onPress={() => router.push('/forgot-password')}>
                  <ThemedText type="smallBold" style={styles.linkText}>
                    Forgot password?
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => router.push('/resend-confirmation')}>
                  <ThemedText type="smallBold" style={styles.linkText}>
                    Resend verification
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </ThemedView>

            <Pressable onPress={() => router.push('/signup')} style={styles.linkRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Need an account?
              </ThemedText>
              <ThemedText type="smallBold" style={styles.linkText}>
                Create one
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
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
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
  hero: { gap: Spacing.two, backgroundColor: 'transparent' },
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
  guestNote: { textAlign: 'center', lineHeight: 20 },
  supportLinks: {
    marginTop: Spacing.one,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
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
