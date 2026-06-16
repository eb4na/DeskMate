import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  claimActiveDevice,
  fetchActiveDevice,
  markKicked,
  resetKicked,
  subscribeActiveDevice,
} from '@/lib/cloud-sync';
import { getDeviceId } from '@/lib/device-id';
import { markGuestUpgradePending, clearGuestUpgradePending } from '@/lib/app-state-repository';
import { signInWithProvider, type OAuthResult } from '@/lib/oauth';
import { clearPersistedState } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

// Guest mode lives only in app state (no Supabase session), so it must be
// persisted ourselves — otherwise every relaunch/reload drops guests to login.
const GUEST_KEY = 'deskmate.guestMode';

type AuthContextType = {
  continueAsGuest: () => void;
  // Convert the current guest into a real account by signing in with Google. On
  // success their guest progress is migrated to the new account (see app-context).
  upgradeGuestWithGoogle: () => Promise<OAuthResult>;
  isGuest: boolean;
  initialized: boolean;
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
  // Permanently delete the account: wipes all server data (RPC, cascades) and the
  // local save, then signs out. Throws if the server delete fails.
  deleteAccount: () => Promise<void>;
  // Set when this device was signed out because the account logged in elsewhere.
  kickedReason: 'otherDevice' | null;
  clearKickedReason: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [kickedReason, setKickedReason] = useState<'otherDevice' | null>(null);

  // Tear-down for the realtime "kicked" subscription, and the id of the user it
  // belongs to, so we only re-claim when the signed-in user actually changes.
  const unsubRef = useRef<(() => void) | null>(null);
  const claimedUserRef = useRef<string | null>(null);
  // Polling fallback for the kick (realtime delivery is unreliable on RN): an
  // interval timer plus a one-shot check we can fire on foreground.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkActiveRef = useRef<(() => void) | null>(null);

  // Claim this device as the account's single active session, revoke the other
  // devices' sessions, and start listening for our own eviction. Safe to call
  // repeatedly — it no-ops once the current user is already claimed.
  async function claimSession(userId: string) {
    if (claimedUserRef.current === userId) return;
    // Mark claimed synchronously (before any await) so the two launch paths —
    // getSession() and onAuthStateChange(INITIAL_SESSION) — don't both claim and
    // leak a second realtime channel. The catch resets it so a failed claim retries.
    claimedUserRef.current = userId;
    try {
      const deviceId = await getDeviceId();
      resetKicked();
      await claimActiveDevice(userId, deviceId);
      // Revoke other devices server-side (does NOT fire SIGNED_OUT locally).
      // The realtime subscription below is what makes the kick instant.
      supabase.auth.signOut({ scope: 'others' }).catch(() => {});

      // Sign this device out because the account claimed another device. Shared
      // by the realtime subscription (instant) and the polling fallback.
      const doKick = () => {
        markKicked();
        setKickedReason('otherDevice');
        // Clearing the session flips the auth gate and routes us to login.
        supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      };

      unsubRef.current?.();
      unsubRef.current = subscribeActiveDevice(userId, deviceId, doKick);

      // Fallback: realtime postgres_changes is flaky on React Native, so also
      // poll the active device id and kick ourselves if we've been replaced.
      // This is what guarantees the kick even when realtime never delivers.
      checkActiveRef.current = async () => {
        const active = await fetchActiveDevice(userId);
        if (active && active !== deviceId) doKick();
      };
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => checkActiveRef.current?.(), 10000);
    } catch {
      // Offline / transient failure — leave unclaimed so the AppState handler
      // retries when we come back to the foreground (and/or get connectivity).
      claimedUserRef.current = null;
    }
  }

  function teardownSession() {
    unsubRef.current?.();
    unsubRef.current = null;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    checkActiveRef.current = null;
    claimedUserRef.current = null;
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        setSession(data.session);
        setIsGuest(false);
        AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
        void claimSession(data.session.user.id);
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
        void claimSession(nextSession.user.id);
      } else {
        teardownSession();
      }
      setInitialized(true);
    });

    // Retry an unfinished claim (e.g. login happened offline) when we return to
    // the foreground.
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      // Already claimed → just re-check whether we've since been replaced (so
      // returning to a stale device kicks it immediately, not after the poll).
      if (claimedUserRef.current) {
        checkActiveRef.current?.();
        return;
      }
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) void claimSession(data.session.user.id);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      appStateSub.remove();
      teardownSession();
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
      upgradeGuestWithGoogle: async () => {
        // Flag the upgrade BEFORE the OAuth round-trip so app-context can migrate
        // the guest's progress once the new session loads. On success,
        // onAuthStateChange flips us out of guest mode automatically.
        await markGuestUpgradePending();
        const res = await signInWithProvider('google');
        if (!res.ok) await clearGuestUpgradePending();
        return res;
      },
      isGuest,
      initialized,
      session,
      user: session?.user ?? null,
      kickedReason,
      clearKickedReason: () => setKickedReason(null),
      signOut: async () => {
        setIsGuest(false);
        AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
        teardownSession();

        if (!session) {
          return;
        }

        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
      deleteAccount: async () => {
        const userId = session?.user.id;
        // Server wipe first — the RPC deletes the auth user, which cascades and
        // removes profiles / user_state / friend_requests / direct_messages /
        // blocked_codes. Guests have no auth user, so skip the RPC for them.
        if (session) {
          const { error } = await supabase.rpc('delete_own_account');
          if (error) throw error;
        }
        // Local wipe: this account's save file + the app's AsyncStorage keys.
        setIsGuest(false);
        teardownSession();
        await clearPersistedState(userId ? `user_state_${userId}` : 'guest_state').catch(() => {});
        await AsyncStorage.multiRemove([GUEST_KEY, 'deskmate.pendingGuestUpgrade', 'deskmate.deviceId']).catch(() => {});
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      },
    }),
    [initialized, isGuest, session, kickedReason],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
