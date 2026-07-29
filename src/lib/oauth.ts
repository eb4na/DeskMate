// Google / Apple auth via Supabase OAuth + an in-app browser session.
//
// Flow: ask Supabase for the provider's authorize URL (skipBrowserRedirect so we
// drive the browser ourselves), open it with expo-web-browser, and when it
// redirects back to `deskmate://auth/callback?code=...` we exchange the PKCE code
// for a session. `signInWithProvider` creates/loads an account; `linkProvider`
// attaches the provider identity to the *currently signed-in* user ("connect").
//
// External setup required (one-time, in dashboards — not code):
//   • Supabase → Authentication → Providers: enable Google and Apple, fill in
//     their client id/secret, and add `deskmate://auth/callback` to the allowed
//     Redirect URLs.
//   • Google Cloud: an OAuth 2.0 Web client (used by Supabase).
//   • Apple Developer: a Services ID + Sign in with Apple key.
//   • For `linkProvider`, enable "Manual linking" in Supabase auth settings.

import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import type { Provider } from '@supabase/supabase-js';

import { supabase, authCallbackUrl } from '@/lib/supabase';

// Google Cloud OAuth client IDs (NOT secrets — they ship in the app binary). The
// WEB client id is the one Supabase already knows (Google provider config); the
// native iOS sign-in returns an id token whose audience is the iOS client id, so
// both must be added to the Supabase Google provider's Authorized Client IDs.
// When these are unset we fall back to the web OAuth flow, so Google keeps working
// until the native path is fully configured.
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleNativeConfigured = !!GOOGLE_WEB_CLIENT_ID && !!GOOGLE_IOS_CLIENT_ID;

// The @react-native-google-signin native module is loaded LAZILY (require inside
// the sign-in fn), never at import time. This keeps a dev binary that predates the
// pod from red-screening ("Cannot find native module") just for importing this
// file — the module is only touched once Google native is actually configured+used.
type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');
let googleModule: GoogleSigninModule | null = null;
function getGoogleModule(): GoogleSigninModule {
  if (googleModule) return googleModule;
  const mod: GoogleSigninModule = require('@react-native-google-signin/google-signin');
  mod.GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });
  googleModule = mod;
  return mod;
}

export type OAuthResult = { ok: boolean; cancelled?: boolean; error?: string; alreadyLinked?: boolean };

type UrlResult = { url: string | null; error: { message: string } | null };

// Supabase reports a provider identity that already belongs to a different user
// (e.g. linking Google when that Google is on another Memobun account) with a
// message/code like "Identity is already linked to another user" /
// "identity_already_exists". Detect it so the UI can give a clear popup.
function isAlreadyLinked(msg?: string | null): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes('identity_already_exists') ||
    (m.includes('already') &&
      (m.includes('linked') || m.includes('registered') || m.includes('associated') || m.includes('exists')))
  );
}

// The iOS consent alert ("Memobun" Wants to Use "…" to Sign In) shows the host of
// the FIRST url the auth session opens — the raw <project>.supabase.co domain looks
// wrong to players. So the session starts on our own domain: memobun.app/auth
// instantly forwards to the Supabase authorize URL carried in the #fragment (the
// page refuses anything outside our Supabase /auth/v1/ path, so it isn't an open
// redirect). Redirects after that first page don't change the alert text.
function brandAuthUrl(url: string): string {
  return `https://memobun.app/auth#${encodeURIComponent(url)}`;
}

async function runOAuth(getUrl: () => Promise<UrlResult>): Promise<OAuthResult> {
  const { url, error } = await getUrl();
  if (error) return { ok: false, error: error.message, alreadyLinked: isAlreadyLinked(error.message) };
  if (!url) return { ok: false, error: 'No sign-in URL was returned.' };

  // Opens the provider's login in a secure in-app browser and resolves once it
  // redirects back to our scheme (or the user cancels).
  const result = await WebBrowser.openAuthSessionAsync(brandAuthUrl(url), authCallbackUrl);
  if (result.type === 'cancel' || result.type === 'dismiss') return { ok: false, cancelled: true };
  if (result.type !== 'success' || !result.url) return { ok: false, error: 'Sign-in was not completed.' };

  const back = new URL(result.url);
  const errDesc = back.searchParams.get('error_description');
  if (errDesc) return { ok: false, error: errDesc, alreadyLinked: isAlreadyLinked(errDesc) };

  const code = back.searchParams.get('code');
  if (!code) return { ok: false, error: 'No authorization code was returned.' };

  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) return { ok: false, error: exErr.message, alreadyLinked: isAlreadyLinked(exErr.message) };
  return { ok: true };
}

