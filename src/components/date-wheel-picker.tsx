import { Picker } from '@expo/ui/community/picker';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BakeryColors, BakeryRadii, BakeryShadow, Colors, Spacing } from '@/constants/theme';

type DateParts = {
  year: number;
  month: number;
  day: number;
};

type DateWheelPickerProps = {
  value: string | null | undefined;
  onChange: (nextValue: string) => void;
  minimumDateISO?: string;
  maximumDateISO?: string;
  minYear?: number;
  maxYear?: number;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getTodayISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateLabel(value?: string | null) {
  const parts = parseISODate(value);
  if (!parts) return 'Select date';
  return `${MONTH_LABELS[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

function parseISODate(value?: string | null): DateParts | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > getDaysInMonth(year, month)) return null;

  return { year, month, day };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function toDateNumber(parts: DateParts) {
  return parts.year * 10000 + parts.month * 100 + parts.day;
}

function clampDateParts(parts: DateParts, minParts: DateParts | null, maxParts: DateParts | null): DateParts {
  const normalized: DateParts = {
    year: parts.year,
    month: Math.max(1, Math.min(12, parts.month)),
    day: Math.max(1, Math.min(getDaysInMonth(parts.year, Math.max(1, Math.min(12, parts.month))), parts.day)),
  };

  if (minParts && toDateNumber(normalized) < toDateNumber(minParts)) return minParts;
  if (maxParts && toDateNumber(normalized) > toDateNumber(maxParts)) return maxParts;
  return normalized;
}

function toISODate(parts: DateParts) {
  const year = String(parts.year).padStart(4, '0');
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function DateWheelPicker({
  value,
  onChange,
  minimumDateISO,
  maximumDateISO,
  minYear,
  maxYear,
}: DateWheelPickerProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const todayParts = parseISODate(getTodayISO())!;
  const [isOpen, setIsOpen] = useState(false);
  const minParts = useMemo(() => parseISODate(minimumDateISO) ?? null, [minimumDateISO]);
  const maxParts = useMemo(() => parseISODate(maximumDateISO) ?? null, [maximumDateISO]);

  const selected = useMemo(() => {
    const fallback = parseISODate(value) ?? todayParts;
    return clampDateParts(fallback, minParts, maxParts);
  }, [maxParts, minParts, todayParts, value]);

  const normalizedSelectedISO = useMemo(() => toISODate(selected), [selected]);

  useEffect(() => {
    if (value !== normalizedSelectedISO) {
      onChange(normalizedSelectedISO);
    }
  }, [normalizedSelectedISO, onChange, value]);

  const yearStart = minParts?.year ?? minYear ?? todayParts.year - 2;
  const yearEnd = maxParts?.year ?? maxYear ?? todayParts.year + 10;

  const monthStart = selected.year === minParts?.year ? minParts.month : 1;
  const monthEnd = selected.year === maxParts?.year ? maxParts.month : 12;
  const dayStart =
    selected.year === minParts?.year && selected.month === minParts.month ? minParts.day : 1;
  const dayEnd =
    selected.year === maxParts?.year && selected.month === maxParts.month
      ? maxParts.day
      : getDaysInMonth(selected.year, selected.month);

  const years = range(yearStart, yearEnd);
  const months = range(monthStart, monthEnd);
  const days = range(dayStart, dayEnd);

  const handleChange = (patch: Partial<DateParts>) => {
    const next = clampDateParts(
      {
        year: patch.year ?? selected.year,
        month: patch.month ?? selected.month,
        day: patch.day ?? selected.day,
      },
      minParts,
      maxParts,
    );
    onChange(toISODate(next));
  };

  const pickerItemStyle = {
    color: theme.text,
    fontSize: Platform.OS === 'ios' ? 16 : 15,
  } as const;

  const selectedMonth = String(selected.month);
  const selectedDay = String(selected.day);
  const selectedYear = String(selected.year);

  return (
    <>
      <Pressable onPress={() => setIsOpen(true)} style={({ pressed }) => [pressed && styles.pressed]}>
        <View
          style={[
            styles.trigger,
            { backgroundColor: theme.backgroundElement, borderColor: BakeryColors.border },
          ]}>
          <View style={styles.triggerTextWrap}>
            <ThemedText type="smallBold">Date</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateLabel(normalizedSelectedISO)}
            </ThemedText>
          </View>
          <ThemedText type="smallBold" style={styles.triggerChevron}>
            Select
          </ThemedText>
        </View>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)} />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.background, borderColor: BakeryColors.border },
            ]}>
            <View style={styles.modalHeader}>
              <ThemedText type="smallBold">Pick a date</ThemedText>
              <Pressable onPress={() => setIsOpen(false)} style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedText type="linkPrimary">Done</ThemedText>
              </Pressable>
            </View>

            <View style={styles.container}>
              <View style={styles.column}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.pickerLabel}>
                  Month
                </ThemedText>
                <View
                  style={[
                    styles.pickerShell,
                    { backgroundColor: theme.backgroundElement, borderColor: BakeryColors.border },
                  ]}>
                  <Picker
                    selectedValue={selectedMonth}
                    onValueChange={(nextValue) => handleChange({ month: Number(nextValue) })}
                    style={styles.picker}>
                    {months.map((month) => (
                      <Picker.Item
                        key={month}
                        label={MONTH_LABELS[month - 1]}
                        value={String(month)}
                        style={pickerItemStyle}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.column}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.pickerLabel}>
                  Day
                </ThemedText>
                <View
                  style={[
                    styles.pickerShell,
                    { backgroundColor: theme.backgroundElement, borderColor: BakeryColors.border },
                  ]}>
                  <Picker
                    selectedValue={selectedDay}
                    onValueChange={(nextValue) => handleChange({ day: Number(nextValue) })}
                    style={styles.picker}>
                    {days.map((day) => (
                      <Picker.Item
                        key={day}
                        label={String(day)}
                        value={String(day)}
                        style={pickerItemStyle}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.column}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.pickerLabel}>
                  Year
                </ThemedText>
                <View
                  style={[
                    styles.pickerShell,
                    { backgroundColor: theme.backgroundElement, borderColor: BakeryColors.border },
                  ]}>
                  <Picker
                    selectedValue={selectedYear}
                    onValueChange={(nextValue) => handleChange({ year: Number(nextValue) })}
                    style={styles.picker}>
                    {years.map((year) => (
                      <Picker.Item
                        key={year}
                        label={String(year)}
                        value={String(year)}
                        style={pickerItemStyle}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              Selected: {formatDateLabel(normalizedSelectedISO)}
            </ThemedText>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  trigger: {
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...BakeryShadow,
  },
  triggerTextWrap: {
    gap: 2,
    flex: 1,
  },
  triggerChevron: {
    color: BakeryColors.mocha,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.three,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(48, 32, 24, 0.35)',
  },
  modalCard: {
    borderRadius: BakeryRadii.panel,
    borderWidth: 1.5,
    padding: Spacing.three,
    gap: Spacing.three,
    ...BakeryShadow,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  column: {
    flex: 1,
    gap: Spacing.one,
  },
  pickerLabel: {
    marginLeft: 4,
  },
  pickerShell: {
    minHeight: Platform.OS === 'ios' ? 176 : 54,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    justifyContent: 'center',
    overflow: 'hidden',
    ...BakeryShadow,
  },
  picker: {
    width: '100%',
  },
  pressed: {
    opacity: 0.85,
  },
});
