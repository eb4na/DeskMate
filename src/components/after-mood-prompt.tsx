/**
 * After-session mood prompt for sessions that were ENDED EARLY but still recorded
 * (>= MIN_MINUTES_FOR_COINS of study time). A full finish captures the after-mood
 * on the session-complete screen, but an early end routes straight Home and skips
 * it — so the mood tracker was missing those sessions entirely. This lightweight
 * standalone modal fills that gap WITHOUT reusing session-complete (whose mount
 * effect also pays coins / ticks quests + streak, none of which an early end earns).
 *
 * Shown only on the manual-stop path (someone is there to answer); the walk-away
 * auto-stop never raises it. `minutes` non-null is the request to show; we arm it
 * after the early-end loading overlay lifts so it greets the player on Home rather
 * than flashing under the loader.
 */
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AFTER_SESSION_MOODS } from '@/constants/placeholder-data';
import { MIN_POPUP_WIDTH } from '@/constants/theme';
import { isLoadingActive, subscribeLoadingDone } from '@/lib/loading-signal';
import { useModalSafeVisible } from '@/lib/modal-traffic';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { useTranslation } from '@/i18n';

const P = {
  card: '#FFFDF8', pink: '#F4A6B6', pinkSoft: '#FBDCE2', brown: '#5B3A2E', muted: '#9A7B6D',
};

export function AfterMoodPrompt({
  minutes,
  onPick,
  onSkip,
}: {
  minutes: number | null;
  onPick: (value: string, label: string, sessionMinutes: number) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const { scale } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale), [scale]);

  const [selected, setSelected] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const moodRing = useRef(new Animated.Value(0)).current;

  // Hold the prompt until the early-end loading overlay lifts (a brief settle delay),
  // then present over Home. Reset everything once the request clears so the next early
  // end starts fresh.
  useEffect(() => {
    if (minutes == null) {
      setArmed(false);
      setSelected(null);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => { timer = setTimeout(() => setArmed(true), 350); };
    if (!isLoadingActive()) arm();
    const unsub = subscribeLoadingDone(arm);
    return () => { clearTimeout(timer); unsub(); };
  }, [minutes]);

  // Defer past the global settle window too: the early-end flow tears down a loading
  // overlay right before this arms, so presenting must wait out that transition.
  const visible = useModalSafeVisible(minutes != null && armed);

  const handleSelect = (value: string) => {
    setSelected(value);
    moodRing.setValue(0);
    Animated.spring(moodRing, { toValue: 1, useNativeDriver: true, friction: 5, tension: 80 }).start();
  };

  const handleDone = () => {
    if (minutes == null) return;
    const opt = AFTER_SESSION_MOODS.find((m) => m.value === selected);
    if (opt) onPick(opt.value, opt.label, minutes);
    else onSkip();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <View style={styles.root}>
        <View style={styles.backdrop} />
        <View style={styles.card}>
          <Text style={styles.prompt}>{t('sessionComplete.moodPrompt')}</Text>

          <View style={styles.moodRow}>
            {AFTER_SESSION_MOODS.map((opt) => {
              const isSelected = selected === opt.value;
              return (
                <Pressable key={opt.value} style={styles.moodOption} onPress={() => handleSelect(opt.value)}>
                  <View style={styles.moodCircle}>
                    <Image source={opt.image} style={styles.moodFace} contentFit="contain" />
                    {isSelected && (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.moodRing,
                          {
                            opacity: moodRing,
                            transform: [{ scale: moodRing.interpolate({ inputRange: [0, 1], outputRange: [1.4, 1] }) }],
                          },
                        ]}
                      />
                    )}
                  </View>
                  <Text style={[styles.moodLabel, isSelected && styles.moodLabelActive]} numberOfLines={1}>
                    {t(`moods.${opt.value}`, { defaultValue: opt.label })}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [styles.doneBtn, !selected && styles.doneBtnDisabled, pressed && styles.pressed]}
            disabled={!selected}
            onPress={handleDone}>
            <Text style={styles.doneBtnText}>{t('common.done')}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]} onPress={onSkip}>
            <Text style={styles.skipText}>{t('common.skip')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (s: number) =>
  StyleSheet.create({
    root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 * s },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.18)' },
    card: {
      width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: 360 * s, backgroundColor: P.card,
      borderRadius: 24 * s, borderWidth: 2, borderColor: P.pinkSoft, padding: 22 * s, alignItems: 'center',
    },
    prompt: { fontSize: 16 * s, fontWeight: '800', color: P.brown, textAlign: 'center', marginBottom: 16 * s },
    moodRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 * s, marginBottom: 16 * s },
    moodOption: { alignItems: 'center', gap: 4 * s, width: 64 * s },
    moodCircle: { width: 54 * s, height: 54 * s, borderRadius: 27 * s, backgroundColor: P.pinkSoft, alignItems: 'center', justifyContent: 'center' },
    moodFace: { width: 46 * s, height: 46 * s },
    moodRing: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 30 * s, borderWidth: 3, borderColor: P.pink },
    moodLabel: { fontSize: 10 * s, color: P.muted, fontWeight: '500', textAlign: 'center' },
    moodLabelActive: { color: P.pink, fontWeight: '800' },
    doneBtn: {
      alignSelf: 'stretch', marginTop: 4 * s, paddingVertical: 13 * s, borderRadius: 16 * s,
      backgroundColor: P.pink, alignItems: 'center', justifyContent: 'center',
    },
    doneBtnDisabled: { opacity: 0.45 },
    doneBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 * s },
    skipBtn: { marginTop: 10 * s, paddingVertical: 6 * s },
    skipText: { color: P.muted, fontWeight: '700', fontSize: 13 * s },
    pressed: { opacity: 0.85 },
  });
