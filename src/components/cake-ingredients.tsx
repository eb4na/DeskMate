// BatterDash ingredient icons. Bases (sponge cubes), fillings (whipped-cream
// piping bags) and toppings are real PNG art; CakeBuildIcon composites the cake
// being built (base sponge + filling band) with the topping sitting on top — for
// any base × filling × topping combination.
import { Image } from 'expo-image';
import { View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';

import type { CakeBase, CakeFilling, CakeTopping } from '@/game/cake/gameTypes';
import { findFilling } from '@/game/cake/gameData';

type Sz = { size?: number };

const BASE_ASSETS: Record<CakeBase, number> = {
  vanilla: require('@/assets/images/cake/base-vanilla.png'),
  chocolate: require('@/assets/images/cake/base-chocolate.png'),
  strawberry: require('@/assets/images/cake/base-strawberry.png'),
  redVelvet: require('@/assets/images/cake/base-redVelvet.png'),
};
const FILLING_ASSETS: Record<CakeFilling, number> = {
  cream: require('@/assets/images/cake/filling-cream.png'),
  chocCream: require('@/assets/images/cake/filling-chocCream.png'),
  strawJam: require('@/assets/images/cake/filling-strawJam.png'),
  redVelvet: require('@/assets/images/cake/filling-redVelvet.png'),
};
const TOPPING_ASSETS: Record<CakeTopping, number> = {
  strawberry: require('@/assets/images/cake/topping-strawberry.png'),
  cherry: require('@/assets/images/cake/topping-cherry.png'),
  blueberry: require('@/assets/images/cake/topping-blueberry.png'),
  choco: require('@/assets/images/cake/topping-choco.png'),
  sprinkles: require('@/assets/images/cake/topping-sprinkles.png'),
};

// Cake-body colour per base, for the composite built cake.
const BASE_LOOK: Record<CakeBase, string> = {
  vanilla: '#F6E7C2',
  chocolate: '#6B4A2F',
  strawberry: '#F2A8BC',
  redVelvet: '#B5352F',
};

export function BaseIcon({ id, size = 22 }: Sz & { id: CakeBase }) {
  return <Image source={BASE_ASSETS[id]} style={{ width: size, height: size }} contentFit="contain" />;
}
export function FillingIcon({ id, size = 22 }: Sz & { id: CakeFilling }) {
  return <Image source={FILLING_ASSETS[id]} style={{ width: size, height: size }} contentFit="contain" />;
}
export function ToppingIcon({ id, size = 22 }: Sz & { id: CakeTopping }) {
  return <Image source={TOPPING_ASSETS[id]} style={{ width: size, height: size }} contentFit="contain" />;
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
 * The cake being built: a sponge slice in the base colour + a filling band + a
 * cream top, with the chosen topping resting ON the cake (not hovering). Any
 * subset draws, covering every base × filling × topping combination.
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
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 32 32" style={{ position: 'absolute' }}>
        <Ellipse cx="16" cy="29.5" rx="11" ry="2" fill="#E7DCC8" opacity={0.5} />
        {/* cake body (lower portion, leaving room for the topping on top) */}
        <Path d="M8 18 Q16 14.5 24 18 L24 27 Q24 29 22 29 L10 29 Q8 29 8 27 Z" fill={baseC} stroke="#A57B58" strokeWidth={1.1} />
        {fillC && <Rect x="8" y="21.5" width="16" height="3.2" fill={fillC} opacity={0.95} />}
        {/* cream top */}
        <Path d="M8 18 Q11.5 15.6 16 16.3 Q20.5 15.6 24 18 Q24 19.4 16 19.4 Q8 19.4 8 18 Z" fill="#FFF6E9" stroke="#A57B58" strokeWidth={0.7} />
      </Svg>
      {topping && (
        <Image
          source={TOPPING_ASSETS[topping]}
          style={{ position: 'absolute', width: size * 0.42, height: size * 0.42, left: size * 0.29, top: size * 0.06 }}
          contentFit="contain"
        />
      )}
    </View>
  );
}
