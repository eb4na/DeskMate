import AsyncStorage from '@react-native-async-storage/async-storage';
import { PostHog } from 'posthog-react-native';

// JSON-serialisable values PostHog accepts as event properties.
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type EventProps = Record<string, JsonValue>;

// Product analytics (PostHog). Entirely optional: if no key is configured the
// client stays null and every helper below is a safe no-op — analytics must
// never crash the app. Set EXPO_PUBLIC_POSTHOG_KEY in .env to enable it.
const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// We pass `customStorage: AsyncStorage` so PostHog persists via the same backend
// the rest of the app already uses, instead of pulling in the expo-file-system
// native module (which changed API on SDK 56 and would force a native rebuild).
export const posthog = apiKey
  ? new PostHog(apiKey, { host, customStorage: AsyncStorage, captureAppLifecycleEvents: true })
  : null;

// Allow-list of event names so capture sites stay consistent and typo-free.
export type AnalyticsEvent =
  | 'study_session_completed'
  | 'shop_purchase'
  | 'companion_chat_opened';

export function track(event: AnalyticsEvent, props?: EventProps) {
  posthog?.capture(event, props);
}

// Tie events to a signed-in account (call on login). Guests stay anonymous.
export function identifyUser(userId: string, props?: EventProps) {
  posthog?.identify(userId, props);
}

// Clear the identity on sign-out so the next account isn't merged into this one.
export function resetUser() {
  posthog?.reset();
}
