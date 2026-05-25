import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
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
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Finishing sign-in...');

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      if (typeof error_description === 'string' && error_description) {
        setStatus('error');
        setMessage(error_description);
        return;
      }

      if (typeof error_code === 'string' && error_code) {
        setStatus('error');
        setMessage(error_code);
        return;
      }

      if (typeof code !== 'string' || !code) {
        setStatus('error');
        setMessage('This sign-in link is missing its confirmation code.');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (cancelled) return;

      if (error) {
        setStatus('error');
        setMessage(error.message);
        return;
      }

      setStatus('success');
      if (type === 'recovery') {
        setMessage('Recovery link accepted. Choose your new password next.');
        setTimeout(() => router.replace('/reset-password'), 500);
        return;
      }

      setMessage('Your account is ready. Taking you back into DeskMate...');
      setTimeout(() => router.replace('/'), 500);
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
          {status === 'loading' ? <ActivityIndicator size="large" color="#7C6F5A" /> : null}
          <ThemedText type="subtitle" style={styles.title}>
            {status === 'success'
              ? 'Signed in'
              : status === 'error'
                ? 'Link issue'
                : 'Checking link'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
            {message}
          </ThemedText>

          {status === 'error' ? (
            <Pressable onPress={() => router.replace('/login')} style={styles.button}>
              <ThemedText type="smallBold" style={styles.buttonText}>
                Back to login
              </ThemedText>
            </Pressable>
          ) : null}
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
  button: {
    marginTop: Spacing.one,
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  buttonText: { color: '#FFF' },
});
