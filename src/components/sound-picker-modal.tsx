import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/context/app-context';
import { SHOP_ITEMS } from '@/constants/shop-data';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, Spacing } from '@/constants/theme';

const C = BakeryColors;

/**
 * Radio for the studying screen: pick a sound you bought in the Shop to play
 * while you study. Lists owned `sound` shop items (none yet → empty state).
 */
export function SoundPickerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { ownedShopItems, equippedShopItems, setEquippedSound } = useApp();
  const { t } = useTranslation();
  const sounds = SHOP_ITEMS.filter((i) => i.category === 'sound' && ownedShopItems.includes(i.id));
  const equipped = equippedShopItems.sound;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>{t('soundPicker.title')}</Text>

          {sounds.length === 0 ? (
            <Text style={styles.empty}>{t('soundPicker.empty')}</Text>
          ) : (
            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: Spacing.two }} showsVerticalScrollIndicator={false}>
              <Pressable onPress={() => setEquippedSound(null)} style={[styles.row, equipped == null && styles.rowActive]}>
                <Text style={styles.rowText}>{t('soundPicker.off')}</Text>
                {equipped == null && <Text style={styles.check}>✓</Text>}
              </Pressable>
              {sounds.map((s) => (
                <Pressable key={s.id} onPress={() => setEquippedSound(s.id)} style={[styles.row, equipped === s.id && styles.rowActive]}>
                  <Image source={s.image} style={styles.rowIcon} contentFit="contain" />
                  <Text style={styles.rowText} numberOfLines={1}>{s.name}</Text>
                  {equipped === s.id && <Text style={styles.check}>✓</Text>}
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Pressable onPress={onClose} style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}>
            <Text style={styles.doneBtnText}>{t('common.done')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(48,32,24,0.4)' },
  card: {
    width: '100%', maxWidth: 340, backgroundColor: C.frosting,
    borderRadius: BakeryRadii.panel, borderWidth: 2, borderColor: C.shortbread,
    padding: Spacing.four, gap: Spacing.three, ...BakeryShadow,
  },
  title: { fontSize: 18, fontWeight: '900', color: C.cocoaDark, textAlign: 'center' },
  empty: { fontSize: 14, color: C.mocha, textAlign: 'center', lineHeight: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    backgroundColor: '#fff', borderRadius: BakeryRadii.card,
    borderWidth: 1.5, borderColor: C.shortbread, paddingHorizontal: Spacing.three, paddingVertical: 12,
  },
  rowActive: { borderColor: C.jam, backgroundColor: C.jam + '1A' },
  rowIcon: { width: 28, height: 28 },
  rowText: { flex: 1, fontSize: 15, fontWeight: '700', color: C.cocoaDark },
  check: { fontSize: 16, fontWeight: '900', color: C.berry },
  doneBtn: { paddingVertical: 13, borderRadius: BakeryRadii.button, alignItems: 'center', backgroundColor: '#F7A7B8' },
  doneBtnText: { fontSize: 15, fontWeight: '900', color: C.cocoaDark },
  pressed: { opacity: 0.85 },
});
