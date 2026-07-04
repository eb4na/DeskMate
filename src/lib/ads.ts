import { Platform } from 'react-native';

// Rewarded video ads via Google AdMob (react-native-google-mobile-ads). Like
// purchases.ts / analytics.ts this is written to FAIL CLOSED and never crash: the
// native module only exists in a rebuilt dev-client / TestFlight binary, and the ad
// unit id is read from .env. If either is missing we treat ads as "unavailable" and
// the UI must REFUSE to grant coins in production (only __DEV__ may mock-grant so the
// app stays usable in Expo Go pre-rebuild). Coins for a rewarded ad are granted ONLY
// when the real EARNED_REWARD callback fires — never on button press, never if no ad
// loaded. Getting that backwards hands out free coins.
//
// SETUP (already done — recorded here for reference):
//   - AdMob app "Memobun" (iOS). App ID is in app.json's react-native-google-mobile-
//     ads plugin (`iosAppId`); the Rewarded ad unit id is EXPO_PUBLIC_ADMOB_REWARDED_IOS
//     in .env.
//   - app.json also configures expo-tracking-transparency (ATT prompt copy).
//   - Requires a native rebuild (EAS build / `expo run:ios`) to ship — the JS bundle
//     alone does not contain the AdMob native module.
//   - Android app "Memobun Android". App ID in app.json plugin (`androidAppId`); the
//     Rewarded ad unit id is EXPO_PUBLIC_ADMOB_REWARDED_ANDROID in .env.

// How much a single rewarded ad pays out, and how many can be watched per day. The
// per-day limit is enforced in app-context (claimAdReward), reset at the account-
// timezone midnight like earnedToday.
export const AD_REWARD_COINS = 100;
export const DAILY_AD_LIMIT = 3;

// How long to wait for an ad to load before giving up (so a hung load() can't leave
// the await hanging forever with no popup).
const LOAD_TIMEOUT_MS = 12000;
// SDK init (ATT prompt + initialize()) can hang on the simulator or when the native
// module isn't actually in the running binary — and it's awaited BEFORE the load
// timeout below, so an unbounded hang here freezes the whole flow with zero feedback
// ("nothing happens" on tap). Cap it so we always fall through to the load path,
// which has its own timeout and reports `unavailable`.
const INIT_TIMEOUT_MS = 5000;

// The production rewarded ad unit id, per platform. In __DEV__ we always swap in
// Google's TEST unit id below — showing real ads to yourself is an AdMob ban risk.
const adUnitId =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS
    : Platform.OS === 'android'
      ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID
      : undefined;

// Lazily required so a missing native module (pre-rebuild / Expo Go) can't crash app
// start. Resolves to null when unavailable.
let GoogleMobileAds: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  GoogleMobileAds = require('react-native-google-mobile-ads');
} catch {
  GoogleMobileAds = null;
}

let ATT: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ATT = require('expo-tracking-transparency');
} catch {
  ATT = null;
}

let initPromise: Promise<void> | null = null;
// Whether the user allowed tracking (personalized ads pay more). Defaults to false →
// non-personalized, which is the privacy-safe and policy-compliant fallback.
let trackingAllowed = false;

// True only when the native module is present AND an ad unit id is configured. The UI
// must check this before attempting a real ad and must NOT grant coins when it is
// false (except the __DEV__ mock path in coin-shop). In __DEV__ a TEST unit id is
// always available, so only the native module needs to exist.
export function adsReady(): boolean {
  if (GoogleMobileAds == null) return false;
  return __DEV__ || !!adUnitId;
}

// The unit id to request: Google's test id in dev, the real one in production.
function activeUnitId(): string | undefined {
  if (__DEV__) return GoogleMobileAds?.TestIds?.REWARDED;
  return adUnitId;
}

// Ask for App Tracking Transparency once (iOS), then initialize the SDK once. Both
// are memoized so repeat ad requests don't re-prompt or re-init.
function ensureInit(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      if (ATT?.requestTrackingPermissionsAsync) {
        const { status } = await ATT.requestTrackingPermissionsAsync();
        trackingAllowed = status === 'granted';
      }
    } catch {
      trackingAllowed = false;
    }
    try {
      await GoogleMobileAds.default().initialize();
    } catch {
      // leave SDK uninitialized; showRewardedAd will report unavailable
    }
  })();
  return initPromise;
}

export type AdResult = { rewarded: boolean; unavailable?: boolean };

// Loads and presents a single rewarded ad. Resolves { rewarded: true } only after the
// SDK's EARNED_REWARD callback fires. Resolves { unavailable: true } when ads aren't
// configured, the load times out, or no ad could be shown — the caller treats that the
// same as a failed purchase (dev mock-grants, prod refuses).
export async function showRewardedAd(): Promise<AdResult> {
  if (!adsReady()) return { rewarded: false, unavailable: true };
  const unitId = activeUnitId();
  if (!unitId) return { rewarded: false, unavailable: true };
  try {
    // Never let a hung init (missing native module / stalled ATT prompt on the sim)
    // block forever — race it against a timeout, then proceed to load() regardless.
    await Promise.race([
      ensureInit(),
      new Promise<void>((r) => setTimeout(r, INIT_TIMEOUT_MS)),
    ]);
    const { RewardedAd, RewardedAdEventType, AdEventType } = GoogleMobileAds;
    const ad = RewardedAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: !trackingAllowed,
    });

    return await new Promise<AdResult>((resolve) => {
      let earned = false;
      let settled = false;
      const finish = (r: AdResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(r);
      };
      // Safety net: if neither LOADED nor ERROR ever fires, don't hang forever.
      const timer = setTimeout(
        () => finish({ rewarded: false, unavailable: true }),
        LOAD_TIMEOUT_MS,
      );

      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        try {
          ad.show();
        } catch {
          finish({ rewarded: false, unavailable: true });
        }
      });
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      });
      ad.addAdEventListener(AdEventType.CLOSED, () => finish({ rewarded: earned }));
      ad.addAdEventListener(AdEventType.ERROR, () =>
        finish({ rewarded: false, unavailable: true }),
      );

      ad.load();
    });
  } catch {
    return { rewarded: false, unavailable: true };
  }
}
