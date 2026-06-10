import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

// Guest mode lives only in app state (no Supabase session), so it must be
// persisted ourselves — otherwise every relaunch/reload drops guests to login.
const GUEST_KEY = 'deskmate.guestMode';

type AuthContextType = {
  continueAsGuest: () => void;
  isGuest: boolean;
  initialized: boolean;
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        setSession(data.session);
        setIsGuest(false);
        AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
      } else {
        // No Supabase session — restore guest mode if it was chosen before.
        const guest = await AsyncStorage.getItem(GUEST_KEY).catch(() => null);
        if (!mounted) return;
        setSession(null);
        setIsGuest(guest === 'true');
      }
      setInitialized(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setIsGuest(false);
        AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
      }
      setInitialized(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      continueAsGuest: () => {
        setSession(null);
        setIsGuest(true);
        setInitialized(true);
        AsyncStorage.setItem(GUEST_KEY, 'true').catch(() => {});
      },
      isGuest,
      initialized,
      session,
      user: session?.user ?? null,
      signOut: async () => {
        setIsGuest(false);
        AsyncStorage.removeItem(GUEST_KEY).catch(() => {});

        if (!session) {
          return;
        }

        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [initialized, isGuest, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
