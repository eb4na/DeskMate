import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { showPopup } from '@/lib/popup';
import { noteModalTransition, useReportModalTransition } from '@/lib/modal-traffic';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeleteAccountModal } from '@/components/delete-account-modal';
import { InstagramFollowRow } from '@/components/instagram-follow-row';
import { PlusIcon } from '@/components/plus-icon';
import { EnvelopeIcon, ScrollSealIcon } from '@/components/settings-icons';
import { fetchMail, fetchMailClaims } from '@/lib/mail';
import { LockBadge } from '@/components/lock-badge';

// Cozy hand-drawn settings icon set (assets/images/settings/*.png).
const SETTINGS_ICONS = {
  account: require('@/assets/images/settings/account.png'),
  signout: require('@/assets/images/settings/signout.png'),
  google: require('@/assets/images/settings/google.png'),
  reset: require('@/assets/images/settings/reset.png'),
  coin: require('@/assets/images/settings/coin.png'),
  timer: require('@/assets/images/settings/timer.png'),
  books: require('@/assets/images/settings/books.png'),
  radio: require('@/assets/images/settings/radio.png'),
  bell: require('@/assets/images/settings/bell.png'),
  gear: require('@/assets/images/settings/gear.png'),
  clock24: require('@/assets/images/settings/clock24.png'),
  language: require('@/assets/images/settings/language.png'),
  progress: require('@/assets/images/settings/progress.png'),
  feedback: require('@/assets/images/settings/feedback.png'),
  bug: require('@/assets/images/settings/bug.png'),
  info: require('@/assets/images/settings/info.png'),
} as const;

function SettingsIcon({ name, size = 34 }: { name: keyof typeof SETTINGS_ICONS; size?: number }) {
  const { scale } = useTabletScale();
  const px = size * scale;
  return <Image source={SETTINGS_ICONS[name]} style={{ width: px, height: px }} contentFit="contain" />;
}
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BIRTHDAY_CHANGE_LIMIT, useApp } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import { linkProvider } from '@/lib/oauth';
import { AppleLogoIcon, GoogleGIcon, LockIcon, MailIcon } from '@/components/auth-icons';
import { ReplayGlyph, TrashGlyph } from '@/components/settings-glyphs';
import { resolveActiveCompanion } from '@/lib/companion-utils';
import i18n, { LANGUAGES, useTranslation } from '@/i18n';
import { DateWheelPicker } from '@/components/date-wheel-picker';

const BIRTHDAY_ICON = require('@/assets/images/profile/birthday-candle.png');

// Month + day only (the stored birthday's year is an arbitrary leap year — never shown).
function formatBirthday(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(i18n.language || 'en-US', { month: 'short', day: 'numeric' });
}
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, MIN_POPUP_WIDTH, Spacing } from '@/constants/theme';
import { useTabletScale } from '@/hooks/use-tablet-scale';

type RowProps = {
  icon: string | ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  badge?: string;
  lock?: boolean;
};

