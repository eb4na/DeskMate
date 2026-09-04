import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { BakeryColors } from '@/constants/theme';

// One monoline icon set for Settings. Every glyph is drawn on the same 24x24 grid
// with the same stroke weight and the SAME colour — the row is identified by the
// icon's SHAPE, not by its colour, so the column reads as one calm list instead of
// a rainbow of stickers. Replaces the per-row colour PNGs, which at 64px were most
// of why the screen scrolled so far.
const INK = BakeryColors.cocoa;
const SW = 1.9;

export type SettingsLineIconName =
  | 'account' | 'bell' | 'books' | 'bug' | 'clock24' | 'coin' | 'info'
  | 'language' | 'progress' | 'radio' | 'reset' | 'signout' | 'timer'
  | 'birthday' | 'mail' | 'lock' | 'plus' | 'trash' | 'gift';

export function SettingsLineIcon({
  name,
  size = 22,
  color = INK,
}: {
  name: SettingsLineIconName;
  size?: number;
  color?: string;
}) {
  const p = { stroke: color, strokeWidth: SW, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'account' && (
        <>
          <Circle cx="12" cy="8.5" r="3.6" {...p} />
          <Path d="M5.2 19.5c1-3.4 3.7-5.2 6.8-5.2s5.8 1.8 6.8 5.2" {...p} />
        </>
      )}
      {name === 'bell' && (
        <>
          <Path d="M6.6 17.2c1-1.1 1.3-2 1.3-3.6v-2a4.1 4.1 0 0 1 8.2 0v2c0 1.6.3 2.5 1.3 3.6z" {...p} />
          <Path d="M10.4 20.1a1.9 1.9 0 0 0 3.2 0" {...p} />
        </>
      )}
      {name === 'books' && (
        <>
          <Path d="M4.5 5.6h6a2 2 0 0 1 1.5.7 2 2 0 0 1 1.5-.7h6v12h-6a2 2 0 0 0-1.5.7 2 2 0 0 0-1.5-.7h-6z" {...p} />
          <Path d="M12 6.3v12" {...p} />
        </>
      )}
      {name === 'bug' && (
        <>
          <Path d="M4.8 18.6V9.4A2.6 2.6 0 0 1 7.4 6.8h9.2a2.6 2.6 0 0 1 2.6 2.6v5.2a2.6 2.6 0 0 1-2.6 2.6H9.2z" {...p} />
          <Path d="M8.6 11.4h6.8M8.6 14h4.4" {...p} />
        </>
      )}
      {name === 'clock24' && (
        <>
          <Circle cx="12" cy="12" r="7.8" {...p} />
          <Path d="M12 7.6V12l3 1.9" {...p} />
        </>
      )}
      {name === 'coin' && (
        <>
          <Circle cx="12" cy="12" r="7.8" {...p} />
          <Path d="M12 8.2v7.6M10 10.1h2.6a1.7 1.7 0 0 1 0 3.4h-2.6M10 13.5h2.8" {...p} />
        </>
      )}
      {name === 'info' && (
        <>
          <Circle cx="12" cy="12" r="7.8" {...p} />
          <Path d="M12 11v5" {...p} />
          <Circle cx="12" cy="8.2" r="0.95" fill={color} stroke="none" />
        </>
      )}
      {name === 'language' && (
        <>
          <Circle cx="12" cy="12" r="7.8" {...p} />
          <Path d="M4.4 12h15.2" {...p} />
          <Path d="M12 4.2c2 2.2 3 4.9 3 7.8s-1 5.6-3 7.8c-2-2.2-3-4.9-3-7.8s1-5.6 3-7.8z" {...p} />
        </>
      )}
      {name === 'progress' && (
        <>
          <Path d="M4.6 19.4h14.8" {...p} />
          <Path d="M7.6 19.4v-4.6M12 19.4V8.2M16.4 19.4v-7.4" {...p} />
        </>
      )}
      {name === 'radio' && (
        <>
          <Path d="M9.4 17.4V6.8l8.2-1.6v10.6" {...p} />
          <Circle cx="7.2" cy="17.6" r="2.3" {...p} />
          <Circle cx="15.4" cy="15.8" r="2.3" {...p} />
        </>
      )}
      {name === 'reset' && (
        <>
          <Path d="M19 12a7 7 0 1 1-2.2-5.1" {...p} />
          <Path d="M19.2 4.6v4.2H15" {...p} />
        </>
      )}
      {name === 'signout' && (
        <>
          <Path d="M14 5.4H6.6a1.4 1.4 0 0 0-1.4 1.4v10.4a1.4 1.4 0 0 0 1.4 1.4H14" {...p} />
          <Path d="M15.8 8.6 19.4 12l-3.6 3.4M10.4 12h9" {...p} />
        </>
      )}
      {name === 'timer' && (
        <>
          <Circle cx="12" cy="13.4" r="6.6" {...p} />
          <Path d="M12 10.2v3.2M9.8 3.8h4.4M12 3.8v3" {...p} />
        </>
      )}
      {name === 'birthday' && (
        // A cake needs its tiers to read at 22px, not just an outline: base, a
        // scalloped top edge, and one candle with a flame.
        <>
          <Path d="M4.6 19.6v-4.4a1.8 1.8 0 0 1 1.8-1.8h11.2a1.8 1.8 0 0 1 1.8 1.8v4.4z" {...p} />
          <Path d="M4.6 16.6c1.3 0 1.3 1.2 2.6 1.2s1.3-1.2 2.6-1.2 1.3 1.2 2.6 1.2 1.3-1.2 2.6-1.2 1.3 1.2 2.6 1.2" {...p} />
          <Path d="M12 13.4v-3.2" {...p} />
          <Path d="M12 6.4c.85.85.85 1.75 0 2.5-.85-.75-.85-1.65 0-2.5z" {...p} />
        </>
      )}
      {name === 'gift' && (
        <>
          <Rect x="4.6" y="10.4" width="14.8" height="9.2" rx="1.6" {...p} />
          <Path d="M4.6 13.8h14.8M12 10.4v9.2" {...p} />
          <Path d="M12 10.4C10.6 8.2 8 7.4 7.2 8.6c-.7 1 .6 1.8 4.8 1.8zM12 10.4c1.4-2.2 4-3 4.8-1.8.7 1-.6 1.8-4.8 1.8z" {...p} />
        </>
      )}
      {name === 'mail' && (
        <>
          <Rect x="4.2" y="6.4" width="15.6" height="11.2" rx="2" {...p} />
          <Path d="m4.8 7.6 7.2 5 7.2-5" {...p} />
        </>
      )}
      {name === 'lock' && (
        <>
          <Rect x="5.6" y="10.6" width="12.8" height="9" rx="2.2" {...p} />
          <Path d="M8.6 10.6V8.2a3.4 3.4 0 0 1 6.8 0v2.4" {...p} />
        </>
      )}
      {name === 'trash' && (
        <>
          <Path d="M5.6 7.4h12.8" {...p} />
          <Path d="M9.4 7.4V5.8a1.4 1.4 0 0 1 1.4-1.4h2.4a1.4 1.4 0 0 1 1.4 1.4v1.6" {...p} />
          <Path d="M7 7.4l.9 11a1.6 1.6 0 0 0 1.6 1.5h5a1.6 1.6 0 0 0 1.6-1.5l.9-11" {...p} />
          <Path d="M10.6 11v5.4M13.4 11v5.4" {...p} />
        </>
      )}
      {name === 'plus' && <Path d="M12 5.6v12.8M5.6 12h12.8" {...p} />}
    </Svg>
  );
}
