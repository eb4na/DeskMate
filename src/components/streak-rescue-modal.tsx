/**
 * On-open streak-rescue prompt, shown on Home once a streak has lapsed past the free
 * grace window (STREAK_GRACE_DAYS), is still inside the freeze window, and hasn't been
 * handled yet today. It only ever appears to a player who already OWNS a freeze — it
 * never sells one at the miss moment; with no freeze the streak just resets. Picking
 * "Let it reset" gives the streak up for good (declineStreakRescue) — over a month-long
 * window a merely-dismissed prompt would come back tomorrow, so the decline has to commit
 * rather than wait for the next login-reward claim.
 *
 * Gated behind the celebratory popups (character/hanji/recipe/birthday) and shown just
 * BEFORE the daily reward so the rescue is resolved before the login reward can advance
 * the streak. Freezes are usable by anyone (not Plus-gated); Plus only affects the free
 * monthly allotment.
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_POPUP_WIDTH } from '@/constants/theme';
import { StreakFreezeIcon } from '@/components/streak-freeze-icon';
import { birthdayRewardAvailable, todayISO, useApp } from '@/context/app-context';
import { useModalSafeVisible } from '@/lib/modal-traffic';
import { isLoadingActive, subscribeLoadingDone } from '@/lib/loading-signal';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { useTranslation } from '@/i18n';

const P = {
  card: '#FFFDF8', blue: '#7FB4E3', blueSoft: '#E4F0FB', brown: '#5B3A2E',
  muted: '#9A7B6D', pink: '#F7A7B8', pinkSoft: '#FCE4EA',
};

export function StreakRescueModal() {
  const { t } = useTranslation();
  const { scale } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale), [scale]);
  const {
    streakRescuePending, streak,
    useStreakFreeze: applyStreakFreeze, dismissStreakRescue, declineStreakRescue,
    hanjiUnlockPending, recipeBadgePending, characterObtainedPending,
    legalAccepted, starterChosen,
    profileBirthday, birthdayRewardYear,
  } = useApp();

  const count = streak.currentStreak;

  // Hold the popup until the launch splash lifts, then ~1.5s so it greets the player on
  // Home rather than flashing under the splash (mirrors the daily-reward modal).
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => { timer = setTimeout(() => setArmed(true), 1500); };
    if (!isLoadingActive()) arm();
    const unsub = subscribeLoadingDone(arm);
    return () => { clearTimeout(timer); unsub(); };
  }, []);

  const onboarded = legalAccepted && starterChosen;
  const birthdayPending = birthdayRewardAvailable({ profileBirthday, birthdayRewardYear }, todayISO());
  // streakRescuePending is only true while the player owns a freeze.
  const visible =
    streakRescuePending && armed && onboarded &&
    !characterObtainedPending && !hanjiUnlockPending && !recipeBadgePending && !birthdayPending;
  const safeVisible = useModalSafeVisible(visible);

  const onUse = () => {
    applyStreakFreeze();     // bridges the gap; window-checked
    dismissStreakRescue();   // mark handled today so we don't reshow
  };

  const onLetReset = () => declineStreakRescue();

  // Android hardware back is a no-op here: this is a streak-saving *decision*, so a
  // stray back-press must not silently forfeit today's rescue — the player picks one
  // of the two explicit buttons (use / let it reset).
  return (
    <Modal visible={safeVisible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.root}>
        <View style={styles.backdrop} />
        <View style={styles.card}>
          <StreakFreezeIcon size={72 * scale} />
          <Text style={styles.title}>{t('streakRescue.title')}</Text>
          <Text style={styles.message}>{t('streakRescue.msgUse', { count })}</Text>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={onUse}>
            <Text style={styles.buttonText}>{t('progress.useFreeze')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={onLetReset}>
            <Text style={styles.secondaryText}>{t('sessionComplete.letItReset')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (s: number) =>
  StyleSheet.create({
    root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 * s },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
    card: {
      width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: 340 * s, backgroundColor: P.card,
      borderRadius: 24 * s, borderWidth: 2, borderColor: P.blueSoft, padding: 22 * s,
      alignItems: 'center', gap: 8 * s,
    },
    title: { fontSize: 19 * s, fontWeight: '900', color: P.brown, textAlign: 'center', marginTop: 4 * s },
    message: { fontSize: 14 * s, color: P.muted, fontWeight: '600', textAlign: 'center', lineHeight: 20 * s, marginBottom: 4 * s },
    button: {
      alignSelf: 'stretch', marginTop: 6 * s, paddingVertical: 13 * s, borderRadius: 16 * s,
      backgroundColor: P.pink, alignItems: 'center', justifyContent: 'center',
    },
    buttonText: { color: '#fff', fontWeight: '900', fontSize: 15 * s },
    secondary: { alignSelf: 'stretch', marginTop: 2 * s, paddingVertical: 11 * s, borderRadius: 16 * s, alignItems: 'center', justifyContent: 'center' },
    secondaryText: { color: P.muted, fontWeight: '800', fontSize: 13.5 * s },
    pressed: { opacity: 0.85 },
  });
