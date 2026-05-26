import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getReminderStyleEffect } from '@/constants/shop-effects';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { DAILY_SESSIONS_GOAL, TODAY_GOAL } from '@/constants/placeholder-data';
import { getHomeGreeting } from '@/constants/companion-lines';
import { getAmbienceEmoji, getAmbienceName } from '@/app/ambience-picker';
import {
  BakeryColors,
  BakeryRadii,
  BakeryShadow,
  BottomTabInset,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';

function daysUntil(dateISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateISO);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function formatExamDate(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getCountdownLabel(days: number): string {
  if (days < 0) return 'Past due';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

const HOME_ROOM_IMAGE = require('@/assets/images/sunlit-bedroom-sanctuary-stockcake.webp');
const HOME_CHARACTER_IMAGE = require('@/assets/images/companion/anime_girl_PNG96_cutout.png');

export default function HomeScreen() {
  const {
    coins,
    sessionsCompleted,
    reminderEnabled,
    reminderTime,
    streak,
    isPlus,
    ambienceId,
    equippedShopItems,
    examCountdowns,
  } = useApp();
  const companionLine = getHomeGreeting({
    lastStudyDate: streak.lastStudyDate,
    currentStreak: streak.currentStreak,
  });
  const reminderStyle = getReminderStyleEffect(equippedShopItems);
  const goalProgress = Math.min(sessionsCompleted, DAILY_SESSIONS_GOAL);
  const goalPct = Math.round((goalProgress / DAILY_SESSIONS_GOAL) * 100);
  const nextUpcomingExam = [...examCountdowns]
    .filter((exam) => daysUntil(exam.dateISO) >= 0)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))[0];
  const latestExam = [...examCountdowns].sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0];
  const featuredExam = nextUpcomingExam ?? latestExam ?? null;
  const examDays = featuredExam ? daysUntil(featuredExam.dateISO) : null;
  const examIsUrgent = examDays !== null && examDays >= 0 && examDays <= 7;
  const examIsPast = examDays !== null && examDays < 0;
  const resolvedCharacterAsset = Asset.fromModule(HOME_CHARACTER_IMAGE);
  const debugRunIdRef = useRef(`home-debug-${Date.now()}`);
  const debugRunId = debugRunIdRef.current;

  const handleExamPress = () => {
    if (featuredExam) {
      router.push('/progress');
      return;
    }
    router.push('/add-exam');
  };

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7641/ingest/f1e26a80-3c70-4f86-827a-d6992368edf3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bf5be3'},body:JSON.stringify({sessionId:'bf5be3',runId:debugRunId,hypothesisId:'H2|H3|H4|H5',location:'src/app/(tabs)/index.tsx:80',message:'home_visual_layers',data:{characterAsset:'anime_girl_PNG96_cutout.png',roomAsset:'sunlit-bedroom-sanctuary-stockcake.webp',sceneBackground:'#E8DBCE',roomOverlayBackground:'rgba(74, 48, 32, 0.06)',characterAreaBackground:null,heroImageBackground:null,goalProgress,goalPct,featuredExam:featuredExam?.name ?? null,reminderEnabled,reminderTime},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // #region agent log
    console.warn(JSON.stringify({sessionId:'bf5be3',runId:debugRunId,hypothesisId:'H3|H4',location:'src/app/(tabs)/index.tsx:86',message:'home_visual_layers_console',data:{roomImageOffsets:{left:-72,right:24},roomOverlayBackground:'rgba(74, 48, 32, 0.06)',heroImage:{width:'96%',maxWidth:372,maxHeight:430},goalProgress,goalPct},timestamp:Date.now()}));
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7641/ingest/f1e26a80-3c70-4f86-827a-d6992368edf3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bf5be3'},body:JSON.stringify({sessionId:'bf5be3',runId:debugRunId,hypothesisId:'H5',location:'src/app/(tabs)/index.tsx:90',message:'resolved_character_asset',data:{assetUri:resolvedCharacterAsset.uri ?? null,assetHash:(resolvedCharacterAsset as any)?.hash ?? null,assetWidth:resolvedCharacterAsset.width ?? null,assetHeight:resolvedCharacterAsset.height ?? null,assetKind:'cutout'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // #region agent log
    console.warn(JSON.stringify({sessionId:'bf5be3',runId:debugRunId,hypothesisId:'H5',location:'src/app/(tabs)/index.tsx:93',message:'resolved_character_asset_console',data:{assetUri:resolvedCharacterAsset.uri ?? null,assetHash:(resolvedCharacterAsset as any)?.hash ?? null,assetWidth:resolvedCharacterAsset.width ?? null,assetHeight:resolvedCharacterAsset.height ?? null,assetKind:'cutout'},timestamp:Date.now()}));
    // #endregion
  }, [
    debugRunId,
    featuredExam?.name,
    goalPct,
    goalProgress,
    reminderEnabled,
    reminderTime,
    resolvedCharacterAsset.height,
    resolvedCharacterAsset.uri,
    resolvedCharacterAsset.width,
  ]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.scene}>
          <Image source={HOME_ROOM_IMAGE} style={styles.roomBackground} contentFit="cover" />
          <ThemedView style={styles.roomOverlay} />

          <ThemedView style={styles.topHud}>
            <ThemedView style={styles.statusStack}>
              <ThemedView style={[styles.statusChip, styles.coinChip]}>
                <ThemedText type="smallBold" style={styles.coinChipText}>
                  🪙 {coins}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.statusChip}>
                <ThemedText type="small" style={styles.statusChipText}>
                  🔥 {streak.currentStreak} day streak
                </ThemedText>
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.goalHud}>
              <ThemedText type="smallBold" style={styles.goalHudTitle}>
                Goal
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.goalHudCopy}>
                {TODAY_GOAL}
              </ThemedText>
              <ThemedText style={styles.goalHudProgress}>
                {goalProgress}/{DAILY_SESSIONS_GOAL}
              </ThemedText>
              <ThemedView style={styles.goalHudTrack}>
                <ThemedView
                  style={[
                    styles.goalHudFill,
                    { width: `${goalPct}%` as unknown as number },
                  ]}
                />
              </ThemedView>
            </ThemedView>
          </ThemedView>

          <ThemedView
            style={styles.characterArea}
            pointerEvents="none"
            onLayout={(event) => {
              const { x, y, width, height } = event.nativeEvent.layout;
              // #region agent log
              fetch('http://127.0.0.1:7641/ingest/f1e26a80-3c70-4f86-827a-d6992368edf3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bf5be3'},body:JSON.stringify({sessionId:'bf5be3',runId:debugRunId,hypothesisId:'H2|H4',location:'src/app/(tabs)/index.tsx:125',message:'character_area_layout',data:{x,y,width,height,backgroundColor:null,pointerEvents:'none'},timestamp:Date.now()})}).catch(()=>{});
              // #endregion
            }}>
            <Image
              source={HOME_CHARACTER_IMAGE}
              style={styles.heroImage}
              contentFit="contain"
              contentPosition="bottom"
              accessibilityLabel="Home character"
              onLayout={(event) => {
                const { x, y, width, height } = event.nativeEvent.layout;
                // #region agent log
                fetch('http://127.0.0.1:7641/ingest/f1e26a80-3c70-4f86-827a-d6992368edf3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bf5be3'},body:JSON.stringify({sessionId:'bf5be3',runId:debugRunId,hypothesisId:'H2|H4',location:'src/app/(tabs)/index.tsx:132',message:'hero_image_layout',data:{x,y,width,height,contentFit:'contain',contentPosition:'bottom',backgroundColor:null},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
                // #region agent log
                console.warn(JSON.stringify({sessionId:'bf5be3',runId:debugRunId,hypothesisId:'H2|H4',location:'src/app/(tabs)/index.tsx:150',message:'hero_image_layout_console',data:{x,y,width,height,contentFit:'contain',contentPosition:'bottom',backgroundColor:null},timestamp:Date.now()}));
                // #endregion
              }}
              onLoad={(event: any) => {
                const source = event?.source ?? event?.nativeEvent?.source ?? null;
                // #region agent log
                fetch('http://127.0.0.1:7641/ingest/f1e26a80-3c70-4f86-827a-d6992368edf3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bf5be3'},body:JSON.stringify({sessionId:'bf5be3',runId:debugRunId,hypothesisId:'H3|H5',location:'src/app/(tabs)/index.tsx:139',message:'hero_image_loaded',data:{cacheType:event?.cacheType ?? event?.nativeEvent?.cacheType ?? null,sourceWidth:source?.width ?? null,sourceHeight:source?.height ?? null,assetKind:'cutout'},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
                // #region agent log
                console.warn(JSON.stringify({sessionId:'bf5be3',runId:debugRunId,hypothesisId:'H3|H5',location:'src/app/(tabs)/index.tsx:167',message:'hero_image_loaded_console',data:{cacheType:event?.cacheType ?? event?.nativeEvent?.cacheType ?? null,sourceWidth:source?.width ?? null,sourceHeight:source?.height ?? null,assetKind:'cutout'},timestamp:Date.now()}));
                // #endregion
              }}
              onError={(event: any) => {
                // #region agent log
                fetch('http://127.0.0.1:7641/ingest/f1e26a80-3c70-4f86-827a-d6992368edf3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bf5be3'},body:JSON.stringify({sessionId:'bf5be3',runId:debugRunId,hypothesisId:'H1',location:'src/app/(tabs)/index.tsx:144',message:'hero_image_error',data:{error:event?.error ?? event?.nativeEvent?.error ?? null},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
              }}
            />
          </ThemedView>

          <ThemedView style={styles.bottomHud}>
            <ThemedView style={styles.bubbleCard}>
              <ThemedText type="small" style={styles.bubbleText}>
                {companionLine}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.metaRow}>
              <Pressable
                style={({ pressed }) => [styles.metaCardPressable, pressed && styles.cardPressed]}
                onPress={handleExamPress}>
                <ThemedView
                  style={[
                    styles.metaCard,
                    examIsUrgent && styles.metaCardUrgent,
                    examIsPast && styles.metaCardPast,
                  ]}>
                  <ThemedText type="smallBold">Exam</ThemedText>
                  {featuredExam ? (
                    <>
                      <ThemedText style={styles.metaHeadline} numberOfLines={1}>
                        {featuredExam.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {featuredExam.subject ? `${featuredExam.subject} · ` : ''}
                        {formatExamDate(featuredExam.dateISO)}
                      </ThemedText>
                      <ThemedText
                        type="smallBold"
                        style={[
                          styles.metaAccentText,
                          examIsUrgent && styles.metaAccentTextUrgent,
                          examIsPast && styles.metaAccentTextPast,
                        ]}>
                        {examDays === null ? '--' : getCountdownLabel(examDays)}
                      </ThemedText>
                    </>
                  ) : (
                    <>
                      <ThemedText style={styles.metaHeadline}>No exam yet</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Add a countdown
                      </ThemedText>
                    </>
                  )}
                </ThemedView>
              </Pressable>

              <ThemedView style={styles.metaCard}>
                <ThemedText type="smallBold">Reminder</ThemedText>
                <ThemedText style={styles.metaHeadline}>
                  {reminderStyle?.emoji ?? '🔔'} {reminderEnabled ? reminderTime : 'Reminder off'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                  {isPlus
                    ? ambienceId
                      ? `${getAmbienceEmoji(ambienceId)} ${getAmbienceName(ambienceId)}`
                      : 'Pick an ambience'
                    : 'Unlock ambience with Plus'}
                </ThemedText>
              </ThemedView>
            </ThemedView>

            <Pressable
              style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
              onPress={() => router.push('/session-picker')}>
              <ThemedText type="smallBold" style={styles.startButtonText}>
                Start Session
              </ThemedText>
            </Pressable>
          </ThemedView>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BakeryColors.frosting,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  scene: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    padding: Spacing.three,
    justifyContent: 'space-between',
    backgroundColor: '#E8DBCE',
  },
  roomBackground: {
    ...StyleSheet.absoluteFill,
    left: -72,
    right: 24,
  },
  roomOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(74, 48, 32, 0.06)',
  },
  topHud: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
    zIndex: 2,
  },
  statusStack: {
    gap: Spacing.two,
    maxWidth: '42%',
  },
  statusChip: {
    borderRadius: BakeryRadii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 249, 241, 0.94)',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  coinChip: {
    backgroundColor: 'rgba(255, 236, 199, 0.98)',
  },
  coinChipText: {
    color: BakeryColors.cocoaDark,
  },
  statusChipText: {
    color: BakeryColors.cocoa,
  },
  goalHud: {
    width: 132,
    borderRadius: BakeryRadii.card,
    padding: Spacing.two,
    gap: Spacing.one,
    backgroundColor: 'rgba(255, 249, 241, 0.95)',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  goalHudTitle: {
    fontSize: 13,
  },
  goalHudCopy: {
    fontSize: 11,
    lineHeight: 16,
  },
  goalHudProgress: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    color: BakeryColors.mocha,
  },
  goalHudTrack: {
    height: 7,
    borderRadius: BakeryRadii.pill,
    backgroundColor: 'rgba(208, 170, 135, 0.35)',
    overflow: 'hidden',
  },
  goalHudFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: BakeryColors.honey,
  },
  characterArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  heroImage: {
    width: '96%',
    maxWidth: 372,
    height: '100%',
    maxHeight: 430,
  },
  bottomHud: {
    zIndex: 2,
    gap: Spacing.two,
  },
  cardPressed: { opacity: 0.85 },
  bubbleCard: {
    borderRadius: BakeryRadii.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 249, 241, 0.95)',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  bubbleText: {
    textAlign: 'center',
    lineHeight: 20,
    color: BakeryColors.cocoaDark,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metaCardPressable: {
    flex: 1,
  },
  metaCard: {
    minHeight: 96,
    borderRadius: BakeryRadii.card,
    padding: Spacing.two,
    gap: 4,
    backgroundColor: 'rgba(255, 249, 241, 0.95)',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  metaCardUrgent: {
    borderColor: `${BakeryColors.danger}66`,
  },
  metaCardPast: {
    borderColor: '#99999955',
  },
  metaHeadline: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  metaAccentText: {
    color: BakeryColors.mocha,
  },
  metaAccentTextUrgent: {
    color: BakeryColors.danger,
  },
  metaAccentTextPast: {
    color: '#999',
  },
  startButton: {
    backgroundColor: BakeryColors.honey,
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D29649',
    ...BakeryShadow,
  },
  startButtonPressed: { opacity: 0.85 },
  startButtonText: { color: BakeryColors.cocoaDark, fontSize: 17 },
});
