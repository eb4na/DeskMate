import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n';
import { supabase } from '@/lib/supabase';

// Adds email + password sign-in to an account that was created with Google or
// Apple. The address itself comes from the OAuth provider and is already
// verified, so there is nothing to confirm — all that is missing is a password.
// That is why this screen shows the email read-only and never sends mail.
export default function ConnectEmailScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Read the address off the current session rather than taking it as a param,
  // so it always matches whatever provider the account actually signed in with.
  useState(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  });

  const inputStyle = {
    borderWidth: 1.5,
    borderColor: colors.backgroundSelected,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    fontSize: 16,
  };

  const handleSetPassword = async () => {
    if (!password) return setErrorMessage(t('errors.enterNewPassword'));
    if (password.length < 6) return setErrorMessage(t('errors.newPasswordTooShort'));
    if (password !== confirmPassword) return setErrorMessage(t('errors.passwordsNoMatch'));

    setSubmitting(true);
    setErrorMessage('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    router.back();
  };

  return (
    <ThemedView style={[styles.container, styles.screenBackground]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <SafeAreaView style={styles.safeArea}>
            <ThemedView style={styles.hero}>
              <ThemedText type="subtitle" style={styles.title}>
                {t('auth.connectEmailTitle')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                {t('auth.connectEmailSubtitle')}
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{t('auth.email')}</ThemedText>
              {/* Read-only: this address belongs to the linked Google/Apple
                  identity. Changing it here would be an email change, not an
                  email connect, and would need its own verification flow. */}
              <ThemedView style={[styles.readonlyField, { borderColor: colors.backgroundSelected }]}>
                <ThemedText themeColor="textSecondary" style={styles.readonlyText}>
                  {email ?? '—'}
                </ThemedText>
              </ThemedView>
              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                {t('auth.connectEmailNote')}
              </ThemedText>

              <ThemedText type="smallBold">{t('auth.newPassword')}</ThemedText>
              <TextInput
                style={inputStyle}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
                placeholder={t('auth.passwordMinPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                returnKeyType="next"
              />

              <ThemedText type="smallBold">{t('auth.confirmPassword2')}</ThemedText>
              <TextInput
                style={inputStyle}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                textContentType="newPassword"
                placeholder={t('auth.typeAgain')}
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                onSubmitEditing={handleSetPassword}
              />

              {errorMessage ? (
                <ThemedText type="small" style={styles.errorText}>
                  {errorMessage}
                </ThemedText>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.primaryButton, (pressed || submitting) && styles.pressed]}
                onPress={handleSetPassword}
                disabled={submitting || !email}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {submitting ? t('auth.saving') : t('auth.connectEmailTitle')}
                </ThemedText>
              </Pressable>

              <Pressable style={styles.cancelRow} onPress={() => router.back()}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('common.cancel')}
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
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', gap: Spacing.one, backgroundColor: 'transparent' },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center' },
  card: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.four,
    gap: Spacing.two,
    ...BakeryShadow,
  },
  readonlyField: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    backgroundColor: 'transparent',
  },
  readonlyText: { fontSize: 16 },
  note: { marginBottom: Spacing.one },
  errorText: { color: BakeryColors.jam },
  primaryButton: {
    marginTop: Spacing.two,
    backgroundColor: BakeryColors.buttonPink,
    borderRadius: BakeryRadii.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF' },
  pressed: { opacity: 0.85 },
  cancelRow: { alignSelf: 'center', marginTop: Spacing.two, paddingVertical: 4 },
});
