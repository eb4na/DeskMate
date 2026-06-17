import { MaxContentWidth } from '@/constants/theme';
import { useIsTablet } from '@/hooks/use-device-class';

// Shared, automated tablet card scaling. One multiplier + one widened content
// column, applied across the card-heavy screens so cards read bigger on tablets
// without hand-dialing each one. Phones are byte-identical: `scale` is the
// integer literal 1 (so `N * 1 === N`, no float drift) and `contentWidth` is the
// unchanged phone cap. Tune the whole app from the two constants below.
const TABLET_FONT_SCALE = 1.3; // font + spacing multiplier on tablet
const TABLET_CONTENT_WIDTH = 1100; // widened centered column on tablet

export function useTabletScale() {
  const isTablet = useIsTablet();
  return {
    isTablet,
    scale: isTablet ? TABLET_FONT_SCALE : 1,
    contentWidth: isTablet ? TABLET_CONTENT_WIDTH : MaxContentWidth,
  };
}
