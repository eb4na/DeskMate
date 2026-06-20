/**
 * Birthday gift popup, shown on the Home screen on the player's birthday. Grants a
 * flat +1000-coin bonus, gated to once per calendar year (see birthdayRewardAvailable
 * / claimBirthdayReward in app-context). Mirrors DailyRewardModal: claim-only (no
 * backdrop dismiss), held until ~1.5s after the launch splash, and gated behind the
 * Hanji/recipe popups so two cards never stack.
 */
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { BIRTHDAY_REWARD_COINS, birthdayRewardAvailable, todayISO, useApp } from '@/context/app-context';
import { isLoadingActive, subscribeLoadingDone } from '@/lib/loading-signal';
import { useTranslation } from '@/i18n';

const COIN = require('@/assets/images/home/coin-icon.png');
const CAKE = require('@/assets/images/profile/birthday-candle.png');

const P = {
  card: '#FFFDF8', pink: '#F7A7B8', pinkSoft: '#FCE4EA', gold: '#E8B14C', goldSoft: '#FBEFD2',
  brown: '#5B3A2E', muted: '#9A7B6D',
};

export function BirthdayRewardModal() {
  const { t } = useTranslation();
  const {
    profileBirthday, birthdayRewardYear, claimBirthdayReward,
    hanjiUnlockPending, recipeBadgePending,
    legalAccepted, starterChosen,
  } = useApp();

  const available = birthdayRewardAvailable({ profileBirthday, birthdayRewardYear }, todayISO());

  // Hold the popup until the launch splash has lifted, then wait ~1.5s so it greets
  // the player once settled on Home — not stacked under the splash. (Same as daily.)
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => { timer = setTimeout(() => setArmed(true), 1500); };
    if (!isLoadingActive()) arm();
    const unsub = subscribeLoadingDone(arm);
    return () => { clearTimeout(timer); unsub(); };
  }, []);

  const onboarded = legalAccepted && starterChosen;
  const visible = available && armed && onboarded && !hanjiUnlockPending && !recipeBadgePending;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.root}>
        <View style={styles.backdrop} />
        <View style={styles.card}>
          <Image source={CAKE} style={styles.cake} contentFit="contain" />
          <Text style={styles.title}>{t('birthdayReward.title')}</Text>
          <Text style={styles.subtitle}>{t('birthdayReward.subtitle')}</Text>

          <View style={styles.hero}>
            <View style={styles.heroCoinRow}>
              <Image source={COIN} style={styles.heroCoin} contentFit="contain" />
              <Text style={styles.heroCoins}>{BIRTHDAY_REWARD_COINS}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={claimBirthdayReward}>
            <Image source={COIN} style={styles.btnCoin} contentFit="contain" />
            <Text style={styles.buttonText}>{t('birthdayReward.claim', { coins: BIRTHDAY_REWARD_COINS })}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(48,32,24,0.45)' },
  card: {
    width: '100%', maxWidth: 340, backgroundColor: P.card, borderRadius: 24,
    borderWidth: 2, borderColor: P.pinkSoft, padding: 22, alignItems: 'center', gap: 6,
  },
  cake: { width: 76, height: 76, marginBottom: 2 },
  title: { fontSize: 21, fontWeight: '900', color: P.pink, textAlign: 'center' },
  subtitle: { fontSize: 13, color: P.muted, fontWeight: '600', textAlign: 'center', lineHeight: 18, marginBottom: 6 },
  hero: {
    alignSelf: 'stretch', alignItems: 'center', gap: 6, paddingVertical: 18, marginTop: 4,
    borderRadius: 18, backgroundColor: P.goldSoft, borderWidth: 2, borderColor: P.gold,
  },
  heroCoinRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroCoin: { width: 34, height: 34 },
  heroCoins: { fontSize: 32, fontWeight: '900', color: P.gold },
  button: {
    alignSelf: 'stretch', marginTop: 12, paddingVertical: 13, borderRadius: 16,
    backgroundColor: P.pink, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  btnCoin: { width: 22, height: 22 },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  pressed: { opacity: 0.85 },
});
