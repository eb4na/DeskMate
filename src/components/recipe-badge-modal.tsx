/**
 * Transient home-screen popup shown each time the player earns a recipe badge.
 * Shows the just-earned character, progress (N/5), and which characters are still
 * missing — stays up until the player taps to dismiss. Intentionally does NOT
 * mention Hanji.
 */
import { useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useApp } from '@/context/app-context';
import { getCompanionImage, localizeCompanionName } from '@/lib/companion-utils';
import { RECIPE_BADGES, RECIPE_IDS } from '@/constants/recipes';
import { useTranslation } from '@/i18n';

const P = { card: '#FFFDF8', pink: '#F491A9', pinkSoft: '#FBDCE4', brown: '#5B3A2E', muted: '#9A7B6D' };

// Each character's art is framed differently, so a single vertical offset clips
// some heads. These per-companion translateY values (px, applied to the 72px
// avatar inside the 48px circle) sit each character's head in the circle. Cocoa
// is the reference (16); the others are raised so their heads aren't cut off.
const SLOT_OFFSETS: Record<string, { x?: number; y: number; scale?: number }> = {
  '': { y: 8 },
  'shop:companion_cocoa': { y: 16 },
  'shop:companion_bunny': { y: 8 },
  'shop:companion_honey': { x: 1, y: 10, scale: 0.93 },
  'shop:companion_tira': { x: 1, y: 8, scale: 0.93 },
};

// A little drooping wisteria sprig — a tapering cluster of lavender blossoms on a
// green stem. Drawn (no asset) so it scales crisply as a corner decoration.
function WisteriaIcon({ size = 40 }: { size?: number }) {
  const petal = '#C7A4E0';
  const petalLt = '#E0CBF0';
  const petalDk = '#A87FD0';
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* stem + leaf */}
      <Path d="M9 3 C12 5 13 8 13 12" stroke="#8BBF7A" strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Path d="M9 4 C6 4.5 4.5 6.5 5 9 C7.5 8.5 9 6.5 9 4 Z" fill="#9FCB8C" />
      {/* tapering blossom cluster */}
      <Circle cx={11} cy={12} r={2.6} fill={petalLt} />
      <Circle cx={15} cy={12.5} r={2.6} fill={petal} />
      <Circle cx={12.5} cy={15} r={2.6} fill={petalDk} />
      <Circle cx={16} cy={16} r={2.5} fill={petalLt} />
      <Circle cx={13.5} cy={18.5} r={2.4} fill={petal} />
      <Circle cx={16.5} cy={20} r={2.2} fill={petalDk} />
      <Circle cx={14.5} cy={22.5} r={2} fill={petalLt} />
      <Circle cx={16} cy={25} r={1.7} fill={petal} />
      <Circle cx={15} cy={27} r={1.3} fill={petalDk} />
    </Svg>
  );
}

// The collected ✓ on a slot. The just-earned badge (`animate`) does a celebratory
// hop-in-place on a gentle loop so the eye lands on what was just unlocked; every
// other already-collected check sits still.
function JumpCheck({ animate }: { animate: boolean }) {
  const jump = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(jump, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(jump, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, jump]);
  const translateY = jump.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });
  const scale = jump.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.18, 1] });
  return <Animated.Text style={[styles.check, { transform: [{ translateY }, { scale }] }]}>✓</Animated.Text>;
}

export function RecipeBadgeModal() {
  const { t } = useTranslation();
  const { recipeBadgePending, clearRecipeBadge, bakedWith } = useApp();

  // recipeBadgePending holds the recipe id just made; the badge goes to that
  // recipe's designated character.
  const justEarned = RECIPE_BADGES.find((b) => b.recipeId === recipeBadgePending);
  const count = RECIPE_BADGES.filter((b) => bakedWith.includes(b.companionId)).length;

  return (
    <Modal visible={!!recipeBadgePending} transparent animationType="fade" onRequestClose={clearRecipeBadge}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={clearRecipeBadge} />
        <View style={styles.card}>
          <View style={styles.wisteria} pointerEvents="none">
            <WisteriaIcon size={44} />
          </View>
          <Text style={styles.title}>{t('recipeBadge.title')}</Text>
          {justEarned && (
            <Text style={styles.got}>
              {t('recipeBadge.got', { name: localizeCompanionName(justEarned.owner, t) })}
            </Text>
          )}
          <Text style={styles.count}>{count}/{RECIPE_BADGES.length}</Text>

          <View style={styles.row}>
            {RECIPE_BADGES.map((b) => {
              const collected = bakedWith.includes(b.companionId);
              const isNew = b.recipeId === recipeBadgePending;
              return (
                <View key={b.recipeId} style={[styles.slot, isNew && styles.slotNew, !collected && styles.slotMissing]}>
                  <View style={styles.slotMask}>
                    <Image
                      source={getCompanionImage(b.companionId, 'classic')}
                      style={[
                        styles.slotImg,
                        { transform: [
                            { translateX: SLOT_OFFSETS[b.companionId]?.x ?? 0 },
                            { translateY: SLOT_OFFSETS[b.companionId]?.y ?? 16 },
                            { scale: SLOT_OFFSETS[b.companionId]?.scale ?? 1 },
                          ] },
                        !collected && styles.imgMissing,
                      ]}
                      contentFit="contain"
                    />
                  </View>
                  {collected && <JumpCheck animate={isNew} />}
                </View>
              );
            })}
          </View>
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
    borderWidth: 2, borderColor: P.pinkSoft, padding: 22, alignItems: 'center', gap: 6,
  },
  wisteria: { position: 'absolute', top: -10, right: 6, zIndex: 3, transform: [{ rotate: '18deg' }] },
  title: { fontSize: 18, fontWeight: '900', color: P.brown, textAlign: 'center' },
  got: { fontSize: 14, fontWeight: '700', color: P.muted, textAlign: 'center' },
  count: { fontSize: 26, fontWeight: '900', color: P.pink, marginVertical: 2 },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  slot: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: P.pinkSoft, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  slotNew: { borderColor: P.pink },
  slotMissing: { backgroundColor: '#EFEAE6' },
  // Inner circular mask that clips the avatar; the check sits outside this so it
  // renders on top of everything, never clipped by the circle.
  slotMask: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  // Oversized so the face fills the circle; the per-character vertical offset
  // (SLOT_TRANSLATE_Y) is applied inline so each head lands in the centre.
  slotImg: { width: 72, height: 72 },
  imgMissing: { opacity: 0.28 },
  check: {
    position: 'absolute', zIndex: 2, bottom: -2, right: -2, fontSize: 13, fontWeight: '900',
    color: '#FFFFFF', backgroundColor: P.pink, borderRadius: 9, width: 18, height: 18,
    textAlign: 'center', overflow: 'hidden', lineHeight: 18,
  },
});
