/**
 * Monthly Plus "room ticket" popup, shown on Home when one (or more) tickets were
 * just granted (on the purchase day-of-month anniversary, or at purchase). Mirrors
 * BirthdayRewardModal: armed ~1.5s after the launch splash and gated behind the
 * Hanji/recipe/daily/birthday popups so cards never stack. The ticket is already
 * granted in app-context; this only acknowledges it (clears the pending count).
 */
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_POPUP_WIDTH, popupMaxWidth } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { isLoadingActive, subscribeLoadingDone } from '@/lib/loading-signal';
import { useReportModalTransition } from '@/lib/modal-traffic';
import { useTranslation } from '@/i18n';

const TICKET = require('@/assets/images/shop/ticket.png');

const P = {
  card: '#FFFDF8', purple: '#9B7BD4', purpleSoft: '#EFE6FB', lilac: '#C9B3EC',
  brown: '#5B3A2E', muted: '#9A7B6D',
};

export function TicketRewardModal() {
  const { t } = useTranslation();
  const {
    exchangeTicketPending, clearExchangeTicketPending,
    hanjiUnlockPending, recipeBadgePending,
    legalAccepted, starterChosen,
    characterObtainedPending,
  } = useApp();

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

  const count = exchangeTicketPending;
  const onboarded = legalAccepted && starterChosen;
  const visible = count > 0 && armed && onboarded && !characterObtainedPending && !hanjiUnlockPending && !recipeBadgePending;
  useReportModalTransition(visible);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={clearExchangeTicketPending}>
      <View style={styles.root}>
        <View style={styles.backdrop} />
        <View style={styles.card}>
          <Image source={TICKET} style={styles.ticket} contentFit="contain" />
          <Text style={styles.title}>{t('ticketReward.title')}</Text>
          <Text style={styles.subtitle}>
            {count > 1 ? t('ticketReward.msgMany', { count }) : t('ticketReward.msg')}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={clearExchangeTicketPending}>
            <Text style={styles.buttonText}>{t('ticketReward.ok')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  card: {
    width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: popupMaxWidth(340), backgroundColor: P.card, borderRadius: 24,
    borderWidth: 2, borderColor: P.purpleSoft, padding: 22, alignItems: 'center', gap: 6,
  },
  ticket: { width: 132, height: 90, marginBottom: 4, backgroundColor: 'transparent' },
  title: { fontSize: 21, fontWeight: '900', color: P.purple, textAlign: 'center' },
  subtitle: { fontSize: 13, color: P.muted, fontWeight: '600', textAlign: 'center', lineHeight: 18, marginBottom: 6 },
  button: {
    alignSelf: 'center', marginTop: 12, paddingVertical: 13, paddingHorizontal: 64, borderRadius: 16,
    backgroundColor: P.purple, alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 15, textAlign: 'center' },
  pressed: { opacity: 0.85 },
});
