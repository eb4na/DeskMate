import Svg, { Circle, Ellipse, Path, Rect, Line } from 'react-native-svg';

const S = '#7A5240';
const H = '#F0B44A';
const B = '#F4C976';
const C = '#FFF0CC';
const R = '#F6C8C2';
const P = '#E48A9A';

// Small Pouch → sketchy bread money bag with bow
export function BreadPouchIcon({ size = 60 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Bag body - wobbly round bun shape */}
      <Path d="M12 40 Q10 22 30 20 Q50 22 48 40 Q48 56 30 56 Q12 56 12 40 Z"
        fill={B} stroke={S} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Highlight on bun */}
      <Path d="M16 36 Q14 24 30 22 Q46 24 44 36" fill={H} opacity={0.3} stroke="none" />
      {/* Score mark */}
      <Path d="M18 38 Q30 32 42 38" stroke={S} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity={0.5} />
      {/* Hatching texture */}
      <Line x1="14" y1="48" x2="18" y2="44" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.18} />
      <Line x1="42" y1="48" x2="46" y2="44" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.18} />
      {/* Neck gather - wobbly */}
      <Path d="M22 22 Q22 18 30 17 Q38 18 38 22 L37 26 Q30 28 23 26 Z"
        fill="#C38F72" stroke={S} strokeWidth="2" strokeLinejoin="round" />
      {/* Bow left loop - slightly uneven */}
      <Path d="M20 19 Q13 13 17 9 Q21 6 24 12 L21 18 Z"
        fill={P} stroke={S} strokeWidth="1.8" strokeLinejoin="round" />
      {/* Bow right loop */}
      <Path d="M40 19 Q47 13 43 9 Q39 6 36 12 L39 18 Z"
        fill={P} stroke={S} strokeWidth="1.8" strokeLinejoin="round" />
      {/* Bow center knot */}
      <Ellipse cx="30" cy="18" rx="5" ry="4" fill="#CC6B7B" stroke={S} strokeWidth="1.8" />
      {/* Ribbon tails */}
      <Path d="M26 20 Q22 26 20 25" stroke={P} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <Path d="M34 20 Q38 26 40 25" stroke={P} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Blush */}
      <Ellipse cx="20" cy="44" rx="5" ry="3" fill={R} opacity={0.6} />
      <Ellipse cx="40" cy="44" rx="5" ry="3" fill={R} opacity={0.6} />
      {/* Shine */}
      <Path d="M22 32 Q26 28 32 30" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity={0.4} />
    </Svg>
  );
}

// Study Bag → sketchy toast backpack
export function BreadBagIcon({ size = 60 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Bag body - slightly wobbly */}
      <Path d="M9 25 Q9 21 14 21 L46 21 Q51 21 51 25 L51 53 Q51 57 46 57 L14 57 Q9 57 9 53 Z"
        fill={B} stroke={S} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Crust top */}
      <Path d="M9 34 Q10 21 24 21 L36 21 Q50 21 51 34 L9 34 Z"
        fill="#C38F72" stroke={S} strokeWidth="2" strokeLinejoin="round" />
      {/* Bread score on crust */}
      <Path d="M14 29 Q30 24 46 29" stroke={S} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.4} />
      {/* Shoulder strap loop - uneven */}
      <Path d="M21 21 Q20 10 30 10 Q40 10 39 21"
        fill="none" stroke={S} strokeWidth="3.5" strokeLinecap="round" />
      <Path d="M21 21 Q20 11 30 11 Q40 11 39 21"
        fill="none" stroke={B} strokeWidth="1.5" strokeLinecap="round" opacity={0.5} />
      {/* Front pocket */}
      <Path d="M16 41 Q16 37 22 37 L38 37 Q44 37 44 41 L44 53 Q44 57 38 57 L22 57 Q16 57 16 53 Z"
        fill={C} stroke={S} strokeWidth="2" strokeLinejoin="round" />
      {/* Zipper line */}
      <Path d="M20 46 Q30 44 40 46" stroke={S} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Zipper pull */}
      <Circle cx="40" cy="46" r="3" fill={H} stroke={S} strokeWidth="1.5" />
      <Circle cx="40" cy="46" r="1.5" fill={S} opacity={0.6} />
      {/* Little star on crust */}
      <Path d="M30 28 L31.2 31.5 L35 31.5 L32 33.5 L33 37 L30 35 L27 37 L28 33.5 L25 31.5 L28.8 31.5 Z"
        fill={B} opacity={0.7} stroke={S} strokeWidth="0.8" strokeLinejoin="round" />
      {/* Shine */}
      <Path d="M12" y1="42" Q14 38 16 40" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity={0.35} />
      {/* Blush */}
      <Ellipse cx="16" cy="52" rx="4" ry="2.5" fill={R} opacity={0.5} />
    </Svg>
  );
}

