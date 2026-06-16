import { useState } from 'react';

import type { Knob } from '@/components/dev-knobs';
import { TABLET_TWEAKS, type TabletTweak } from '@/constants/tablet-tweaks';
import { useIsTablet } from '@/hooks/use-device-class';

// Makes a screen's buttons / image assets adjustable on tablets in ~1 line each.
// For every element you list, the 🎛 panel gets X / Y / Size knobs, and `t(name)`
// returns the matching style override (a transform), gated to tablet only.
//
// Safety: defaults are identity (x:0, y:0, scale:1), so wiring a screen changes
// NOTHING until values are dialed and baked into TABLET_TWEAKS. A missing/unbaked
// element resolves to identity — it can never crash or shift a screen.
//
// NOTE: a transform moves the rendered pixels (and a normal Pressable's hit area
// moves with them), but it does NOT move custom coordinate-mapped hit-testing.
// So never use this on game play-surfaces (boards, grid cells, the player sprite)
// whose tap handling computes positions from raw screen coords — chrome only.

export type TweakElement = { name: string; label: string };

const X_RANGE: [number, number] = [-400, 400];
const Y_RANGE: [number, number] = [-400, 400];
const SCALE_RANGE: [number, number] = [0.3, 4];

export function usePosTweaks(screen: string, elements: TweakElement[]) {
  const isTablet = useIsTablet();

  const baked = (name: string): TabletTweak => TABLET_TWEAKS[`${screen}.${name}`] ?? {};

  // Dev-only live values, seeded from whatever is already baked. In production the
  // panel never mounts, so this state is never touched and `t()` reads baked only.
  const [dev, setDev] = useState<Record<string, TabletTweak>>(() => {
    const seed: Record<string, TabletTweak> = {};
    for (const el of elements) {
      const v = TABLET_TWEAKS[`${screen}.${el.name}`] ?? {};
      seed[el.name] = { x: v.x ?? 0, y: v.y ?? 0, scale: v.scale ?? 1 };
    }
    return seed;
  });

  const knobs: Knob[] = [];
  for (const el of elements) {
    const v = dev[el.name] ?? {};
    knobs.push({ key: `${el.name}.x`, label: `${el.label} X`, value: v.x ?? 0, min: X_RANGE[0], max: X_RANGE[1], step: 2 });
    knobs.push({ key: `${el.name}.y`, label: `${el.label} Y`, value: v.y ?? 0, min: Y_RANGE[0], max: Y_RANGE[1], step: 2 });
    knobs.push({ key: `${el.name}.scale`, label: `${el.label} Size`, value: v.scale ?? 1, min: SCALE_RANGE[0], max: SCALE_RANGE[1], step: 0.05 });
  }

  const onChange = (key: string, value: number) => {
    const dot = key.lastIndexOf('.');
    const name = key.slice(0, dot);
    const prop = key.slice(dot + 1);
    setDev((p) => ({ ...p, [name]: { ...p[name], [prop]: value } }));
  };

  const t = (name: string) => {
    if (!isTablet) return null;
    const v = __DEV__ ? (dev[name] ?? baked(name)) : baked(name);
    return { transform: [{ translateX: v.x ?? 0 }, { translateY: v.y ?? 0 }, { scale: v.scale ?? 1 }] };
  };

  return { knobs, onChange, t };
}
