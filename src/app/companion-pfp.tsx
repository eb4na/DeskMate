import { useMemo, useRef, useState } from 'react';
import { Dimensions, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { CompanionAvatar } from '@/components/companion-avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DEFAULT_PFP_FOCUS, type PfpFocus, useApp } from '@/context/app-context';
import { BakeryColors, BakeryRadii, MaxContentWidth, Spacing } from '@/constants/theme';

const PREVIEW = Math.min(Dimensions.get('window').width - 96, 280);
const MIN_SCALE = 1;
const MAX_SCALE = 3;
const PAN_LIMIT = 0.6;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function CompanionPfpScreen() {
  const { companionSlots, setCompanionPfp } = useApp();
  const params = useLocalSearchParams<{ slotId?: string }>();
  const slot = useMemo(
    () => companionSlots.find((c) => c.id === params.slotId),
    [companionSlots, params.slotId],
  );

  const [focus, setFocus] = useState<PfpFocus>(slot?.pfp ?? DEFAULT_PFP_FOCUS);
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const baseRef = useRef<PfpFocus>(focus);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        baseRef.current = focusRef.current;
      },
      onPanResponderMove: (_evt, g) => {
        setFocus((f) => ({
          ...f,
          x: clamp(baseRef.current.x + g.dx / PREVIEW, -PAN_LIMIT, PAN_LIMIT),
          y: clamp(baseRef.current.y + g.dy / PREVIEW, -PAN_LIMIT, PAN_LIMIT),
        }));
      },
    }),
  ).current;

  const zoom = (delta: number) =>
    setFocus((f) => ({ ...f, scale: clamp(Math.round((f.scale + delta) * 10) / 10, MIN_SCALE, MAX_SCALE) }));

  const handleSave = () => {
    if (slot) setCompanionPfp(slot.id, focus);
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <ThemedText type="smallBold" style={styles.cancel}>Cancel</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Profile picture</ThemedText>
          <Pressable onPress={handleSave} hitSlop={8}>
            <ThemedText type="smallBold" style={styles.save}>Save</ThemedText>
          </Pressable>
        </View>

        {!slot || !slot.imageUri ? (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              This companion has no image to crop yet.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Drag to position {slot.name}&apos;s face · use − / + to zoom
            </ThemedText>

            <View style={styles.previewWrap} {...pan.panHandlers}>
              <CompanionAvatar source={{ uri: slot.imageUri }} size={PREVIEW} focus={focus} style={styles.previewRing} />
              {/* soft ring overlay */}
              <View pointerEvents="none" style={styles.previewBorder} />
            </View>

            <View style={styles.zoomRow}>
              <Pressable onPress={() => zoom(-0.1)} style={({ pressed }) => [styles.zoomBtn, pressed && styles.pressed]}>
                <ThemedText style={styles.zoomText}>−</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setFocus(DEFAULT_PFP_FOCUS)}
                style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}>
                <ThemedText type="small" style={styles.resetText}>Reset</ThemedText>
              </Pressable>
              <Pressable onPress={() => zoom(0.1)} style={({ pressed }) => [styles.zoomBtn, pressed && styles.pressed]}>
                <ThemedText style={styles.zoomText}>+</ThemedText>
              </Pressable>
            </View>

            <Pressable onPress={handleSave} style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={styles.saveBtnText}>Save profile picture</ThemedText>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  cancel: { color: BakeryColors.mocha },
  save: { color: BakeryColors.cocoa },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four, padding: Spacing.four },
  hint: { textAlign: 'center' },
  previewWrap: { width: PREVIEW, height: PREVIEW },
  previewRing: { borderWidth: 3, borderColor: BakeryColors.butter },
  previewBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PREVIEW,
    height: PREVIEW,
    borderRadius: PREVIEW / 2,
    borderWidth: 2,
    borderColor: BakeryColors.shortbread,
  },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  zoomBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BakeryColors.frosting,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  zoomText: { fontSize: 26, fontWeight: '700', color: BakeryColors.cocoa, lineHeight: 30 },
  resetBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BakeryRadii.chip,
    backgroundColor: BakeryColors.frosting,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  resetText: { color: BakeryColors.mocha, fontWeight: '700' },
  saveBtn: {
    backgroundColor: BakeryColors.honey,
    borderRadius: 20,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderWidth: 2,
    borderColor: '#B07F3C',
  },
  saveBtnText: { color: BakeryColors.cocoaDark, fontSize: 15 },
  pressed: { opacity: 0.8 },
});
