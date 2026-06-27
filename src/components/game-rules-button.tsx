// A small "?" help button (drop it top-right of a game screen, mirroring the
// game's top-left back button) that opens a modal with that game's rules.
// `title` + `body` are passed in already-translated so each game owns its copy.
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useIsTablet } from '@/hooks/use-device-class';
import { useTranslation } from '@/i18n';
import { BakeryColors, MIN_POPUP_WIDTH } from '@/constants/theme';

export function GameRulesButton({
  title,
  body,
  style,
}: {
  title: string;
  body: string;
  // Position override so each caller can match its own back button (top/right + safe area).
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const isTablet = useIsTablet();
  const [open, setOpen] = useState(false);

  // Bigger, easier tap target on tablets.
  const size = isTablet ? 56 : 38;
  const sizeStyle = { width: size, height: size, borderRadius: size / 2 };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityLabel={t('games.howToPlay')}
        style={({ pressed }) => [styles.btn, sizeStyle, style, pressed && styles.pressed]}>
        <ThemedText style={[styles.q, isTablet && styles.qTablet]}>?</ThemedText>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Inner press is swallowed so tapping the card doesn't dismiss. */}
          <Pressable style={styles.card} onPress={() => {}}>
            <ThemedText type="subtitle" style={styles.title}>{title}</ThemedText>
            <ThemedText type="small" style={styles.body}>{body}</ThemedText>
            <Pressable
              onPress={() => setOpen(false)}
              style={({ pressed }) => [styles.okBtn, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={styles.okText}>{t('common.ok')}</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    shadowColor: '#8B6B57',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  q: { fontSize: 22, lineHeight: 26, fontWeight: '800', color: BakeryColors.berry },
  qTablet: { fontSize: 32, lineHeight: 38 },
  pressed: { opacity: 0.7 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(60,40,35,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    minWidth: MIN_POPUP_WIDTH,
    maxWidth: 360,
    backgroundColor: BakeryColors.frosting,
    borderRadius: 22,
    padding: 22,
    gap: 12,
  },
  title: { color: BakeryColors.cocoaDark, textAlign: 'center' },
  body: { color: BakeryColors.cocoaDark, lineHeight: 21 },
  okBtn: {
    alignSelf: 'center',
    marginTop: 4,
    paddingVertical: 9,
    paddingHorizontal: 34,
    borderRadius: 16,
    backgroundColor: BakeryColors.jam,
  },
  okText: { color: '#FFFFFF' },
});
