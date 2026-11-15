// "New update available" popup. On launch, asks the App Store (Apple's public
// lookup API — no backend) for Memobun's latest version; if it's newer than the
// installed one, shows the standard popup with "Update now" (opens the App Store
// page) and "Later" (silences it until the NEXT version ships). iOS release builds
// only; never in dev. Renders nothing itself — it waits behind every other launch
// popup (same gating as TicketRewardModal) and then calls showPopup, whose host
// already waits out the modal settle window.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { birthdayRewardAvailable, nextLoginReward, todayISO, useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { isLoadingActive, subscribeLoadingDone } from '@/lib/loading-signal';
import { showPopup } from '@/lib/popup';

const BUNDLE_ID = 'com.sophialin.memobun';
const DISMISSED_KEY = 'memobun_update_dismissed_version';

type StoreInfo = { version: string; url: string };

// One check + one popup per app launch (Home remounts this on every focus).
let checkedThisLaunch = false;

/** -1 / 0 / 1 comparing dotted numeric versions ("1.1.10" > "1.1.9"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

async function fetchStoreInfo(): Promise<StoreInfo | null> {
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}&_=${Date.now()}`);
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.results?.[0];
    if (!r?.version) return null;
    const url = r.trackId ? `itms-apps://apps.apple.com/app/id${r.trackId}` : r.trackViewUrl;
    return url ? { version: String(r.version), url } : null;
  } catch {
    return null; // offline / blocked — just skip this launch
  }
}

export function AppUpdatePrompt() {
  const { t } = useTranslation();
  const {
    exchangeTicketPending,
    hanjiUnlockPending, recipeBadgePending,
    legalAccepted, starterChosen,
    characterObtainedPending,
    loginRewardDate, streak, isPlus, streakFreezes, streakRescueDismissedDate,
    profileBirthday, birthdayRewardYear,
    streakRescuePending,
  } = useApp();

  const enabled = Platform.OS === 'ios' && !__DEV__;

  // Same arming as the reward popups: after the splash lifts, +1.5s.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => { timer = setTimeout(() => setArmed(true), 1500); };
    if (!isLoadingActive()) arm();
    const unsub = subscribeLoadingDone(arm);
    return () => { clearTimeout(timer); unsub(); };
  }, [enabled]);

  // Look up the store version in the background as soon as we mount.
  const [store, setStore] = useState<StoreInfo | null>(null);
  useEffect(() => {
    if (!enabled || checkedThisLaunch) return;
    let cancelled = false;
    (async () => {
      const installed = Constants.expoConfig?.version;
      const info = await fetchStoreInfo();
      if (cancelled || !info || !installed) return;
      if (compareVersions(info.version, installed) <= 0) return;
      let dismissed: string | null = null;
      try { dismissed = await AsyncStorage.getItem(DISMISSED_KEY); } catch {}
      if (dismissed === info.version) return;
      if (!cancelled) setStore(info);
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  const onboarded = legalAccepted && starterChosen;
  const dailyPending = nextLoginReward({ loginRewardDate, streak, isPlus, streakFreezes, streakRescueDismissedDate }, todayISO()).available;
  const birthdayPending = birthdayRewardAvailable({ profileBirthday, birthdayRewardYear }, todayISO());
  const ready = !!store && armed && onboarded && !characterObtainedPending && !hanjiUnlockPending
    && !recipeBadgePending && !dailyPending && !birthdayPending && !streakRescuePending && !exchangeTicketPending;

  useEffect(() => {
    if (!ready || !store || checkedThisLaunch) return;
    checkedThisLaunch = true;
    showPopup(t('appUpdate.title'), t('appUpdate.message'), [
      { text: t('appUpdate.updateNow'), onPress: () => { Linking.openURL(store.url).catch(() => {}); } },
      {
        text: t('appUpdate.later'),
        style: 'cancel',
        onPress: () => { AsyncStorage.setItem(DISMISSED_KEY, store.version).catch(() => {}); },
      },
    ]);
  }, [ready, store, t]);

  return null;
}
