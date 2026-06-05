import { DarkTheme, DefaultTheme, ThemeProvider, Stack, router } from 'expo-router';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppProvider } from '@/context/app-context';
import { useApp } from '@/context/app-context';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { Spacing } from '@/constants/theme';
import '@/lib/notifications';
import i18n from '@/i18n';

function RootNavigator() {
  const { initialized, isGuest, session } = useAuth();
  const { loaded, languageSelected } = useApp();

  useEffect(() => {
    if (initialized && loaded && (session || isGuest) && !languageSelected) {
      router.replace('/language-picker');
    }
  }, [initialized, loaded, session, isGuest, languageSelected]);

  if (!initialized || !loaded) {
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
        <Stack.Screen name="session-picker" options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }} />
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
        <Stack.Screen name="food-gallery" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="friends" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="companion-chat" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="companion-pfp" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'Settings' }} />
        <Stack.Screen name="coin-shop" options={{ presentation: 'modal', title: 'Get Coins' }} />
      </Stack.Protected>
    </Stack>
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
            <RootNavigator />
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
