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
import { AuthProvider, useAuth } from '@/context/auth-context';
import { Spacing } from '@/constants/theme';
import '@/lib/notifications';
import i18n from '@/i18n';

const LOADING_IMGS = [
  require('@/assets/images/home/loading.png'),
  require('@/assets/images/home/loading2.png'),
];

// Full-screen loading splash shown OVER the app — the home screen mounts behind
// it (loading its art) and stays hidden until everything is ready. Only when
// `ready` flips true does the overlay fill its bar and fade away (then onDone).
function LoadingScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  // Pick one of the loading artworks at random each time it shows.
  const img = useRef(LOADING_IMGS[Math.floor(Math.random() * LOADING_IMGS.length)]).current;
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
    const t = setTimeout(() => setMinDone(true), 3000);
    const s = setTimeout(() => setSlow(true), 3000);
    return () => {
      clearTimeout(t);
      clearTimeout(s);
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
        <View style={styles.loadingTrack}>
          <Animated.View style={[styles.loadingFill, { width }]} />
        </View>
        {slow && !ready && <Text style={styles.loadingSlow}>Just a moment longer…</Text>}
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
        <Stack.Screen name="subject-picker" options={{ presentation: 'modal', title: 'Subject & mood' }} />
        <Stack.Screen name="session" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="session-complete" options={{ headerShown: false }} />
        {/* Wave 1 modals */}
        <Stack.Screen name="add-exam" options={{ presentation: 'modal', title: 'Add exam countdown' }} />
        <Stack.Screen name="reminder-settings" options={{ presentation: 'modal', title: 'Daily reminder' }} />
        {/* Wave 2 modals */}
        <Stack.Screen name="add-task" options={{ presentation: 'modal', title: 'Task' }} />
        <Stack.Screen name="manage-subjects" options={{ presentation: 'modal', title: 'Subjects' }} />
        {/* Wave 3 */}
        <Stack.Screen name="weekly-report" options={{ presentation: 'modal', title: 'Weekly Report' }} />
        <Stack.Screen name="break-game" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="cake-game" options={{ headerShown: false, gestureEnabled: false }} />
        {/* Wave 4 */}
        <Stack.Screen name="plus-upgrade" options={{ presentation: 'modal', title: 'DeskMate Plus' }} />
        <Stack.Screen name="custom-timer" options={{ headerShown: false, presentation: 'transparentModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ambience-picker" options={{ presentation: 'modal', title: 'Ambience' }} />
        <Stack.Screen name="companion-gallery" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="edit-room" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="food-gallery" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="friends" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="profile" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="friend-card" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="companion-chat" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="companion-pfp" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'Settings' }} />
        <Stack.Screen name="coin-shop" options={{ presentation: 'modal', title: 'Get Coins' }} />
      </Stack.Protected>
    </Stack>
    {loadingVisible && (
      <LoadingScreen
        key={authed ? 'authed' : 'launch'}
        ready={appReady}
        onDone={() => setLoadingVisible(false)}
      />
    )}
    </>
  );
}

function AppShell() {
  return (
    <>
      <RootNavigator />
      <InviteListener />
    </>
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
  loadingSlow: { fontSize: 12, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 3 },
});
