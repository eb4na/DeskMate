import { Asset } from 'expo-asset';
import { Image as ExpoImage } from 'expo-image';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack, router } from 'expo-router';
import { Animated, Easing, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { InviteListener } from '@/components/invite-listener';
import { AppProvider } from '@/context/app-context';
import { useApp } from '@/context/app-context';
import { StudyRoomProvider } from '@/lib/use-study-room';
import { subscribeLoadingScreen, takeLoadingDone } from '@/lib/loading-signal';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { Spacing } from '@/constants/theme';
import '@/lib/notifications';
import i18n, { useTranslation } from '@/i18n';

const LOADING_IMGS = [
  require('@/assets/images/home/loading4.png'),
  require('@/assets/images/home/loading6.png'),
  require('@/assets/images/home/loading11.png'),
  require('@/assets/images/home/loading8.png'),
  require('@/assets/images/home/loading9.png'),
  require('@/assets/images/home/loading10.png'),
];

// Index-aligned with LOADING_IMGS: true where the art's bottom (under the label)
// is too dark or too pink for the default pink label to read — use white there.
const LOADING_TEXT_WHITE = [true, true, true, true, true, false];

// Full-screen loading splash shown OVER the app — the home screen mounts behind
// it (loading its art) and stays hidden until everything is ready. Only when
// `ready` flips true does the overlay fill its bar and fade away (then onDone).
function LoadingScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  // Pick one of the loading artworks at random each time it shows.
  const idx = useRef(Math.floor(Math.random() * LOADING_IMGS.length)).current;
  const img = LOADING_IMGS[idx];
  const whiteText = LOADING_TEXT_WHITE[idx];
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);
  const [minDone, setMinDone] = useState(false);

  // Creep the bar toward ~92% over the 3s minimum; never completes on its own.
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 0.92,
      duration: 3000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const minTimer = setTimeout(() => setMinDone(true), 3000);
    const slowTimer = setTimeout(() => setSlow(true), 3000);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(slowTimer);
    };
  }, [progress]);

  // Finish only once the app is ready AND the 3s minimum has passed.
  const finished = ready && minDone;
  useEffect(() => {
    if (!finished) return;
    Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 260, useNativeDriver: false }),
      Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => onDone());
  }, [finished, progress, fade, onDone]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View style={[styles.loadingRoot, { opacity: fade }]} pointerEvents="auto">
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
  const { initialized, isGuest, session } = useAuth();
  const { loaded, languageSelected } = useApp();
  const { t } = useTranslation();
  const [assetsReady, setAssetsReady] = useState(false);
  // Loading overlay is shown on first launch and re-shown on every login/sign-in.
  const [loadingVisible, setLoadingVisible] = useState(true);

  // Preload the home-screen images once so the home screen is ready behind the
  // loading overlay.
  useEffect(() => {
    Asset.loadAsync(PRELOAD_ASSETS)
      .catch(() => {})
      .finally(() => setAssetsReady(true));
  }, []);

  // Re-show the loading screen whenever the user becomes authenticated — i.e.
  // every time they log in or finish signing in (a guest also counts).
  const authed = !!session || isGuest;
  const wasAuthed = useRef(false);
  useEffect(() => {
    if (authed && !wasAuthed.current) setLoadingVisible(true);
    wasAuthed.current = authed;
  }, [authed]);

  // Re-show the loading screen on demand (e.g. after finishing a study session).
  useEffect(() => subscribeLoadingScreen(() => setLoadingVisible(true)), []);

  useEffect(() => {
    if (initialized && loaded && (session || isGuest) && !languageSelected) {
      router.replace('/language-picker');
    }
  }, [initialized, loaded, session, isGuest, languageSelected]);

  // The home screen mounts immediately (and loads its art) behind the loading
  // overlay; the overlay only lifts once everything is ready.
  const appReady = initialized && loaded && assetsReady;

  return (
    <>
    <Stack>
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />

      <Stack.Protected guard={!!session || isGuest}>
        <Stack.Screen name="language-picker" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Session flow */}
        <Stack.Screen name="session-picker" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="subject-picker" options={{ presentation: 'modal', title: t('screens.subjectMood') }} />
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
        <Stack.Screen name="mood-chart" options={{ presentation: 'modal', title: t('screens.moodChart') }} />
        <Stack.Screen name="subject-chart" options={{ presentation: 'modal', title: t('screens.subjectChart') }} />
        <Stack.Screen name="break-game" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="cake-game" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="party-invite" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="study-lobby" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="study-desk" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        {/* Wave 4 */}
        <Stack.Screen name="plus-upgrade" options={{ presentation: 'modal', title: t('screens.deskmatePlus') }} />
        <Stack.Screen name="custom-timer" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ambience-picker" options={{ presentation: 'modal', title: t('screens.ambience') }} />
        <Stack.Screen name="companion-gallery" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="edit-room" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="food-gallery" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="friends" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="profile" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="friend-card" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="dm-chat" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="companion-chat" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="companion-pfp" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal', title: t('screens.settings') }} />
        <Stack.Screen name="coin-shop" options={{ presentation: 'modal', title: t('screens.getCoins') }} />
      </Stack.Protected>
    </Stack>
    {loadingVisible && (
      <LoadingScreen
        key={authed ? 'authed' : 'launch'}
        ready={appReady}
        onDone={() => {
          setLoadingVisible(false);
          // Run any pending completion callback (e.g. start the study timer only
          // now that the loading screen has finished).
          takeLoadingDone()?.();
        }}
      />
    )}
    </>
  );
}

function AppShell() {
  return (
    <StudyRoomProvider>
      <RootNavigator />
      <InviteListener />
    </StudyRoomProvider>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <AppProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AnimatedSplashOverlay />
            <AppShell />
          </ThemeProvider>
        </AppProvider>
      </AuthProvider>
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F7DDE4',
    zIndex: 999,
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
