/**
 * On-open streak-rescue prompt, shown on Home while the streak sits inside the freeze
 * window (STREAK_RESCUE_DAYS days to act, counting from the first missed day) and hasn't
 * been handled yet today. It's the primary place a lapsed streak is saved: if the player
 * owns a freeze they can spend one; if they own none they can buy one on the spot ($1.99)
 * which bridges the streak directly. Picking "Let it reset" gives the streak up for good
 * (declineStreakRescue) — over a 30-day window a merely-dismissed prompt would come back
 * tomorrow, so the decline has to commit rather than wait for the next login-reward claim.
 *
 * Gated behind the celebratory popups (character/hanji/recipe/birthday) and shown just
 * BEFORE the daily reward so the rescue is resolved before the login reward can advance
 * the streak. Freezes are usable by anyone (not Plus-gated); Plus only affects the free
 * monthly allotment.
 *
 * Like the daily-reward modal, this is a native <Modal>; buying (or any confirm popup)
 * would stack a second native modal over it and freeze iOS, so we set `leaving` to
 * dismiss ourselves first and let the popup-host / StoreKit sheet present cleanly.
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_POPUP_WIDTH } from '@/constants/theme';
import { StreakFreezeIcon } from '@/components/streak-freeze-icon';
import { birthdayRewardAvailable, todayISO, useApp } from '@/context/app-context';
import { PRODUCT_IDS, fetchPrices, purchaseProduct, purchasesReady } from '@/lib/purchases';
import { track } from '@/lib/analytics';
import { showPopup } from '@/lib/popup';
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
    streakRescuePending, streak, streakFreezes,
    useStreakFreeze, rescueStreakByPurchase, dismissStreakRescue, declineStreakRescue,
    hanjiUnlockPending, recipeBadgePending, characterObtainedPending,
    legalAccepted, starterChosen,
    profileBirthday, birthdayRewardYear,
  } = useApp();

  const hasFreeze = streakFreezes > 0;
  const count = streak.currentStreak;

  // Fetch the real store price for the buy button (falls back to the default sticker).
  const [price, setPrice] = useState('$1.99');
  useEffect(() => {
    let alive = true;
    fetchPrices([PRODUCT_IDS.streakFreeze]).then((m) => {
      const p = m[PRODUCT_IDS.streakFreeze];
      if (alive && p) setPrice(p);
    });
    return () => { alive = false; };
  }, []);

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

  // Dismiss ourselves before presenting the StoreKit sheet or any popup so two native
  // modals never stack (iOS freeze). Self-resets: Home remounts this on focus.
  const [leaving, setLeaving] = useState(false);

  const onboarded = legalAccepted && starterChosen;
  const birthdayPending = birthdayRewardAvailable({ profileBirthday, birthdayRewardYear }, todayISO());
  const visible =
    streakRescuePending && armed && onboarded && !leaving &&
    !characterObtainedPending && !hanjiUnlockPending && !recipeBadgePending && !birthdayPending;
  const safeVisible = useModalSafeVisible(visible);

  const onUse = () => {
    useStreakFreeze();       // bridges the gap; window-checked
    dismissStreakRescue();   // mark handled today so we don't reshow
  };

  const onLetReset = () => declineStreakRescue();

  const onBuy = () => {
    // Hide this native modal first, then run the purchase so the StoreKit sheet (or the
    // dev mock / failure popup) isn't stacked on top of us.
    setLeaving(true);
    const productId = PRODUCT_IDS.streakFreeze;
    // Success = bridge the streak (the bought freeze is spent immediately, net-zero
    // inventory) and mark handled. rescueStreakByPurchase sets the dismissed date.
    const doRescue = () => { track('shop_purchase', { kind: 'freeze' }); rescueStreakByPurchase(); };

    // Fail closed: dev mock-grants after a confirm; production refuses when unavailable.
    if (!purchasesReady()) {
      if (__DEV__) {
        showPopup(t('shop.streakFreezeName'), t('shop.streakFreezeDesc'), [
          { text: t('common.cancel'), style: 'cancel', onPress: () => setLeaving(false) },
          { text: t('shop.buyForMock', { price }), onPress: doRescue },
        ]);
      } else {
        showPopup(
          t('shop.storeUnavailable', { defaultValue: 'Store unavailable' }),
          t('shop.storeUnavailableMsg', { defaultValue: 'Purchases are temporarily unavailable. Please try again later.' }),
        );
      }
      return;
    }

    purchaseProduct(productId).then((res) => {
      if (res.ok) {
        doRescue();
      } else if (res.cancelled) {
        // Bring the prompt back so they can decide again.
        setLeaving(false);
      } else {
        showPopup(
          t('shop.purchaseFailed', { defaultValue: 'Purchase failed' }),
          t('shop.purchaseFailedMsg', { defaultValue: 'Something went wrong and you were not charged. Please try again.' }),
        );
      }
    });
  };

  // Android hardware back is a no-op here: this is a streak-saving *decision*, so a
  // stray back-press must not silently forfeit today's rescue — the player picks one
  // of the three explicit buttons (use / buy / let it reset).
  return (
    <Modal visible={safeVisible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.root}>
        <View style={styles.backdrop} />
        <View style={styles.card}>
          <StreakFreezeIcon size={72 * scale} />
          <Text style={styles.title}>{t('streakRescue.title')}</Text>
          <Text style={styles.message}>
            {hasFreeze
              ? t('streakRescue.msgUse', { count })
              : t('streakRescue.msgBuy', { count })}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={hasFreeze ? onUse : onBuy}>
            <Text style={styles.buttonText}>
              {hasFreeze ? t('progress.useFreeze') : t('streakRescue.buyButton', { price })}
            </Text>
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
