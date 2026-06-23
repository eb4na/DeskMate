// Renders the app's custom popup in place of the native iOS/Android alert.
// Mounted once at the root; listens to showPopup() (src/lib/popup.ts) and shows a
// cozy bakery-styled card matching the rest of the app's modals.

import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { subscribePopup, type PopupButton, type PopupConfig } from '@/lib/popup';
import { useTranslation } from '@/i18n';
import { BakeryColors as C, BakeryRadii, BakeryShadow, Spacing } from '@/constants/theme';

export function PopupHost() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<PopupConfig | null>(null);

  useEffect(() => subscribePopup((cfg) => setConfig(cfg)), []);

  if (!config) return null;

  const rawButtons = config.buttons && config.buttons.length > 0 ? config.buttons : [{ text: t('common.ok') }];
  // Filled action buttons on top, plain "cancel" links below — consistent layout
  // regardless of the order they were passed in (mirrors the app's other popups).
  const actions = rawButtons.filter((b) => b.style !== 'cancel');
  const cancels = rawButtons.filter((b) => b.style === 'cancel');

  // Dismiss first, then run the handler — so a handler that opens another popup
  // (e.g. purchase → confirmation) isn't immediately cleared.
  const press = (btn: PopupButton) => {
    const cb = btn.onPress;
    setConfig(null);
    cb?.();
  };

  // Backdrop tap / hardware back = the cancel action if there is one, else close.
  const dismiss = () => {
    const cancel = cancels[0];
    if (cancel) press(cancel);
    else setConfig(null);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
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
                  onPress={() => press(btn)}
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
                onPress={() => press(btn)}
                style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}>
                <Text style={styles.cancelText}>{btn.text}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
    maxWidth: 340,
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
  primaryBtn: { backgroundColor: C.honey },
  destructiveBtn: { backgroundColor: C.danger },
  actionText: { fontSize: 16, fontWeight: '800' },
  primaryText: { color: C.cocoaDark },
  destructiveText: { color: '#FFFFFF' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  cancelText: { fontSize: 14, fontWeight: '700', color: C.mocha },
  pressed: { opacity: 0.85 },
});