function SettingRow({ icon, label, value, onPress, badge, lock }: RowProps) {
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.rowPressed : null]}>
      {typeof icon === 'string' ? (
        <ThemedText style={styles.rowIcon}>{icon}</ThemedText>
      ) : (
        <View style={styles.rowIconImage}>{icon}</View>
      )}
      <View style={styles.rowBody}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {value ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {value}
          </ThemedText>
        ) : null}
      </View>
      {lock ? <LockBadge size={26 * scale} /> : null}
      {badge ? (
        <ThemedView style={styles.badge}>
          <ThemedText style={styles.badgeText}>{badge}</ThemedText>
        </ThemedView>
      ) : null}
      {onPress ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.chevron}>
          ›
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  const { user, isGuest, signOut, deleteAccount, upgradeGuest, upgradeGuestEmail } = useAuth();
  const [upgrading, setUpgrading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Local confirm for the test "reset to new account" — a root showPopup can't
  // render over this native-modal screen (it just looked like nothing happened).
  const [resetOpen, setResetOpen] = useState(false);
  // Inline language dropdown (replaces the old full-screen picker).
  const [langOpen, setLangOpen] = useState(false);
  // Leave-guest / sign-out confirm — a LOCAL modal (not root showPopup, which can't
  // present over the Settings native modal — the tap just looked dead).
  const [signOutOpen, setSignOutOpen] = useState(false);
  // Change-password — a LOCAL modal (root showPopup can't present over the Settings
  // native modal) with its own field/error/success state.
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const {
    coins,
    isPlus,
    profileDisplayName,
    reminderEnabled,
    language,
    setLanguage,
    markLanguageSelected,
    reminderTime,
    setReminder,
    use24HourTime,
    setUse24HourTime,
    soundEffectsEnabled,
    setSoundEffectsEnabled,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    companionSkins,
    resetGameData,
    previewBondLevelUp,
    devLapseStreak,
    devMaxOutAccount,
    devUnlockHanji,
    replayTutorial,
    claimedMailIds,
    profileBirthday,
    profileBirthdayChangeCount,
    updateProfile,
  } = useApp();
  // Birthday editor (set at onboarding; up to BIRTHDAY_CHANGE_LIMIT changes here).
  const bdayChangesLeft = BIRTHDAY_CHANGE_LIMIT - profileBirthdayChangeCount;
  const [bdayOpen, setBdayOpen] = useState(false);
  useReportModalTransition(signOutOpen || pwOpen || resetOpen || bdayOpen);
  const [bdayDraft, setBdayDraft] = useState('2008-01-01');

  // Unread mail count for the Mailbox row badge (live fetch on open). Only count mail
  // with an UNCLAIMED reward: a message-only mail (no coins/item) can't be claimed, so
  // it must never badge forever. "Claimed" merges the SERVER claims with local state —
  // local `claimedMailIds` is wiped by an account reset, but the server claim persists,
  // so without the server check a reset would wrongly re-badge already-claimed mail.
  const [unreadMail, setUnreadMail] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all([fetchMail(), fetchMailClaims()]).then(([m, serverClaimed]) => {
      if (!alive) return;
      const claimed = new Set([...serverClaimed, ...claimedMailIds]);
      const hasReward = (x: { coins: number; itemId: string | null; itemChoices: string[] }) =>
        x.coins > 0 || !!x.itemId || x.itemChoices.length > 0;
      setUnreadMail(m.filter((x) => hasReward(x) && !claimed.has(x.id)).length);
    });
    return () => {
      alive = false;
    };
  }, [claimedMailIds]);

  const activeCompanion = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins);

  // Providers already linked to this account (e.g. ['email','google']).
  const connectedProviders = (user?.identities ?? []).map((i) => i.provider);

  const handleConnect = async (provider: 'google' | 'apple') => {
    try {
      const res = await linkProvider(provider);
      if (res.ok) {
        await supabase.auth.refreshSession().catch(() => {});
        showPopup(t('auth.connected'));
      } else if (res.alreadyLinked) {
        showPopup(t('auth.providerLinkedTitle'), t('auth.providerLinkedMsg'));
      } else if (!res.cancelled) {
        showPopup(t('auth.connectFailed'), res.error ?? '');
      }
    } catch (e) {
      showPopup(t('auth.connectFailed'), e instanceof Error ? e.message : String(e));
    }
  };

  // Guest → real account: connect Google or Apple, keeping the guest's progress.
  // On success the auth listener flips us out of guest mode automatically.
  const handleUpgrade = async (provider: 'google' | 'apple') => {
    setUpgrading(true);
    const res = await upgradeGuest(provider);
    setUpgrading(false);
    if (res.ok) {
      showPopup(t('auth.connected'));
    } else if (res.alreadyLinked) {
      showPopup(t('auth.providerLinkedTitle'), t('auth.providerLinkedMsg'));
    } else if (!res.cancelled) {
      showPopup(t('auth.connectFailed'), res.error ?? '');
    }
  };

  const handleSignOut = () => setSignOutOpen(true);

  const doSignOut = async () => {
    setSignOutOpen(false);
    try {
      await signOut();
    } catch {
      // signOut failures are rare (guest leave is purely local) and a root popup
      // can't present over this modal anyway — swallow so the leave still proceeds.
    }
    // Auth state flips to unauthed → the root guard routes to /login; close the
    // Settings modal if it's still mounted so login isn't stuck behind it.
    if (router.canDismiss()) router.dismissAll();
  };

  const openChangePassword = () => {
    setPwCurrent('');
    setPwNew('');
    setPwConfirm('');
    setPwError('');
    setPwSuccess(false);
    setPwOpen(true);
  };

  const handleChangePassword = async () => {
    const email = user?.email;
    if (!email) {
      setPwError(t('errors.generic'));
      return;
    }
    if (!pwCurrent) {
      setPwError(t('errors.enterCurrentPassword'));
      return;
    }
    if (!pwNew) {
      setPwError(t('errors.enterNewPassword'));
      return;
    }
    if (pwNew.length < 6) {
      setPwError(t('errors.newPasswordTooShort'));
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError(t('errors.passwordsNoMatch'));
      return;
    }
    if (pwNew === pwCurrent) {
      setPwError(t('errors.newPasswordSameAsOld'));
      return;
    }

    setPwSaving(true);
    setPwError('');

    // Verify the current password first — this is what makes it a "change"
    // (vs. the email-link "reset"). Re-auth is the same user/device, so the
    // single-device claim in AuthProvider no-ops (no re-revoke, no kick).
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: pwCurrent });
    if (signInError) {
      setPwError(t('errors.currentPasswordWrong'));
      setPwSaving(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: pwNew });
    if (error) {
      setPwError(error.message);
      setPwSaving(false);
      return;
    }

    setPwSuccess(true);
    setPwSaving(false);
    setTimeout(() => setPwOpen(false), 900);
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteAccount();
      setDeleteOpen(false);
      // Auth flips to unauthed → root guard routes to /login. Dismiss the Settings
      // native modal so login isn't stuck behind it (router.replace can't escape it).
      if (router.canDismiss()) router.dismissAll();
    } catch (error) {
      setDeleteOpen(false);
      showPopup(
        t('deleteAccount.failed', { defaultValue: 'Could not delete account' }),
        error instanceof Error ? error.message : t('settings.tryAgain'),
      );
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <ThemedText type="subtitle">{t('settings.title')}</ThemedText>
            <Pressable onPress={() => router.back()} style={styles.closeBtn}>
              <ThemedText type="smallBold" style={styles.closeText}>
                {t('common.done')}
              </ThemedText>
            </Pressable>
          </View>

          {/* Mailbox */}
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow
              icon={<EnvelopeIcon size={34} />}
              label={t('mailbox.title')}
              value={t('settings.mailboxSub')}
              badge={unreadMail > 0 ? (unreadMail > 9 ? '9+' : String(unreadMail)) : undefined}
              onPress={() => router.push('/mailbox')}
            />
          </ThemedView>

          {/* Account */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {t('settings.secAccount')}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow
              icon={<SettingsIcon name="account" />}
              label={isGuest ? t('settings.guestMode') : t('settings.signedIn')}
              value={isGuest ? t('settings.guestProgressNote') : user?.email ?? t('settings.accountFallback')}
            />
            <View style={styles.divider} />
            {/* Birthday: set at onboarding, changeable up to BIRTHDAY_CHANGE_LIMIT times
                here. Once every change is used, the row locks for good. */}
            <SettingRow
              icon={<Image source={BIRTHDAY_ICON} style={{ width: 30 * scale, height: 30 * scale }} contentFit="contain" />}
              label={t('profileCard.birthday')}
              value={profileBirthday ? formatBirthday(profileBirthday) : t('profileCard.addBirthday')}
              onPress={bdayChangesLeft <= 0 ? undefined : () => { setBdayDraft(profileBirthday || '2008-01-01'); setBdayOpen(true); }}
              lock={bdayChangesLeft <= 0}
            />
            {/* Change password — only for email/password accounts (OAuth-only
                accounts have no password to change). */}
            {!isGuest && connectedProviders.includes('email') && (
              <>
                <View style={styles.divider} />
                <SettingRow
                  icon={<LockIcon color={BakeryColors.jam} size={26} />}
                  label={t('settings.changePassword')}
                  value={t('settings.changePasswordNote')}
                  onPress={openChangePassword}
                />
              </>
            )}
            <View style={styles.divider} />
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={styles.rowIconImage}>
                <SettingsIcon name="signout" />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold" style={styles.dangerText}>
                  {isGuest ? t('settings.leaveGuestMode') : t('settings.signOut')}
                </ThemedText>
              </View>
            </Pressable>
          </ThemedView>

          {/* Guests: create a real account (keeps progress, unlocks friends) */}
          {isGuest && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                {t('auth.createAccount')}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.group}>
                <Pressable
                  disabled={upgrading}
                  onPress={() => handleUpgrade('google')}
                  style={({ pressed }) => [styles.row, !upgrading && pressed && styles.rowPressed]}>
                  <View style={styles.rowIconImage}>
                    <GoogleGIcon size={28} />
                  </View>
                  <View style={styles.rowBody}>
                    <ThemedText type="smallBold">{t('auth.continueWithGoogle')}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('auth.createAccountNote')}
                    </ThemedText>
                  </View>
                </Pressable>
                <View style={styles.divider} />
                <Pressable
                  disabled={upgrading}
                  onPress={() => handleUpgrade('apple')}
                  style={({ pressed }) => [styles.row, !upgrading && pressed && styles.rowPressed]}>
                  <View style={styles.rowIconImage}>
                    <AppleLogoIcon size={26} />
                  </View>
                  <View style={styles.rowBody}>
                    <ThemedText type="smallBold">{t('auth.continueWithApple')}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('auth.createAccountNote')}
                    </ThemedText>
                  </View>
                </Pressable>
                <View style={styles.divider} />
                {/* Email sign-up: flag the upgrade first (so the guest's progress —
                    incl. their birthday and unused birthday changes — migrates into
                    the new account), then hand off to the signup screen. */}
                <Pressable
                  disabled={upgrading}
                  onPress={async () => {
                    await upgradeGuestEmail();
                    router.push('/signup');
                  }}
                  style={({ pressed }) => [styles.row, !upgrading && pressed && styles.rowPressed]}>
                  <View style={styles.rowIconImage}>
                    <MailIcon size={26} />
                  </View>
                  <View style={styles.rowBody}>
                    <ThemedText type="smallBold">{t('auth.continueWithEmail')}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('auth.createAccountNote')}
                    </ThemedText>
                  </View>
                </Pressable>
              </ThemedView>
            </>
          )}

          {/* Connected accounts — link Google / Apple to this account */}
          {!isGuest && user && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                {t('auth.connectedAccounts')}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.group}>
                {(['google', 'apple'] as const).map((provider, idx) => {
                  const connected = connectedProviders.includes(provider);
                  return (
                    <View key={provider}>
                      {idx > 0 && <View style={styles.divider} />}
                      <Pressable
                        disabled={connected}
                        onPress={() => handleConnect(provider)}
                        style={({ pressed }) => [styles.row, !connected && pressed && styles.rowPressed]}>
                        <View style={styles.rowIconImage}>
                          {provider === 'apple' ? <AppleLogoIcon size={30} /> : <GoogleGIcon size={28} />}
                        </View>
                        <View style={styles.rowBody}>
                          <ThemedText type="smallBold">
                            {connected
                              ? provider === 'google' ? 'Google' : 'Apple'
                              : provider === 'google' ? t('auth.connectGoogle') : t('auth.connectApple')}
                          </ThemedText>
                        </View>
                        <ThemedText type="small" themeColor="textSecondary" style={connected ? styles.connectedTag : undefined}>
                          {connected ? `✓ ${t('auth.connected')}` : '＋'}
                        </ThemedText>
                      </Pressable>
                    </View>
                  );
                })}
              </ThemedView>
            </>
          )}

          {/* Membership */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {t('settings.secMembership')}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow
              icon={<PlusIcon size={38 * scale} />}
              label={t('settings.plus')}
              value={isPlus ? t('settings.plusActive') : t('settings.freePlan')}
              badge={isPlus ? 'PLUS' : undefined}
              onPress={() => router.push('/plus-upgrade')}
            />
            {/* DEV-ONLY test affordances. Gated behind __DEV__ so release builds
                (TestFlight / App Store) can't grant Plus, coins, or badges for free —
                that would defeat the real IAP flow. They stay available in Expo/dev. */}
            {__DEV__ && (
            <>
            <View style={styles.divider} />
            {/* TEST/PLACEHOLDER — wipe items/progress (keep the account), grant 1,000,000 coins. Remove before launch. */}
            <Pressable
              onPress={() => setResetOpen(true)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={styles.rowIconImage}>
                <SettingsIcon name="reset" />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold" style={styles.dangerText}>Reset items &amp; progress</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Test button — keeps your account, removes everything owned (back to just Bun), grants 1M coins</ThemedText>
              </View>
            </Pressable>
            {/* TEST — max out the account: own everything, all badges, 9,999,999 coins, Plus. */}
            <Pressable
              // Stamp the anti-freeze signal before closing: these dev buttons arm a
              // Home popup (a native <Modal> gated by useModalSafeVisible), and Settings
              // is itself a native modal. Without the stamp the popup tries to present
              // while Settings is still dismissing and iOS silently drops it — so the
              // celebration never appears. The stamp makes it wait out the dismiss.
              onPress={() => { devMaxOutAccount(); noteModalTransition(); router.back(); }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={styles.rowIconImage}>
                <SettingsIcon name="reset" />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold">Max out account</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Test button — grants every shop item, all recipes &amp; badges (incl. Hanji), 9,999,999 coins, max companion bond, and Plus</ThemedText>
              </View>
            </Pressable>
            {/* TEST — preview the bond/chef level-up celebration on Home without studying. */}
            <Pressable
              onPress={() => { previewBondLevelUp(); noteModalTransition(); router.back(); }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={styles.rowIconImage}>
                <SettingsIcon name="reset" />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold">Preview level-up</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Test button — shows the level-up celebration on Home for your active companion</ThemedText>
              </View>
            </Pressable>
            {/* TEST — grant all recipes + badges, actually grant Hanji, and show the unlock celebration. */}
            <Pressable
              onPress={() => { devUnlockHanji(); noteModalTransition(); router.back(); }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={styles.rowIconImage}>
                <SettingsIcon name="reset" />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold">Unlock Hanji</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Test button — grants all recipes &amp; badges, gives you Hanji, and shows the 5/5 badge screen then the Hanji unlock celebration on Home</ThemedText>
              </View>
            </Pressable>
            {/* TEST — fake a 1-day streak lapse (+1 freeze) so the "Use streak freeze" rescue prompt shows on Home. */}
            <Pressable
              onPress={() => { devLapseStreak(); noteModalTransition(); router.back(); }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={styles.rowIconImage}>
                <SettingsIcon name="reset" />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold">Test streak freeze</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Test button — fakes a 1-day streak lapse and gives you a freeze, so the “Use streak freeze” prompt appears on Home</ThemedText>
              </View>
            </Pressable>
            </>
            )}
          </ThemedView>

          {/* Balances */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {t('settings.secBalances')}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow icon={<SettingsIcon name="coin" size={38} />} label={t('settings.focusCoins')} value={t('settings.coinsValue', { count: coins })} />
          </ThemedView>

          {/* Focus & study */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {t('settings.secFocusStudy')}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <SettingRow
              icon={<SettingsIcon name="timer" />}
              label={t('settings.customTimer')}
              value={isPlus ? t('settings.customTimerOn') : t('settings.plusFeature')}
              lock={!isPlus}
              onPress={() =>
                isPlus
                  ? router.push({ pathname: '/custom-timer', params: { from: 'settings' } })
                  : router.push('/plus-upgrade')
              }
            />
            <View style={styles.divider} />
            <SettingRow
              icon={<SettingsIcon name="books" />}
              label={t('settings.manageSubjects')}
              value={t('settings.manageSubjectsNote')}
              onPress={() => router.push('/manage-subjects')}
            />
          </ThemedView>

          {/* Reminders */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {t('settings.secReminders')}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <View style={styles.row}>
              <View style={styles.rowIconImage}>
                <SettingsIcon name="bell" />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold">{t('settings.dailyStudyReminder')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {reminderEnabled ? t('settings.reminderOn', { time: reminderTime }) : t('settings.off')}
                </ThemedText>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={(next) => setReminder(next, reminderTime)}
                trackColor={{ true: BakeryColors.jam, false: BakeryColors.shortbread }}
                thumbColor="#FFF"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowIconImage}>
                <SettingsIcon name="clock24" />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold">{t('settings.hour24')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {use24HourTime ? t('settings.hour24On') : t('settings.hour24Off')}
                </ThemedText>
              </View>
              <Switch
                value={use24HourTime}
                onValueChange={setUse24HourTime}
                trackColor={{ true: BakeryColors.jam, false: BakeryColors.shortbread }}
                thumbColor="#FFF"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowIconImage}>
                <SettingsIcon name="radio" />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold">{t('settings.soundEffects')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {soundEffectsEnabled ? t('settings.soundEffectsOn') : t('settings.soundEffectsOff')}
                </ThemedText>
              </View>
              <Switch
                value={soundEffectsEnabled}
                onValueChange={setSoundEffectsEnabled}
                trackColor={{ true: BakeryColors.jam, false: BakeryColors.shortbread }}
                thumbColor="#FFF"
              />
            </View>
          </ThemedView>

          {/* Support & about */}
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {t('settings.secAbout')}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.group}>
            <InstagramFollowRow />
            <View style={styles.divider} />
            {/* Language — inline dropdown (no separate screen). Tapping expands the
                list right here; picking a language switches it and collapses. */}
            <Pressable
              onPress={() => setLangOpen((o) => !o)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={styles.rowIconImage}><SettingsIcon name="language" /></View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold">{t('settings.language')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {(() => {
                    const lang = LANGUAGES.find((l) => l.code === language);
                    return lang ? `${lang.flag} ${lang.native}` : 'English';
                  })()}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={[styles.chevron, langOpen && styles.chevronOpen]}>
                ›
              </ThemedText>
            </Pressable>
            {langOpen && (
              <View style={styles.langDropdown}>
                {LANGUAGES.map((lang) => {
                  const active = lang.code === language;
                  return (
                    <Pressable
                      key={lang.code}
                      onPress={() => {
                        if (lang.code !== language) {
                          setLanguage(lang.code);
                          markLanguageSelected();
                        }
                        setLangOpen(false);
                      }}
                      style={({ pressed }) => [styles.langOption, active && styles.langOptionActive, pressed && styles.rowPressed]}>
                      <ThemedText style={styles.langFlag}>{lang.flag}</ThemedText>
                      <ThemedText type="smallBold" style={styles.langName}>{lang.native}</ThemedText>
                      {active && <ThemedText type="smallBold" style={styles.langCheck}>✓</ThemedText>}
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View style={styles.divider} />
            <SettingRow
              icon={<ReplayGlyph />}
              label={t('tutorial.replay')}
              value={t('tutorial.replayNote')}
              onPress={() => { replayTutorial(); router.back(); }}
            />
            <View style={styles.divider} />
            <SettingRow
              icon={<SettingsIcon name="bug" />}
              label={t('settings.reportBug')}
              value={t('settings.reportBugNote')}
              onPress={() =>
                Linking.openURL(
                  'mailto:memobunsupport@gmail.com?subject=Memobun%20Support&body=' +
                    encodeURIComponent('How can we help?\n\n\n(App version, device, etc.)'),
                )
              }
            />
            <View style={styles.divider} />
            <SettingRow
              icon={<ScrollSealIcon size={40} />}
              label={t('settings.privacyTerms')}
              value={t('settings.privacyTermsDesc')}
              onPress={() => router.push('/legal')}
            />
            <View style={styles.divider} />
            <SettingRow icon={<SettingsIcon name="info" />} label={t('settings.version')} value={t('settings.versionValue')} />
          </ThemedView>

          {/* Delete account — pinned to the very bottom of Settings (danger zone). */}
          <ThemedView type="backgroundElement" style={styles.group}>
            <Pressable
              onPress={() => setDeleteOpen(true)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={styles.rowIconImage}>
                <TrashGlyph />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="smallBold" style={styles.dangerText}>
                  {t('settings.deleteAccount', { defaultValue: 'Delete account' })}
                </ThemedText>
              </View>
            </Pressable>
          </ThemedView>

          <View style={styles.footer} />
        </SafeAreaView>
      </ScrollView>
      <DeleteAccountModal
        visible={deleteOpen}
        displayName={isGuest ? null : profileDisplayName}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteOpen(false)}
      />

      {/* Leave-guest / sign-out confirm — local modal so it shows over Settings. */}
      <Modal visible={signOutOpen} transparent animationType="fade" onRequestClose={() => setSignOutOpen(false)}>
        <View style={styles.resetBackdrop}>
          <View style={styles.resetCard}>
            <ThemedText style={styles.resetTitle}>{isGuest ? t('settings.leaveGuestQ') : t('settings.signOutQ')}</ThemedText>
            <ThemedText style={styles.resetBody}>{isGuest ? t('settings.leaveGuestMsg') : t('settings.signOutMsg')}</ThemedText>
            <Pressable style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]} onPress={doSignOut}>
              <ThemedText style={styles.resetBtnText}>{isGuest ? t('settings.leaveGuestMode') : t('settings.signOut')}</ThemedText>
            </Pressable>
            <Pressable style={styles.resetCancel} onPress={() => setSignOutOpen(false)}>
              <ThemedText style={styles.resetCancelText}>{t('common.cancel')}</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Change password — local modal so it shows over the Settings native modal. */}
      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={() => setPwOpen(false)}>
        <KeyboardAvoidingView
          style={styles.pwBackdrop}
          behavior={Platform.select({ ios: 'padding', android: undefined })}>
          <View style={styles.pwCard}>
            <ThemedText style={styles.pwTitle}>{t('settings.changePassword')}</ThemedText>
            <TextInput
              style={styles.pwInput}
              value={pwCurrent}
              onChangeText={setPwCurrent}
              secureTextEntry
              textContentType="password"
              autoCapitalize="none"
              placeholder={t('auth.currentPasswordPlaceholder')}
              placeholderTextColor={BakeryColors.jam}
              returnKeyType="next"
            />
            <TextInput
              style={styles.pwInput}
              value={pwNew}
              onChangeText={setPwNew}
              secureTextEntry
              textContentType="newPassword"
              autoCapitalize="none"
              placeholder={t('auth.passwordMinPlaceholder')}
              placeholderTextColor={BakeryColors.jam}
              returnKeyType="next"
            />
            <TextInput
              style={styles.pwInput}
              value={pwConfirm}
              onChangeText={setPwConfirm}
              secureTextEntry
              textContentType="newPassword"
              autoCapitalize="none"
              placeholder={t('auth.typeAgain')}
              placeholderTextColor={BakeryColors.jam}
              returnKeyType="done"
              onSubmitEditing={handleChangePassword}
            />
            {pwError ? <ThemedText style={styles.pwError}>{pwError}</ThemedText> : null}
            {pwSuccess ? <ThemedText style={styles.pwSuccess}>{t('settings.passwordChanged')}</ThemedText> : null}
            <Pressable
              style={({ pressed }) => [styles.pwBtn, (pressed || pwSaving) && styles.pressed]}
              onPress={handleChangePassword}
              disabled={pwSaving}>
              <ThemedText style={styles.pwBtnText}>
                {pwSaving ? t('auth.saving') : t('auth.updatePassword')}
              </ThemedText>
            </Pressable>
            <Pressable style={styles.resetCancel} onPress={() => setPwOpen(false)} disabled={pwSaving}>
              <ThemedText style={styles.resetCancelText}>{t('common.cancel')}</ThemedText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* TEST reset confirm — local modal so it shows over the Settings modal. */}
      <Modal visible={resetOpen} transparent animationType="fade" onRequestClose={() => setResetOpen(false)}>
        <View style={styles.resetBackdrop}>
          <View style={styles.resetCard}>
            <ThemedText style={styles.resetTitle}>Reset items &amp; progress?</ThemedText>
            <ThemedText style={styles.resetBody}>
              TEST: keeps your account (you stay signed in), but you'll re-accept the Privacy Policy and confirm your birthday to verify your age again. Removes everything you own — companions, backgrounds, desks, outfits, skins, recipes/badges — leaving just Bun. Wipes study progress too, and grants 1,000,000 coins.
            </ThemedText>
            <Pressable
              style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
              onPress={() => {
                // Reset progress/purchases (account stays intact), then close
                // Settings and drop back to Home.
                resetGameData();
                setResetOpen(false);
                if (router.canDismiss()) router.dismissAll();
              }}>
              <ThemedText style={styles.resetBtnText}>Reset items &amp; progress</ThemedText>
            </Pressable>
            <Pressable style={styles.resetCancel} onPress={() => setResetOpen(false)}>
              <ThemedText style={styles.resetCancelText}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Birthday editor (limited changes). A LOCAL modal (root showPopup can't
          present over the Settings native modal). The warning note makes the
          limit explicit, so Save commits directly without a second confirm. */}
      <Modal visible={bdayOpen} transparent animationType="fade" onRequestClose={() => setBdayOpen(false)}>
        <View style={styles.resetBackdrop}>
          <View style={styles.resetCard}>
            <ThemedText style={styles.resetTitle}>{t('profileCard.birthday')}</ThemedText>
            <ThemedText style={styles.resetBody}>
              {!profileBirthday
                ? t('settings.birthdaySetNote')
                : bdayChangesLeft === 1
                  ? t('profileCard.birthdayChangeLastNote')
                  : t('profileCard.birthdayChangeNote', { times: bdayChangesLeft })}
            </ThemedText>
            <DateWheelPicker value={bdayDraft} onChange={setBdayDraft} hideYear />
            <Pressable
              style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
              onPress={() => {
                // First-ever set (pre-onboarding-update users) doesn't burn a change;
                // editing an existing birthday does (birthdayChangeUsed increments).
                const isChange = !!profileBirthday;
                // Don't burn an allowed change if nothing actually changed
                // (e.g. they opened the picker, it defaulted to today's value, Save).
                if (isChange && bdayDraft === profileBirthday) { setBdayOpen(false); return; }
                updateProfile(isChange ? { birthday: bdayDraft, birthdayChangeUsed: true } : { birthday: bdayDraft });
                setBdayOpen(false);
              }}>
              <ThemedText style={styles.resetBtnText}>{t('profileCard.birthdaySave')}</ThemedText>
            </Pressable>
            <Pressable style={styles.resetCancel} onPress={() => setBdayOpen(false)}>
              <ThemedText style={styles.resetCancelText}>{t('common.cancel')}</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const makeStyles = (s: number, contentWidth: number) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    padding: Spacing.four * s,
    maxWidth: contentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.two * s,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two * s,
  },
  closeBtn: {
    paddingHorizontal: Spacing.three * s,
    paddingVertical: Spacing.one * s,
    borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.jam,
  },
  closeText: { color: BakeryColors.cocoaDark },
  sectionTitle: {
    fontSize: 12 * s,
    letterSpacing: 0.6,
    marginTop: Spacing.three * s,
    marginBottom: Spacing.one * s,
    marginLeft: Spacing.two * s,
  },
  group: {
    borderRadius: BakeryRadii.card * s,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three * s,
    paddingHorizontal: Spacing.three * s,
    paddingVertical: Spacing.three * s,
  },
  rowPressed: { opacity: 0.7 },
  rowIcon: { fontSize: 22 * s, lineHeight: 28 * s, width: 28 * s, textAlign: 'center' },
  rowIconImage: { width: 44 * s, height: 44 * s, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 * s },
  connectedTag: { color: '#5BA86B', fontWeight: '700' },
  chevron: { fontSize: 22 * s, lineHeight: 24 * s },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  // Inline language dropdown
  langDropdown: { paddingLeft: 44 * s, paddingBottom: 6 * s, gap: 2 * s },
  langOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10 * s,
    paddingVertical: 11 * s, paddingHorizontal: 12 * s, borderRadius: 12 * s,
  },
  langOptionActive: { backgroundColor: 'rgba(247,167,184,0.18)' },
  langFlag: { fontSize: 20 * s },
  langName: { flex: 1 },
  langCheck: { color: BakeryColors.berry },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BakeryColors.border,
    opacity: 0.4,
    marginLeft: Spacing.five * s,
  },
  badge: {
    backgroundColor: BakeryColors.jam,
    borderRadius: BakeryRadii.chip * s,
    paddingHorizontal: Spacing.two * s,
    paddingVertical: 2 * s,
  },
  badgeText: { fontSize: 11 * s, fontWeight: '800', color: BakeryColors.cocoaDark },
  dangerText: { color: BakeryColors.danger },
  // Local reset-confirm modal
  resetBackdrop: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', padding: 24 },
  resetCard: {
    width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: 360 * s, backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.panel * s, borderWidth: 2, borderColor: '#E8A0A0',
    padding: Spacing.four * s, gap: Spacing.two * s, ...BakeryShadow,
  },
  resetTitle: { fontSize: 20 * s, fontWeight: '900', color: '#C0392B', textAlign: 'center' },
  resetBody: { fontSize: 13.5 * s, color: BakeryColors.cocoaDark, lineHeight: 19 * s, textAlign: 'center' },
  resetBtn: { paddingVertical: 14 * s, borderRadius: BakeryRadii.button * s, alignItems: 'center', backgroundColor: '#D0392B', marginTop: Spacing.one * s },
  resetBtnText: { fontSize: 16 * s, fontWeight: '900', color: '#fff' },
  resetCancel: { alignItems: 'center', paddingVertical: Spacing.one * s },
  resetCancelText: { fontSize: 14 * s, fontWeight: '800', color: BakeryColors.mocha },
  pressed: { opacity: 0.85 },
  footer: { height: Spacing.five * s },
  // Change-password modal
  pwBackdrop: { flex: 1, backgroundColor: 'rgba(91,58,46,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  pwCard: {
    width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: 360 * s, backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.panel * s, borderWidth: 2, borderColor: BakeryColors.rose,
    padding: Spacing.four * s, gap: Spacing.two * s, ...BakeryShadow,
  },
  pwTitle: { fontSize: 19 * s, fontWeight: '900', color: BakeryColors.cocoaDark, textAlign: 'center', marginBottom: Spacing.one * s },
  pwInput: {
    height: 50 * s, borderRadius: BakeryRadii.pill, backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: BakeryColors.rose, paddingHorizontal: Spacing.three * s,
    fontSize: 15 * s, color: BakeryColors.cocoaDark,
  },
  pwError: { color: BakeryColors.danger, fontSize: 13 * s, lineHeight: 18 * s, textAlign: 'center' },
  pwSuccess: { color: BakeryColors.success, fontSize: 13 * s, lineHeight: 18 * s, textAlign: 'center' },
  pwBtn: { paddingVertical: 14 * s, borderRadius: BakeryRadii.pill, alignItems: 'center', backgroundColor: BakeryColors.jam, marginTop: Spacing.one * s },
  pwBtnText: { fontSize: 16 * s, fontWeight: '900', color: '#fff' },
});
