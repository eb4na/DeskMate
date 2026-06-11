import { Picker } from '@expo/ui/community/picker';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import i18n, { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, Colors, Spacing } from '@/constants/theme';

type TimeWheelPickerProps = {
  /** Value as a 24-hour "HH:MM" string. */
  value: string;
  onChange: (next: string) => void;
  /** When false, the picker shows 12-hour hours with an AM/PM column. */
  use24Hour?: boolean;
};

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function parse(value: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return { hour: 9, minute: 0 };
  const hour = Math.max(0, Math.min(23, Number(m[1])));
  const minute = Math.max(0, Math.min(59, Number(m[2])));
  return { hour, minute };
}

function toISOTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Format a 24-hour HH:MM into a display label honouring 12/24-hour preference. */
export function formatTimeLabel(value: string, use24Hour: boolean) {
  const { hour, minute } = parse(value);
  const mm = String(minute).padStart(2, '0');
  if (use24Hour) return `${String(hour).padStart(2, '0')}:${mm}`;
  const period = hour < 12 ? i18n.t('pickers.am') : i18n.t('pickers.pm');
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${mm} ${period}`;
}

export function TimeWheelPicker({ value, onChange, use24Hour = false }: TimeWheelPickerProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const theme = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [isOpen, setIsOpen] = useState(false);

  const { hour, minute } = useMemo(() => parse(value), [value]);

  // Derive the 12-hour parts from the canonical 24-hour value.
  const period = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  const hours = use24Hour ? range(0, 23) : range(1, 12);
  const minutes = range(0, 59);

  const commit = (next: { hour?: number; minute?: number; period?: 'AM' | 'PM'; hour12?: number }) => {
    let nextHour = hour;
    const nextMinute = next.minute ?? minute;

    if (use24Hour) {
      nextHour = next.hour ?? hour;
    } else {
      const h12 = next.hour12 ?? hour12;
      const p = next.period ?? period;
      const base = h12 % 12; // 12 -> 0
      nextHour = p === 'PM' ? base + 12 : base;
    }
    onChange(toISOTime(nextHour, nextMinute));
  };

  const pickerItemStyle = {
    color: theme.text,
    fontSize: Platform.OS === 'ios' ? 16 : 15,
  } as const;

  const selectedHourValue = use24Hour ? String(hour) : String(hour12);

  return (
    <>
      <Pressable onPress={() => setIsOpen(true)} style={({ pressed }) => [pressed && styles.pressed]}>
        <View
          style={[
            styles.trigger,
            { backgroundColor: theme.backgroundElement, borderColor: BakeryColors.border },
          ]}>
          <View style={styles.triggerTextWrap}>
            <ThemedText type="smallBold">{t('pickers.time')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatTimeLabel(value, use24Hour)}
            </ThemedText>
          </View>
          <ThemedText type="smallBold" style={styles.triggerChevron}>
            {t('pickers.select')}
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
              <ThemedText type="smallBold">{t('pickers.pickTime')}</ThemedText>
              <Pressable onPress={() => setIsOpen(false)} style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedText type="linkPrimary">{t('common.done')}</ThemedText>
              </Pressable>
            </View>

            <View style={styles.container}>
              <View style={styles.column}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.pickerLabel}>
                  {t('pickers.hour')}
                </ThemedText>
                <View
                  style={[
                    styles.pickerShell,
                    { backgroundColor: theme.backgroundElement, borderColor: BakeryColors.border },
                  ]}>
                  <Picker
                    selectedValue={selectedHourValue}
                    onValueChange={(nextValue) =>
                      use24Hour
                        ? commit({ hour: Number(nextValue) })
                        : commit({ hour12: Number(nextValue) })
                    }
                    style={styles.picker}>
                    {hours.map((h) => (
                      <Picker.Item key={h} label={String(h)} value={String(h)} style={pickerItemStyle} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.column}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.pickerLabel}>
                  {t('pickers.minute')}
                </ThemedText>
                <View
                  style={[
                    styles.pickerShell,
                    { backgroundColor: theme.backgroundElement, borderColor: BakeryColors.border },
                  ]}>
                  <Picker
                    selectedValue={String(minute)}
                    onValueChange={(nextValue) => commit({ minute: Number(nextValue) })}
                    style={styles.picker}>
                    {minutes.map((mm) => (
                      <Picker.Item
                        key={mm}
                        label={String(mm).padStart(2, '0')}
                        value={String(mm)}
                        style={pickerItemStyle}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              {!use24Hour && (
                <View style={styles.column}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.pickerLabel}>
                    {t('pickers.ampm')}
                  </ThemedText>
                  <View
                    style={[
                      styles.pickerShell,
                      { backgroundColor: theme.backgroundElement, borderColor: BakeryColors.border },
                    ]}>
                    <Picker
                      selectedValue={period}
                      onValueChange={(nextValue) => commit({ period: nextValue as 'AM' | 'PM' })}
                      style={styles.picker}>
                      <Picker.Item label={t('pickers.am')} value="AM" style={pickerItemStyle} />
                      <Picker.Item label={t('pickers.pm')} value="PM" style={pickerItemStyle} />
                    </Picker>
                  </View>
                </View>
              )}
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              {t('pickers.selected', { value: formatTimeLabel(value, use24Hour) })}
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
