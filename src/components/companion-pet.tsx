import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';

import { BakeryHeartEmoji } from '@/components/bakery-emoji';
import { getPetLine } from '@/constants/pet-lines';
import { playPop, prewarmPop } from '@/lib/sounds';
import { BakeryColors } from '@/constants/theme';

// Maps a companion's display name to its pet-line key (see pet-lines.ts).
const PERSONA_KEYS: Record<string, string> = {
  Bun: 'bun', Cocoa: 'cocoa', Bunny: 'bunny', Miel: 'miel', Tira: 'tira', Hanji: 'hanji',
};

// Tiny single-listener bus so a tap shows the cloud WITHOUT re-rendering the (large)
// home component — only the small PetCloudHost reacts. Keeps tapping snappy.
type PetCloudEvent = { line: string; id: number };
let cloudListener: ((e: PetCloudEvent) => void) | null = null;
// Monotonic id per tap — used as the PetBubble's React key and to match the
// finishing bubble against the current one (see PetCloudHost). A counter (not
// Date.now()) guarantees uniqueness even for two taps in the same millisecond.
let cloudSeq = 0;
function emitPetCloud(line: string) {
  cloudListener?.({ line, id: ++cloudSeq });
}

export type Heart = { id: number; startX: number; driftX: number; bottom: number; rot: number };

// Build a fresh burst of 3–4 hearts spawning from the character's SIDES (random side +
// height) at an angle. Shared by the home tap and the in-session tap so both feel alike.
export function makeHearts(scale = 1): Heart[] {
  const base = Date.now();
  const count = 3 + Math.floor(Math.random() * 2); // 3–4
  return Array.from({ length: count }, (_, i) => {
    const side = Math.random() < 0.5 ? -1 : 1;
    return {
      id: base + i,
      startX: side * (48 + Math.random() * 42) * scale,
      driftX: side * (20 + Math.random() * 45) * scale,
      bottom: (55 + Math.random() * 100) * scale,
      rot: side * (10 + Math.random() * 22),
    };
  });
}

