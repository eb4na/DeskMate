import { Platform } from 'react-native';

// In-app purchases via RevenueCat (react-native-purchases). Like analytics.ts, this
// is written to FAIL CLOSED and never crash: the native module only exists in a
// rebuilt dev-client / TestFlight binary, and the API key is read from .env. If
// either is missing we treat purchases as "unavailable" and the UI must refuse to
// grant anything (see PURCHASES_READY). The ONLY exception is __DEV__, where we let
// the caller mock-grant so the app stays usable in Expo Go / pre-rebuild dev builds.
//
// Manual setup required to go live (none of this is code):
//   1. Create a RevenueCat account, add an iOS app, paste its public SDK key into
//      .env as EXPO_PUBLIC_REVENUECAT_IOS_KEY.
//   2. In App Store Connect create one IAP per PRODUCT_IDS below (consumables for the
//      coin packs, auto-renewing subs for "monthly" / "yearly"), with the EXACT
//      product IDs below. Submit them for review with the app build.
//   3. In RevenueCat: add the same products, and create an Entitlement whose
//      identifier is exactly PLUS_ENTITLEMENT ("Memobun Plus") attached to the two
//      subscription products. NOTE: the coin packs below do not exist in RevenueCat
//      yet — create them too, or coin-pack purchases will fail.
//   4. Rebuild the native client (EAS build / `expo run:ios`) — the JS-only current
//      build does NOT contain the StoreKit native module.

// App Store / RevenueCat product identifiers. These MUST match what you create in
// App Store Connect and RevenueCat exactly. Coin packs are consumables; the two
// plus.* products are auto-renewing subscriptions tied to the "plus" entitlement.
export const PRODUCT_IDS = {
  // coin packs — keyed by the CoinPack.id used in shop.tsx
  pouch: 'memobun.coins.pouch',
  bag: 'memobun.coins.bag',
  chest: 'memobun.coins.chest',
  vault: 'memobun.coins.vault',
  treasury: 'memobun.coins.treasury',
  // one-time Streak Freeze consumable
  streakFreeze: 'memobun.streakfreeze',
  // Memobun Plus subscription. These MUST match the App Store Connect subscription
  // Product IDs exactly (ASC IDs can't be renamed once created). The live App Store
  // subscriptions in the "Memobun Plus" group use the bare ids "monthly"/"yearly".
  plusMonthly: 'monthly',
  plusAnnual: 'yearly',
} as const;

// Must match the RevenueCat Entitlement identifier EXACTLY (case + spaces).
export const PLUS_ENTITLEMENT = 'Memobun Plus';

const apiKey = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : undefined;

// Lazily required so a missing native module (pre-rebuild) can't crash app start.
// Resolves to the react-native-purchases default export, or null if unavailable.
let Purchases: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Purchases = require('react-native-purchases').default;
} catch {
  Purchases = null;
}

let configured = false;

// True only when the native module is present AND an API key is set. The UI must
// check this before attempting any real purchase, and must NOT grant goods when
// it's false (except mock-grants gated behind __DEV__ at the call site).
export function purchasesReady(): boolean {
  return configured;
}

// Call once after auth is known. `appUserId` (the Supabase user id) ties purchases
// to the account so Plus follows the user across devices; omit for guests.
export async function configurePurchases(appUserId?: string): Promise<void> {
  if (configured || !Purchases || !apiKey) return;
  try {
    Purchases.configure(appUserId ? { apiKey, appUserID: appUserId } : { apiKey });
    configured = true;
  } catch {
    configured = false;
  }
}

export type PriceMap = Record<string, string>; // productId -> localized priceString

// Fetch localized prices for the given product IDs so the UI shows the store's real
// currency/amount instead of hardcoded "$1.00" strings. Returns {} when unavailable.
export async function fetchPrices(ids: string[]): Promise<PriceMap> {
  if (!configured || !Purchases) return {};
  try {
    const products = await Purchases.getProducts(ids);
    const map: PriceMap = {};
    for (const p of products) map[p.identifier] = p.priceString;
    return map;
  } catch {
    return {};
  }
}

export type PurchaseOutcome = { ok: boolean; cancelled: boolean };

// Buy a consumable coin pack by its App Store product id. Coins are granted by the
// CALLER on ok:true (consumables don't appear in entitlements).
export async function purchaseProduct(productId: string): Promise<PurchaseOutcome> {
  if (!configured || !Purchases) return { ok: false, cancelled: false };
  try {
    const products = await Purchases.getProducts([productId]);
    if (!products.length) return { ok: false, cancelled: false };
    await Purchases.purchaseStoreProduct(products[0]);
    return { ok: true, cancelled: false };
  } catch (e: any) {
    return { ok: false, cancelled: !!e?.userCancelled };
  }
}

// ISO expiry of the active "plus" entitlement, or null if not subscribed.
function plusExpiryFrom(customerInfo: any): string | null {
  const ent = customerInfo?.entitlements?.active?.[PLUS_ENTITLEMENT];
  if (!ent) return null;
  // expirationDate is null for lifetime entitlements; treat as far-future.
  return ent.expirationDate ?? new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
}

export type PlusOutcome = { ok: boolean; cancelled: boolean; until: string | null };

// Subscribe to Memobun Plus. On ok:true, `until` is the real entitlement expiry.
export async function purchasePlus(plan: 'monthly' | 'annual'): Promise<PlusOutcome> {
  if (!configured || !Purchases) return { ok: false, cancelled: false, until: null };
  const productId = plan === 'annual' ? PRODUCT_IDS.plusAnnual : PRODUCT_IDS.plusMonthly;
  try {
    const products = await Purchases.getProducts([productId]);
    if (!products.length) return { ok: false, cancelled: false, until: null };
    const { customerInfo } = await Purchases.purchaseStoreProduct(products[0]);
    const until = plusExpiryFrom(customerInfo);
    return { ok: !!until, cancelled: false, until };
  } catch (e: any) {
    return { ok: false, cancelled: !!e?.userCancelled, until: null };
  }
}

// Restore prior purchases (Apple-required for subscriptions). Returns the Plus
// expiry if the restored account has an active "plus" entitlement.
export async function restorePlus(): Promise<{ ok: boolean; until: string | null }> {
  if (!configured || !Purchases) return { ok: false, until: null };
  try {
    const customerInfo = await Purchases.restorePurchases();
    const until = plusExpiryFrom(customerInfo);
    return { ok: true, until };
  } catch {
    return { ok: false, until: null };
  }
}

// Read the current Plus entitlement without buying (call on launch to reconcile a
// cancellation/renewal that happened off-device). Returns undefined when unavailable
// so the caller can leave local Plus state untouched.
export async function currentPlusExpiry(): Promise<string | null | undefined> {
  if (!configured || !Purchases) return undefined;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return plusExpiryFrom(customerInfo);
  } catch {
    return undefined;
  }
}
