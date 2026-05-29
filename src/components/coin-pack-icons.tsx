import Svg, { Circle, Ellipse, Path, Rect, Line, G } from 'react-native-svg';

// Small Pouch → cute bread money bag with bow
export function BreadPouchIcon({ size = 60 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Bag body - round bun */}
      <Circle cx="30" cy="40" r="17" fill="#F4C976" />
      <Circle cx="30" cy="40" r="17" fill="#FFF8F1" opacity={0.25} />
      {/* Score mark on bun */}
      <Path d="M20 34 Q30 30 40 34" stroke="#C38F72" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Neck gather */}
      <Rect x="24" y="22" width="12" height="7" rx="3" fill="#C38F72" />
      {/* Bow left loop */}
      <Ellipse cx="21" cy="18" rx="6" ry="4" fill="#E48A9A" transform="rotate(-20 21 18)" />
      {/* Bow right loop */}
      <Ellipse cx="39" cy="18" rx="6" ry="4" fill="#E48A9A" transform="rotate(20 39 18)" />
      {/* Bow center knot */}
      <Ellipse cx="30" cy="19" rx="4" ry="3" fill="#CC6B7B" />
      {/* Bow tails */}
      <Path d="M27 21 Q24 26 22 25" stroke="#E48A9A" strokeWidth="2" strokeLinecap="round" fill="none" />
      <Path d="M33 21 Q36 26 38 25" stroke="#E48A9A" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Blush */}
      <Ellipse cx="21" cy="42" rx="4" ry="2.5" fill="#F6C8C2" opacity={0.65} />
      <Ellipse cx="39" cy="42" rx="4" ry="2.5" fill="#F6C8C2" opacity={0.65} />
      {/* Shine */}
      <Circle cx="24" cy="35" r="2.5" fill="white" opacity={0.35} />
    </Svg>
  );
}

// Study Bag → toast-colored backpack
export function BreadBagIcon({ size = 60 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Bag body */}
      <Rect x="10" y="22" width="40" height="32" rx="10" fill="#F4C976" />
      {/* Crust top edge */}
      <Path d="M10 32 Q10 22 20 22 L40 22 Q50 22 50 32 Z" fill="#C38F72" />
      {/* Top handle loop */}
      <Path d="M22 22 Q22 12 30 12 Q38 12 38 22" fill="none" stroke="#A46F56" strokeWidth="3" strokeLinecap="round" />
      {/* Front pocket */}
      <Rect x="17" y="36" width="26" height="14" rx="7" fill="#F7DFC4" />
      {/* Pocket zip line */}
      <Line x1="22" y1="43" x2="38" y2="43" stroke="#C38F72" strokeWidth="1.5" strokeLinecap="round" />
      {/* Zip pull */}
      <Circle cx="38" cy="43" r="2.5" fill="#F0B44A" />
      <Circle cx="38" cy="43" r="1" fill="#A46F56" />
      {/* Little star detail on crust */}
      <Path d="M30 27 L31 30 L34 30 L32 32 L33 35 L30 33 L27 35 L28 32 L26 30 L29 30 Z" fill="#F4C976" opacity={0.7} />
      {/* Shine on bag body */}
      <Circle cx="16" cy="36" r="2" fill="white" opacity={0.3} />
      {/* Blush */}
      <Ellipse cx="17" cy="48" rx="3.5" ry="2" fill="#F6C8C2" opacity={0.6} />
    </Svg>
  );
}

