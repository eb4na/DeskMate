/**
 * One-time celebration shown on the Home screen when the player collects every
 * recipe badge and unlocks Hanji. Driven by `hanjiUnlockPending` in app-context;
 * dismissing (or tapping through to the gallery) clears the flag.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';

const HANJI_IMG = require('@/assets/images/hanji/hanji.png');

const P = { card: '#FFFDF8', purple: '#B7A0E0', purpleSoft: '#ECE3FA', brown: '#5B3A2E', muted: '#9A7B6D' };

export function HanjiUnlockModal() {
  const { t } = useTranslation();
  const { hanjiUnlockPending, clearHanjiUnlock, recipeBadgePending } = useApp();
  // On the final badge both flags are set; show the 5/5 recipe-progress popup
  // first and only reveal Hanji once that popup is dismissed (recipeBadgePending
  // cleared).
  const visible = hanjiUnlockPending && !recipeBadgePending;

  const meet = () => {
    clearHanjiUnlock();
    router.push('/companion-gallery');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={clearHanjiUnlock}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={clearHanjiUnlock} />
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Image source={HANJI_IMG} style={styles.avatarImg} contentFit="contain" />
          </View>
          <Text style={styles.title}>{t('hanjiUnlock.title')}</Text>
          <Text style={styles.message}>{t('hanjiUnlock.message')}</Text>
          <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={meet}>
            <Text style={styles.buttonText}>{t('hanjiUnlock.button')}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.laterBtn, pressed && styles.pressed]} onPress={clearHanjiUnlock} hitSlop={8}>
            <Text style={styles.laterText}>{t('common.close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(48,32,24,0.45)' },
  card: {
    width: '100%', maxWidth: 320, backgroundColor: P.card, borderRadius: 24,
    borderWidth: 2, borderColor: P.purpleSoft, padding: 22, alignItems: 'center', gap: 8,
  },
  avatar: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: P.purpleSoft,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  // Framed to centre Hanji's head in the 96px circle (values measured from the
  // current hanji.png; re-check if the art changes).
  avatarImg: { position: 'absolute', width: 180, height: 180, left: -42, top: 4 },
  title: { fontSize: 18, fontWeight: '900', color: P.brown, textAlign: 'center' },
  message: { fontSize: 14, color: P.muted, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  button: {
    alignSelf: 'stretch', marginTop: 10, paddingVertical: 13, borderRadius: 16,
    backgroundColor: P.purple, alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  laterBtn: { paddingVertical: 8, alignItems: 'center' },
  laterText: { color: P.muted, fontWeight: '800', fontSize: 14 },
  pressed: { opacity: 0.85 },
});
