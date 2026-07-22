/**
 * Achievements — permanent one-time milestones across study/tasks/streak/social.
 * Each is measured against a lifetime stat; a met-but-unclaimed one shows a manual
 * Claim button paying bonus coins that bypass the daily earn cap (claimAchievement
 * in app-context). Claimed ones show a check; locked ones show their progress.
 *
 * Shown as a CENTERED RECTANGLE POPUP (transparentModal, see _layout.tsx) over the
 * Progress tab — a real dialog you dismiss with Done / a backdrop tap, not a sheet you
 * swipe down. The list scrolls inside the card when it's taller than the cap. A
 * ready-to-claim row shows an obvious pink "Claim" pill; claimed rows show green.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CoinIcon } from '@/components/coin-icon';
import { MenuHeader, MenuRow, SectionLabel, SectionRule } from '@/components/menu-card';
import { SoundPressable } from '@/components/sound-pressable';
import { useApp } from '@/context/app-context';
import { ACHIEVEMENTS, type AchievementDef, type AchievementStatKey } from '@/constants/quests';
import { RECIPE_IDS } from '@/constants/recipes';
import { BakeryColors, BakeryRadii, BakeryShadow, PastelCards, Spacing, popupMaxWidth } from '@/constants/theme';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { useTranslation } from '@/i18n';

const CLAIMED_GREEN = '#8FD3A8';

const CATEGORY_ORDER: AchievementDef['category'][] = ['study', 'tasks', 'streak', 'social', 'recipes'];

export default function AchievementsScreen() {
  const { t } = useTranslation();
  const { scale } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale), [scale]);
  const {
    sessionsCompleted,
    totalMinutes,
    streak,
    lifetimeTasksCompleted,
    lifetimeFriendSessions,
    claimedAchievements,
    claimAchievement,
    madeFoods,
  } = useApp();

  const dismiss = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const stat = (key: AchievementStatKey): number => {
    switch (key) {
      case 'sessionsCompleted':
        return sessionsCompleted;
      case 'totalMinutes':
        return totalMinutes;
      case 'longestStreak':
        return streak.longestStreak;
      case 'lifetimeTasksCompleted':
        return lifetimeTasksCompleted;
      case 'lifetimeFriendSessions':
        return lifetimeFriendSessions;
      case 'recipesMade':
        return RECIPE_IDS.filter((id) => madeFoods.includes(id)).length;
    }
  };

  const unclaimedCount = ACHIEVEMENTS.filter(
    (a) => !claimedAchievements.includes(a.id) && stat(a.statKey) >= a.goal,
  ).length;

  const renderRow = (a: AchievementDef) => {
    const value = stat(a.statKey);
    const current = Math.min(value, a.goal);
    const done = value >= a.goal;
    const claimed = claimedAchievements.includes(a.id);
    const claimable = done && !claimed;
    const checkColor = claimed ? CLAIMED_GREEN : claimable ? BakeryColors.buttonPink : BakeryColors.latte;

    return (
      <MenuRow
        key={a.id}
        checkable
        checked={done}
        checkColor={checkColor}
        active={claimable}
        sound={claimable ? 'confirm' : 'none'}
        onPress={claimable ? () => claimAchievement(a.id) : undefined}
        name={t(`achievements.items.${a.id}.title`)}
        sub={
          claimed
            ? t(`achievements.items.${a.id}.desc`)
            : `${t(`achievements.items.${a.id}.desc`)}  ·  ${t('achievements.progress', { current, goal: a.goal })}`
        }
        trailing={
          claimed ? (
            <Text style={styles.claimedText}>{t('achievements.claimed')}</Text>
          ) : claimable ? (
            // Obvious pink "Claim" button so it's clear which milestones have a reward
            // waiting (the whole row is tappable — see MenuRow onPress above).
            <View style={styles.claimPill}>
              <Text style={styles.claimPillText}>{t('achievements.cardClaim')}</Text>
              <CoinIcon size={14 * scale} />
              <Text style={styles.claimPillText}>+{a.reward}</Text>
            </View>
          ) : (
            <>
              <CoinIcon size={16 * scale} />
              <Text style={styles.reward}>+{a.reward}</Text>
            </>
          )
        }
      />
    );
  };

  return (
    // Backdrop is a sibling BEHIND the card (not a Pressable wrapping it) so the
    // ScrollView has zero Pressable ancestors — a Pressable ancestor swallows the
    // list's scroll pan, and this list is long enough to overflow.
    <View style={styles.root}>
      <Pressable style={styles.backdrop} onPress={dismiss} />
      <View style={styles.card}>
        <MenuHeader
          title={t('achievements.title')}
          subtitle={
            unclaimedCount > 0
              ? t('achievements.readyCount', { count: unclaimedCount })
              : t('achievements.subtitle')
          }
        />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {CATEGORY_ORDER.map((cat, ci) => {
            const items = ACHIEVEMENTS.filter((a) => a.category === cat);
            if (items.length === 0) return null;
            return (
              <View key={cat}>
                {ci > 0 && <SectionRule />}
                <SectionLabel>{t(`achievements.categories.${cat}`)}</SectionLabel>
                {items.map(renderRow)}
              </View>
            );
          })}
        </ScrollView>

        <SoundPressable
          sound="tap"
          onPress={dismiss}
          style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}>
          <Text style={styles.doneText}>{t('common.done')}</Text>
        </SoundPressable>
      </View>
    </View>
  );
}

const makeStyles = (s: number) =>
  StyleSheet.create({
    root: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.four,
    },
    // Dim escapes the root's horizontal padding (negative insets) so it covers the
    // full screen while the padding still insets the card from the edges.
    backdrop: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: -Spacing.four,
      right: -Spacing.four,
      backgroundColor: 'rgba(59, 42, 33, 0.35)',
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
    // flexShrink lets the list shrink + scroll once the card hits its maxHeight
    // (achievements is long); a short list would just size to content.
    scroll: { flexShrink: 1, alignSelf: 'stretch' },
    scrollBody: { paddingBottom: 2 * s },
    reward: { fontSize: 15 * s, fontWeight: '900', color: '#C98A2B' },
    claimedText: { color: CLAIMED_GREEN, fontWeight: '900', fontSize: 13 * s },
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
