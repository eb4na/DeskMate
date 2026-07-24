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
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SoundPressable } from '@/components/sound-pressable';

import {
  AppleLogoIcon,
  ChevronDownIcon,
  GoogleGIcon,
  LockIcon,
  MailIcon,
} from '@/components/auth-icons';
import { DevKnobs, type Knob } from '@/components/dev-knobs';
import { BakeryColors, BakeryRadii, BakeryShadow, Fonts, MaxContentWidth, MIN_POPUP_WIDTH, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { showPopup } from '@/lib/popup';
import { useIsTablet } from '@/hooks/use-device-class';
import { authCallbackUrl, supabase } from '@/lib/supabase';
import { signInWithProvider } from '@/lib/oauth';
import { LANGUAGES, type SupportedLanguage, useTranslation } from '@/i18n';
import { useReportModalTransition } from '@/lib/modal-traffic';

const LOGIN_BG = require('@/assets/images/auth/login-bg.png');
const LOGIN_CAT = require('@/assets/images/auth/login-cat.png');
const LOGO = require('@/assets/images/auth/memobun-sign.png');

// Password-visibility toggle: a normal (open-eyed) bear while the password is
// hidden as dots, and an eyes-covered bear while it's revealed. Matches signup.
const BEAR_HIDDEN = require('@/assets/images/auth/bear-eyes-open.png');
const BEAR_SHOWN = require('@/assets/images/auth/bear-eyes-covered.png');

// Tablet-only layout overrides for the login screen. Applied only when
// useIsTablet() (phones stay byte-identical). These are 11-inch-REFERENCE values
// (834×1194): at render they're scaled per-device by tsW/tsH so the whole login
// scene keeps the same proportions on any tablet size (the 11-inch is untouched
// since tsW=tsH=1 there; the 13-inch scales up, the mini scales down). Author live
// via the 🎛 panel in Tablet mode — the knobs edit these raw 11-inch numbers, so
// dialing on any device still bakes correct 11-inch-reference values.
const LOGIN_TABLET = {
  signTop: -80,             // signHang.top (was signHangTablet)
  signHeight: 560,          // signHang.height
  catSize: 214,             // cat width & height
  catBottom: -14,           // catWrap.bottom offset (nudged down so the cat clears the "Continue as guest" text)
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
  const { kickedReason, clearKickedReason, continueAsGuest } = useAuth();
  const { t } = useTranslation();
  const { language, chooseLoginLanguage } = useApp();
  // iPad's taller screen leaves the hanging sign sitting low, so lift it up there.
  const isTablet = useIsTablet();
  // Proportional tablet scaling off the 11-inch reference (834×1194), same system
  // as the Home screen: widths/sizes/X scale by tsW, heights/Y by tsH. Keeps the
  // login scene the same proportion of the screen at any tablet size (fixes the
  // form reading tiny on the 13-inch). Phones and the 11-inch are unaffected.
  const { width: winW, height: winH } = useWindowDimensions();
  const TABLET_REF_W = 834;
  const TABLET_REF_H = 1194;
  const tsW = isTablet ? winW / TABLET_REF_W : 1;
  const tsH = isTablet ? winH / TABLET_REF_H : 1;
  // The language pill is a small element, so strict tsW scaling still reads tiny on
  // big tablets. Amplify the growth ABOVE the 11-inch reference (×3 the delta) so the
  // 11-inch is untouched (tsW=1 → 1) but the 13-inch gets a clearly larger pill.
  const langScale = 1 + (tsW - 1) * 3;
  // Tablet overrides (see LOGIN_TABLET). `lt` only changes via the dev knob
  // panel; production keeps the baked LOGIN_TABLET values.
  const [lt, setLt] = useState(LOGIN_TABLET);
  // Per-device scaled values used for rendering. The knobs still edit the raw `lt`
  // (11-inch reference); `lts` derives from it so each device scales correctly.
  // formWidth stays the fixed layout cap — formScale·tsW carries the uniform growth
  // (width + height + text together), so the two never double-count.
  const lts = {
    signTop: lt.signTop * tsH,
    signHeight: lt.signHeight * tsH,
    catSize: lt.catSize * tsW,
    catBottom: lt.catBottom * tsH,
    formTop: lt.formTop * tsH,
    formWidth: lt.formWidth,
    formScale: (lt.formScale ?? 1) * tsW,
  };
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
  // True when sign-in failed because the email is registered but not yet
  // confirmed — surfaces a "Resend verification" button (login has no code field).
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);
  const noticeMessage = typeof notice === 'string' ? notice : '';

  const activeLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  // Surface the "kicked off by another device" reason as a custom cozy popup the
  // moment we land here, once. The inline banner stays as a persistent reminder.
  const kickAlertShown = useRef(false);
  const [showKickModal, setShowKickModal] = useState(false);
  useReportModalTransition(langMenuOpen || showKickModal);
  useEffect(() => {
    if (kickedReason && !kickAlertShown.current) {
      kickAlertShown.current = true;
      setShowKickModal(true);
    }
  }, [kickedReason]);

  // Choosing a language here applies it live and counts as the user's choice, so
  // the first-launch language prompt won't appear again after sign-in.
  const handlePickLanguage = (code: SupportedLanguage) => {
    chooseLoginLanguage(code);
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
    setNeedsVerification(false);
    clearKickedReason();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      const notConfirmed = /email not confirmed|email_not_confirmed/i.test(error.message);
      setNeedsVerification(notConfirmed);
      setErrorMessage(
        notConfirmed
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

  // Resend the signup verification code and jump to the code-entry screen. Shown
  // only after a sign-in attempt failed because the email isn't confirmed yet.
  const handleResendVerification = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage(t('errors.enterEmailPassword'));
      return;
    }

    setResendingVerify(true);
    setErrorMessage('');

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: { emailRedirectTo: authCallbackUrl },
    });

    setResendingVerify(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.push({ pathname: '/verify-code', params: { email: normalizedEmail, mode: 'signup' } });
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
    <View style={styles.container}>
      <RNImage source={LOGIN_BG} style={styles.bg} resizeMode="stretch" />
      <View style={[styles.catWrap, isTablet && { bottom: lts.catBottom }]} pointerEvents="none">
        <RNImage
          source={LOGIN_CAT}
          style={[styles.cat, isTablet && { width: lts.catSize, height: lts.catSize }]}
          resizeMode="contain"
        />
      </View>
      {/* Hanging Memobun sign — pinned to the very top so the strings meet the
          screen edge; the form below is padded down to clear it. */}
      <View style={[styles.signHang, isTablet && { top: lts.signTop, height: lts.signHeight }]} pointerEvents="none">
        <RNImage source={LOGO} style={styles.signHangImg} resizeMode="contain" />
      </View>
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {/* Language dropdown — pinned top-right, independent of the centered form */}
          <View style={[styles.langBar, isTablet && { paddingTop: 34 * tsH }]}>
            <Pressable
              style={({ pressed }) => [
                styles.langPill,
                // The pill lives outside the scaled form column, so scale it here by
                // the same tsW. Anchored top-right so it grows in place and stays
                // pinned to the corner (11-inch unchanged at tsW=1).
                isTablet && { transform: [{ scale: langScale }], transformOrigin: '100% 0%' },
                pressed && styles.pressed,
              ]}
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

          <View style={[styles.scrollContent, isTablet && { paddingTop: lts.formTop }]}>
            <View style={[styles.inner, isTablet && { maxWidth: lts.formWidth, transform: [{ scale: lts.formScale }] }]}>
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
                  <RNImage
                    source={showPassword ? BEAR_SHOWN : BEAR_HIDDEN}
                    style={styles.bearToggle}
                    resizeMode="contain"
                  />
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

              {/* Resend verification — only when the email is registered but unconfirmed */}
              {needsVerification ? (
                <SoundPressable
                  style={({ pressed }) => [styles.oauthButton, (pressed || resendingVerify) && styles.pressed]}
                  onPress={handleResendVerification}
                  disabled={resendingVerify}>
                  <Text style={styles.oauthText}>
                    {resendingVerify ? t('auth.sending') : t('auth.resendVerification')}
                  </Text>
                </SoundPressable>
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

              {/* Continue as guest (no account — progress stays on this device) */}
              <Pressable
                hitSlop={8}
                style={styles.resendRow}
                onPress={handleGuest}>
                <Text style={styles.guestText}>{t('auth.continueAsGuest')}</Text>
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
  scrollContent: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 162 },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  signHang: { position: 'absolute', top: -55, left: 0, right: 0, height: 360, alignItems: 'center', zIndex: 2 },
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
  bearToggle: { width: 30, height: 30, backgroundColor: 'transparent' },

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
  guestText: { fontSize: 13, fontWeight: '700', color: BakeryColors.berry },

  // Messages
  errorText: { color: BakeryColors.danger, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  noticeText: { color: BakeryColors.success, fontSize: 13, lineHeight: 18, textAlign: 'center' },

  // Language modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
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
    backgroundColor: 'rgba(91,58,46,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  kickCard: {
    width: '100%',
    minWidth: MIN_POPUP_WIDTH,
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
    alignSelf: 'center',
    backgroundColor: BakeryColors.jam,
    borderRadius: BakeryRadii.pill,
    paddingVertical: 14,
    paddingHorizontal: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  kickBtnText: {
    fontFamily: Fonts.rounded,
    fontSize: 17,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  pressed: { opacity: 0.85 },
});