// Native Sign in with Apple: shows the system sheet instead of a web session, so
// iOS never displays the "…supabase.co wants to sign in" consent prompt. We hand
// Apple's identity token straight to Supabase (signInWithIdToken), which verifies
// it against Apple's keys. No nonce: Supabase's native Apple verifier doesn't use
// one, and a nonce sent to Apple but not matched here fails verification.
//
// Requires (one-time, Supabase dashboard): the app's bundle id
// `com.sophialin.memobun` added to the Apple provider's Client IDs list, ALONGSIDE
// the existing Services ID (the web/link flow still needs the Services ID). The
// native token's audience is the bundle id, so without it verification fails with
// an audience-mismatch error.
async function signInWithAppleNative(): Promise<OAuthResult> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e) {
    // User dismissed the Apple sheet (or it was canceled) — treat as a cancel, not
    // an error, so the UI stays quiet.
    if (e instanceof Error && 'code' in e && (e as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      return { ok: false, cancelled: true };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  if (!credential.identityToken) return { ok: false, error: 'Apple did not return an identity token.' };

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) return { ok: false, error: error.message, alreadyLinked: isAlreadyLinked(error.message) };
  return { ok: true };
}

// Native Google sign-in: shows the system Google account picker instead of a web
// session, so there's no "…supabase.co wants to sign in" prompt. We hand Google's
// id token to Supabase (signInWithIdToken). Only runs when both client ids are set
// (see GOOGLE_*_CLIENT_ID); otherwise the caller uses the web flow.
async function signInWithGoogleNative(): Promise<OAuthResult> {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = getGoogleModule();
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { ok: false, cancelled: true };

    const idToken = response.data.idToken;
    if (!idToken) return { ok: false, error: 'Google did not return an id token.' };

    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) return { ok: false, error: error.message, alreadyLinked: isAlreadyLinked(error.message) };
    return { ok: true };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
      return { ok: false, cancelled: true };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Native Google id-token sign-in is DISABLED. Confirmed empirically (2026-07-07):
// on iOS the GoogleSignIn SDK always stamps a fresh `nonce` claim into the id token
// (a different value every sign-in, even after signOut), but @react-native-google-
// signin v16 exposes no way to set or read that nonce — so we can never pass the
// matching value to supabase.auth.signInWithIdToken, and Supabase rejects the token
// ("Passed nonce and nonce in id_token should either both exist or not"). Until the
// library supports a nonce, Google uses the web OAuth flow (Supabase owns the nonce
// end-to-end there, so it just works). Apple native is unaffected — its verifier
// doesn't use a nonce. Flip this to re-enable native Google if the lib gains support.
const GOOGLE_NATIVE_ENABLED = false;

/** Sign in (or sign up) with a social provider. */
export function signInWithProvider(provider: Provider): Promise<OAuthResult> {
  // Apple on iOS uses its native sheet (no supabase.co web prompt). Google and
  // everything else fall back to the web OAuth flow (see GOOGLE_NATIVE_ENABLED).
  if (provider === 'apple' && Platform.OS === 'ios') {
    return AppleAuthentication.isAvailableAsync().then((available) =>
      available ? signInWithAppleNative() : webSignInWithProvider(provider),
    );
  }
  if (provider === 'google' && Platform.OS === 'ios' && googleNativeConfigured && GOOGLE_NATIVE_ENABLED) {
    return signInWithGoogleNative();
  }
  return webSignInWithProvider(provider);
}

// Google reuses whatever account already has a session in the auth browser and
// signs straight in with it — the account chooser never appears, so anyone with
// two Google accounts is stuck on whichever they used first, with no way to
// switch from inside the app. `prompt=select_account` makes Google show the
// picker every time; an already-signed-in account is still one tap, so this
// costs nothing for the common case. Google-only: Apple's web flow takes no
// `prompt` parameter, and sending one risks an invalid_request.
function providerQueryParams(provider: Provider): Record<string, string> | undefined {
  return provider === 'google' ? { prompt: 'select_account' } : undefined;
}

function webSignInWithProvider(provider: Provider): Promise<OAuthResult> {
  return runOAuth(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: authCallbackUrl,
        skipBrowserRedirect: true,
        queryParams: providerQueryParams(provider),
      },
    });
    return { url: data?.url ?? null, error };
  });
}

/** Connect a social provider to the account that is already signed in. */
export function linkProvider(provider: Provider): Promise<OAuthResult> {
  return runOAuth(async () => {
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo: authCallbackUrl,
        skipBrowserRedirect: true,
        // Same reason as sign-in: without this, "connect Google" silently links
        // whichever account the browser already holds, with no chance to pick.
        queryParams: providerQueryParams(provider),
      },
    });
    return { url: (data as { url?: string } | null)?.url ?? null, error };
  });
}
