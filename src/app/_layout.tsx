import { Asset } from 'expo-asset';
import { useFonts } from 'expo-font';
import { Image as ExpoImage } from 'expo-image';
import { DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { Animated, Appearance, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { PostHogProvider } from 'posthog-react-native';

import { useIsTablet } from '@/hooks/use-device-class';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ErrorBoundary } from '@/components/error-boundary';
import { InviteListener } from '@/components/invite-listener';
import { CharacterObtainedModal } from '@/components/character-obtained-modal';
import { LegalConsentGate } from '@/components/legal-consent-gate';
import { StarterChooser } from '@/components/starter-chooser';
import { TutorialPortal } from '@/components/home-tutorial';
import { PopupHost } from '@/components/popup-host';
import { AppProvider } from '@/context/app-context';
import { useApp } from '@/context/app-context';
import { StudyRoomProvider } from '@/lib/use-study-room';
import { prewarmCoreSounds, setTapSoundEnabled } from '@/lib/sounds';
import { setLoadingActive, subscribeLoadingScreen, takeLoadingDone } from '@/lib/loading-signal';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { posthog, identifyUser, resetUser } from '@/lib/analytics';
import { configurePurchases, currentPlusExpiry, onPlusEntitlementChange } from '@/lib/purchases';
import { ROOM_PAIRS } from '@/constants/room-data';
import { resolveActiveCompanion } from '@/lib/companion-utils';
import { BakeryColors, Spacing } from '@/constants/theme';
import '@/lib/notifications';
import i18n, { useTranslation } from '@/i18n';

// Memobun is locked to light mode (see hooks/use-color-scheme.ts). iOS enforces
// this natively via userInterfaceStyle, but on Android the system dark setting
// still reaches react-native's useColorScheme, so force it app-wide here.
Appearance.setColorScheme('light');

const LOADING_IMGS = [
  require('@/assets/images/home/loading4.png'),
  require('@/assets/images/home/loading11.png'),
  require('@/assets/images/home/loading8.png'),
  require('@/assets/images/home/loading9.png'),
  require('@/assets/images/home/loading14.png'),
];

// Index-aligned with LOADING_IMGS: true where the art's bottom (under the label)
// is too dark or too pink for the default pink label to read — use white there.
const LOADING_TEXT_WHITE = [true, true, true, true, true];

// Full-screen loading splash shown OVER the app — the home screen mounts behind
// it (loading its art) and stays hidden until everything is ready. Only when
// `ready` flips true does the overlay fill its bar and fade away (then onDone).
function LoadingScreen({ ready, quick, onDone }: { ready: boolean; quick?: boolean; onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  // Pick one of the loading artworks at random each time it shows.
  const idx = useRef(Math.floor(Math.random() * LOADING_IMGS.length)).current;
  const img = LOADING_IMGS[idx];
  const whiteText = LOADING_TEXT_WHITE[idx];
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);
  const [minDone, setMinDone] = useState(false);
  // FAIL-OPEN failsafe: if `ready` never flips (e.g. a hung asset prefetch leaves a
  // gate stuck), force-dismiss after a hard cap so the overlay can NEVER block the
  // app forever. Generous so it doesn't cut a legitimately-slow load short.
  const [forceDone, setForceDone] = useState(false);

  // Launch/login use the full 3s loader; quick in-app navigation uses a short
  // minimum so it dismisses the moment the destination's assets are ready.
  const minMs = quick ? 400 : 3000;
  const barMs = quick ? 500 : 3000;
  const maxMs = quick ? 6000 : 10000;

  // Creep the bar toward ~92% over the minimum hold; never completes on its own.
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 0.92,
      duration: barMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const minTimer = setTimeout(() => setMinDone(true), minMs);
    const slowTimer = setTimeout(() => setSlow(true), 3000);
    const maxTimer = setTimeout(() => setForceDone(true), maxMs);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(slowTimer);
      clearTimeout(maxTimer);
    };
  }, [progress, minMs, barMs, maxMs]);

  // Finish once the app is ready AND the minimum hold has passed — OR once the hard
  // max-hold failsafe trips (so a stuck `ready` can't freeze the screen).
  const finished = (ready && minDone) || forceDone;
  useEffect(() => {
    if (!finished) return;
    Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 260, useNativeDriver: false }),
      Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => onDone());
  }, [finished, progress, fade, onDone]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View style={[styles.loadingRoot, { opacity: fade }]} pointerEvents={finished ? 'none' : 'auto'}>
      <ExpoImage source={img} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" />
      <View style={styles.loadingBarWrap}>
        <Text style={[styles.loadingLabel, whiteText && styles.loadingLabelWhite]}>{t('common.loading')}</Text>
        <View style={styles.loadingTrack}>
          <Animated.View style={[styles.loadingFill, { width }]} />
        </View>
        {slow && !ready && <Text style={styles.loadingSlow}>{t('common.loadingSlow')}</Text>}
      </View>
    </Animated.View>
  );
}

