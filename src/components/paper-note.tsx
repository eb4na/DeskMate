import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';

import { noteFontFamily } from '@/lib/companion-voice';

const INK = '#5D3C2E';
const ACCENT = '#9C4A5C';
const SEAL = '#D96F83';

/** Code-drawn envelope with a pink heart seal (approved mockup, viewBox 140x96). */
export function Envelope({ width, sealed = true, label }: { width: number; sealed?: boolean; label?: string }) {
  const height = (width * 96) / 140;
  return (
    <Svg width={width} height={height} viewBox="0 0 140 96">
      <Rect x={2} y={2} width={136} height={92} rx={7} fill="#FFFDF8" stroke="#F1BDCC" strokeWidth={2} />
      <Path d="M4 90 L56 52 M136 90 L84 52" fill="none" stroke="#F6D3DC" strokeWidth={1.6} />
      <Path d="M4 6 L70 56 L136 6" fill="#FFF4EC" stroke="#F1BDCC" strokeWidth={2} strokeLinejoin="round" />
      {sealed ? (
        <Path
          d="M70 66 C60 59 57 51 61 46 C64 42 68 44 70 47 C72 44 76 42 79 46 C83 51 80 59 70 66 Z"
          fill={SEAL}
        />
      ) : null}
      {label ? (
        <SvgText x={104} y={82} textAnchor="middle" fontSize={9} fill={ACCENT}>
          {label}
        </SvgText>
      ) : null}
    </Svg>
  );
}

/** Cream lined paper with two tape strips, a slight tilt, and handwritten text. */
export function PaperNote({
  text,
  signature,
  lang,
  width,
}: {
  text: string;
  signature: string;
  lang: string;
  width: number;
}) {
  const font = noteFontFamily(lang);
  const fontSize = Math.round(Math.max(18, Math.min(26, width * 0.062)));
  const lineHeight = Math.round(fontSize * 1.45);
  const [h, setH] = useState(0);
  const PAD_TOP = 18;
  const lineCount = h > 0 ? Math.ceil((h - PAD_TOP) / lineHeight) : 0;
  const text_ = { fontFamily: font, fontSize, lineHeight, color: INK } as const;
  return (
    <View style={[styles.wrap, { width }]}>
      <View style={[styles.tape, { left: 18, backgroundColor: 'rgba(247,167,184,0.62)', transform: [{ rotate: '-6deg' }] }]} />
      <View style={[styles.tape, { right: 18, backgroundColor: 'rgba(170,200,232,0.6)', transform: [{ rotate: '5deg' }] }]} />
      <View style={styles.paper}>
        <View style={styles.clip} onLayout={(e) => setH(e.nativeEvent.layout.height)} pointerEvents="none">
          {Array.from({ length: lineCount }, (_, i) => (
            <View
              key={i}
              style={[styles.rule, { top: PAD_TOP + (i + 1) * lineHeight - Math.round(lineHeight * 0.14) }]}
            />
          ))}
        </View>
        <Text style={text_}>{text}</Text>
        <Text style={[text_, { textAlign: 'right', color: ACCENT, marginTop: lineHeight * 0.4 }]}>{signature}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { transform: [{ rotate: '-0.6deg' }] },
  tape: { position: 'absolute', top: -10, width: 62, height: 20, zIndex: 2 },
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', borderRadius: 4 },
  rule: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(214,170,150,0.38)' },
  paper: {
    backgroundColor: '#FFFBF4',
    borderRadius: 4,
    paddingHorizontal: 22,
    paddingTop: 18, // keep in sync with PAD_TOP
    paddingBottom: 14,
    shadowColor: INK,
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});
