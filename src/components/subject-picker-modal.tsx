import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, Spacing } from '@/constants/theme';

const C = BakeryColors;

/**
 * A simple modal for choosing what to study. Used in multiplayer so each player
 * picks their own subject (at start, when picking a different subject, or when
 * resuming after a break). Returns the chosen subject name (or null = just focus).
 */
export function SubjectPickerModal({
  visible,
  title,
  onPick,
  onClose,
}: {
  visible: boolean;
  title?: string;
  onPick: (subjectName: string | null) => void;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const { subjects } = useApp();
  const active = subjects.filter((s) => !s.archived).sort((a, b) => a.order - b.order);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>{title ?? t('studyRoom.whatStudying')}</Text>
          <ScrollView contentContainerStyle={styles.chipWrap} showsVerticalScrollIndicator={false}>
            {active.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => onPick(s.name)}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: s.color, backgroundColor: s.color + '22' },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.chipText, { color: C.cocoaDark }]} numberOfLines={1}>
                  {s.emoji ? `${s.emoji} ` : ''}{s.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => onPick(null)} style={({ pressed }) => [styles.focusBtn, pressed && styles.pressed]}>
            <Text style={styles.focusText}>{t('studyRoom.justFocus')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  card: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
    backgroundColor: C.frosting,
    borderRadius: BakeryRadii.panel,
    borderWidth: 2,
    borderColor: C.shortbread,
    padding: Spacing.four,
    gap: Spacing.three,
    ...BakeryShadow,
  },
  title: { fontSize: 18, fontWeight: '900', color: C.cocoaDark, textAlign: 'center' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center' },
  chip: { borderRadius: BakeryRadii.pill, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontSize: 14, fontWeight: '700' },
  focusBtn: {
    paddingVertical: 12,
    borderRadius: BakeryRadii.button,
    alignItems: 'center',
    backgroundColor: C.honey,
  },
  focusText: { fontSize: 15, fontWeight: '900', color: C.cocoaDark },
  pressed: { opacity: 0.85 },
});
