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

import * as WebBrowser from 'expo-web-browser';
import type { Provider } from '@supabase/supabase-js';

import { supabase, authCallbackUrl } from '@/lib/supabase';

export type OAuthResult = { ok: boolean; cancelled?: boolean; error?: string };

type UrlResult = { url: string | null; error: { message: string } | null };

async function runOAuth(getUrl: () => Promise<UrlResult>): Promise<OAuthResult> {
  const { url, error } = await getUrl();
  if (error) return { ok: false, error: error.message };
  if (!url) return { ok: false, error: 'No sign-in URL was returned.' };

  // Opens the provider's login in a secure in-app browser and resolves once it
  // redirects back to our scheme (or the user cancels).
  const result = await WebBrowser.openAuthSessionAsync(url, authCallbackUrl);
  if (result.type === 'cancel' || result.type === 'dismiss') return { ok: false, cancelled: true };
  if (result.type !== 'success' || !result.url) return { ok: false, error: 'Sign-in was not completed.' };

  const back = new URL(result.url);
  const errDesc = back.searchParams.get('error_description');
  if (errDesc) return { ok: false, error: errDesc };

  const code = back.searchParams.get('code');
  if (!code) return { ok: false, error: 'No authorization code was returned.' };

  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) return { ok: false, error: exErr.message };
  return { ok: true };
}

/** Sign in (or sign up) with a social provider. */
export function signInWithProvider(provider: Provider): Promise<OAuthResult> {
  return runOAuth(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authCallbackUrl, skipBrowserRedirect: true },
    });
    return { url: data?.url ?? null, error };
  });
}

/** Connect a social provider to the account that is already signed in. */
export function linkProvider(provider: Provider): Promise<OAuthResult> {
  return runOAuth(async () => {
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: authCallbackUrl, skipBrowserRedirect: true },
    });
    return { url: (data as { url?: string } | null)?.url ?? null, error };
  });
}
