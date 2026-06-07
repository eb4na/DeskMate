// Hand-drawn SVG icons for every BatterDash cake ingredient, made to read as the
// real thing (chocolate bar, whipped-cream piping bags, fruit). Plus CakeBuildIcon,
// which layers a base + filling + topping into the finished cake for ANY
// combination. No faces (project rule). Keyed by the ingredient ids in gameData.
import { type ReactNode } from 'react';
import Svg, { Circle, Ellipse, Line, Path, Rect, G } from 'react-native-svg';

import type { CakeBase, CakeFilling, CakeTopping } from '@/game/cake/gameTypes';
import { findFilling } from '@/game/cake/gameData';

type Sz = { size?: number };

const CRUST = '#A57B58';

// Natural flavour colours for the raw base ingredient look.
const BASE_LOOK: Record<CakeBase, string> = {
  vanilla: '#F6E7C2',
  chocolate: '#6B4A2F',
  strawberry: '#F0506A',
  blueberry: '#5D74C6',
};

// ── topping shapes (shared by ToppingIcon and the cake-top decoration) ───────
function toppingShape(id: CakeTopping): ReactNode {
  switch (id) {
    case 'strawberry':
      return (
        <G>
          <Path d="M16 9 Q23 9 22.5 16 Q22 26 16 28.5 Q10 26 9.5 16 Q9 9 16 9 Z" fill="#F04E63" />
          <Path d="M10 10 L16 6.5 L22 10 Q19 12.5 16 12 Q13 12.5 10 10 Z" fill="#74C078" />
          <Ellipse cx="14" cy="15" rx="0.9" ry="1.3" fill="#FFE39A" />
          <Ellipse cx="18" cy="15" rx="0.9" ry="1.3" fill="#FFE39A" />
          <Ellipse cx="16" cy="19" rx="0.9" ry="1.3" fill="#FFE39A" />
          <Ellipse cx="13" cy="20" rx="0.8" ry="1.1" fill="#FFE39A" />
          <Ellipse cx="19" cy="20" rx="0.8" ry="1.1" fill="#FFE39A" />
        </G>
      );
    case 'cherry':
      return (
        <G>
          <Path d="M15 9 Q22 9 21 16" stroke="#6B8E3D" strokeWidth={1.8} fill="none" strokeLinecap="round" />
          <Path d="M15 9 L20 7" stroke="#6B8E3D" strokeWidth={1.8} fill="none" strokeLinecap="round" />
          <Circle cx="13.5" cy="21" r="6.5" fill="#D63A52" />
          <Circle cx="21" cy="20" r="4.6" fill="#C32E46" />
          <Ellipse cx="11.5" cy="19" rx="1.6" ry="1.1" fill="#fff" opacity={0.5} />
        </G>
      );
    case 'blueberry':
      return (
        <G>
          <Circle cx="16" cy="18" r="8.5" fill="#5D74C6" />
          <Path d="M16 12 l1.6 2.6 3 .3 -2.2 2 .7 3 -3.1-1.6 -3.1 1.6 .7-3 -2.2-2 3-.3 Z" fill="#3B4E92" />
          <Ellipse cx="12.5" cy="16" rx="2" ry="1.4" fill="#fff" opacity={0.4} />
        </G>
      );
    case 'chocChunks':
      return (
        <G>
          <Rect x="7" y="13" width="8" height="8" rx="2" fill="#6B4A33" transform="rotate(-12 11 17)" />
          <Rect x="16" y="9" width="7.5" height="7.5" rx="2" fill="#7C5740" transform="rotate(10 19 13)" />
          <Rect x="15" y="18" width="8" height="8" rx="2" fill="#5A3D2B" transform="rotate(-8 19 22)" />
        </G>
      );
    case 'sprinkles':
      return (
        <G>
          <Rect x="7" y="14" width="9" height="3.4" rx="1.7" fill="#F47CA0" transform="rotate(28 11 16)" />
          <Rect x="16" y="9" width="9" height="3.4" rx="1.7" fill="#7BC0E8" transform="rotate(-22 20 11)" />
          <Rect x="17" y="18" width="9" height="3.4" rx="1.7" fill="#F6C453" transform="rotate(40 21 20)" />
          <Rect x="6" y="21" width="9" height="3.4" rx="1.7" fill="#8FD3A0" transform="rotate(-14 10 23)" />
          <Rect x="13" y="22" width="8" height="3.2" rx="1.6" fill="#C89BE8" transform="rotate(8 17 24)" />
        </G>
      );
  }
}

