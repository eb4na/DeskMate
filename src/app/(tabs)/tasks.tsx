import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SoundPressable } from '@/components/sound-pressable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FitText } from '@/components/fit-text';
import { NotebookBackground } from '@/components/notebook-background';
import { TaskCalendar } from '@/components/task-calendar';
import { TaskList } from '@/components/task-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp, MAX_EXAMS } from '@/context/app-context';

import { useTranslation } from '@/i18n';
import { localizeSubjectName } from '@/lib/subject-utils';
import { BakeryColors, BakeryRadii, BakeryShadow, BottomTabClearance, MaxContentWidth, PastelCards, Spacing } from '@/constants/theme';
import { useTabletScale } from '@/hooks/use-tablet-scale';

export default function TasksScreen() {
  const { t } = useTranslation();
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  const { tasks, subjects, examCountdowns, tasksView, setTasksView } = useApp();
  const listView = tasksView === 'list';
  // Search lives in the header next to + Exam / + Task, but drives the calendar
  // area below, so the Tasks screen owns the flag and TaskCalendar renders it.
  const [searchMode, setSearchMode] = useState(false);

  // Exam countdowns aren't a Plus perk — one cap for everyone.
  const canAddExam = examCountdowns.length < MAX_EXAMS;

  // Avoidance tracker: tasks with postponeCount >= 1, not done, sorted by count desc
  const needsAttention = tasks
    .filter((t) => t.status !== 'done' && t.postponeCount >= 1)
    .sort((a, b) => b.postponeCount - a.postponeCount)
    .slice(0, 3);

  return (
    <View style={styles.root}>
      <NotebookBackground />
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBox}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <ThemedView type="transparent" style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              {t('tasks.title')}
            </ThemedText>
            <ThemedView type="transparent" style={styles.headerActions}>
              {!listView && (
              <SoundPressable
                style={({ pressed }) => [styles.searchBtn, searchMode && styles.searchBtnActive, pressed && styles.pressed]}
                onPress={() => setSearchMode((v) => !v)}
                accessibilityLabel={t('calendar.searchTasks')}>
                <Svg width={18 * scale} height={18 * scale} viewBox="0 0 24 24" fill="none">
                  <Circle cx="10.5" cy="10.5" r="6.5" stroke={searchMode ? '#FFFFFF' : BakeryColors.cocoaDark} strokeWidth={2.4} />
                  <Path d="M15.6 15.6 L20.5 20.5" stroke={searchMode ? '#FFFFFF' : BakeryColors.cocoaDark} strokeWidth={2.4} strokeLinecap="round" />
                </Svg>
              </SoundPressable>
              )}
              <SoundPressable
                style={({ pressed }) => [styles.manageBtn, pressed && styles.pressed]}
                onPress={() => router.push(canAddExam ? '/add-exam' : '/plus-upgrade')}>
                <ThemedText themeColor="textSecondary" style={styles.manageBtnText}>{t('tasks.addExamShort')}</ThemedText>
              </SoundPressable>
              <SoundPressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                onPress={() => router.push('/add-task')}>
                <ThemedText style={styles.addBtnText}>{t('tasks.addTaskShort')}</ThemedText>
              </SoundPressable>
            </ThemedView>
          </ThemedView>

          {/* Calendar ⇄ List. Same tasks, two ways to read them: the calendar for
              "what's on the 14th", the list for "what do I still owe". */}
          <ThemedView type="transparent" style={styles.viewSwitch}>
            {([
              { key: 'calendar' as const, label: 'tasks.viewCalendar' },
              { key: 'list' as const, label: 'tasks.viewList' },
            ]).map(({ key, label }) => {
              const active = tasksView === key;
              return (
                <SoundPressable
                  key={key}
                  style={({ pressed }) => [styles.viewPill, active && styles.viewPillOn, pressed && styles.pressed]}
                  onPress={() => {
                    setSearchMode(false);
                    setTasksView(key);
                  }}>
                  <ThemedText type="smallBold" numberOfLines={1} style={[styles.viewPillText, active && styles.viewPillTextOn]}>
                    {t(label)}
                  </ThemedText>
                </SoundPressable>
              );
            })}
          </ThemedView>

          {listView ? (
            <TaskList />
          ) : (
            /* Calendar with day notes + task peek */
            <TaskCalendar searchMode={searchMode} onCloseSearch={() => setSearchMode(false)} />
          )}

          {/* Needs attention (avoidance tracker) */}
          {needsAttention.length > 0 && (
            <ThemedView type="transparent" style={styles.section}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                {t('tasks.needsAttention')}
              </ThemedText>
              {needsAttention.map((task) => {
                const subjectName = task.subjectId
                  ? subjects.find((s) => s.id === task.subjectId)?.name
                  : null;
                const nudge = subjectName
                  ? t('tasks.nudgeSubject', { subject: localizeSubjectName(subjectName, t) })
                  : t('tasks.nudgeGeneric');
                return (
                  <ThemedView key={task.id} type="backgroundElement" style={styles.nudgeCard}>
                    <FitText type="smallBold" style={styles.nudgeTitle} numberOfLines={1}>
                      {task.title}
                    </FitText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.nudgeText}>
                      {nudge}
                    </ThemedText>
                  </ThemedView>
                );
              })}
            </ThemedView>
          )}

        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const makeStyles = (s: number, contentWidth: number) => {
  return StyleSheet.create({
  root: { flex: 1 },
  // Keep the whole scroll above the floating menu bar so it stays fully visible
  // and content never scrolls underneath it.
  scrollBox: { flex: 1, marginBottom: BottomTabClearance },
  safeArea: {
    paddingHorizontal: Spacing.four * s,
    paddingTop: Spacing.four * s,
    paddingBottom: Spacing.four * s,
    maxWidth: contentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four * s,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewSwitch: {
    flexDirection: 'row',
    backgroundColor: BakeryColors.cream,
    borderRadius: BakeryRadii.chip * s,
    padding: 3 * s,
    gap: 2 * s,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  viewPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7 * s,
    borderRadius: BakeryRadii.chip * s,
  },
  viewPillOn: { backgroundColor: BakeryColors.buttonPink },
  viewPillText: { color: BakeryColors.mocha },
  viewPillTextOn: { color: '#FFFFFF' },
  title: { fontSize: 28 * s, lineHeight: 34 * s },
  headerActions: { flexDirection: 'row', gap: Spacing.two * s, alignItems: 'center' },
  manageBtn: {
    paddingHorizontal: Spacing.three * s,
    paddingVertical: 8 * s,
    borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.cream,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  // Exam-button text: scaled to match the Task button's text (was a fixed 14px via
  // type="small", which left the Exam button smaller than Task on tablets).
  manageBtnText: { fontSize: 14 * s, fontWeight: '700' },
  addBtn: {
    backgroundColor: BakeryColors.jam,
    borderRadius: BakeryRadii.pill,
    paddingHorizontal: Spacing.three * s,
    paddingVertical: 8 * s,
    borderWidth: 1.5,
    borderColor: '#E0A33C',
    ...BakeryShadow,
  },
  addBtnText: { color: '#fff', fontSize: 14 * s, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  section: { gap: Spacing.two * s },
  searchBtn: {
    width: 40 * s,
    height: 40 * s,
    borderRadius: 20 * s,
    backgroundColor: BakeryColors.rose,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  searchBtnActive: { backgroundColor: BakeryColors.buttonPink },
  sectionTitle: { fontSize: 13 * s, textTransform: 'uppercase', letterSpacing: 1.2, color: BakeryColors.mocha, fontWeight: '800' },
  nudgeCard: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.three * s,
    gap: Spacing.two * s,
    borderLeftWidth: 3,
    borderLeftColor: BakeryColors.honey,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  nudgeTitle: { fontSize: 14 * s },
  nudgeText: { lineHeight: 20 * s, fontSize: 13 * s },

  });
};