// Coin Chest → bread loaf treasure chest with coins
export function BreadChestIcon({ size = 60 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Coins behind chest */}
      <Circle cx="15" cy="28" r="7" fill="#F0B44A" />
      <Circle cx="15" cy="28" r="4.5" fill="#F4C976" />
      <Circle cx="45" cy="28" r="7" fill="#F0B44A" />
      <Circle cx="45" cy="28" r="4.5" fill="#F4C976" />
      <Circle cx="30" cy="24" r="7" fill="#F0B44A" />
      <Circle cx="30" cy="24" r="4.5" fill="#F4C976" />
      {/* Chest base */}
      <Rect x="8" y="36" width="44" height="20" rx="7" fill="#C38F72" />
      {/* Chest lid - bread loaf arch */}
      <Path d="M8 38 Q8 20 30 20 Q52 20 52 38 Z" fill="#F4C976" />
      {/* Bread score marks on lid */}
      <Path d="M18 35 Q30 28 42 35" stroke="#C38F72" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <Path d="M22 31 Q30 26 38 31" stroke="#C38F72" strokeWidth="1" strokeLinecap="round" fill="none" opacity={0.6} />
      {/* Metal band */}
      <Rect x="8" y="42" width="44" height="5" rx="2" fill="#A46F56" />
      {/* Lock clasp */}
      <Rect x="25" y="38" width="10" height="9" rx="3" fill="#F0B44A" />
      <Path d="M27 38 Q27 33 30 33 Q33 33 33 38" fill="none" stroke="#A46F56" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="30" cy="43" r="1.5" fill="#A46F56" />
      {/* Chest rivets */}
      <Circle cx="14" cy="49" r="2" fill="#F0B44A" />
      <Circle cx="46" cy="49" r="2" fill="#F0B44A" />
      {/* Shine */}
      <Circle cx="15" cy="25" r="2" fill="white" opacity={0.4} />
    </Svg>
  );
}

// Scholar Vault → round sourdough vault door
export function BreadVaultIcon({ size = 60 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Outer vault frame */}
      <Circle cx="30" cy="32" r="24" fill="#A46F56" />
      {/* Door face - sourdough bread */}
      <Circle cx="30" cy="32" r="20" fill="#F4C976" />
      {/* Bread surface highlight */}
      <Circle cx="30" cy="32" r="20" fill="#FFF8F1" opacity={0.2} />
      {/* Sourdough score marks */}
      <Path d="M30 14 Q38 20 38 32 Q38 44 30 50 Q22 44 22 32 Q22 20 30 14 Z" fill="none" stroke="#C38F72" strokeWidth="1.5" />
      <Path d="M12 32 Q18 24 30 24 Q42 24 48 32 Q42 40 30 40 Q18 40 12 32 Z" fill="none" stroke="#C38F72" strokeWidth="1.5" />
      {/* Inner ring */}
      <Circle cx="30" cy="32" r="13" fill="none" stroke="#C38F72" strokeWidth="1.5" />
      {/* Vault wheel / handle */}
      <Circle cx="30" cy="32" r="8" fill="#F0B44A" />
      <Circle cx="30" cy="32" r="8" fill="#A46F56" opacity={0.1} />
      {/* Wheel spokes */}
      <Line x1="30" y1="24" x2="30" y2="40" stroke="#A46F56" strokeWidth="2" strokeLinecap="round" />
      <Line x1="22" y1="32" x2="38" y2="32" stroke="#A46F56" strokeWidth="2" strokeLinecap="round" />
      <Line x1="24.3" y1="26.3" x2="35.7" y2="37.7" stroke="#A46F56" strokeWidth="2" strokeLinecap="round" />
      <Line x1="35.7" y1="26.3" x2="24.3" y2="37.7" stroke="#A46F56" strokeWidth="2" strokeLinecap="round" />
      {/* Center hub */}
      <Circle cx="30" cy="32" r="3.5" fill="#A46F56" />
      <Circle cx="30" cy="32" r="1.5" fill="#F0B44A" />
      {/* Outer bolts */}
      <Circle cx="30" cy="12" r="2" fill="#C38F72" />
      <Circle cx="30" cy="52" r="2" fill="#C38F72" />
      <Circle cx="10" cy="32" r="2" fill="#C38F72" />
      <Circle cx="50" cy="32" r="2" fill="#C38F72" />
      {/* Hinge on left */}
      <Rect x="5" y="26" width="6" height="5" rx="2" fill="#C38F72" />
      <Rect x="5" y="33" width="6" height="5" rx="2" fill="#C38F72" />
      {/* Shine */}
      <Circle cx="22" cy="24" r="2.5" fill="white" opacity={0.3} />
    </Svg>
  );
}