// ── Bases: the raw flavour, recognizable ─────────────────────────────────────
export function BaseIcon({ id, size = 22 }: Sz & { id: CakeBase }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {id === 'vanilla' && (
        <G>
          <Rect x="6" y="9" width="20" height="15" rx="4" fill={BASE_LOOK.vanilla} stroke="#D9C291" strokeWidth={1.3} />
          <Path d="M10 21 L21 11" stroke="#6B4A33" strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M11.5 21.5 L22 12" stroke="#9A7150" strokeWidth={1} strokeLinecap="round" opacity={0.7} />
        </G>
      )}
      {id === 'chocolate' && (
        <G>
          <Rect x="6" y="8" width="20" height="17" rx="3" fill={BASE_LOOK.chocolate} stroke="#43301F" strokeWidth={1.4} />
          <Line x1="12.7" y1="9" x2="12.7" y2="24" stroke="#43301F" strokeWidth={1} />
          <Line x1="19.3" y1="9" x2="19.3" y2="24" stroke="#43301F" strokeWidth={1} />
          <Line x1="6" y1="16.5" x2="26" y2="16.5" stroke="#43301F" strokeWidth={1} />
          <Rect x="7.6" y="9.4" width="3" height="5" rx="1.4" fill="#fff" opacity={0.16} />
        </G>
      )}
      {id === 'strawberry' && toppingShape('strawberry')}
      {id === 'blueberry' && (
        <G>
          <Circle cx="12" cy="19" r="6.5" fill="#5D74C6" />
          <Circle cx="20.5" cy="20.5" r="5.5" fill="#4A5EA8" />
          <Circle cx="19" cy="12.5" r="5.2" fill="#6B82D0" />
          <Path d="M19 9 l1 2 2 .2 -1.4 1.3 .4 2 -2-1 -2 1 .4-2 -1.4-1.3 2-.2 Z" fill="#39497F" opacity={0.85} />
          <Ellipse cx="10" cy="17" rx="1.7" ry="1.1" fill="#fff" opacity={0.4} />
        </G>
      )}
    </Svg>
  );
}

// ── Fillings: a whipped-cream piping bag tinted with the filling colour ──────
export function FillingIcon({ id, size = 22 }: Sz & { id: CakeFilling }) {
  const c = findFilling(id).color;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* bag */}
      <Path d="M8 7 Q16 4.5 24 7 L17.5 19 Q16 20.5 14.5 19 Z" fill="#F2ECE0" stroke="#C9B9A2" strokeWidth={1.3} strokeLinejoin="round" />
      <Path d="M8 7 Q16 9.5 24 7" stroke="#C9B9A2" strokeWidth={1.3} fill="none" />
      <Path d="M10 8.5 Q16 6.8 22 8.5" stroke="#ffffff" strokeWidth={1.2} fill="none" opacity={0.5} />
      {/* piped cream swirl in the filling colour */}
      <Path d="M11 22 Q12 17.5 16 17.5 Q20 17.5 21 22 Q20 27.5 16 28.5 Q12 27.5 11 22 Z" fill={c} stroke="#0000001a" strokeWidth={0.6} />
      <Path d="M13.5 22 Q16 19.8 18.5 22" stroke="#ffffff" strokeWidth={1.3} fill="none" opacity={0.45} strokeLinecap="round" />
      <Ellipse cx="16" cy="25.5" rx="3" ry="1.3" fill="#fff" opacity={0.3} />
    </Svg>
  );
}

// ── Toppings: the actual fruit / sprinkle ────────────────────────────────────
export function ToppingIcon({ id, size = 22 }: Sz & { id: CakeTopping }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {toppingShape(id)}
    </Svg>
  );
}

export type IngredientKind = 'base' | 'filling' | 'topping';

/** One icon for any single ingredient, keyed by kind + id. */
export function CakeIngredientIcon({
  kind,
  id,
  size = 22,
}: Sz & { kind: IngredientKind; id: CakeBase | CakeFilling | CakeTopping }) {
  if (kind === 'base') return <BaseIcon id={id as CakeBase} size={size} />;
  if (kind === 'filling') return <FillingIcon id={id as CakeFilling} size={size} />;
  return <ToppingIcon id={id as CakeTopping} size={size} />;
}

/**
 * The built cake = a sponge slice in the base colour, a filling band, a cream top,
 * and the topping on top. Any subset draws (partial builds), covering every
 * base × filling × topping combination dynamically.
 */
export function CakeBuildIcon({
  base,
  filling,
  topping,
  size = 26,
}: Sz & { base?: CakeBase; filling?: CakeFilling; topping?: CakeTopping }) {
  const baseC = base ? BASE_LOOK[base] : '#F4D9A6';
  const fillC = filling ? findFilling(filling).color : null;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Ellipse cx="16" cy="28" rx="12" ry="2.4" fill="#E7DCC8" opacity={0.6} />
      {/* cake body */}
      <Path d="M7 15 Q16 11 25 15 L25 25.5 Q25 27.5 23 27.5 L9 27.5 Q7 27.5 7 25.5 Z" fill={baseC} stroke={CRUST} strokeWidth={1.2} />
      {/* filling band */}
      {fillC && <Rect x="7" y="19" width="18" height="3.6" fill={fillC} opacity={0.95} />}
      {/* cream top */}
      <Path d="M7 15 Q11 12 16 13 Q21 12 25 15 Q25 16.5 16 16.5 Q7 16.5 7 15 Z" fill="#FFF6E9" stroke={CRUST} strokeWidth={0.8} />
      {/* topping, small, on top */}
      {topping && (
        <G transform="translate(9.5 -1.5) scale(0.42)">{toppingShape(topping)}</G>
      )}
    </Svg>
  );
}
