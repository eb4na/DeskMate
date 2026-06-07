import { Asset } from 'expo-asset';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack, router } from 'expo-router';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { InviteListener } from '@/components/invite-listener';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppProvider } from '@/context/app-context';
import { useApp } from '@/context/app-context';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { Spacing } from '@/constants/theme';
import '@/lib/notifications';
import i18n from '@/i18n';

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

  // Preload the home-screen images once, before revealing the app.
  useEffect(() => {
    Asset.loadAsync(PRELOAD_ASSETS)
      .catch(() => {})
      .finally(() => setAssetsReady(true));
  }, []);

  useEffect(() => {
    if (initialized && loaded && (session || isGuest) && !languageSelected) {
      router.replace('/language-picker');
    }
  }, [initialized, loaded, session, isGuest, languageSelected]);

  if (!initialized || !loaded || !assetsReady) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C6F5A" />
        <ThemedText type="small" themeColor="textSecondary">
          Loading your DeskMate account...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
});
