// The bakery-styled popup card + backdrop, shared by the two popup presenters:
// PopupHost's root <Modal> (normal screens) and the /popup transparentModal route
// (popups fired while a modal-presented screen is on top — see popup-host.tsx).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type PopupButton, type PopupConfig } from '@/lib/popup';
import { useTranslation } from '@/i18n';
import { BakeryColors as C, BakeryRadii, BakeryShadow, MIN_POPUP_WIDTH, popupMaxWidth, Spacing } from '@/constants/theme';

export function PopupCard({
  config,
  onPress,
}: {
  config: PopupConfig;
  // Called with the pressed button; with the cancel button (or null when there is
  // none) on backdrop tap. The presenter dismisses itself, then runs btn.onPress.
  onPress: (btn: PopupButton | null) => void;
}) {
  const { t } = useTranslation();

  const rawButtons = config.buttons && config.buttons.length > 0 ? config.buttons : [{ text: t('common.ok') }];
  // Filled action buttons on top, plain "cancel" links below — consistent layout
  // regardless of the order they were passed in (mirrors the app's other popups).
  const actions = rawButtons.filter((b) => b.style !== 'cancel');
  const cancels = rawButtons.filter((b) => b.style === 'cancel');

  // Backdrop tap / hardware back = the cancel action if there is one, else close.
  const dismiss = () => onPress(cancels[0] ?? null);

  return (
    <Pressable style={styles.backdrop} onPress={dismiss}>
      <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
        <Text style={styles.title}>{config.title}</Text>
        {!!config.message && <Text style={styles.message}>{config.message}</Text>}

        <View style={styles.buttons}>
          {actions.map((btn, i) => {
            const destructive = btn.style === 'destructive';
            return (
              <Pressable
                key={`a${i}`}
                onPress={() => onPress(btn)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  destructive ? styles.destructiveBtn : styles.primaryBtn,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.actionText, destructive ? styles.destructiveText : styles.primaryText]}>
                  {btn.text}
                </Text>
              </Pressable>
            );
          })}
          {cancels.map((btn, i) => (
            <Pressable
              key={`c${i}`}
              onPress={() => onPress(btn)}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>{btn.text}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    minWidth: MIN_POPUP_WIDTH,
    maxWidth: popupMaxWidth(340),
    backgroundColor: '#FFFDF8',
    borderRadius: BakeryRadii.panel,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    ...BakeryShadow,
  },
  title: { fontSize: 19, fontWeight: '800', color: C.cocoaDark, textAlign: 'center' },
  message: { fontSize: 14, fontWeight: '600', color: C.mocha, textAlign: 'center', lineHeight: 20 },
  buttons: { gap: Spacing.two, marginTop: Spacing.one },
  actionBtn: { borderRadius: BakeryRadii.button, paddingVertical: Spacing.three, alignItems: 'center' },
  primaryBtn: { backgroundColor: C.buttonPink },
  destructiveBtn: { backgroundColor: C.danger },
  actionText: { fontSize: 16, fontWeight: '800' },
  primaryText: { color: C.cocoaDark },
  destructiveText: { color: '#FFFFFF' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  cancelText: { fontSize: 14, fontWeight: '700', color: C.mocha },
  pressed: { opacity: 0.85 },
});
