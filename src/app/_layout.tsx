import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppProvider } from '@/context/app-context';
import { useApp } from '@/context/app-context';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { Spacing } from '@/constants/theme';
import '@/lib/notifications';

function RootNavigator() {
  const { initialized, isGuest, session } = useAuth();
  const { loaded } = useApp();

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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Session flow */}
        <Stack.Screen name="session-picker" options={{ presentation: 'modal', title: 'Session length' }} />
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
        {/* Wave 4 */}
        <Stack.Screen name="plus-upgrade" options={{ presentation: 'modal', title: 'DeskMate Plus' }} />
        <Stack.Screen name="custom-timer" options={{ presentation: 'modal', title: 'Custom Timer' }} />
        <Stack.Screen name="ambience-picker" options={{ presentation: 'modal', title: 'Ambience' }} />
        <Stack.Screen name="companion-gallery" options={{ presentation: 'modal', title: 'Companion Gallery' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'Settings' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <AppProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <RootNavigator />
        </ThemeProvider>
      </AppProvider>
    </AuthProvider>
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
