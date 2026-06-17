import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Image as RNImage,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SoundPressable } from '@/components/sound-pressable';

import {
  AppleLogoIcon,
  ChevronDownIcon,
  EyeIcon,
  EyeOffIcon,
  GoogleGIcon,
  LockIcon,
  MailIcon,
} from '@/components/auth-icons';
import { DevKnobs, type Knob } from '@/components/dev-knobs';
import { BakeryColors, BakeryRadii, BakeryShadow, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { useIsTablet } from '@/hooks/use-device-class';
import { supabase } from '@/lib/supabase';
import { signInWithProvider } from '@/lib/oauth';
import { LANGUAGES, type SupportedLanguage, useTranslation } from '@/i18n';

const LOGIN_BG = require('@/assets/images/auth/login-bg.png');
const LOGIN_CAT = require('@/assets/images/auth/login-cat.png');
const LOGO = require('@/assets/images/auth/memobun-sign.png');

// Tablet-only layout overrides for the login screen. Applied only when
// useIsTablet() (phones stay byte-identical). Defaults equal today's values
// (signTop:-120 is the old signHangTablet; the rest match the phone styles), so
// nothing shifts until dialed. Author live via the 🎛 panel in Tablet mode,
// "Log values", then paste the numbers here — they ship to all tablets.
const LOGIN_TABLET = {
  signTop: -80,             // signHang.top (was signHangTablet)
  signHeight: 560,          // signHang.height
  catSize: 214,             // cat width & height
  catBottom: 2,             // catWrap.bottom offset
  formTop: 373,             // scrollContent.paddingTop (form distance from top)
  formWidth: 716,           // inner.maxWidth (how wide the input/button column gets)
  formScale: 1.06,          // visual scale of the whole form column (inputs + buttons together)
};

// Same flag art the Settings language picker uses. Codes without a PNG fall
// back to the emoji in LANGUAGES.
const FLAGS: Partial<Record<SupportedLanguage, number>> = {
  en: require('@/assets/images/flags/en.png'),
  ja: require('@/assets/images/flags/ja.png'),
};

export default function LoginScreen() {
  const { email: emailParam, notice } = useLocalSearchParams<{ email?: string; notice?: string }>();
  const { kickedReason, clearKickedReason } = useAuth();
  const { t } = useTranslation();
  const { language, setLanguage, markLanguageSelected } = useApp();
  // iPad's taller screen leaves the hanging sign sitting low, so lift it up there.
  const isTablet = useIsTablet();
  // Tablet overrides (see LOGIN_TABLET). `lt` only changes via the dev knob
  // panel; production keeps the baked LOGIN_TABLET values.
  const [lt, setLt] = useState(LOGIN_TABLET);
  const loginKnobs: Knob[] = [
    { key: 'signTop', label: 'Sign Y', value: lt.signTop, min: -260, max: 100, step: 2 },
    { key: 'signHeight', label: 'Sign height', value: lt.signHeight, min: 200, max: 560, step: 4 },
    { key: 'catSize', label: 'Cat size', value: lt.catSize, min: 80, max: 360, step: 4 },
    { key: 'catBottom', label: 'Cat Y', value: lt.catBottom, min: -80, max: 200, step: 2 },
    { key: 'formTop', label: 'Form top', value: lt.formTop, min: 60, max: 420, step: 4 },
    { key: 'formWidth', label: 'Form width', value: lt.formWidth, min: 260, max: 820, step: 4 },
    { key: 'formScale', label: 'Button/form size', value: lt.formScale, min: 0.6, max: 1.2, step: 0.02 },
  ];

  const [email, setEmail] = useState(typeof emailParam === 'string' ? emailParam : '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const noticeMessage = typeof notice === 'string' ? notice : '';

  const activeLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  // Surface the "kicked off by another device" reason as a custom cozy popup the
  // moment we land here, once. The inline banner stays as a persistent reminder.
  const kickAlertShown = useRef(false);
  const [showKickModal, setShowKickModal] = useState(false);
  useEffect(() => {
    if (kickedReason && !kickAlertShown.current) {
      kickAlertShown.current = true;
      setShowKickModal(true);
    }
  }, [kickedReason]);

  // Choosing a language here applies it live and counts as the user's choice, so
  // the first-launch language prompt won't appear again after sign-in.
  const handlePickLanguage = (code: SupportedLanguage) => {
    setLanguage(code);
    markLanguageSelected();
    setLangMenuOpen(false);
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

  return (
    <View style={styles.container}>
      <RNImage source={LOGIN_BG} style={styles.bg} resizeMode="stretch" />
      <View style={[styles.catWrap, isTablet && { bottom: lt.catBottom }]} pointerEvents="none">
        <RNImage
          source={LOGIN_CAT}
          style={[styles.cat, isTablet && { width: lt.catSize, height: lt.catSize }]}
          resizeMode="contain"
        />
      </View>
      {/* Hanging Memobun sign — pinned to the very top so the strings meet the
          screen edge; the form below is padded down to clear it. */}
      <View style={[styles.signHang, isTablet && { top: lt.signTop, height: lt.signHeight }]} pointerEvents="none">
        <RNImage source={LOGO} style={styles.signHangImg} resizeMode="contain" />
      </View>
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {/* Language dropdown — pinned top-right, independent of the centered form */}
          <View style={styles.langBar}>
            <Pressable
              style={({ pressed }) => [styles.langPill, pressed && styles.pressed]}
              onPress={() => setLangMenuOpen(true)}>
              {FLAGS[activeLang.code] ? (
                <RNImage source={FLAGS[activeLang.code]!} style={styles.langPillFlagImg} resizeMode="contain" />
              ) : (
                <Text style={styles.langPillFlag}>{activeLang.flag}</Text>
              )}
              <Text style={styles.langPillText}>{activeLang.native}</Text>
              <ChevronDownIcon color={BakeryColors.mocha} size={15} />
            </Pressable>
          </View>

          <View style={[styles.scrollContent, isTablet && { paddingTop: lt.formTop }]}>
            <View style={[styles.inner, isTablet && { maxWidth: lt.formWidth, transform: [{ scale: lt.formScale ?? 1 }] }]}>
              {/* Email */}
              <View style={styles.inputRow}>
                <MailIcon color={BakeryColors.jam} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  placeholder={t('auth.emailAddress')}
                  placeholderTextColor={BakeryColors.jam}
                  returnKeyType="next"
                />
              </View>

              {/* Password */}
              <View style={styles.inputRow}>
                <LockIcon color={BakeryColors.jam} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  placeholder={t('auth.password')}
                  placeholderTextColor={BakeryColors.jam}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <Pressable
                  hitSlop={8}
                  onPress={() => setShowPassword((s) => !s)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  {showPassword ? (
                    <EyeOffIcon color={BakeryColors.jam} />
                  ) : (
                    <EyeIcon color={BakeryColors.jam} />
                  )}
                </Pressable>
              </View>

              {/* Forgot password */}
              <Pressable
                style={styles.forgotRow}
                onPress={() => router.push('/forgot-password')}>
                <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
              </Pressable>

              {/* Messages */}
              {!errorMessage && kickedReason ? (
                <Text style={styles.errorText}>{t('auth.signedOutOtherDevice')}</Text>
              ) : null}
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
              {!errorMessage && noticeMessage ? (
                <Text style={styles.noticeText}>{noticeMessage}</Text>
              ) : null}

              {/* Log In */}
              <SoundPressable
                sound="confirm"
                style={({ pressed }) => [styles.primaryButton, (pressed || submitting) && styles.pressed]}
                onPress={handleLogin}
                disabled={submitting}>
                <Text style={styles.primaryButtonText}>
                  {submitting ? t('auth.signingIn') : t('auth.logIn')}
                </Text>
              </SoundPressable>

              {/* Continue with Google */}
              <SoundPressable
                style={({ pressed }) => [styles.oauthButton, (pressed || submitting) && styles.pressed]}
                onPress={() => handleSocial(() => signInWithProvider('google'))}
                disabled={submitting}>
                <GoogleGIcon size={20} />
                <Text style={styles.oauthText}>{t('auth.continueWithGoogle')}</Text>
              </SoundPressable>

              {/* Continue with Apple */}
              <SoundPressable
                style={({ pressed }) => [styles.oauthButton, (pressed || submitting) && styles.pressed]}
                onPress={() => handleSocial(() => signInWithProvider('apple'))}
                disabled={submitting}>
                <AppleLogoIcon size={20} />
                <Text style={styles.oauthText}>{t('auth.continueWithApple')}</Text>
              </SoundPressable>

              {/* Create account footer */}
              <Pressable
                style={({ pressed }) => [styles.footerPill, pressed && styles.pressed]}
                onPress={() => router.push('/signup')}>
                <Text style={styles.footerText}>{t('auth.dontHaveAccount')} </Text>
                <Text style={styles.footerLink}>{t('auth.createAccount')}</Text>
                <ChevronDownIcon color={BakeryColors.berry} size={14} />
              </Pressable>

              {/* Resend verification (subtle) */}
              <Pressable
                hitSlop={8}
                style={styles.resendRow}
                onPress={() => router.push('/resend-confirmation')}>
                <Text style={styles.resendText}>{t('auth.resendVerification')}</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* Language picker modal */}
      <Modal
        visible={langMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLangMenuOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setLangMenuOpen(false)}>
          <View style={styles.langMenu}>
            {LANGUAGES.map((lang) => {
              const isActive = lang.code === language;
              return (
                <Pressable
                  key={lang.code}
                  style={({ pressed }) => [
                    styles.langMenuItem,
                    isActive && styles.langMenuItemActive,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => handlePickLanguage(lang.code)}>
                  {FLAGS[lang.code] ? (
                    <RNImage source={FLAGS[lang.code]!} style={styles.langMenuFlagImg} resizeMode="contain" />
                  ) : (
                    <Text style={styles.langMenuFlag}>{lang.flag}</Text>
                  )}
                  <Text style={[styles.langMenuText, isActive && styles.langMenuTextActive]}>
                    {lang.native}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Signed-out-elsewhere popup — custom cozy card (not the native alert) */}
      <Modal
        visible={showKickModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKickModal(false)}>
        <View style={styles.kickBackdrop}>
          <View style={styles.kickCard}>
            <Text style={styles.kickEmoji}>🐰</Text>
            <Text style={styles.kickTitle}>{t('auth.signedOutTitle')}</Text>
            <Text style={styles.kickMsg}>{t('auth.signedOutOtherDevice')}</Text>
            <Pressable
              style={({ pressed }) => [styles.kickBtn, pressed && styles.pressed]}
              onPress={() => setShowKickModal(false)}>
              <Text style={styles.kickBtnText}>{t('common.ok')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <DevKnobs screen="login" knobs={loginKnobs} onChange={(key, value) => setLt((p) => ({ ...p, [key]: value }))} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BakeryColors.frosting },
  // Above the hanging sign (zIndex 2) so the language pill stays tappable/visible;
  // the form's top region is transparent, so the sign still shows through.
  flexFill: { flex: 1, zIndex: 3 },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  catWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  cat: { width: 150, height: 150 },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 185 },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  signHang: { position: 'absolute', top: 0, left: 0, right: 0, height: 360, alignItems: 'center', zIndex: 2 },
  // iPad sign position/height is tablet-gated via LOGIN_TABLET (signTop/signHeight).
  signHangImg: { width: '100%', height: '100%' },

  // Language pill — pinned to the top-right corner
  langBar: { alignItems: 'flex-end', paddingHorizontal: Spacing.four, paddingTop: Spacing.one },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  langPillFlag: { fontSize: 15 },
  langPillFlagImg: { width: 20, height: 14, borderRadius: 3 },
  langPillText: { fontSize: 13, fontWeight: '700', color: BakeryColors.cocoaDark },

  // Welcome banner
  welcomeCard: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: BakeryRadii.panel,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  welcomeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  heart: { fontSize: 13, color: BakeryColors.jam },
  welcomeTitle: { fontSize: 19, fontWeight: '800', color: BakeryColors.cocoaDark },
  taglinePill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.shortbread,
  },
  taglineText: { fontSize: 11, fontWeight: '600', color: BakeryColors.cocoa, textAlign: 'center' },

  // Inputs
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 54,
    borderRadius: BakeryRadii.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: BakeryColors.rose,
    ...BakeryShadow,
  },
  input: { flex: 1, fontSize: 15, color: BakeryColors.cocoaDark, paddingVertical: 0 },

  forgotRow: { alignSelf: 'flex-end', paddingVertical: 2 },
  forgotText: { fontSize: 12.5, fontWeight: '700', color: BakeryColors.mocha },

  // Buttons
  primaryButton: {
    marginTop: Spacing.one,
    height: 54,
    borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.jam,
    alignItems: 'center',
    justifyContent: 'center',
    ...BakeryShadow,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 54,
    borderRadius: BakeryRadii.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  oauthText: { fontSize: 15, fontWeight: '700', color: BakeryColors.cocoaDark },

  // Footer
  footerPill: {
    marginTop: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  footerText: { fontSize: 13, color: BakeryColors.cocoa },
  footerLink: { fontSize: 13, fontWeight: '800', color: BakeryColors.berry },

  resendRow: { alignSelf: 'center', marginTop: Spacing.two, paddingVertical: 4 },
  resendText: { fontSize: 12, color: BakeryColors.mocha, opacity: 0.75 },

  // Messages
  errorText: { color: BakeryColors.danger, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  noticeText: { color: BakeryColors.success, fontSize: 13, lineHeight: 18, textAlign: 'center' },

  // Language modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(78, 53, 40, 0.28)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.select({ ios: 96, android: 64 }),
    paddingHorizontal: Spacing.four,
  },
  langMenu: {
    minWidth: 180,
    borderRadius: BakeryRadii.card,
    backgroundColor: BakeryColors.frosting,
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    padding: Spacing.one,
    gap: 2,
    ...BakeryShadow,
  },
  langMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BakeryRadii.chip,
  },
  langMenuItemActive: { backgroundColor: BakeryColors.cream },
  langMenuFlag: { fontSize: 16 },
  langMenuFlagImg: { width: 24, height: 17, borderRadius: 3 },
  langMenuText: { fontSize: 14, fontWeight: '600', color: BakeryColors.cocoa },
  langMenuTextActive: { color: BakeryColors.cocoaDark, fontWeight: '800' },

  // Signed-out-elsewhere popup — cozy bubbly card replacing the native alert.
  kickBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(91,58,46,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  kickCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: BakeryColors.frosting,
    borderRadius: 30,
    borderWidth: 2.5,
    borderColor: BakeryColors.rose,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
    ...BakeryShadow,
  },
  kickEmoji: { fontSize: 44, marginBottom: -2 },
  kickTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 26,
    fontWeight: '900',
    color: BakeryColors.berry,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  kickMsg: {
    fontFamily: Fonts.rounded,
    fontSize: 15.5,
    fontWeight: '700',
    color: BakeryColors.cocoa,
    textAlign: 'center',
    lineHeight: 22,
  },
  kickBtn: {
    alignSelf: 'stretch',
    backgroundColor: BakeryColors.jam,
    borderRadius: BakeryRadii.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  kickBtnText: {
    fontFamily: Fonts.rounded,
    fontSize: 17,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },

  pressed: { opacity: 0.85 },
});