// Coin Chest → sketchy bread treasure chest
export function BreadChestIcon({ size = 60 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Coins behind */}
      <Circle cx="14" cy="30" r="8" fill={H} stroke={S} strokeWidth="1.5" />
      <Circle cx="14" cy="30" r="5" fill={B} />
      <Path d="M11 27 Q14 25 17 27" stroke={S} strokeWidth="1" strokeLinecap="round" fill="none" opacity={0.4} />
      <Circle cx="46" cy="30" r="8" fill={H} stroke={S} strokeWidth="1.5" />
      <Circle cx="46" cy="30" r="5" fill={B} />
      <Circle cx="30" cy="25" r="8" fill={H} stroke={S} strokeWidth="1.5" />
      <Circle cx="30" cy="25" r="5" fill={B} />
      {/* Chest base */}
      <Path d="M8 40 Q8 37 12 37 L48 37 Q52 37 52 40 L52 54 Q52 57 48 57 L12 57 Q8 57 8 54 Z"
        fill="#C38F72" stroke={S} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Lid - bread loaf arch */}
      <Path d="M8 40 Q6 22 30 20 Q54 22 52 40 Z"
        fill={B} stroke={S} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Bread score marks on lid */}
      <Path d="M16 37 Q30 28 44 37" stroke={S} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity={0.5} />
      <Path d="M20 33 Q30 26 40 33" stroke={S} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity={0.3} />
      {/* Lid texture */}
      <Line x1="10" y1="38" x2="14" y2="34" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.15} />
      <Line x1="46" y1="38" x2="50" y2="34" stroke={S} strokeWidth="1" strokeLinecap="round" opacity={0.15} />
      {/* Metal band */}
      <Path d="M8 44 L52 44 L52 50 L8 50 Z" fill="#A46F56" stroke={S} strokeWidth="1.5" opacity={0.9} />
      {/* Lock */}
      <Rect x="25" y="40" width="10" height="10" rx="3" fill={H} stroke={S} strokeWidth="2" />
      <Path d="M27 40 Q27 35 30 35 Q33 35 33 40" fill="none" stroke={S} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="30" cy="45" r="2" fill={S} opacity={0.6} />
      {/* Rivets */}
      <Circle cx="14" cy="53" r="2.5" fill={H} stroke={S} strokeWidth="1.5} />
      <Circle cx="46" cy="53" r="2.5" fill={H} stroke={S} strokeWidth="1.5" />
      {/* Shine */}
      <Path d="M14 28 Q18 24 22 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity={0.4} />
    </Svg>
  );
}

// Scholar Vault → sketchy sourdough vault door
export function BreadVaultIcon({ size = 60 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Outer frame - slightly wobbly circle */}
      <Path d="M4 30 Q4 4 30 4 Q56 4 56 30 Q56 56 30 56 Q4 56 4 30 Z"
        fill="#A46F56" stroke={S} strokeWidth="2.5" />
      {/* Door face */}
      <Path d="M9 30 Q9 8 30 8 Q51 8 51 30 Q51 52 30 52 Q9 52 9 30 Z"
        fill={B} stroke={S} strokeWidth="2" />
      {/* Sourdough scoring - leaf pattern */}
      <Path d="M30 12 Q38 18 38 30 Q38 42 30 48 Q22 42 22 30 Q22 18 30 12 Z"
        fill="none" stroke={S} strokeWidth="1.8" strokeLinecap="round" opacity={0.45} />
      <Path d="M12 30 Q18 22 30 22 Q42 22 48 30 Q42 38 30 38 Q18 38 12 30 Z"
        fill="none" stroke={S} strokeWidth="1.8" strokeLinecap="round" opacity={0.45} />
      {/* Inner ring */}
      <Path d="M16 30 Q16 14 30 14 Q44 14 44 30 Q44 46 30 46 Q16 46 16 30 Z"
        fill="none" stroke={S} strokeWidth="1.2" opacity={0.3} />
      {/* Wheel handle */}
      <Circle cx="30" cy="30" r="9" fill={H} stroke={S} strokeWidth="2.5" />
      <Circle cx="30" cy="30" r="9" fill={C} opacity={0.2} />
      {/* Wheel spokes - slightly imperfect */}
      <Line x1="30" y1="21" x2="30" y2="39" stroke={S} strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="21" y1="30" x2="39" y2="30" stroke={S} strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="24" y1="24" x2="36" y2="36" stroke={S} strokeWidth="2" strokeLinecap="round" />
      <Line x1="36" y1="24" x2="24" y2="36" stroke={S} strokeWidth="2" strokeLinecap="round" />
      {/* Center hub */}
      <Circle cx="30" cy="30" r="4" fill={S} opacity={0.75} />
      <Circle cx="30" cy="30" r="2" fill={H} />
      {/* Bolts */}
      <Circle cx="30" cy="10" r="2.5" fill="#C38F72" stroke={S} strokeWidth="1.2} />
      <Circle cx="30" cy="50" r="2.5" fill="#C38F72" stroke={S} strokeWidth="1.2" />
      <Circle cx="8" cy="30" r="2.5" fill="#C38F72" stroke={S} strokeWidth="1.2" />
      <Circle cx="52" cy="30" r="2.5" fill="#C38F72" stroke={S} strokeWidth="1.2" />
      {/* Hinge */}
      <Rect x="2" y="24" width="7" height="5" rx="2" fill="#C38F72" stroke={S} strokeWidth="1.5" />
      <Rect x="2" y="31" width="7" height="5" rx="2" fill="#C38F72" stroke={S} strokeWidth="1.5" />
      {/* Sketch texture on door */}
      <Line x1="14" y1="22" x2="18" y2="18" stroke={S} strokeWidth="0.8" strokeLinecap="round" opacity={0.15} />
      <Line x1="42" y1="40" x2="46" y2="36" stroke={S} strokeWidth="0.8" strokeLinecap="round" opacity={0.15} />
      {/* Shine */}
      <Path d="M16" Q20 12 26 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity={0.3} />
    </Svg>
  );
}
