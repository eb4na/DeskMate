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
import { useTranslation } from '@/i18n';

export default function SignupScreen() {
  const { t } = useTranslation();
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
      setErrorMessage(t('errors.enterEmailPasswordSignup'));
      setExistingAccountMessage('');
      return;
    }

    if (password.length < 6) {
      setErrorMessage(t('errors.passwordTooShort'));
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
        setExistingAccountMessage(t('errors.emailAlreadyRegistered'));
      } else {
        setErrorMessage(error.message);
      }
      setSubmitting(false);
      return;
    }

    // Supabase signals a duplicate email in three ways:
    // 1. error.message "user already registered" (enumeration protection OFF)
    // 2. data.user.identities === [] (unconfirmed duplicate, protection OFF)
    // 3. data.user === null with no error (enumeration protection ON)
    // 4. data.user.email_confirmed_at set (confirmed account already exists)
    const looksLikeExistingAccount =
      !data.user ||
      (Array.isArray(data.user.identities) && data.user.identities.length === 0) ||
      !!data.user.email_confirmed_at;

    setSubmitting(false);

    if (looksLikeExistingAccount) {
      setExistingAccountMessage(t('errors.emailAlreadyRegisteredLong'));
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
              <ThemedText style={styles.heroEmoji}></ThemedText>
              <ThemedText type="subtitle" style={styles.title}>
                {t('auth.signupTitle')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                {t('auth.signupSubtitle')}
              </ThemedText>
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
                textContentType="newPassword"
                placeholder={t('auth.passwordMinPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                onSubmitEditing={handleSignup}
              />

              {errorMessage ? (
                <ThemedText type="small" style={styles.errorText}>
                  {errorMessage}
                </ThemedText>
              ) : null}

              {existingAccountMessage ? (
                <ThemedText type="small" style={styles.errorText}>
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
                  {submitting ? t('auth.creatingAccount') : t('auth.createAccount')}
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
                        notice: t('errors.emailExistsNotice'),
                      },
                    })
                  }>
                  <ThemedText type="smallBold" style={styles.secondaryButtonText}>
                    {t('auth.goToSignIn')}
                  </ThemedText>
                </Pressable>
              ) : null}

              <ThemedText type="small" themeColor="textSecondary" style={styles.helperText}>
                {t('auth.signupHelper')}
              </ThemedText>
            </ThemedView>

            <Pressable onPress={() => router.replace('/login')} style={styles.linkRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('auth.alreadyHaveAccount')}
              </ThemedText>
              <ThemedText type="smallBold" style={styles.linkText}>
                {t('auth.signInLink')}
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
