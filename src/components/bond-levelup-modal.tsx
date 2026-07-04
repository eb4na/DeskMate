/**
 * One-shot Home celebration shown when a companion's bond level goes up from
 * studying (see `recordSession` → `bondLevelUp`). Mirrors CharacterObtainedModal's
 * layout: dimmed backdrop + centered card. Shows the companion in its CURRENT
 * outfit (equipped skin), the new level, and a progress bar toward the next level.
 * Tap anywhere to dismiss.
 */
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CompanionLevel } from '@/components/companion-level';
import { BakeryColors, MIN_POPUP_WIDTH, popupMaxWidth } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { localizeCompanionName, resolveActiveCompanion } from '@/lib/companion-utils';
import { useModalSafeVisible } from '@/lib/modal-traffic';

const P = { card: '#FFFDF8', brown: '#5B3A2E', muted: '#9A7B6D' };

export function BondLevelUpModal() {
  const { t } = useTranslation();
  const {
    bondLevelUp, clearBondLevelUp,
    defaultCompanionId, companionSlots, bunSkinId, companionSkins, companionMinutes,
  } = useApp();
  // Defer past the settle window so this never presents on top of a still-
  // transitioning modal (recordSession can fire from session-complete / MP finish).
  const visible = useModalSafeVisible(!!bondLevelUp);

  if (!bondLevelUp) {
    return <Modal visible={false} transparent />;
  }

  // The stored id is an activeCompanionId (companionMinutes is keyed by it), so it
  // resolves straight to the current-skin look — the same art shown on Home.
  const resolved = resolveActiveCompanion(bondLevelUp.companionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins);
  const name = localizeCompanionName(resolved.name, t);
  const minutes = companionMinutes?.[bondLevelUp.companionId] ?? 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={clearBondLevelUp}>
      <Pressable style={styles.root} onPress={clearBondLevelUp}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Image source={resolved.imageSource} style={styles.avatarImg} contentFit="contain" />
          </View>
          <Text style={styles.badge}>{t('bondLevelUp.title', { level: bondLevelUp.level })}</Text>
          <Text style={styles.message}>{t('bondLevelUp.message', { name })}</Text>
          <View style={styles.meterWrap}>
            <CompanionLevel minutes={minutes} scale={1.5} />
          </View>
          <Text style={styles.hint}>{t('bondLevelUp.dismiss')}</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: 'rgba(50,32,26,0.35)' },
  card: {
    width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: popupMaxWidth(320), backgroundColor: P.card, borderRadius: 24,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', padding: 22, alignItems: 'center', gap: 8,
    shadowColor: '#5B3A2E', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatar: {
    width: 118, height: 118, borderRadius: 59, backgroundColor: BakeryColors.rose,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  avatarImg: { width: '88%', height: '88%' },
  badge: { fontSize: 24, fontWeight: '900', color: BakeryColors.berry, textAlign: 'center' },
  message: { fontSize: 14, color: P.muted, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  meterWrap: { alignSelf: 'stretch', paddingHorizontal: 10, marginTop: 6 },
  hint: { fontSize: 12.5, color: P.muted, fontWeight: '700', textAlign: 'center', marginTop: 8 },
});
