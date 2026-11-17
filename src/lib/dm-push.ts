// Push notifications for incoming friend DMs.
//
// Server side (supabase/migrations/20261113_dm_push_notifications.sql): every new
// direct_messages row fires a trigger that posts to Expo's push API for each of the
// recipient's registered tokens (skipped if the recipient blocked the sender).
// This file is the client half:
//  - registerDmPush(): get this device's Expo push token and claim it for the
//    signed-in user (register_push_token RPC). Only when notification permission is
//    ALREADY granted, unless `ask` — we request it in context (opening a chat),
//    never cold on launch.
//  - unregisterDmPush(): drop this device's token on sign-out, so the next account
//    on the phone doesn't get the previous one's messages.
//  - the currently open chat is tracked so a DM from that friend doesn't banner
//    while you're already reading the conversation.

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export const DM_CHANNEL_ID = 'direct-messages';

let lastToken: string | null = null;
let openChatCode: string | null = null;

/** Called by dm-chat on focus/blur. */
export function setOpenDmChat(code: string | null) {
  openChatCode = code ? code.toUpperCase() : null;
}

/** True when a DM notification is from the chat that's on screen right now. */
export function isDmFromOpenChat(data: unknown): boolean {
  const d = data as { kind?: string; fromCode?: string } | undefined;
  return !!(d?.kind === 'dm' && openChatCode && d.fromCode?.toUpperCase() === openChatCode);
}

export async function registerDmPush(lang: string, opts: { ask?: boolean } = {}): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) return; // guests have no account to receive DMs

    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && opts.ask && perm.canAskAgain) {
      perm = await Notifications.requestPermissionsAsync();
    }
    if (!perm.granted) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(DM_CHANNEL_ID, {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token) return;
    lastToken = token;

    // p_badge: this build keeps the icon badge in sync (setAppBadge), so the server
    // may put the unread count on its pushes. Older builds omit it → no badge, since
    // they could never clear one.
    await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS, p_lang: lang, p_badge: true });
  } catch {
    // No network / simulator without push / stale binary — DMs still work in-app.
  }
}

/**
 * Set the app-icon badge to the number of unread DMs. While the app is closed the
 * push itself carries the badge (server-side count); while it's open we keep it in
 * sync as chats are read. Needs badge permission — a no-op without it.
 */
export async function setAppBadge(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, Math.min(99, Math.floor(count))));
  } catch {
    // stale binary / no permission — the in-app red dot still shows unread
  }
}

export async function unregisterDmPush(): Promise<void> {
  // Signing out: this account's unread count no longer belongs on the icon.
  void setAppBadge(0);
  if (!lastToken) return;
  try {
    await supabase.from('push_tokens').delete().eq('token', lastToken);
  } catch {
    // best effort
  }
  lastToken = null;
}
