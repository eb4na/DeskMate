import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ColorValue } from 'react-native';

type P = { color?: ColorValue; size?: number };
const c = (color: ColorValue) => color as string;

// Envelope — email field prefix
export function MailIcon({ color = '#A46F56', size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="2.5" y="5" width="19" height="14" rx="3" fill="none" stroke={c(color)} strokeWidth="1.8" />
      <Path d="M4 7.5 L12 13 L20 7.5" fill="none" stroke={c(color)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Padlock — password field prefix
export function LockIcon({ color = '#A46F56', size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="4.5" y="10" width="15" height="10" rx="3" fill="none" stroke={c(color)} strokeWidth="1.8" />
      <Path d="M8 10 V8 a4 4 0 0 1 8 0 V10" fill="none" stroke={c(color)} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M12 14 V16.5" stroke={c(color)} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

// Eye — password visible. A round, bright kawaii eye: big filled iris with a
// little sparkle highlight.
export function EyeIcon({ color = '#A46F56', size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 12 Q12 4.5 21 12 Q12 19.5 3 12 Z" fill="none" stroke={c(color)} strokeWidth="1.8" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3.6" fill={c(color)} />
      <Circle cx="10.7" cy="10.7" r="1.05" fill="#FFFFFF" />
    </Svg>
  );
}

// Password hidden — a sweet closed/sleepy eye: a downward eyelid curve with a
// few little lashes (cuter than a struck-through eye).
export function EyeOffIcon({ color = '#A46F56', size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 10.5 Q12 17.5 20 10.5" fill="none" stroke={c(color)} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M6.8 13.9 L5.7 15.8" stroke={c(color)} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M12 14.7 L12 16.9" stroke={c(color)} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M17.2 13.9 L18.3 15.8" stroke={c(color)} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

// Chevron — language dropdown pill
export function ChevronDownIcon({ color = '#A46F56', size = 16 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 9 L12 15 L18 9" fill="none" stroke={c(color)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Multicolor Google "G"
export function GoogleGIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}
