/**
 * Daily reward popup, shown once per day on the Home screen. The payout is tied to
 * the STUDY streak: streak day N pays N coins, capped at 200 (see
 * constants/login-rewards). Claim-only — no backdrop dismiss — and `loginRewardDate`
 * gates it to once per calendar day.
 *
 * Today's reward is previewed via the same `nextLoginReward` helper that
 * claimLoginReward commits, so the shown day/coins can never drift from the payout.
 * Gated behind the Hanji/recipe popups so two cards never stack, and held until
 * ~1.5s after the launch splash lifts (see the `armed` timer) so it greets the
 * player on Home rather than flashing under the splash.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { birthdayRewardAvailable, nextLoginReward, todayISO, useApp } from '@/context/app-context';
import { DAILY_REWARD_CAP } from '@/constants/login-rewards';
import { isLoadingActive, subscribeLoadingDone } from '@/lib/loading-signal';
import { useTranslation } from '@/i18n';

const COIN = require('@/assets/images/home/coin-icon.png');

const P = {
  card: '#FFFDF8', pink: '#F7A7B8', pinkSoft: '#FCE4EA', gold: '#E8B14C', goldSoft: '#FBEFD2',
  brown: '#5B3A2E', muted: '#9A7B6D', line: '#F0DDD3',
};

export function DailyRewardModal() {
  const { t } = useTranslation();
  const {
    loginRewardDate, streak, claimLoginReward,
    hanjiUnlockPending, recipeBadgePending,
    legalAccepted, starterChosen,
    isPlus, streakFreezes,
    profileBirthday, birthdayRewardYear,
  } = useApp();

  const reward = nextLoginReward({ loginRewardDate, streak, isPlus, streakFreezes }, todayISO());
  // On the player's birthday the birthday gift shows first — hold the daily reward
  // until it's claimed so the two cards never stack.
  const birthdayPending = birthdayRewardAvailable({ profileBirthday, birthdayRewardYear }, todayISO());

  // Hold the popup until the launch splash has lifted, then wait ~1.5s so it
  // greets the player once they're settled on Home — not stacked under the splash.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => { timer = setTimeout(() => setArmed(true), 1500); };
    if (!isLoadingActive()) arm();
    const unsub = subscribeLoadingDone(arm);
    return () => { clearTimeout(timer); unsub(); };
  }, []);

  // Hold the reward until onboarding is fully done — the consent gate (Privacy +
  // age) and the starter pick. The reward is a native Modal, which draws above the
  // gate's plain-View overlay regardless of zIndex, so without this it could pop
  // over the Privacy/age screens. (starterChosen is grandfathered true for anyone
  // who already passed the legal gate, so this never suppresses it for them.)
  // Dismiss the native Modal in the same commit as navigating to the paywall — RN
  // Modals can't reliably present a `presentation: 'modal'` route from underneath
  // (matches sound-picker-modal). `leaving` self-resets: Home remounts this on focus.
  const [leaving, setLeaving] = useState(false);

  const onboarded = legalAccepted && starterChosen;
  const visible = reward.available && armed && onboarded && !hanjiUnlockPending && !recipeBadgePending && !birthdayPending && !leaving;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.root}>
        <View style={styles.backdrop} />
        <View style={styles.card}>
          <Text style={styles.title}>{t('dailyReward.title')}</Text>
          <Text style={styles.subtitle}>{t('dailyReward.subtitle', { max: isPlus ? DAILY_REWARD_CAP * 2 : DAILY_REWARD_CAP })}</Text>

          {/* Today's reward: streak day N pays N coins (capped at 200). */}
          <View style={styles.hero}>
            <Text style={styles.heroDay}>{t('dailyReward.day', { n: reward.day })}</Text>
            <View style={styles.heroCoinRow}>
              <Image source={COIN} style={styles.heroCoin} contentFit="contain" />
              <Text style={styles.heroCoins}>{reward.coins}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={claimLoginReward}>
            <Image source={COIN} style={styles.btnCoin} contentFit="contain" />
            <Text style={styles.buttonText}>{t('dailyReward.claim', { coins: reward.coins })}</Text>
          </Pressable>

          {/* Free users: upsell to Plus, which doubles this reward. Navigating away
              blurs Home, so the modal unmounts and re-shows (doubled) on return. */}
          {!isPlus && (
            <Pressable
              style={({ pressed }) => [styles.upsell, pressed && styles.pressed]}
              onPress={() => { setLeaving(true); router.push('/plus-upgrade'); }}>
              <Text style={styles.upsellText}>
                {t('dailyReward.get2x', { coins: reward.baseCoins * 2 })}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const TILE = 62;
const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(48,32,24,0.45)' },
  card: {
    width: '100%', maxWidth: 340, backgroundColor: P.card, borderRadius: 24,
    borderWidth: 2, borderColor: P.pinkSoft, padding: 22, alignItems: 'center', gap: 6,
  },
  title: { fontSize: 19, fontWeight: '900', color: P.brown, textAlign: 'center' },
  subtitle: { fontSize: 13, color: P.muted, fontWeight: '600', textAlign: 'center', lineHeight: 18, marginBottom: 6 },
  // Single big reward card (streak day + its coins).
  hero: {
    alignSelf: 'stretch', alignItems: 'center', gap: 6, paddingVertical: 18, marginTop: 4,
    borderRadius: 18, backgroundColor: P.goldSoft, borderWidth: 2, borderColor: P.gold,
  },
  heroDay: { fontSize: 13, fontWeight: '800', color: P.muted, letterSpacing: 0.3 },
  heroCoinRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroCoin: { width: 34, height: 34 },
  heroCoins: { fontSize: 32, fontWeight: '900', color: P.gold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  tile: {
    width: TILE, height: TILE, borderRadius: 14, backgroundColor: P.pinkSoft,
    borderWidth: 1.5, borderColor: P.line, alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  tileBig: { backgroundColor: P.goldSoft, borderColor: P.gold },
  tileToday: { borderColor: P.pink, borderWidth: 2.5, transform: [{ scale: 1.04 }] },
  tileClaimed: { opacity: 0.5 },
  tileDay: { fontSize: 10, fontWeight: '800', color: P.muted },
  tileCoin: { width: 20, height: 20 },
  tileCoins: { fontSize: 13, fontWeight: '900', color: P.brown },
  tileCoinsBig: { color: P.gold },
  check: {
    ...StyleSheet.absoluteFill, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(247,167,184,0.25)',
  },
  checkMark: { fontSize: 24, fontWeight: '900', color: P.pink },
  plusNote: { fontSize: 11.5, color: P.gold, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  button: {
    alignSelf: 'stretch', marginTop: 12, paddingVertical: 13, borderRadius: 16,
    backgroundColor: P.pink, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  btnCoin: { width: 22, height: 22 },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  // Secondary upsell button: gold outline so it reads as a bonus, not the main claim.
  upsell: {
    alignSelf: 'stretch', marginTop: 8, paddingVertical: 11, borderRadius: 16,
    backgroundColor: P.goldSoft, borderWidth: 1.5, borderColor: P.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  upsellText: { color: P.gold, fontWeight: '900', fontSize: 13.5 },
  pressed: { opacity: 0.85 },
});
