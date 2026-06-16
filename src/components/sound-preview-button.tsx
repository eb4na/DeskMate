import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { hasSoundPreview, previewingId, subscribePreview, togglePreview } from '@/lib/ambience-audio';

/**
 * Play/pause button that plays a study sound's looping 10-second preview. Renders
 * nothing if that sound has no audio file yet. `id` is the ambience id (e.g. 'rain').
 * Pass `style` to position it (e.g. absolutely inside a card). The play/pause glyphs
 * are drawn shapes (no emoji) so they stay crisp and on-brand.
 */
export function SoundPreviewButton({ id, style }: { id: string; style?: StyleProp<ViewStyle> }) {
  const [playing, setPlaying] = useState(previewingId() === id);
  useEffect(() => subscribePreview((cur) => setPlaying(cur === id)), [id]);
  if (!hasSoundPreview(id)) return null;
  return (
    <Pressable
      hitSlop={10}
      onPress={(e) => {
        e.stopPropagation?.();
        togglePreview(id);
      }}
      style={[styles.btn, style]}>
      {playing ? (
        <View style={styles.pauseRow}>
          <View style={styles.pauseBar} />
          <View style={styles.pauseBar} />
        </View>
      ) : (
        <View style={styles.playTriangle} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F7A7B8',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  // White right-pointing triangle (nudged right a touch so it reads optically centred).
  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFF',
    marginLeft: 3,
  },
  // Two white bars = pause.
  pauseRow: { flexDirection: 'row', gap: 4 },
  pauseBar: { width: 4, height: 14, borderRadius: 1.5, backgroundColor: '#FFF' },
});
