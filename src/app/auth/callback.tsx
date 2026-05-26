import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const { code, type, error_description, error_code } = useLocalSearchParams<{
    code?: string;
    type?: string;
    error_description?: string;
    error_code?: string;
  }>();

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      if (typeof error_description === 'string' && error_description) {
        router.replace('/login');
        return;
      }

      if (typeof error_code === 'string' && error_code) {
        router.replace('/login');
        return;
      }

      if (typeof code !== 'string' || !code) {
        router.replace('/login');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (cancelled) return;

      if (error) {
        router.replace('/login');
        return;
      }

      if (type === 'recovery') {
        router.replace('/reset-password');
        return;
      }

      router.replace('/');
    }

    completeAuth();

    return () => {
      cancelled = true;
    };
  }, [code, error_code, error_description, type]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ActivityIndicator size="large" color="#7C6F5A" />
          <ThemedText type="subtitle" style={styles.title}>
            Checking link
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
            Taking you to the right screen...
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderRadius: 20,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  title: { textAlign: 'center' },
  message: { textAlign: 'center', lineHeight: 20 },
});
