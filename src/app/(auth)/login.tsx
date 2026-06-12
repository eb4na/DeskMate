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
import { useApp } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import { signInWithProvider } from '@/lib/oauth';
import { LANGUAGES, type SupportedLanguage, useTranslation } from '@/i18n';

const LOGIN_BG = require('@/assets/images/auth/login-bg.png');

export default function LoginScreen() {
  const { email: emailParam, notice } = useLocalSearchParams<{ email?: string; notice?: string }>();
  const { continueAsGuest, kickedReason, clearKickedReason } = useAuth();
  const { t } = useTranslation();
  const { language, setLanguage, markLanguageSelected } = useApp();

  // Choosing a language here applies it live and counts as the user's choice, so
  // the first-launch language prompt won't appear again after sign-in.
  const handlePickLanguage = (code: SupportedLanguage) => {
    setLanguage(code);
    markLanguageSelected();
  };
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
      setErrorMessage(t('errors.enterEmailPassword'));
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    clearKickedReason();

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

    // One device per account is enforced centrally in AuthProvider (it claims the
    // active session, revokes other devices, and listens for its own eviction).

    // Blur any focused field so iOS tears down the keyboard/input views
    // before this screen unmounts (prevents stranded input artifacts).
    Keyboard.dismiss();
    router.replace('/');
    setSubmitting(false);
  };

  // Social sign-in (Google) via the Supabase OAuth browser flow. On success the
  // auth listener already has the session.
  const handleSocial = async (run: () => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>) => {
    setSubmitting(true);
    setErrorMessage('');
    clearKickedReason();
    const res = await run();
    if (res.ok) {
      // Single-device enforcement is handled centrally in AuthProvider.
      Keyboard.dismiss();
      router.replace('/');
    } else if (!res.cancelled) {
      setErrorMessage(res.error ?? t('errors.signInFailed'));
    }
    setSubmitting(false);
  };

  const handleGuest = () => {
    Keyboard.dismiss();
    clearKickedReason();
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
              <ThemedText style={styles.heroEmoji}></ThemedText>
              <ThemedText type="subtitle" style={styles.title}>
                {t('auth.welcomeBack')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                {t('auth.tagline')} {t('auth.guestNote')}
              </ThemedText>

              <ThemedView style={styles.langRow}>
                {LANGUAGES.map((lang) => {
                  const isActive = language === lang.code;
                  return (
                    <Pressable
                      key={lang.code}
                      onPress={() => handlePickLanguage(lang.code)}
                      style={[styles.langChip, isActive && styles.langChipActive]}>
                      <ThemedText style={styles.langChipFlag}>{lang.flag}</ThemedText>
                      <ThemedText
                        type="smallBold"
                        style={[styles.langChipText, isActive && styles.langChipTextActive]}>
                        {lang.native}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ThemedView>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{t('auth.email')}</ThemedText>
              <TextInput
                style={inputStyle}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                returnKeyType="next"
              />

              <ThemedText type="smallBold">{t('auth.password')}</ThemedText>
              <TextInput
                style={inputStyle}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              {!errorMessage && kickedReason ? (
                <ThemedText type="small" style={styles.errorText}>
                  {t('auth.signedOutOtherDevice')}
                </ThemedText>
              ) : null}

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
                  {submitting ? t('auth.signingIn') : t('auth.signIn')}
                </ThemedText>
              </Pressable>

              <ThemedView style={styles.orRow}>
                <ThemedView style={styles.orLine} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.orText}>{t('auth.or')}</ThemedText>
                <ThemedView style={styles.orLine} />
              </ThemedView>

              <Pressable
                style={({ pressed }) => [styles.oauthButton, (pressed || submitting) && styles.pressed]}
                onPress={() => handleSocial(() => signInWithProvider('google'))}
                disabled={submitting}>
                <ThemedText type="smallBold" style={styles.oauthText}>
                  {t('auth.continueWithGoogle')}
                </ThemedText>
              </Pressable>


              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                onPress={handleGuest}>
                <ThemedText type="smallBold" style={styles.secondaryButtonText}>
                  {t('auth.continueAsGuest')}
                </ThemedText>
              </Pressable>

              <ThemedText type="small" themeColor="textSecondary" style={styles.guestNote}>
                {t('auth.guestModeNote')}
              </ThemedText>

              <ThemedView style={styles.supportLinks}>
                <Pressable onPress={() => router.push('/forgot-password')}>
                  <ThemedText type="smallBold" style={styles.linkText}>
                    {t('auth.forgotPassword')}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => router.push('/resend-confirmation')}>
                  <ThemedText type="smallBold" style={styles.linkText}>
                    {t('auth.resendVerification')}
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </ThemedView>

            <Pressable onPress={() => router.push('/signup')} style={styles.linkRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('auth.needAccount')}
              </ThemedText>
              <ThemedText type="smallBold" style={styles.linkText}>
                {t('auth.createOne')}
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
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.one,
    backgroundColor: 'transparent',
    marginTop: Spacing.one,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: BakeryRadii.chip,
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    backgroundColor: BakeryColors.glass,
  },
  langChipActive: {
    borderColor: BakeryColors.honey,
    backgroundColor: BakeryColors.cream,
  },
  langChipFlag: { fontSize: 14 },
  langChipText: { fontSize: 12, color: BakeryColors.mocha },
  langChipTextActive: { color: BakeryColors.cocoaDark },
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
  orRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: 'transparent', marginVertical: 2 },
  orLine: { flex: 1, height: 1, backgroundColor: BakeryColors.border },
  orText: { paddingHorizontal: 2 },
  oauthButton: {
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    backgroundColor: '#FFFFFF',
  },
  oauthText: { color: BakeryColors.cocoaDark },
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
