/**
 * Achievements — permanent one-time milestones across study/tasks/streak/social.
 * Each is measured against a lifetime stat; a met-but-unclaimed one shows a manual
 * Claim button paying bonus coins that bypass the daily earn cap (claimAchievement
 * in app-context). Claimed ones show a check; locked ones show their progress.
 *
 * Laid out by category (Study / Tasks / Streaks / Friends), two cards per row.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/coin-icon';
import { SoundPressable } from '@/components/sound-pressable';
import { useApp } from '@/context/app-context';
import { ACHIEVEMENTS, type AchievementDef, type AchievementStatKey } from '@/constants/quests';
import { RECIPE_IDS } from '@/constants/recipes';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { useTranslation } from '@/i18n';

const P = {
  cream: '#FFF8EF',
  card: '#FFFDF8',
  pink: '#F7A7B8',
  pinkSoft: '#FBD9E0',
  gold: '#E8B14C',
  goldSoft: '#FBEFD2',
  green: '#8BCF8B',
  brown: '#5B3A2E',
  muted: '#9A7B6D',
  track: '#F0E2D6',
  lockBorder: '#EDE0D4',
} as const;

// Section order on the screen. Each maps to an i18n category label.
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

  const renderCard = (a: AchievementDef) => {
    const value = stat(a.statKey);
    const current = Math.min(value, a.goal);
    const done = value >= a.goal;
    const claimed = claimedAchievements.includes(a.id);
    const pct = Math.max(0, Math.min(1, current / a.goal));

    return (
      <View key={a.id} style={[styles.card, !done && !claimed && styles.cardLocked]}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {t(`achievements.items.${a.id}.title`)}
          </Text>
          <View style={styles.rewardChip}>
            <CoinIcon size={13 * scale} />
            <Text style={styles.rewardChipText}>{a.reward}</Text>
          </View>
        </View>
        <Text style={styles.cardDesc}>{t(`achievements.items.${a.id}.desc`)}</Text>

        <View style={styles.cardFooter}>
          {!claimed && (
            <View style={styles.trackBar}>
              <View style={[styles.fill, { width: `${pct * 100}%` }, done && styles.fillDone]} />
            </View>
          )}
          {claimed ? (
            <Text style={styles.claimedText}>{t('achievements.claimed')}</Text>
          ) : (
            <>
              <Text style={styles.progressText}>
                {t('quests.progress', { current, goal: a.goal })}
              </Text>
              <SoundPressable
                sound="confirm"
                disabled={!done}
                onPress={() => claimAchievement(a.id)}
                style={({ pressed }) => [
                  styles.claimBtn,
                  !done && styles.claimBtnDisabled,
                  pressed && done && styles.pressed,
                ]}>
                <CoinIcon size={14 * scale} />
                <Text style={[styles.claimText, !done && styles.claimTextDisabled]}>
                  {t('achievements.claim', { coins: a.reward })}
                </Text>
              </SoundPressable>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: P.cream }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Text style={styles.title}>{t('achievements.title')}</Text>
        <Text style={styles.subtitle}>
          {unclaimedCount > 0
            ? t('achievements.readyCount', { count: unclaimedCount })
            : t('achievements.subtitle')}
        </Text>

        {CATEGORY_ORDER.map((cat) => {
          const items = ACHIEVEMENTS.filter((a) => a.category === cat);
          if (items.length === 0) return null;
          return (
            <View key={cat} style={styles.section}>
              <Text style={styles.sectionTitle}>{t(`achievements.categories.${cat}`)}</Text>
              <View style={styles.grid}>{items.map(renderCard)}</View>
            </View>
          );
        })}

        <SoundPressable
          sound="tap"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}>
          <Text style={styles.doneText}>{t('common.done')}</Text>
        </SoundPressable>
      </SafeAreaView>
    </ScrollView>
  );
}

const makeStyles = (s: number) =>
  StyleSheet.create({
    safe: { flex: 1, paddingHorizontal: 18 * s, alignItems: 'center' },
    title: { fontSize: 26 * s, fontWeight: '900', color: P.brown, marginTop: 8 * s, textAlign: 'center' },
    subtitle: { fontSize: 13 * s, color: P.muted, fontWeight: '700', marginTop: 4 * s, marginBottom: 14 * s, textAlign: 'center' },
    section: { alignSelf: 'stretch', width: '100%', marginBottom: 6 * s },
    sectionTitle: { fontSize: 16 * s, fontWeight: '900', color: P.brown, marginBottom: 10 * s, marginTop: 6 * s },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    card: {
      width: '48%',
      marginBottom: 12 * s,
      backgroundColor: P.card,
      borderRadius: 18 * s,
      borderWidth: 2,
      borderColor: P.pinkSoft,
      padding: 12 * s,
      gap: 5 * s,
    },
    cardLocked: { borderColor: P.lockBorder, opacity: 0.92 },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 * s },
    cardTitle: { flex: 1, fontSize: 14 * s, fontWeight: '900', color: P.brown },
    cardDesc: { fontSize: 11.5 * s, fontWeight: '600', color: P.muted, lineHeight: 16 * s },
    rewardChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3 * s,
      backgroundColor: P.goldSoft,
      borderRadius: 10 * s,
      paddingHorizontal: 6 * s,
      paddingVertical: 3 * s,
    },
    rewardChipText: { fontSize: 12 * s, fontWeight: '900', color: P.gold },
    // Footer pinned to the bottom so paired cards in a row line their buttons up.
    cardFooter: { marginTop: 'auto', gap: 7 * s, paddingTop: 4 * s },
    trackBar: { height: 8 * s, borderRadius: 5 * s, backgroundColor: P.track, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 5 * s, backgroundColor: P.pink },
    fillDone: { backgroundColor: P.green },
    progressText: { fontSize: 12 * s, fontWeight: '800', color: P.muted },
    claimBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5 * s,
      backgroundColor: P.pink,
      borderRadius: 13 * s,
      paddingVertical: 8 * s,
    },
    claimBtnDisabled: { backgroundColor: P.track },
    claimText: { color: '#fff', fontWeight: '900', fontSize: 12.5 * s },
    claimTextDisabled: { color: P.muted },
    claimedText: { color: P.green, fontWeight: '900', fontSize: 13 * s, textAlign: 'center' },
    doneBtn: {
      marginTop: 14 * s,
      marginBottom: 8 * s,
      alignSelf: 'stretch',
      width: '100%',
      backgroundColor: P.brown,
      borderRadius: 16 * s,
      paddingVertical: 14 * s,
      alignItems: 'center',
    },
    doneText: { color: '#fff', fontWeight: '900', fontSize: 15 * s },
    pressed: { opacity: 0.85 },
  });
