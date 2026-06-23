/**
 * Daily Goals — the fixed everyday goals (DAILY_GOALS, the same list each day), each
 * with a progress bar and a manual Claim button. Rewards are bonus coins that bypass
 * the daily earn cap (claimQuestReward in app-context). Counters reset at 12am in the
 * account timezone; unclaimed rewards are forfeited then (use-it-or-lose-it).
 * (Route/file kept as `daily-quests` to avoid router churn; UI reads "Daily Goals".)
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/coin-icon';
import { SoundPressable } from '@/components/sound-pressable';
import { useApp } from '@/context/app-context';
import { dailyGoalIds, getQuest, type QuestStatKey } from '@/constants/quests';
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
  greenSoft: '#E3F4E3',
  brown: '#5B3A2E',
  muted: '#9A7B6D',
  track: '#F0E2D6',
} as const;

export default function DailyQuestsScreen() {
  const { t } = useTranslation();
  const { scale } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale), [scale]);
  const { quests, claimQuestReward } = useApp();

  const ids = dailyGoalIds();

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: P.cream }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Text style={styles.title}>{t('quests.title')}</Text>
        <Text style={styles.subtitle}>{t('quests.resetsMidnight')}</Text>

        <View style={styles.list}>
          {ids.map((id) => {
            const def = getQuest(id);
            if (!def) return null;
            const current = Math.min((quests[def.statKey as QuestStatKey] as number) ?? 0, def.goal);
            const done = current >= def.goal;
            const claimed = quests.claimedToday.includes(id);
            const pct = Math.max(0, Math.min(1, current / def.goal));

            return (
              <View key={id} style={styles.questCard}>
                <View style={styles.questTop}>
                  <View style={styles.questText}>
                    <Text style={styles.questTitle}>{t(`quests.items.${id}.title`)}</Text>
                    <Text style={styles.questDesc}>{t(`quests.items.${id}.desc`)}</Text>
                  </View>
                  <View style={styles.rewardChip}>
                    <CoinIcon size={16 * scale} />
                    <Text style={styles.rewardChipText}>{def.reward}</Text>
                  </View>
                </View>

                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pct * 100}%` }, done && styles.fillDone]} />
                </View>

                <View style={styles.questBottom}>
                  <Text style={styles.progressText}>
                    {t('quests.progress', { current, goal: def.goal })}
                  </Text>
                  {claimed ? (
                    <Text style={styles.claimedText}>{t('quests.claimed')}</Text>
                  ) : (
                    <SoundPressable
                      sound="confirm"
                      disabled={!done}
                      onPress={() => claimQuestReward(id)}
                      style={({ pressed }) => [
                        styles.claimBtn,
                        !done && styles.claimBtnDisabled,
                        pressed && done && styles.pressed,
                      ]}>
                      <CoinIcon size={16 * scale} />
                      <Text style={[styles.claimText, !done && styles.claimTextDisabled]}>
                        {t('quests.claim', { coins: def.reward })}
                      </Text>
                    </SoundPressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>

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
    safe: { flex: 1, paddingHorizontal: 20 * s, alignItems: 'center' },
    title: { fontSize: 26 * s, fontWeight: '900', color: P.brown, marginTop: 8 * s, textAlign: 'center' },
    subtitle: { fontSize: 13 * s, color: P.muted, fontWeight: '700', marginTop: 4 * s, marginBottom: 18 * s },
    list: { alignSelf: 'stretch', gap: 14 * s, width: '100%' },
    questCard: {
      backgroundColor: P.card,
      borderRadius: 20 * s,
      borderWidth: 2,
      borderColor: P.pinkSoft,
      padding: 16 * s,
      gap: 10 * s,
    },
    questTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 * s },
    questText: { flex: 1, gap: 3 * s },
    questTitle: { fontSize: 15.5 * s, fontWeight: '900', color: P.brown },
    questDesc: { fontSize: 12.5 * s, fontWeight: '600', color: P.muted, lineHeight: 17 * s },
    rewardChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4 * s,
      backgroundColor: P.goldSoft,
      borderRadius: 12 * s,
      paddingHorizontal: 8 * s,
      paddingVertical: 4 * s,
    },
    rewardChipText: { fontSize: 13 * s, fontWeight: '900', color: P.gold },
    track: { height: 10 * s, borderRadius: 6 * s, backgroundColor: P.track, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 6 * s, backgroundColor: P.pink },
    fillDone: { backgroundColor: P.green },
    questBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    progressText: { fontSize: 12.5 * s, fontWeight: '800', color: P.muted },
    claimBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6 * s,
      backgroundColor: P.pink,
      borderRadius: 14 * s,
      paddingHorizontal: 14 * s,
      paddingVertical: 8 * s,
    },
    claimBtnDisabled: { backgroundColor: P.track },
    claimText: { color: '#fff', fontWeight: '900', fontSize: 13.5 * s },
    claimTextDisabled: { color: P.muted },
    claimedText: { color: P.green, fontWeight: '900', fontSize: 13.5 * s },
    doneBtn: {
      marginTop: 24 * s,
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
