import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { BakeryColors } from '@/constants/theme';

// Graph-paper / notebook background for utility screens (Task / Progress / Shop …).
// Reads as real grid paper: faint MINOR rulings every cell plus slightly stronger
// MAJOR rulings every N cells (like graph paper), on a warm cream sheet. Code-drawn
// with react-native-svg (no PNG assets). Light mode only.
//
// Drop it as the FIRST child of a flex:1 View and render content on top:
//   <View style={{ flex: 1 }}>
//     <NotebookBackground />
//     …content…
//   </View>
// NOT for "scene" screens that already own the full-bleed art (Home study-room).
//
// Lines are emitted explicitly from a measured onLayout size (not an SVG <Pattern>)
// so it renders identically across iOS / Android / web.

export function NotebookBackground({
  cell = 30,
  major = 0,
  minorColor = BakeryColors.gridLine,
  majorColor = BakeryColors.gridLineMajor,
  background = BakeryColors.paper,
  style,
}: {
  /** Minor cell size in px. */
  cell?: number;
  /** Every `major`-th line is drawn stronger (graph-paper feel). 0 disables. */
  major?: number;
  minorColor?: string;
  majorColor?: string;
  background?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };

  const cols = size.w > 0 ? Math.ceil(size.w / cell) : 0;
  const rows = size.h > 0 ? Math.ceil(size.h / cell) : 0;
  const isMajor = (i: number) => major > 0 && i % major === 0;

  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, { backgroundColor: background }, style]}>
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          {Array.from({ length: cols + 1 }, (_, i) => (
            <Line
              key={`v${i}`}
              x1={i * cell}
              y1={0}
              x2={i * cell}
              y2={size.h}
              stroke={isMajor(i) ? majorColor : minorColor}
              strokeWidth={isMajor(i) ? 1.4 : 1}
            />
          ))}
          {Array.from({ length: rows + 1 }, (_, i) => (
            <Line
              key={`h${i}`}
              x1={0}
              y1={i * cell}
              x2={size.w}
              y2={i * cell}
              stroke={isMajor(i) ? majorColor : minorColor}
              strokeWidth={isMajor(i) ? 1.4 : 1}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}
