import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { getCompanionImage } from '@/lib/companion-utils';
import { showPopup } from '@/lib/popup';
import { supabase } from '@/lib/supabase';
import {
  becomeFriends,
  cancelMatching,
  CHEER_KINDS,
  fetchCheers,
  findBuddy,
  getActivePair,
  getBuddyStatus,
  leaveBuddy,
  reportBuddy,
  sendCheer,
  type BuddyStatus,
  type CheerKind,
} from '@/lib/study-buddy';
import { ROOM_PAIRS } from '@/constants/room-data';
import { useTranslation } from '@/i18n';
import { Spacing } from '@/constants/theme';
import { useTabletScale } from '@/hooks/use-tablet-scale';

const P = {
  cream: '#FFF8EF',
  card: '#FFFDF8',
  pink: '#F7A7B8',
  pinkSoft: '#FBD9E0',
  peach: '#F4C5A8',
  brown: '#5B3A2E',
  mutedBrown: '#9A7B6D',
  green: '#5BC47B',
} as const;

type View_ = 'loading' | 'intro' | 'waiting' | 'matched';

// Whole days left until the pairing dissolves (ceil so "ends in 6h" still reads "1 day").
function daysLeft(endsAt: string): number {
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export default function StudyBuddyScreen() {
  const { t } = useTranslation();
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  const { addFriend } = useApp();
  const { user, isGuest } = useAuth();

  const [view, setView] = useState<View_>('loading');
  const [pairId, setPairId] = useState<string | null>(null);
  const [status, setStatus] = useState<BuddyStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [cheered, setCheered] = useState(false); // cheered this session (button feedback)
  const [latestCheer, setLatestCheer] = useState<CheerKind | null>(null); // newest cheer FROM the buddy
  const [errorText, setErrorText] = useState<string | null>(null); // visible inline failure reason
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Newest cheer the partner sent me (cheers I sent are ignored). Surfaced as a banner.
  const loadCheers = useCallback(
    async (id: string) => {
      const cheers = await fetchCheers(id);
      const fromBuddy = cheers.find((c) => c.fromUser !== user?.id);
      setLatestCheer(fromBuddy ? fromBuddy.kind : null);
    },
    [user?.id],
  );

  const loadStatus = useCallback(
    async (id: string) => {
      const s = await getBuddyStatus(id);
      if (s && s.pairStatus === 'ended') {
        // Buddy went inactive / week ended / they left — drop back to the intro and
        // tell the user why (so a vanished buddy isn't a confusing silent reset).
        setStatus(null);
        setPairId(null);
        setView('intro');
        if (s.endedReason === 'ghost') {
          showPopup(t('studyBuddy.endedTitle'), t('studyBuddy.endedGhost'));
        } else if (s.endedReason === 'expired') {
          showPopup(t('studyBuddy.endedTitle'), t('studyBuddy.endedExpired'));
        } else if (s.endedReason === 'left') {
          showPopup(t('studyBuddy.endedTitle'), t('studyBuddy.endedLeft'));
        }
        return;
      }
      setStatus(s);
      loadCheers(id);
    },
    [loadCheers, t],
  );

  // On open: do I already have an active buddy?
  useEffect(() => {
    if (!user?.id) {
      setView('intro');
      return;
    }
    (async () => {
      const pair = await getActivePair(user.id);
      if (pair) {
        setPairId(pair.pairId);
        await loadStatus(pair.pairId);
        setView('matched');
      } else {
        setView('intro');
      }
    })();
  }, [user?.id, loadStatus]);

  // Live channel for the active pair: re-pull status when the buddy cheers or
  // updates. Lightweight broadcast ping → re-fetch the authoritative status.
  useEffect(() => {
    if (!pairId) return;
    const ch = supabase.channel(`buddy:${pairId}`);
    ch.on('broadcast', { event: 'ping' }, () => loadStatus(pairId)).subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [pairId, loadStatus]);

  const handleFind = async () => {
    setBusy(true);
    setErrorText(null);
    let res: Awaited<ReturnType<typeof findBuddy>>;
    try {
      res = await findBuddy();
    } catch (e) {
      setBusy(false);
      setErrorText(`Request failed: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    setBusy(false);
    if (res.status === 'matched') {
      setPairId(res.pairId);
      await loadStatus(res.pairId);
      setView('matched');
    } else if (res.status === 'waiting') {
      setView('waiting');
    } else {
      const msg =
        res.error === 'birthday'
          ? t('studyBuddy.errorBirthday')
          : res.error === 'restricted'
            ? t('studyBuddy.errorRestricted')
            : t('studyBuddy.errorGeneric');
      // Show the friendly message + the raw server reason inline so failures are never silent.
      setErrorText(res.raw && res.error === 'generic' ? `${msg}\n(${res.raw})` : msg);
      showPopup(t('studyBuddy.couldNotMatch'), msg);
    }
  };

  const handleCancel = async () => {
    if (user?.id) await cancelMatching(user.id);
    setView('intro');
  };

  // While waiting, re-poll for a match every few seconds.
  useEffect(() => {
    if (view !== 'waiting') return;
    const timer = setInterval(async () => {
      const res = await findBuddy();
      if (res.status === 'matched') {
        setPairId(res.pairId);
        await loadStatus(res.pairId);
        setView('matched');
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [view, loadStatus]);

  const handleCheer = async (kind: CheerKind) => {
    if (!pairId || cheered) return;
    const ok = await sendCheer(pairId, kind);
    if (ok) {
      setCheered(true);
      channelRef.current?.send({ type: 'broadcast', event: 'ping', payload: {} });
    } else {
      showPopup(t('studyBuddy.alreadyCheered'), t('studyBuddy.alreadyCheeredMsg'));
    }
  };

  const handleBecomeFriends = async () => {
    if (!pairId) return;
    setBusy(true);
    const res = await becomeFriends(pairId);
    setBusy(false);
    channelRef.current?.send({ type: 'broadcast', event: 'ping', payload: {} });
    if (res.both && res.partnerCode) {
      addFriend(res.partnerCode);
      showPopup(t('studyBuddy.nowFriends'), t('studyBuddy.nowFriendsMsg', { code: res.partnerCode }));
    } else {
      showPopup(t('studyBuddy.friendRequested'), t('studyBuddy.friendRequestedMsg'));
    }
    await loadStatus(pairId);
  };

  const handleLeave = () => {
    showPopup(t('studyBuddy.leaveQ'), t('studyBuddy.leaveMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('studyBuddy.leave'),
        style: 'destructive',
        onPress: async () => {
          if (pairId) await leaveBuddy(pairId);
          channelRef.current?.send({ type: 'broadcast', event: 'ping', payload: {} });
          setStatus(null);
          setPairId(null);
          setView('intro');
        },
      },
    ]);
  };

  const handleReport = () => {
    const reasons: { key: string; label: string }[] = [
      { key: 'inappropriate', label: t('studyBuddy.reportInappropriate') },
      { key: 'harassment', label: t('studyBuddy.reportHarassment') },
      { key: 'spam', label: t('studyBuddy.reportSpam') },
    ];
    showPopup(t('studyBuddy.reportQ'), t('studyBuddy.reportMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      ...reasons.map((r) => ({
        text: r.label,
        style: 'destructive' as const,
        onPress: async () => {
          if (pairId) await reportBuddy(pairId, r.key);
          channelRef.current?.send({ type: 'broadcast', event: 'ping', payload: {} });
          setStatus(null);
          setPairId(null);
          setView('intro');
          showPopup(t('studyBuddy.reportThanks'), t('studyBuddy.reportThanksMsg'));
        },
      })),
    ]);
  };

  // ── Guest gate ──
  if (isGuest) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: P.cream }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerWrap}>
            <Text style={styles.bigTitle}>{t('studyBuddy.guestGateTitle')}</Text>
            <Text style={styles.body}>{t('studyBuddy.guestGateBody')}</Text>
            <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={() => router.back()}>
              <Text style={styles.primaryBtnText}>{t('common.done')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: P.cream }]}>
      <View style={styles.dragHandleArea} pointerEvents="none">
        <View style={styles.dragHandle} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: P.cream }}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.headerPanel}>
            <Text style={styles.headerTitle}>{t('studyBuddy.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('studyBuddy.subtitle')}</Text>
          </View>

          {view === 'loading' && (
            <View style={styles.centerWrap}>
              <ActivityIndicator color={P.pink} />
            </View>
          )}

          {view === 'intro' && (
            <>
              <View style={styles.introCard}>
                <Text style={styles.introTitle}>{t('studyBuddy.introTitle')}</Text>
                <Text style={styles.introBody}>{t('studyBuddy.introBody')}</Text>
                <View style={styles.safetyNote}>
                  <Text style={styles.safetyText}>{t('studyBuddy.safetyNote')}</Text>
                </View>
              </View>
              {errorText && (
                <View style={styles.errorCard}>
                  <Text style={styles.errorCardText}>{errorText}</Text>
                </View>
              )}
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, (pressed || busy) && styles.pressed]}
                disabled={busy}
                onPress={handleFind}>
                <Text style={styles.primaryBtnText}>{busy ? '…' : t('studyBuddy.findBuddy')}</Text>
              </Pressable>
            </>
          )}

          {view === 'waiting' && (
            <View style={styles.centerWrap}>
              <ActivityIndicator color={P.pink} size="large" />
              <Text style={styles.bigTitle}>{t('studyBuddy.lookingTitle')}</Text>
              <Text style={styles.body}>{t('studyBuddy.lookingBody')}</Text>
              <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} onPress={handleCancel}>
                <Text style={styles.secondaryBtnText}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          )}

          {view === 'matched' && status && (
            <>
              {/* Buddy card — companion + name + streak + studied-today. No code, no chat. */}
              {(() => {
                const bg = ROOM_PAIRS.find((r) => r.id === status.partnerBackground) ?? ROOM_PAIRS[0];
                return (
                  <View style={styles.buddyCard}>
                    <View style={styles.buddyScene}>
                      <Image source={bg.backgroundImage} style={StyleSheet.absoluteFill} contentFit="cover" />
                      <Image
                        source={getCompanionImage(status.partnerCompanion, status.partnerSkin)}
                        style={styles.buddyFig}
                        contentFit="contain"
                      />
                    </View>
                    <Text style={styles.buddyName}>{status.partnerName || t('studyBuddy.buddyFallback')}</Text>
                    <Text style={styles.buddyStreak}>{t('studyBuddy.streakLabel', { count: status.partnerStreak })}</Text>
                    <Text style={styles.daysLeft}>{t('studyBuddy.daysLeft', { count: daysLeft(status.endsAt) })}</Text>
                  </View>
                );
              })()}

              {/* Studied-today check-in */}
              <View style={[styles.checkCard, status.partnerStudiedToday ? styles.checkYes : styles.checkNo]}>
                <View style={[styles.checkBadge, status.partnerStudiedToday ? styles.checkBadgeYes : styles.checkBadgeNo]}>
                  <Text style={styles.checkBadgeText}>{status.partnerStudiedToday ? '✓' : '–'}</Text>
                </View>
                <Text style={styles.checkText}>
                  {status.partnerStudiedToday
                    ? t('studyBuddy.studiedYes', { name: status.partnerName || t('studyBuddy.buddyFallback') })
                    : t('studyBuddy.studiedNo', { name: status.partnerName || t('studyBuddy.buddyFallback') })}
                </Text>
              </View>

              {/* A cheer the buddy sent me */}
              {latestCheer && (
                <View style={styles.cheerBanner}>
                  <Text style={styles.cheerBannerText}>
                    {t('studyBuddy.buddyCheered', {
                      name: status.partnerName || t('studyBuddy.buddyFallback'),
                      cheer: t(`studyBuddy.cheer.${latestCheer}`),
                    })}
                  </Text>
                </View>
              )}

              {/* Canned cheers */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('studyBuddy.sendCheer')}</Text>
                <View style={styles.cheerWrap}>
                  {CHEER_KINDS.map((k) => (
                    <Pressable
                      key={k}
                      disabled={cheered}
                      style={({ pressed }) => [styles.cheerBtn, (pressed || cheered) && styles.cheerBtnDisabled]}
                      onPress={() => handleCheer(k)}>
                      <Text style={styles.cheerBtnText}>{t(`studyBuddy.cheer.${k}`)}</Text>
                    </Pressable>
                  ))}
                </View>
                {cheered && <Text style={styles.cheerSent}>{t('studyBuddy.cheerSent')}</Text>}
              </View>

              {/* Become friends (mutual) */}
              <Pressable
                style={({ pressed }) => [styles.friendBtn, (pressed || busy || status.iWantFriend) && styles.pressed]}
                disabled={busy || status.iWantFriend}
                onPress={handleBecomeFriends}>
                <Text style={styles.friendBtnText}>
                  {status.iWantFriend ? t('studyBuddy.friendPending') : t('studyBuddy.becomeFriends')}
                </Text>
              </Pressable>

              {/* Report / leave */}
              <View style={styles.dangerRow}>
                <Pressable style={({ pressed }) => [styles.dangerBtn, pressed && styles.pressed]} onPress={handleReport}>
                  <Text style={styles.dangerBtnText}>{t('studyBuddy.report')}</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.dangerBtn, pressed && styles.pressed]} onPress={handleLeave}>
                  <Text style={styles.dangerBtnText}>{t('studyBuddy.leave')}</Text>
                </Pressable>
              </View>
            </>
          )}

          <Pressable style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>{t('common.done')}</Text>
          </Pressable>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const makeStyles = (s: number, contentWidth: number) =>
  StyleSheet.create({
    container: { flex: 1 },
    safeArea: {
      padding: Spacing.four * s,
      maxWidth: contentWidth,
      width: '100%',
      alignSelf: 'center',
      gap: Spacing.four * s,
      backgroundColor: P.cream,
    },
    dragHandleArea: { alignItems: 'center', paddingTop: 10 * s, paddingBottom: 2 * s },
    dragHandle: { width: 36 * s, height: 4 * s, borderRadius: 2 * s, backgroundColor: 'rgba(91,58,46,0.18)' },

    headerPanel: {
      backgroundColor: P.card,
      borderRadius: 26 * s,
      paddingVertical: Spacing.four * s,
      paddingHorizontal: Spacing.four * s,
      borderWidth: 1.5,
      borderColor: P.peach,
      alignItems: 'center',
      gap: 4 * s,
      shadowColor: '#C9A18A',
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
    headerTitle: { fontSize: 22 * s, fontWeight: '800', color: P.brown, letterSpacing: 0.2 },
    headerSubtitle: { fontSize: 13 * s, color: P.mutedBrown, fontWeight: '500', textAlign: 'center' },

    centerWrap: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three * s, paddingVertical: 40 * s },
    bigTitle: { fontSize: 20 * s, fontWeight: '900', color: P.brown, textAlign: 'center' },
    body: { fontSize: 14 * s, color: P.mutedBrown, textAlign: 'center', lineHeight: 20 * s },

    introCard: {
      backgroundColor: P.card,
      borderRadius: 22 * s,
      borderWidth: 1.5,
      borderColor: P.pinkSoft,
      padding: Spacing.four * s,
      gap: Spacing.two * s,
    },
    introTitle: { fontSize: 17 * s, fontWeight: '900', color: P.brown },
    introBody: { fontSize: 14 * s, color: P.mutedBrown, lineHeight: 20 * s },
    safetyNote: {
      backgroundColor: P.pinkSoft,
      borderRadius: 14 * s,
      borderWidth: 1.5,
      borderColor: P.pink,
      padding: Spacing.three * s,
      marginTop: 4 * s,
    },
    safetyText: { fontSize: 12.5 * s, color: P.brown, lineHeight: 18 * s, fontWeight: '500' },
    errorCard: {
      backgroundColor: '#FDEAEA',
      borderRadius: 14 * s,
      borderWidth: 1.5,
      borderColor: '#E89B9B',
      padding: Spacing.three * s,
    },
    errorCardText: { fontSize: 13 * s, color: '#8A3A3A', fontWeight: '600', lineHeight: 18 * s },

    buddyCard: {
      backgroundColor: P.card,
      borderRadius: 22 * s,
      borderWidth: 1.5,
      borderColor: P.pinkSoft,
      padding: Spacing.four * s,
      alignItems: 'center',
      gap: 4 * s,
    },
    buddyScene: {
      width: 120 * s,
      height: 150 * s,
      borderRadius: 18 * s,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: P.pinkSoft,
      backgroundColor: P.pinkSoft,
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: 6 * s,
    },
    buddyFig: { width: '130%', height: '95%', marginBottom: -6 },
    buddyName: { fontSize: 19 * s, fontWeight: '900', color: P.brown },
    buddyStreak: { fontSize: 13 * s, color: P.mutedBrown, fontWeight: '600' },
    daysLeft: { fontSize: 12 * s, color: P.pink, fontWeight: '800', marginTop: 2 * s },

    checkCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three * s,
      borderRadius: 18 * s,
      borderWidth: 1.5,
      padding: Spacing.three * s,
    },
    checkYes: { backgroundColor: '#EAF8EE', borderColor: P.green },
    checkNo: { backgroundColor: P.card, borderColor: P.pinkSoft },
    checkBadge: { width: 36 * s, height: 36 * s, borderRadius: 18 * s, alignItems: 'center', justifyContent: 'center' },
    checkBadgeYes: { backgroundColor: P.green },
    checkBadgeNo: { backgroundColor: P.mutedBrown },
    checkBadgeText: { color: '#fff', fontSize: 20 * s, fontWeight: '900', lineHeight: 22 * s },
    checkText: { flex: 1, fontSize: 14 * s, color: P.brown, fontWeight: '700', lineHeight: 19 * s },

    section: { gap: Spacing.two * s },
    sectionTitle: { fontSize: 16 * s, fontWeight: '800', color: P.brown },
    cheerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two * s },
    cheerBtn: {
      backgroundColor: P.pinkSoft,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: P.pink,
      paddingHorizontal: 16 * s,
      paddingVertical: 10 * s,
    },
    cheerBtnDisabled: { opacity: 0.5 },
    cheerBtnText: { color: P.brown, fontWeight: '800', fontSize: 13 * s },
    cheerSent: { fontSize: 12 * s, color: P.green, fontWeight: '700' },
    cheerBanner: {
      backgroundColor: '#FFF3D6',
      borderRadius: 16 * s,
      borderWidth: 1.5,
      borderColor: P.peach,
      padding: Spacing.three * s,
    },
    cheerBannerText: { fontSize: 13.5 * s, color: P.brown, fontWeight: '700', textAlign: 'center', lineHeight: 19 * s },

    friendBtn: {
      backgroundColor: P.peach,
      borderRadius: 16 * s,
      paddingVertical: Spacing.three * s,
      alignItems: 'center',
    },
    friendBtnText: { color: P.brown, fontWeight: '900', fontSize: 15 * s },

    dangerRow: { flexDirection: 'row', gap: Spacing.two * s },
    dangerBtn: {
      flex: 1,
      backgroundColor: P.card,
      borderRadius: 14 * s,
      borderWidth: 1.5,
      borderColor: P.pinkSoft,
      paddingVertical: 12 * s,
      alignItems: 'center',
    },
    dangerBtnText: { color: P.mutedBrown, fontWeight: '800', fontSize: 13 * s },

    primaryBtn: {
      backgroundColor: P.pink,
      borderRadius: 18 * s,
      paddingVertical: Spacing.three * s,
      alignItems: 'center',
      shadowColor: '#C9A18A',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    primaryBtnText: { color: '#fff', fontSize: 17 * s, fontWeight: '800' },
    secondaryBtn: { paddingVertical: Spacing.two * s },
    secondaryBtnText: { color: P.mutedBrown, fontWeight: '800', fontSize: 15 * s },

    doneButton: {
      backgroundColor: P.card,
      borderRadius: 18 * s,
      borderWidth: 1.5,
      borderColor: P.pinkSoft,
      paddingVertical: Spacing.three * s,
      alignItems: 'center',
    },
    doneButtonText: { color: P.mutedBrown, fontSize: 16 * s, fontWeight: '800' },

    pressed: { opacity: 0.85 },
  });
