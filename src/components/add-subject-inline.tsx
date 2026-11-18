import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

import { MAX_SUBJECTS, useApp } from '@/context/app-context';
import { SUBJECT_COLORS } from '@/constants/placeholder-data';
import { BakeryColors, BakeryRadii } from '@/constants/theme';
import { useTranslation } from '@/i18n';
import { containsProfanity } from '@/lib/profanity';

const C = BakeryColors;

/**
 * "＋ Add" for the start-of-session subject pickers: tap it, type a name, and the
 * new subject is created AND picked in one go (onAdded gets its name), so nobody
 * has to leave the session flow for the Subjects screen.
 *
 * Same rules as manage-subjects: bad words BLOCK (shown inline — these pickers sit
 * in modals, where a popup can't stack on top), MAX_SUBJECTS active cap, and the
 * next unused palette colour. Typing an existing subject's name just picks it.
 */
export function AddSubjectInline({
  onAdded,
  chipStyle,
  chipTextStyle,
  scale = 1,
}: {
  onAdded: (subjectName: string) => void;
  /** Look of the closed "＋ Add" button, so it matches the host's subject chips. */
  chipStyle?: StyleProp<ViewStyle>;
  chipTextStyle?: StyleProp<TextStyle>;
  scale?: number;
}) {
  const { t } = useTranslation();
  const { subjects, addSubject } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const s = scale;

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.addChip, chipStyle, pressed && styles.pressed]}
        accessibilityRole="button">
        <Text style={[styles.addChipText, chipTextStyle]}>{t('common.addChip')}</Text>
      </Pressable>
    );
  }

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (containsProfanity(trimmed)) {
      setError(t('common.inappropriateLanguage'));
      return;
    }
    const active = subjects.filter((sub) => !sub.archived);
    const existing = active.find((sub) => sub.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      onAdded(existing.name);
      return;
    }
    // Only ACTIVE colours count as taken (mirrors manage-subjects' nextColor).
    const used = active.map((sub) => sub.color);
    const color = SUBJECT_COLORS.find((c) => !used.includes(c)) ?? SUBJECT_COLORS[active.length % SUBJECT_COLORS.length];
    if (!addSubject(trimmed, color)) {
      setError(t('manageSubjects.limitMsgPlus', { max: MAX_SUBJECTS }));
      return;
    }
    onAdded(trimmed);
  };

  return (
    <View style={styles.openWrap}>
      <View style={[styles.inputRow, { gap: 8 * s }]}>
        <TextInput
          style={[styles.input, { fontSize: 15 * s, paddingVertical: 10 * s, paddingHorizontal: 14 * s }]}
          placeholder={t('manageSubjects.addNewSubject')}
          placeholderTextColor={C.latte}
          value={name}
          onChangeText={(v) => { setName(v); if (error) setError(null); }}
          onSubmitEditing={submit}
          maxLength={30}
          autoFocus
          returnKeyType="done"
        />
        <Pressable
          onPress={submit}
          disabled={!name.trim()}
          style={({ pressed }) => [
            styles.addBtn,
            { paddingVertical: 10 * s, paddingHorizontal: 16 * s },
            !name.trim() && styles.addBtnDisabled,
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.addBtnText, { fontSize: 15 * s }]}>{t('common.add')}</Text>
        </Pressable>
      </View>
      {error && <Text style={[styles.error, { fontSize: 12.5 * s }]}>{error}</Text>}
    </View>
  );
}

/**
 * A container that pads its bottom by the live keyboard height, so a centred card
 * holding a text field slides up above the keyboard instead of hiding behind it.
 * (KeyboardAvoidingView under-pads inside modals; reanimated measures the real
 * keyboard.) Use it as the full-screen root that centres the card.
 */
export function KeyboardLiftView({ style, ...rest }: ViewProps) {
  const keyboard = useAnimatedKeyboard();
  const lift = useAnimatedStyle(() => ({ paddingBottom: keyboard.height.value }));
  return <Animated.View {...rest} style={[style, lift]} />;
}

const styles = StyleSheet.create({
  addChip: {
    borderRadius: BakeryRadii.pill, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.jam,
    paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center', justifyContent: 'center',
  },
  addChipText: { fontSize: 14, fontWeight: '800', color: C.berry },
  openWrap: { alignSelf: 'stretch', width: '100%', gap: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1, color: C.cocoaDark, fontWeight: '700',
    backgroundColor: '#FFFFFF', borderRadius: BakeryRadii.pill, borderWidth: 1.5, borderColor: C.shortbread,
  },
  addBtn: { borderRadius: BakeryRadii.pill, backgroundColor: C.buttonPink, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabled: { opacity: 0.45 },
  // Dark text on the pink, matching the pickers' own "Just focus" button.
  addBtnText: { fontWeight: '900', color: C.cocoaDark },
  error: { color: '#C2536B', fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.85 },
});
