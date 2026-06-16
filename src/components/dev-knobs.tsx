import * as Clipboard from 'expo-clipboard';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { setForcedDeviceClass, useForcedDeviceClass } from '@/hooks/use-device-class';

// A +/- button that fires once on tap and then auto-repeats while held, so a big
// adjustment doesn't need dozens of taps. ~350ms before repeat kicks in, then
// every 60ms.
function HoldButton({ onStep, style, children }: { onStep: () => void; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const start = () => {
    onStep();
    const tick = () => {
      onStep();
      timer.current = setTimeout(tick, 60);
    };
    timer.current = setTimeout(tick, 350);
  };
  return (
    <Pressable hitSlop={6} style={style} onPressIn={start} onPressOut={stop}>
      {children}
    </Pressable>
  );
}

// Dev-only "design mode" panel: a floating 🎛 button that opens a list of
// numeric knobs you can nudge live on the device with +/- steppers. Use it to
// dial in spacing/sizes by feel, then read the values off "Log values" and bake
// them into the real StyleSheet. Renders nothing outside a dev bundle (__DEV__).

export type Knob = {
  key: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
};

type Props = {
  // Identifies which screen these knobs belong to; baked into the generated code
  // so the values land on the right screen. e.g. 'login', 'home'.
  screen: string;
  knobs: Knob[];
  onChange: (key: string, value: number) => void;
};

type Preview = 'auto' | 'phone' | 'tablet';

// Master switch for the on-screen design-knobs UI. Off = the floating button and
// panel never render anywhere (the knob plumbing stays wired so baked values keep
// working and it can be re-enabled in one place). Flip to true to dial layouts.
const ENABLED: boolean = false;

export function DevKnobs(props: Props) {
  // Hook-free gate so the hook-laden implementation only mounts when enabled
  // (avoids conditional-hook issues): when disabled, render nothing at all.
  if (!ENABLED) return null;
  return <DevKnobsImpl {...props} />;
}

function DevKnobsImpl({ screen, knobs, onChange }: Props) {
  const [open, setOpen] = useState(false);
  // The generated save-code (screen tag + values). Shown in the panel to copy or
  // screenshot, and copied to the clipboard, so the dialed numbers can be handed
  // off verbatim. Cleared whenever a knob changes so a stale code is never sent.
  const [code, setCode] = useState<string | null>(null);
  const handleChange = (key: string, value: number) => {
    setCode(null);
    onChange(key, value);
  };
  // Latest knobs, so a held repeat reads the up-to-date value each tick (the
  // press-time closure would otherwise keep re-applying the original value).
  const knobsRef = useRef(knobs);
  knobsRef.current = knobs;
  const stepKnob = (key: string, dir: number) => {
    const k = knobsRef.current.find((x) => x.key === key);
    if (!k) return;
    const next = Math.min(k.max, Math.max(k.min, Math.round((k.value + dir * k.step) * 100) / 100));
    handleChange(k.key, next);
  };
  const toggleCode = () => {
    // Second press hides the code box and returns to the knobs.
    if (code) {
      setCode(null);
      return;
    }
    const values = Object.fromEntries(knobs.map((k) => [k.key, k.value]));
    const text = `MEMOBUN-TABLET ${screen} ${JSON.stringify(values)}`;
    setCode(text);
    // Best-effort clipboard copy; the on-screen code is still copyable/screenshottable.
    Clipboard.setStringAsync(text).catch(() => {});
    console.log('[DevKnobs]', text);
  };
  // Scale the whole widget (FAB + panel) up/down via the "Panel size" stepper, so
  // it's readable or out of the way as needed. Composes with the drag transform.
  const [scale, setScale] = useState(1);
  const bumpScale = (d: number) => setScale((s) => Math.min(2, Math.max(0.6, Math.round((s + d) * 10) / 10)));
  // Preview a device class without owning the hardware: 'tablet' forces every
  // useIsTablet() in the tree to report tablet, so you can dial tablet layout on
  // a phone-sized simulator. Global (single source of truth) so it survives
  // navigation and stays in sync across every mounted panel.
  const preview: Preview = useForcedDeviceClass() ?? 'auto';
  const choosePreview = (p: Preview) => setForcedDeviceClass(p === 'auto' ? null : p);

  // Drag the whole panel anywhere by its 🎛 handle, so it never blocks the thing
  // you're tuning. PanResponder only engages after ~5px of movement, so a plain
  // tap still toggles the panel open/closed. (Same Animated/PanResponder idiom as
  // DraggableIngredient in (tabs)/index.tsx.)
  const pan = useRef(new Animated.ValueXY()).current;
  const dragHandlers = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => pan.flattenOffset(),
    }),
  ).current;

  if (!__DEV__) return null;

  return (
    <Animated.View pointerEvents="box-none" style={[styles.root, { transform: [...pan.getTranslateTransform(), { scale: scale ?? 1 }] }]}>
      {open && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Design knobs</Text>
            <Pressable hitSlop={8} onPress={toggleCode}>
              <Text style={styles.logBtn}>{code ? 'Hide code' : 'Get code'}</Text>
            </Pressable>
          </View>
          {code && (
            <View style={styles.codeBox}>
              <Text style={styles.codeHint}>Copied ✓ — paste this code to Claude:</Text>
              <Text selectable style={styles.codeText}>{code}</Text>
            </View>
          )}
          <View style={styles.segment}>
            {(['auto', 'phone', 'tablet'] as const).map((p) => (
              <Pressable
                key={p}
                style={[styles.segmentBtn, preview === p && styles.segmentBtnOn]}
                onPress={() => choosePreview(p)}>
                <Text style={[styles.segmentText, preview === p && styles.segmentTextOn]}>
                  {p === 'auto' ? 'Auto' : p === 'phone' ? 'Phone' : 'Tablet'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.row, styles.sizeRow]}>
            <Text style={styles.label} numberOfLines={1}>Panel size</Text>
            <View style={styles.stepper}>
              <HoldButton style={styles.step} onStep={() => bumpScale(-0.1)}>
                <Text style={styles.stepText}>−</Text>
              </HoldButton>
              <Text style={styles.value}>{Math.round(scale * 100)}%</Text>
              <HoldButton style={styles.step} onStep={() => bumpScale(0.1)}>
                <Text style={styles.stepText}>+</Text>
              </HoldButton>
            </View>
          </View>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {knobs.map((k) => (
              <View key={k.key} style={styles.row}>
                <Text style={styles.label} numberOfLines={1}>{k.label}</Text>
                <View style={styles.stepper}>
                  <HoldButton style={styles.step} onStep={() => stepKnob(k.key, -1)}>
                    <Text style={styles.stepText}>−</Text>
                  </HoldButton>
                  <Text style={styles.value}>{k.value}</Text>
                  <HoldButton style={styles.step} onStep={() => stepKnob(k.key, 1)}>
                    <Text style={styles.stepText}>+</Text>
                  </HoldButton>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      <View {...dragHandlers.panHandlers}>
        <Pressable style={styles.fab} onPress={() => setOpen((o) => !o)}>
          <Text style={styles.fabText}>{open ? '✕' : '🎛'}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // bottom clears the floating tab bar (top ≈144px from screen bottom) so the
  // 🎛 stays tappable on tab screens; still fine on full-screen modals.
  root: { position: 'absolute', right: 12, bottom: 160, alignItems: 'flex-end', zIndex: 9999 },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(40,30,28,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  fabText: { fontSize: 20, color: '#FFF' },
  panel: {
    width: 248,
    maxHeight: 340,
    backgroundColor: 'rgba(28,22,20,0.95)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  panelTitle: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  logBtn: { color: '#FFD479', fontSize: 12, fontWeight: '700' },
  codeBox: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,212,121,0.5)', padding: 8, marginBottom: 8 },
  codeHint: { color: '#FFD479', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  codeText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  segment: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 9, padding: 2, marginBottom: 8 },
  segmentBtn: { flex: 1, paddingVertical: 5, borderRadius: 7, alignItems: 'center' },
  segmentBtnOn: { backgroundColor: 'rgba(255,212,121,0.9)' },
  segmentText: { color: '#CFC8C4', fontSize: 12, fontWeight: '700' },
  segmentTextOn: { color: '#2A1F1C' },
  list: { flexGrow: 0 },
  sizeRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.15)', paddingBottom: 8, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 },
  label: { color: '#EEE', fontSize: 12.5, flex: 1, marginRight: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  step: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#FFF', fontSize: 16, fontWeight: '800', lineHeight: 18 },
  value: { color: '#FFF', fontSize: 13, fontWeight: '700', minWidth: 44, textAlign: 'center' },
});
