/**
 * To-Do List — the Tasks tab's second view, beside the month calendar.
 *
 * The calendar answers "what's on the 14th?". This answers "what do I still owe?":
 * every open task in one column, grouped by when it's due, with a tick box you can
 * hit without opening anything. It's also the ONLY place an undated task can live —
 * the calendar can't place a task with no day (see taskFallsOn), so "email teacher,
 * sometime" had nowhere to exist until this screen and its quick-add row.
 *
 * Drawn with the bakery-menu primitives (MenuCard / SectionLabel / MenuRow with its
 * dotted leader) so it reads as a page of the same notebook as the session picker
 * and achievements — a menu you tick, not a second calendar.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FitText } from '@/components/fit-text';
import { MenuCard, MenuHeader, MenuRow, SectionLabel, SectionRule } from '@/components/menu-card';
import { SoundPressable } from '@/components/sound-pressable';
import { ThemedText } from '@/components/themed-text';
import { formatTimeLabel } from '@/components/time-wheel-picker';
import { MAX_TASKS, useApp } from '@/context/app-context';
import i18n, { useTranslation } from '@/i18n';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { doneRowsForList, groupTasksForList, rowKey, type TaskGroupKey, type TaskListRow } from '@/lib/task-list-groups';
import { isTaskDoneOn } from '@/lib/task-recurrence';
import { containsProfanity } from '@/lib/profanity';
import { showPopup } from '@/lib/popup';
import { localizeSubjectName } from '@/lib/subject-utils';
import { BakeryColors as C, BakeryRadii, Spacing } from '@/constants/theme';

const SECTION_LABEL_KEY: Record<TaskGroupKey, string> = {
  overdue: 'tasks.sectionOverdue',
  today: 'tasks.today',
  week: 'tasks.sectionThisWeek',
  later: 'tasks.sectionLater',
  anytime: 'calendar.anytime',
};

// Local date math, matching task-calendar.tsx rather than app-context's timezone-aware
// todayISO: this list sits one tap from the calendar, and the two disagreeing about
// which day is "today" across a midnight boundary would be worse than either rule.
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Short weekday for a day inside the coming week, otherwise "Oct 6". */
function dayLabel(iso: string, today: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return '';
  const days = Math.round((d.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
  const locale = i18n.language || 'en-US';
  return Math.abs(days) < 7
    ? d.toLocaleDateString(locale, { weekday: 'short' })
    : d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

/** Chevron for the Done section header — code-drawn, like every other icon here. */
function Chevron({ open, size = 14 }: { open: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={open ? 'M5 15 L12 8 L19 15' : 'M5 9 L12 16 L19 9'}
        stroke={C.mocha}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function TaskRow({
  row,
  today,
  s,
  onToggled,
}: {
  row: TaskListRow;
  today: string;
  s: number;
  /** Told which row was just ticked, so the list can keep it where it is. */
  onToggled?: (key: string, nowDone: boolean) => void;
}) {
  const { subjects, toggleTaskOccurrence, use24HourTime } = useApp();
  const { task, occurrenceISO } = row;
  const subject = task.subjectId ? subjects.find((sub) => sub.id === task.subjectId) : null;
  const done = isTaskDoneOn(task, occurrenceISO);

  // One trailing label, picked by what actually tells you something: the due time
  // when there is one, else the day (for anything not due today), else the subject.
  // Anything more turns a one-line row into a paragraph.
  const timeLabel = task.dueTime ? formatTimeLabel(task.dueTime, use24HourTime) : null;
  const dateLabel = occurrenceISO && occurrenceISO !== today ? dayLabel(occurrenceISO, today) : null;
  const trailingText = timeLabel ?? dateLabel ?? (subject ? localizeSubjectName(subject.name, i18n.t) : null);

  return (
    <MenuRow
      name={task.title}
      nameStyle={done ? styles.nameDone : undefined}
      checkable
      checked={done}
      onCheckPress={() => {
        toggleTaskOccurrence(task.id, occurrenceISO);
        onToggled?.(rowKey(task.id, occurrenceISO), !done);
      }}
      icon={
        subject ? (
          <View style={[styles.subjectDot, { backgroundColor: subject.color }, { width: 8 * s, height: 8 * s, borderRadius: 4 * s }]} />
        ) : undefined
      }
      trailing={
        trailingText ? (
          <FitText numberOfLines={1} style={[styles.trailing, done && styles.trailingDone, { fontSize: 12.5 * s }]}>
            {trailingText}
          </FitText>
        ) : undefined
      }
      onPress={() => router.push({ pathname: '/add-task', params: { taskId: task.id } })}
      style={done ? styles.rowDone : undefined}
    />
  );
}

export function TaskList() {
  const { t } = useTranslation();
  const { scale } = useTabletScale();
  const s = scale;
  const { tasks, addTask } = useApp();
  const today = todayISO();

  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);
  // Rows ticked during THIS visit. They stay where they are, crossed out, rather
  // than vanishing from under the finger that tapped them (and, for a repeat,
  // appearing to jump a week forward). Component state, so the list settles the
  // next time you open it — which is exactly "until you come back".
  const [heldRows, setHeldRows] = useState<ReadonlySet<string>>(() => new Set());
  const onToggled = (key: string, nowDone: boolean) =>
    setHeldRows((prev) => {
      const next = new Set(prev);
      if (nowDone) next.add(key);
      else next.delete(key);
      return next;
    });

  const groups = useMemo(() => groupTasksForList(tasks, today, heldRows), [tasks, today, heldRows]);
  const doneRows = useMemo(() => doneRowsForList(tasks, today, heldRows), [tasks, today, heldRows]);
  const draftBlocked = containsProfanity(draft);

  // Quick capture: straight to an undated task, no form. A task added here has no
  // day, so it can't carry a reminder either (computeTaskReminders gives a dateless
  // task nothing) — reminderMode 'off' says that out loud rather than implying one.
  const submitDraft = () => {
    const title = draft.trim();
    if (!title || draftBlocked) return;
    const id = addTask({
      title,
      subjectId: null,
      dueDate: null,
      isDeadline: false,
      dueTime: null,
      estimatedMinutes: null,
      priority: 'medium',
      status: 'not_started',
      notifyAt: null,
      reminderMode: 'off',
    });
    // addTask returns '' at the cap rather than throwing.
    if (!id) {
      showPopup(t('addTask.limitReached'), t('addTask.limitMsg', { count: MAX_TASKS }));
      return;
    }
    setDraft('');
  };

  const empty = groups.length === 0 && doneRows.length === 0;

  return (
    <View style={styles.wrap}>
      <MenuCard>
        <MenuHeader title={t('tasks.listTitle')} />

        {empty ? (
          <View style={styles.empty}>
            <ThemedText type="smallBold" style={styles.emptyTitle}>{t('tasks.noTasks')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              {t('tasks.noTasksHint')}
            </ThemedText>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.key}>
              <SectionLabel style={group.key === 'overdue' ? styles.overdueLabel : undefined}>
                {t(SECTION_LABEL_KEY[group.key])}
              </SectionLabel>
              {group.rows.map((row) => (
                <TaskRow
                  key={`${row.task.id}:${row.occurrenceISO}`}
                  row={row}
                  today={today}
                  s={s}
                  onToggled={onToggled}
                />
              ))}
            </View>
          ))
        )}

        {doneRows.length > 0 && (
          <>
            <SectionRule />
            <SoundPressable style={styles.doneHeader} onPress={() => setShowDone((v) => !v)}>
              <SectionLabel style={styles.doneLabel}>{t('tasks.doneCount', { count: doneRows.length })}</SectionLabel>
              <Chevron open={showDone} size={14 * s} />
            </SoundPressable>
            {showDone &&
              doneRows.map((row) => (
                <TaskRow key={`done:${row.task.id}:${row.occurrenceISO}`} row={row} today={today} s={s} />
              ))}
          </>
        )}
      </MenuCard>

      {/* Quick-add: the dashed "one more line on the list" row. */}
      <View style={[styles.quickAdd, draftBlocked && styles.quickAddBlocked]}>
        <ThemedText style={[styles.plus, { fontSize: 18 * s }]}>＋</ThemedText>
        <TextInput
          style={[styles.input, { fontSize: 15 * s }]}
          value={draft}
          onChangeText={setDraft}
          placeholder={t('tasks.quickAdd')}
          placeholderTextColor={C.latte}
          returnKeyType="done"
          onSubmitEditing={submitDraft}
          blurOnSubmit={false}
          maxLength={80}
        />
      </View>
      {draftBlocked && (
        <ThemedText type="small" style={styles.blockedWarn}>{t('common.inappropriateLanguage')}</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },
  nameDone: { textDecorationLine: 'line-through', color: C.mocha },
  rowDone: { opacity: 0.6 },
  trailing: { fontSize: 12.5, fontWeight: '700', color: C.mocha },
  trailingDone: { textDecorationLine: 'line-through' },
  overdueLabel: { color: C.danger },
  doneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  doneLabel: { flexShrink: 1 },
  empty: { paddingVertical: Spacing.four, alignItems: 'center', gap: 4 },
  emptyTitle: { color: C.cocoaDark },
  emptyText: { textAlign: 'center' },
  quickAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    borderStyle: 'dashed',
    backgroundColor: C.cream,
  },
  quickAddBlocked: { borderColor: '#C2536B' },
  plus: { color: C.mocha, fontWeight: '800' },
  input: { flex: 1, color: C.cocoaDark, fontWeight: '600', paddingVertical: 2 },
  blockedWarn: { color: '#C2536B', fontWeight: '700', paddingHorizontal: Spacing.three },
});
