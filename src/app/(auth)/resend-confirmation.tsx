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
import { useAuth } from '@/context/auth-context';
import { BakeryColors, BakeryRadii, BakeryShadow, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { showPopup } from '@/lib/popup';
import { useTranslation } from '@/i18n';

export default function ResendConfirmationScreen() {
  const { continueAsGuest } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  const handleResend = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage(t('errors.enterSignupEmail'));
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
    });

    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    setSuccessMessage(t('auth.codeResent'));
    setSubmitting(false);
    router.push({ pathname: '/verify-code', params: { email: normalizedEmail, mode: 'signup' } });
  };

  const handleGuest = () => {
    showPopup(t('auth.guestWarnTitle'), t('auth.guestWarnMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.continueAsGuest'),
        style: 'destructive',
        onPress: () => {
          continueAsGuest();
          router.replace('/');
        },
      },
    ]);
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
                {t('auth.resendConfirmation')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                {t('auth.resendSubtitle')}
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
                returnKeyType="done"
                onSubmitEditing={handleResend}
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
                onPress={handleResend}
                disabled={submitting}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {submitting ? t('auth.sending') : t('auth.resendVerification')}
                </ThemedText>
              </Pressable>
            </ThemedView>

            <ThemedView style={styles.linkActions}>
              <Pressable onPress={() => router.replace('/login')} style={styles.linkRow}>
                <ThemedText type="smallBold" style={styles.linkText}>
                  {t('auth.backToLogin')}
                </ThemedText>
              </Pressable>
              <Pressable onPress={handleGuest} style={styles.linkRow}>
                <ThemedText type="smallBold" style={styles.linkText}>
                  {t('auth.continueAsGuest')}
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
