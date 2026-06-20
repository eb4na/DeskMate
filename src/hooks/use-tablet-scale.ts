import { useWindowDimensions } from 'react-native';

import { MaxContentWidth } from '@/constants/theme';
import { useIsTablet } from '@/hooks/use-device-class';

// Shared tablet scaling. Tablet mode was designed on the iPad Pro 11" (4th gen) —
// shortest side 834pt — at a 1.3× multiplier. Instead of hardcoding 1.3 for every
// tablet (which looks wrong on any other iPad size), the multiplier scales
// PROPORTIONALLY to the screen's shortest side, anchored so the 11" Pro reproduces
// exactly the tuned 1.3 (834 / 642 ≈ 1.3). Every other model — mini, Air, 13" — is
// then proportional to that reference, clamped to a sane range.
//
// Phones are byte-identical: `scale` is the integer literal 1 (so `N * 1 === N`, no
// float drift) and `contentWidth` is the unchanged phone cap.
const REF_IPAD11_SHORTEST = 834; // iPad Pro 11" (4th gen) shortest side, in pt
const REF_SCALE = 1.3; // the multiplier the tablet layouts were tuned at on that model
const TABLET_SCALE_BASELINE = REF_IPAD11_SHORTEST / REF_SCALE; // ≈ 642
const TABLET_SCALE_MIN = 1.1;
const TABLET_SCALE_MAX = 1.7;
const TABLET_CONTENT_WIDTH = 1100; // widened centered column on tablet

export function useTabletScale() {
  const isTablet = useIsTablet();
  const { width, height } = useWindowDimensions();
  const shortest = Math.min(width, height);
  const tabletScale = Math.min(
    TABLET_SCALE_MAX,
    Math.max(TABLET_SCALE_MIN, shortest / TABLET_SCALE_BASELINE),
  );
  return {
    isTablet,
    scale: isTablet ? tabletScale : 1,
    contentWidth: isTablet ? TABLET_CONTENT_WIDTH : MaxContentWidth,
  };
}
