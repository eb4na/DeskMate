/**
 * Daily Goals — the fixed everyday goals (DAILY_GOALS, the same list each day), each
 * with a progress bar and a manual Claim button. Rewards are bonus coins that bypass
 * the daily earn cap (claimQuestReward in app-context). Counters reset at 12am in the
 * account timezone; unclaimed rewards are forfeited then (use-it-or-lose-it).
 * (Route/file kept as `daily-quests` to avoid router churn; UI reads "Daily Goals".)
 *
 * Shown as a CENTERED RECTANGLE POPUP (transparentModal, see _layout.tsx) over the
 * Progress tab — a real dialog you dismiss with Done / a backdrop tap, not a sheet you
 * swipe down. A ready-to-claim row shows an obvious pink "Claim" pill (tap the row to
 * claim); a claimed row shows green.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CoinIcon } from '@/components/coin-icon';
import { MenuHeader, MenuRow } from '@/components/menu-card';
import { SoundPressable } from '@/components/sound-pressable';
import { useApp } from '@/context/app-context';
import { dailyGoalIds, getQuest, type QuestStatKey } from '@/constants/quests';
import { BakeryColors, BakeryRadii, BakeryShadow, PastelCards, Spacing, popupMaxWidth } from '@/constants/theme';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { useTranslation } from '@/i18n';

const CLAIMED_GREEN = '#8FD3A8';

export default function DailyQuestsScreen() {
  const { t } = useTranslation();
  const { scale } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale), [scale]);
  const { quests, claimQuestReward } = useApp();

  const ids = dailyGoalIds();
  const dismiss = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Pressable style={styles.backdrop} onPress={dismiss}>
      <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
        <MenuHeader title={t('quests.title')} subtitle={t('quests.resetsMidnight')} />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {ids.map((id) => {
            const def = getQuest(id);
            if (!def) return null;
            const current = Math.min((quests[def.statKey as QuestStatKey] as number) ?? 0, def.goal);
            const done = current >= def.goal;
            const claimed = quests.claimedToday.includes(id);
            const claimable = done && !claimed;
            const checkColor = claimed ? CLAIMED_GREEN : claimable ? BakeryColors.buttonPink : BakeryColors.latte;

            return (
              <MenuRow
                key={id}
                checkable
                checked={done}
                checkColor={checkColor}
                active={claimable}
                sound={claimable ? 'confirm' : 'none'}
                onPress={claimable ? () => claimQuestReward(id) : undefined}
                name={t(`quests.items.${id}.title`)}
                sub={`${t(`quests.items.${id}.desc`)}  ·  ${t('quests.progress', { current, goal: def.goal })}`}
                trailing={
                  claimed ? (
                    <Text style={styles.claimedText}>{t('quests.claimed')}</Text>
                  ) : claimable ? (
                    // Obvious pink "Claim" button so it's clear which rows have a reward
                    // waiting (the whole row is tappable — see MenuRow onPress above).
                    <View style={styles.claimPill}>
                      <Text style={styles.claimPillText}>{t('quests.cardClaim')}</Text>
                      <CoinIcon size={14 * scale} />
                      <Text style={styles.claimPillText}>+{def.reward}</Text>
                    </View>
                  ) : (
                    <>
                      <CoinIcon size={16 * scale} />
                      <Text style={styles.reward}>+{def.reward}</Text>
                    </>
                  )
                }
              />
            );
          })}
        </ScrollView>

        <SoundPressable
          sound="tap"
          onPress={dismiss}
          style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}>
          <Text style={styles.doneText}>{t('common.done')}</Text>
        </SoundPressable>
      </Pressable>
    </Pressable>
  );
}

const makeStyles = (s: number) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(59, 42, 33, 0.35)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.four,
    },
    card: {
      width: '100%',
      maxWidth: popupMaxWidth(360),
      maxHeight: '82%',
      backgroundColor: PastelCards.honey.fill,
      borderRadius: BakeryRadii.panel,
      borderWidth: 1.5,
      borderColor: PastelCards.honey.border,
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.three,
      paddingBottom: Spacing.three,
      ...BakeryShadow,
    },
    // flexShrink lets the list shrink + scroll only when the card hits its maxHeight;
    // short lists (daily goals) size to content and don't scroll.
    scroll: { flexShrink: 1, alignSelf: 'stretch' },
    scrollBody: { paddingBottom: 2 * s },
    reward: { fontSize: 15 * s, fontWeight: '900', color: '#C98A2B' },
    claimedText: { color: CLAIMED_GREEN, fontWeight: '900', fontSize: 13.5 * s },
    claimPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3 * s,
      backgroundColor: BakeryColors.buttonPink,
      borderRadius: 999,
      paddingHorizontal: 11 * s,
      paddingVertical: 5 * s,
    },
    claimPillText: { color: BakeryColors.cocoaDark, fontWeight: '900', fontSize: 13 * s },
    doneBtn: {
      marginTop: Spacing.three,
      alignSelf: 'stretch',
      width: '100%',
      backgroundColor: BakeryColors.buttonPink,
      borderRadius: 999,
      paddingVertical: 14 * s,
      alignItems: 'center',
    },
    doneText: { color: '#fff', fontWeight: '900', fontSize: 15 * s },
    pressed: { opacity: 0.85 },
  });
