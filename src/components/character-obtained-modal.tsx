/**
 * One-shot celebration shown the moment the player obtains a companion — whether
 * by buying it in the shop or picking it as their first-launch starter. Matches
 * the HanjiUnlockModal layout: dimmed backdrop + centered card. The character's
 * own color (from STARTER_CHOICES[*].bg) tints the avatar circle and the button.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { companionByShopItemId, localizeCompanionName } from '@/lib/companion-utils';

const P = { card: '#FFFDF8', brown: '#5B3A2E', muted: '#9A7B6D' };

export function CharacterObtainedModal() {
  const { t } = useTranslation();
  const { characterObtainedPending, clearCharacterObtained, setActiveCompanion } = useApp();
  const choice = characterObtainedPending ? companionByShopItemId(characterObtainedPending) : undefined;
  const visible = !!choice;

  if (!choice) {
    return <Modal visible={false} transparent />;
  }

  const name = localizeCompanionName(choice.name, t);

  const meet = () => {
    setActiveCompanion(choice.activeId);
    clearCharacterObtained();
    router.push('/companion-gallery');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={clearCharacterObtained}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={clearCharacterObtained} />
        <View style={styles.card}>
          <View style={[styles.avatar, { backgroundColor: choice.bg }]}>
            <Image source={choice.image} style={styles.avatarImg} contentFit="contain" />
          </View>
          <Text style={styles.title}>{t('characterObtained.title', { name })}</Text>
          <Text style={styles.message}>{t('characterObtained.message')}</Text>
          <Pressable
            style={({ pressed }) => [styles.button, { backgroundColor: choice.bg }, pressed && styles.pressed]}
            onPress={meet}>
            <Text style={styles.buttonText}>{t('characterObtained.button', { name })}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.laterBtn, pressed && styles.pressed]}
            onPress={clearCharacterObtained}
            hitSlop={8}>
            <Text style={styles.laterText}>{t('common.close')}</Text>
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
    width: '100%', maxWidth: 320, backgroundColor: P.card, borderRadius: 24,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', padding: 22, alignItems: 'center', gap: 8,
    shadowColor: '#5B3A2E', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatar: {
    width: 110, height: 110, borderRadius: 55,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  avatarImg: { width: '88%', height: '88%' },
  title: { fontSize: 20, fontWeight: '900', color: P.brown, textAlign: 'center' },
  message: { fontSize: 14, color: P.muted, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  button: {
    alignSelf: 'stretch', marginTop: 10, paddingVertical: 13, borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  laterBtn: { paddingVertical: 8, alignItems: 'center' },
  laterText: { color: P.muted, fontWeight: '800', fontSize: 14 },
  pressed: { opacity: 0.85 },
});
