/**
 * One-shot Home celebration shown when a companion's bond level goes up from
 * studying (see `recordSession` → `bondLevelUp`). Mirrors CharacterObtainedModal's
 * layout: dimmed backdrop + centered card. Shows the companion in its CURRENT
 * outfit (equipped skin), the new level, and a progress bar toward the next level.
 * Tap anywhere to dismiss.
 */
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { CompanionLevel } from '@/components/companion-level';
import { PaperNote } from '@/components/paper-note';
import { BakeryColors, MIN_POPUP_WIDTH, popupMaxWidth } from '@/constants/theme';
import { birthdayRewardAvailable, nextLoginReward, todayISO, useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { BOND_LETTER_MAX_LEVEL } from '@/lib/companion-moments';
import { localizeCompanionName, resolveActiveCompanion } from '@/lib/companion-utils';
import { letterText, personaKeyForName } from '@/lib/companion-voice';
import { useModalSafeVisible } from '@/lib/modal-traffic';

const P = { card: '#FFFDF8', brown: '#5B3A2E', muted: '#9A7B6D' };

export function BondLevelUpModal() {
  const { t } = useTranslation();
  const {
    bondLevelUp, clearBondLevelUp,
    defaultCompanionId, companionSlots, bunSkinId, companionSkins, companionMinutes,
    hanjiUnlockPending, recipeBadgePending, characterObtainedPending,
    exchangeTicketPending, streakRescuePending,
    loginRewardDate, streak, isPlus, streakFreezes, streakRescueDismissedDate,
    profileBirthday, birthdayRewardYear,
    addKeepsakes, markKeepsakeSeen, language,
  } = useApp();
  const { t: tc } = useTranslation('companion');
  const { width: winW } = useWindowDimensions();
  // The settle window alone is NOT enough: it delays a present, it doesn't make two
  // popups take turns. Two modals armed in the same instant both wait it out and then
  // present together — which wedges iOS and leaves Home frozen to taps.
  //
  // That is exactly what a finished study block does: finishStudyBlock calls
  // markFoodMade (arms the recipe badge) AND recordSession (arms this level-up), so
  // both cards became visible the moment Home cleared its activeSession.
  //
  // So join the same priority chain every other reward popup follows
  // (character → Hanji → recipe → birthday → streak rescue → daily → ticket), at the
  // tail: a bond level-up is the least time-sensitive of them, and it stays armed
  // until it's shown.
  const dailyPending = nextLoginReward({ loginRewardDate, streak, isPlus, streakFreezes, streakRescueDismissedDate }, todayISO()).available;
  const birthdayPending = birthdayRewardAvailable({ profileBirthday, birthdayRewardYear }, todayISO());
  const want =
    !!bondLevelUp && !characterObtainedPending && !hanjiUnlockPending && !recipeBadgePending &&
    !birthdayPending && !streakRescuePending && !dailyPending && exchangeTicketPending <= 0;
  const visible = useModalSafeVisible(want);

  // Levels 2–15 come with a short letter from the companion. It is filed in their
  // letter box (already read) the moment the popup shows it; MomentHost back-fills any
  // letter this popup never got to show (levels crossed by petting, double jumps).
  const resolved = bondLevelUp
    ? resolveActiveCompanion(bondLevelUp.companionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins)
    : null;
  const persona = resolved ? personaKeyForName(resolved.name) : null;
  const level = bondLevelUp?.level ?? 0;
  const letter =
    persona && level >= 2 && level <= BOND_LETTER_MAX_LEVEL ? letterText(persona, level) : null;
  const letterId = persona && letter ? `letter:${persona}:${level}` : null;
  useEffect(() => {
    if (!visible || !persona || !letterId) return;
    addKeepsakes([{ id: letterId, persona, kind: 'letter', contentId: String(level), level, dateISO: todayISO(), seen: true }]);
    markKeepsakeSeen(letterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, letterId]);

  if (!bondLevelUp || !resolved) {
    return <Modal visible={false} transparent />;
  }

  // The stored id is an activeCompanionId (companionMinutes is keyed by it), so it
  // resolves straight to the current-skin look — the same art shown on Home.
  const name = localizeCompanionName(resolved.name, t);
  const minutes = companionMinutes?.[bondLevelUp.companionId] ?? 0;
  // The card is min(maxWidth, screen − 2·28 root padding) wide; its content box is that
  // minus 2·22 padding and 2·2 border. The note must fit inside it or its edges clip.
  const noteW = Math.min(popupMaxWidth(320), winW - 56) - 48;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={clearBondLevelUp}>
      <Pressable style={styles.root} onPress={clearBondLevelUp}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Image source={resolved.imageSource} style={styles.avatarImg} contentFit="contain" />
          </View>
          <Text style={styles.badge}>{t('bondLevelUp.title', { level: bondLevelUp.level })}</Text>
          <Text style={styles.message}>{t('bondLevelUp.message', { name })}</Text>
          <View style={styles.meterWrap}>
            <CompanionLevel minutes={minutes} scale={1.5} />
          </View>
          {letter ? (
            <>
              <ScrollView style={styles.letterScroll} contentContainerStyle={styles.letterContent} showsVerticalScrollIndicator={false}>
                <PaperNote text={letter} signature={tc('ui.signature', { name })} lang={language} width={noteW} />
              </ScrollView>
              <Text style={styles.saved}>{tc('ui.savedToLetters', { name })}</Text>
            </>
          ) : null}
          <Text style={styles.hint}>{t('bondLevelUp.dismiss')}</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: 'rgba(50,32,26,0.35)' },
  card: {
    width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: popupMaxWidth(320), backgroundColor: P.card, borderRadius: 24,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', padding: 22, alignItems: 'center', gap: 8,
    shadowColor: '#5B3A2E', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatar: {
    width: 118, height: 118, borderRadius: 59, backgroundColor: BakeryColors.rose,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  avatarImg: { width: '88%', height: '88%' },
  badge: { fontSize: 24, fontWeight: '900', color: BakeryColors.berry, textAlign: 'center' },
  message: { fontSize: 14, color: P.muted, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  meterWrap: { alignSelf: 'stretch', paddingHorizontal: 10, marginTop: 6 },
  letterScroll: { alignSelf: 'stretch', maxHeight: 240, marginTop: 10 },
  letterContent: { alignItems: 'center', paddingTop: 12, paddingBottom: 6 },
  saved: { fontSize: 12.5, color: '#9C4A5C', fontWeight: '800', textAlign: 'center' },
  hint: { fontSize: 12.5, color: P.muted, fontWeight: '700', textAlign: 'center', marginTop: 8 },
});