// First-screen (home) art preloaded during the loading screen so nothing pops
// in once the app is shown.
const PRELOAD_ASSETS = [
  require('@/assets/images/home/home-room-bg.png'),
  require('@/assets/images/home/home-room-new.png'),
  require('@/assets/images/home/home-room-pink.png'),
  require('@/assets/images/home/desk-new.png'),
  require('@/assets/images/home/desk-overlay.png'),
  require('@/assets/images/home/desk-mixer.png'),
  require('@/assets/images/home/desk-strawberries.png'),
  require('@/assets/images/home/desk-eggs.png'),
  require('@/assets/images/home/desk-butter.png'),
  require('@/assets/images/home/sunlight.png'),
  require('@/assets/images/bun/bun-home.png'),
];

function RootNavigator() {
  const { initialized, isGuest, session, signOut, sessionRestoredAtLaunch } = useAuth();
  const { loaded, legalAccepted, markLegalAccepted, setBirthday, updateProfile, soundEffectsEnabled, starterChosen, isPlus, plusPlan, plusUntil, setIsPlus, persistedStateReady, resetAccountForAbandonedOnboarding,
    equippedBackgroundRoomId, equippedDeskRoomId, activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins } = useApp();
  const { t } = useTranslation();

  // Rounded display font (Baloo 2 ExtraBold) for the study countdown — loads from the
  // bundled asset; non-blocking (the timer falls back to system until it's ready).
  useFonts({ Baloo2: require('@/assets/fonts/Baloo2-ExtraBold.ttf') });

  // Keep the tap-sound helper's gate in sync with the user's setting.
  useEffect(() => { setTapSoundEnabled(soundEffectsEnabled); }, [soundEffectsEnabled]);
  // Warm the audio session + first-heard sound pools while the launch loader is
  // still up, so the app's very first sound (button tap, companion pop, coin
  // chime after login) plays instantly instead of silently loading.
  useEffect(() => { prewarmCoreSounds(); }, []);
  // Dev only: expo-image's disk cache persists across Metro restarts, keyed by
  // asset URL + content hash. If Metro's asset map was ever corrupted (duplicate
  // basenames from worktrees/website copies), the WRONG bytes get cached under the
  // RIGHT key and keep rendering (e.g. flag/bear/sign where the desk mixer and
  // ingredients belong) even after `expo start -c` — the poison lives on the
  // device. Purging at launch in dev makes any such episode self-heal on reload.
  useEffect(() => {
    if (!__DEV__) return;
    ExpoImage.clearMemoryCache().catch(() => {});
    ExpoImage.clearDiskCache().catch(() => {});
  }, []);
  const [assetsReady, setAssetsReady] = useState(false);
  // Loading overlay is shown on first launch and re-shown on every login/sign-in.
  const [loadingVisible, setLoadingVisible] = useState(true);
  // Quick (readiness-based) vs the full 3s launch loader.
  const [loadingQuick, setLoadingQuick] = useState(false);
  // For quick loads, gates the overlay on a destination's asset preload promise.
  const [taskReady, setTaskReady] = useState(true);

  // Preload the home-screen images once so the home screen is ready behind the
  // loading overlay.
  useEffect(() => {
    Asset.loadAsync(PRELOAD_ASSETS)
      .catch(() => {})
      .finally(() => setAssetsReady(true));
  }, []);

  // PRELOAD_ASSETS only covers the DEFAULT room/desk/Bun. A player with an equipped
  // room, desk, or companion would otherwise see those (full-screen bg + big
  // character) pop in AFTER the splash lifts. So once saved state is loaded (the
  // equipped ids are final), preload exactly what THIS home will render and gate the
  // splash on it too — no half-painted home flash. Re-runs harmlessly if the player
  // later changes their room/companion.
  const [homeAssetsReady, setHomeAssetsReady] = useState(false);
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    try {
      const bg = ROOM_PAIRS.find((r) => r.id === equippedBackgroundRoomId)?.backgroundImage ?? ROOM_PAIRS[0].backgroundImage;
      const desk = ROOM_PAIRS.find((r) => r.id === equippedDeskRoomId)?.deskImage ?? ROOM_PAIRS[0].deskImage;
      const char = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins)?.imageSource;
      const numeric = [bg, desk, ...(typeof char === 'number' ? [char] : [])].filter((x): x is number => x != null);
      // Custom-art companions carry a {uri} image — prefetch those through expo-image.
      const uri = char && typeof char === 'object' && 'uri' in char ? char.uri : undefined;
      // Race a timeout so a HUNG prefetch (pending, never rejects) can't wedge the
      // splash — `.catch` only handles rejection, not an indefinitely-pending promise.
      Promise.race([
        Promise.all([
          Asset.loadAsync(numeric).catch(() => {}),
          ...(uri ? [ExpoImage.prefetch(uri).catch(() => {})] : []),
        ]),
        new Promise((res) => setTimeout(res, 5000)),
      ]).finally(() => { if (!cancelled) setHomeAssetsReady(true); });
    } catch {
      // Never let a resolution error wedge the splash on screen — fail open.
      setHomeAssetsReady(true);
    }
    return () => { cancelled = true; };
  }, [loaded, equippedBackgroundRoomId, equippedDeskRoomId, activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins]);

  // Re-show the loading screen whenever the user becomes authenticated — i.e.
  // every time they log in or finish signing in (a guest also counts).
  const authed = !!session || isGuest;
  const wasAuthed = useRef(false);
  useEffect(() => {
    if (authed && !wasAuthed.current) setLoadingVisible(true);
    wasAuthed.current = authed;
  }, [authed]);

  // Abandoned-onboarding guard: if the player quit the app on the privacy/birthday
  // gate or the buddy picker and relaunches, send them back to the login screen and
  // erase the half-finished account. We only act on a session that was *restored at
  // launch* (a returning user) — never on a login/signup that happens later in this
  // run (incl. the email-confirmation deep link), so a brand-new user can complete
  // onboarding normally the first time through.
  const abandonHandledRef = useRef(false);
  useEffect(() => {
    if (abandonHandledRef.current) return;
    if (!initialized || !sessionRestoredAtLaunch) return;
    // Wait until this account's saved state is *reliably* loaded (not a failed-load
    // fallback to defaults, which would falsely look like unfinished onboarding).
    if (!persistedStateReady || !authed) return;
    // Onboarding finished — disarm the guard for the rest of the session so a LATER
    // in-session drop back to the starter picker (e.g. the dev "Reset items" button)
    // is treated as a deliberate re-pick, not an abandoned-onboarding wipe.
    if (legalAccepted && starterChosen) { abandonHandledRef.current = true; return; }
    abandonHandledRef.current = true;
    (async () => {
      await resetAccountForAbandonedOnboarding();
      await signOut().catch(() => {});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- functions are stable enough; guarded by abandonHandledRef
  }, [initialized, sessionRestoredAtLaunch, persistedStateReady, authed, legalAccepted, starterChosen]);

  // Re-show the loading screen on demand (e.g. after finishing a study session,
  // or when navigating to a heavy screen via navigateWithLoading).
  useEffect(
    () =>
      subscribeLoadingScreen(({ quick, until }) => {
        setLoadingQuick(!!quick);
        setLoadingVisible(true);
        if (until) {
          setTaskReady(false);
          until.finally(() => setTaskReady(true));
        } else {
          setTaskReady(true);
        }
      }),
    [],
  );

  // Configure RevenueCat once auth is known (ties purchases to the account so Plus
  // follows the user across devices), then reconcile Plus against the real
  // entitlement: a subscription cancelled/renewed off-device is corrected here on
  // launch. No-ops entirely when IAP is unavailable (pre-rebuild / no API key) —
  // currentPlusExpiry returns undefined and local Plus state is left untouched.
  // Activation-only entitlement handler, kept in a latest-ref so the once-registered
  // listener always sees current Plus state (a stale `setIsPlus` closure would misfire
  // its freezes-granted popup). Flips Plus ON for a purchase/renewal that happened
  // ANYWHERE — another device, an Apple-side renewal, a deferred/Ask-to-Buy approval,
  // or the app backgrounded mid-purchase — none of which hit the paywall's callback.
  // It deliberately never turns Plus OFF: the customerInfo listener fires often (every
  // foreground, coin-pack buy, transient grace state) and a momentary inactive read
  // must not yank Plus mid-session — deactivation stays with the cold-launch reconcile
  // below. Guarded so unrelated customerInfo updates don't cause re-render churn.
  const plusActivateRef = useRef<(info: { until: string | null; plan: 'monthly' | 'annual' }) => void>(() => {});
  plusActivateRef.current = ({ until, plan }) => {
    if (until && (!isPlus || plusUntil !== until)) setIsPlus(true, plan, until);
  };

  const plusReconciled = useRef(false);
  useEffect(() => {
    if (!initialized || !loaded || !authed || plusReconciled.current) return;
    plusReconciled.current = true;
    (async () => {
      // In dev, Plus is controlled locally (the test "reset to new account" makes a
      // free account, mock-purchase grants it) — don't auto-sync from the store, or a
      // sandbox entitlement would re-grant Plus right after a reset.
      if (__DEV__) return;
      await configurePurchases(session?.user?.id);
      // Activate Plus on any future entitlement change, from anywhere (see ref above).
      onPlusEntitlementChange((info) => plusActivateRef.current(info));
      const until = await currentPlusExpiry();
      if (until === undefined) return; // IAP unavailable — leave local state as-is
      if (until) setIsPlus(true, plusPlan ?? 'monthly', until);
      else if (isPlus) setIsPlus(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, loaded, authed, session?.user?.id]);

  // The home screen mounts immediately (and loads its art) behind the loading
  // overlay; the overlay only lifts once everything is ready. For quick loads,
  // `taskReady` also waits on the destination's asset preload.
  const appReady = initialized && loaded && assetsReady && homeAssetsReady && taskReady;

  // Mirror overlay visibility so screens can hold their own popups until the
  // launch splash has actually lifted (see daily-reward-modal's delayed show).
  useEffect(() => { setLoadingActive(loadingVisible); }, [loadingVisible]);

  return (
    <>
    <Stack screenOptions={{ contentStyle: { backgroundColor: BakeryColors.frosting } }}>
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />

      <Stack.Protected guard={!!session || isGuest}>
        <Stack.Screen name="language-picker" options={{ headerShown: false, gestureEnabled: false, animation: 'none', presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Session flow */}
        <Stack.Screen name="session-picker" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="session" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="session-complete" options={{ headerShown: false }} />
        {/* Wave 1 modals */}
        <Stack.Screen name="add-exam" options={{ presentation: 'modal', title: t('screens.addExamCountdown') }} />
        <Stack.Screen name="reminder-settings" options={{ presentation: 'modal', title: t('screens.dailyReminder') }} />
        {/* Wave 2 modals */}
        <Stack.Screen name="add-task" options={{ presentation: 'modal', title: t('screens.task') }} />
        <Stack.Screen name="manage-subjects" options={{ presentation: 'modal', title: t('screens.subjects') }} />
        {/* Wave 3 */}
        <Stack.Screen name="weekly-report" options={{ presentation: 'modal', title: t('screens.weeklyReport') }} />
        <Stack.Screen name="subject-chart" options={{ presentation: 'modal', title: t('screens.subjectChart') }} />
        <Stack.Screen name="break-game" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="next-session" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="session-checkpoint" options={{ headerShown: false, gestureEnabled: false, animation: 'fade', presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } }} />
        <Stack.Screen name="cake-game" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="party-invite" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="study-lobby" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="study-desk" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        {/* Wave 4 */}
        <Stack.Screen name="plus-upgrade" options={{ presentation: 'modal', title: t('screens.deskmatePlus') }} />
        <Stack.Screen name="custom-timer" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ambience-picker" options={{ presentation: 'modal', title: t('screens.ambience') }} />
        <Stack.Screen name="companion-gallery" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="daily-quests" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="achievements" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="edit-room" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="food-gallery" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="friends" options={{ presentation: 'modal', headerShown: false, gestureEnabled: true }} />
        <Stack.Screen name="profile" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="friend-card" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="dm-chat" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="companion-chat" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="companion-pfp" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal', title: t('screens.settings') }} />
        <Stack.Screen name="mailbox" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="legal" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="coin-shop" options={{ presentation: 'modal', title: t('screens.getCoins') }} />
        {/* showPopup() fallback surface: pushed by PopupHost when the focused route
            is itself modal-presented (a root <Modal> can't present then — iOS drops
            it or wedges). Same options as session-checkpoint's transparent overlay. */}
        <Stack.Screen name="popup" options={{ headerShown: false, gestureEnabled: false, animation: 'fade', presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } }} />
      </Stack.Protected>
    </Stack>
    {loadingVisible && (
      <LoadingScreen
        key={authed ? 'authed' : 'launch'}
        ready={appReady}
        quick={loadingQuick}
        onDone={() => {
          setLoadingVisible(false);
          setLoadingQuick(false);
          // Run any pending completion callback (e.g. start the study timer only
          // now that the loading screen has finished).
          takeLoadingDone()?.();
        }}
      />
    )}
    {/* First-launch consent: any new account or new guest must accept the
        Privacy Policy + Terms before using the app. Shown once the launch
        splash has lifted and the saved state is loaded. */}
    {authed && loaded && !legalAccepted && (
      <LegalConsentGate
        onAgree={(birthday) => {
          setBirthday(birthday);
          // Seed the profile birthday (shown on the card + drives the yearly reward)
          // from the same pick, but YEAR-STRIPPED to a fixed leap year (2008) — the
          // profile birthday syncs to friends, so the real birth year must not leak.
          // Only month/day is ever used (card formatter + isBirthdayToday). This is
          // the initial set, so it does NOT consume the one allowed change in Settings.
          updateProfile({ birthday: `2008-${birthday.slice(5)}` });
          markLegalAccepted();
        }}
      />
    )}
    {/* Starter pick: once consent is given, a new account/guest chooses one of
        five companions for free (the other four go to the shop). Shown once. */}
    {authed && loaded && legalAccepted && !starterChosen && (
      <StarterChooser />
    )}
    </>
  );
}

// On a tablet held in landscape, keep the whole (portrait-designed) app in a
// centred portrait-aspect column with dark bars filling the sides, instead of
// stretching the UI across the wide screen. Phones and portrait tablets render
// normally.
function LandscapeLetterbox({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const isTablet = useIsTablet();
  if (!isTablet || width <= height) return <>{children}</>;
  // Render the app at its FULL portrait size, then shrink the whole thing with a
  // transform so the layout is identical — just smaller — centred with dark sides.
  const short = Math.min(width, height); // portrait width
  const long = Math.max(width, height);  // portrait height
  const scale = height / long;            // fit portrait height into the landscape height
  return (
    <View style={styles.letterboxRoot}>
      <View style={{ width: short, height: long, transform: [{ scale }] }}>{children}</View>
    </View>
  );
}

// Tie PostHog events to the signed-in account, and clear the identity on
// sign-out so the next person on the device isn't merged into it. Guests stay
// anonymous. No-ops when analytics is disabled (posthog is null).
function AnalyticsIdentity() {
  const { user, isGuest } = useAuth();
  useEffect(() => {
    // Identify by the (non-PII) account UUID only — deliberately don't send the user's
    // email to a third-party analytics service (privacy-by-design for a 13+ app).
    if (user) identifyUser(user.id);
    else if (!isGuest) resetUser();
  }, [user, isGuest]);
  return null;
}

// Wrap the app in PostHog's provider only when analytics is configured. App
// lifecycle events (open/background) are enabled on the client itself; here we
// turn OFF touch and screen autocapture — screen autocapture isn't supported for
// expo-router, and we capture the meaningful moments manually via `track()`.
function Analytics({ children }: { children: ReactNode }) {
  if (!posthog) return <>{children}</>;
  return (
    <PostHogProvider
      client={posthog}
      autocapture={{ captureScreens: false, captureTouches: false }}
    >
      {children}
    </PostHogProvider>
  );
}

function AppShell() {
  return (
    <Analytics>
      <StudyRoomProvider>
        <AnalyticsIdentity />
        <LandscapeLetterbox>
          <ErrorBoundary>
            <RootNavigator />
          </ErrorBoundary>
        </LandscapeLetterbox>
        <InviteListener />
        {/* Root-mounted so the coachmark overlay paints ABOVE the bottom tab bar
            (Home drives its visibility via the tutorial signal). */}
        <TutorialPortal />
        <PopupHost />
        <CharacterObtainedModal />
      </StudyRoomProvider>
    </Analytics>
  );
}

export default function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <AppProvider>
          <ThemeProvider value={DefaultTheme}>
            <AnimatedSplashOverlay />
            <AppShell />
          </ThemeProvider>
        </AppProvider>
      </AuthProvider>
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  letterboxRoot: {
    flex: 1,
    backgroundColor: '#1A1410', // dark side bars
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  loadingRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F7DDE4',
    // Above the consent gate / starter chooser (zIndex 1000) so those can mount
    // underneath the splash and be revealed when it lifts — no home-screen flash.
    zIndex: 1001,
  },
  loadingBarWrap: {
    position: 'absolute',
    bottom: '6%',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingTrack: {
    width: '64%',
    height: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
  },
  loadingFill: { height: '100%', borderRadius: 8, backgroundColor: '#F2A0B5' },
  loadingLabel: { fontSize: 18, fontWeight: '800', color: '#F2A0B5', letterSpacing: 0.5, textShadowColor: 'rgba(255,255,255,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  loadingLabelWhite: { color: '#fff', textShadowColor: 'rgba(0,0,0,0.4)' },
  loadingSlow: { fontSize: 12, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 3 },
});