// A heart that bursts from the character's side, drifting outward + up at an angle.
export function FloatingHeart({ heart, size, onDone }: { heart: Heart; size: number; onDone: () => void }) {
  const prog = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(prog, { toValue: 1, duration: 1200, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onDone();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const translateX = prog.interpolate({ inputRange: [0, 1], outputRange: [heart.startX, heart.startX + heart.driftX] });
  const translateY = prog.interpolate({ inputRange: [0, 1], outputRange: [0, -85] });
  const opacity = prog.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] });
  const scale = prog.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1, 0.85] });
  const rotate = prog.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${heart.rot}deg`] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.heart, { bottom: heart.bottom, marginLeft: -size / 2, opacity, transform: [{ translateX }, { translateY }, { scale }, { rotate }] }]}>
      <BakeryHeartEmoji size={size} />
    </Animated.View>
  );
}

// A dreamy cloud bubble (overlapping puffs, no outline) holding the line. Pops in,
// floats up, and fades away — then removes itself via `onDone`. Drawn by the home in a
// high-zIndex layer so it floats over the desk. Top on phone, right of the character on
// tablet. `key` it by a fresh id each tap so the float restarts.
export function PetBubble({ line, isTablet = false, scale = 1, onDone }: { line: string; isTablet?: boolean; scale?: number; onDone?: () => void }) {
  const prog = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Longer lifetime so the line is readable: pop in fast, hold, drift up + fade slowly.
    Animated.timing(prog, { toValue: 1, duration: 3600, easing: Easing.out(Easing.quad), useNativeDriver: true })
      .start(({ finished }) => { if (finished) onDone?.(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Random horizontal offset each pop — bounded so it stays middle-ish (never too far
  // left/right). Fixed for this bubble's lifetime (it remounts per tap via its key).
  const offsetX = useRef((Math.random() * 2 - 1) * 55 * scale).current;
  const translateY = prog.interpolate({ inputRange: [0, 1], outputRange: [0, -58] });
  const opacity = prog.interpolate({ inputRange: [0, 0.07, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const popScale = prog.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0.7, 1, 1.06] });

  const W = (isTablet ? 188 : 232) * scale;
  const H = (W * 84) / 120;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        // Always centered (never biased left/right), starting around the table-top
        // height — same for phone and tablet. `bottom` is the one knob for start height.
        { position: 'absolute', left: 0, right: 0, alignItems: 'center', bottom: 96 * scale },
        { opacity, transform: [{ translateX: offsetX }, { translateY }, { scale: popScale }] },
      ]}>
      <View style={{ width: W, height: H }}>
        <Svg width={W} height={H} viewBox="0 0 120 84" style={StyleSheet.absoluteFill}>
          <Ellipse cx={60} cy={54} rx={50} ry={22} fill="#FFFFFF" />
          <Ellipse cx={36} cy={50} rx={20} ry={18} fill="#FFFFFF" />
          <Ellipse cx={86} cy={50} rx={20} ry={18} fill="#FFFFFF" />
          <Ellipse cx={48} cy={38} rx={18} ry={16} fill="#FFFFFF" />
          <Ellipse cx={74} cy={36} rx={20} ry={18} fill="#FFFFFF" />
          <Ellipse cx={60} cy={34} rx={16} ry={15} fill="#FFFFFF" />
        </Svg>
        <View style={{ position: 'absolute', left: W * 0.16, right: W * 0.16, top: H * 0.34, bottom: H * 0.12, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{ fontSize: (isTablet ? 11 : 14) * scale, fontWeight: '700', color: BakeryColors.cocoaDark, textAlign: 'center' }}
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.7}>
            {line}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

// Mount once in the home's high-zIndex layer. Subscribes to the cloud bus and renders
// the floating cloud on tap — so a tap only re-renders THIS tiny host, not the home.
export function PetCloudHost({ isTablet = false, scale = 1 }: { isTablet?: boolean; scale?: number }) {
  const [cloud, setCloud] = useState<PetCloudEvent | null>(null);
  useEffect(() => {
    cloudListener = (e) => setCloud(e);
    return () => { cloudListener = null; };
  }, []);
  if (!cloud) return null;
  // Clear ONLY if the bubble that finished is still the one showing. When you tap
  // again before the previous bubble's 3.6s lifetime ends, that earlier bubble is
  // unmounted but its animation callback still fires later — without this guard it
  // would null out (or fully suppress) the newer bubble, so a repeat tap looked
  // like the dialogue stopped showing.
  return (
    <PetBubble
      key={cloud.id}
      line={cloud.line}
      isTablet={isTablet}
      scale={scale}
      onDone={() => setCloud((c) => (c?.id === cloud.id ? null : c))}
    />
  );
}

// Wraps the home companion so tapping it pets the character: a pop sound, a squish
// bounce, hearts bursting from its sides, and a persona line shown in a floating cloud
// (emitted on the bus, drawn by PetCloudHost). Plus a tiny bond nudge via `onPet`.
// Only a tight centered hitbox is tappable, so the surrounding home buttons still work.
export function CompanionPet({
  children,
  onPet,
  disabled,
  scale = 1,
  companionName,
  skinId,
}: {
  children: ReactNode;
  onPet: () => void;
  disabled?: boolean;
  scale?: number;
  companionName?: string;
  skinId?: string;
}) {
  const petScale = useRef(new Animated.Value(1)).current;
  const [hearts, setHearts] = useState<Heart[]>([]);

  // Load the pop sound up front so the first tap doesn't hitch creating the audio pool.
  useEffect(() => { prewarmPop(); }, []);

  const pet = useCallback(() => {
    if (disabled) return;
    // Start the squish bounce FIRST (native-driven) so the tap feels instant, then sound.
    Animated.sequence([
      Animated.timing(petScale, { toValue: 1.1, duration: 110, useNativeDriver: true }),
      Animated.spring(petScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
    playPop();
    // Hearts burst from the character's SIDES (random side + height) at an angle.
    setHearts((h) => [...h, ...makeHearts(scale)]);
    emitPetCloud(getPetLine(companionName ? PERSONA_KEYS[companionName] : undefined, skinId));
    // Defer the bond write off the tap frame — it triggers an app-wide context re-render
    // and isn't visually urgent, so the pop/bounce/cloud render first.
    requestAnimationFrame(() => onPet());
  }, [disabled, scale, onPet, petScale, companionName, skinId]);

  const hbW = 150 * scale;
  const hbH = 200 * scale;

  return (
    <>
      <Animated.View pointerEvents="none" style={{ transform: [{ scale: petScale }], transformOrigin: 'center bottom' }}>
        {children}
      </Animated.View>

      {hearts.map((h) => (
        <FloatingHeart key={h.id} heart={h} size={18 * scale} onDone={() => setHearts((cur) => cur.filter((x) => x.id !== h.id))} />
      ))}

      {/* Tight, centered hitbox over the character's body — the only tappable part. */}
      <Pressable onPress={pet} style={[styles.hitbox, { width: hbW, height: hbH, marginLeft: -hbW / 2 }]} />
    </>
  );
}

const styles = StyleSheet.create({
  hitbox: { position: 'absolute', bottom: 0, left: '50%' },
  heart: { position: 'absolute', left: '50%' },
});
