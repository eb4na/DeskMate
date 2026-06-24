import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { companionLevelInfo } from '@/lib/companion-level';
import { useTranslation } from '@/i18n';
import { BakeryColors } from '@/constants/theme';

// Code-drawn chef's toque, bakery style (puffy white top + cream band).
function ChefHatIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path
        d="M16 43 C6 43 5 28 15 26 C11 15 25 11 31 18 C35 11 49 13 49 25 C59 26 58 43 48 43 Z"
        fill="#FFFFFF"
        stroke="#BE9A72"
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <Rect x="17" y="41" width="30" height="14" rx="4" fill="#FFF3E4" stroke="#BE9A72" strokeWidth={2.4} />
    </Svg>
  );
}

// Bond meter shown under a companion: a chef's hat + a slim progress bar toward the next
// level + the current level number. Level comes purely from `minutes` studied with that
// companion (see companion-level.ts). `scale` matches the tablet scale of its host.
export function CompanionLevel({ minutes, scale = 1 }: { minutes: number; scale?: number }) {
  const { t } = useTranslation();
  const { level, progress } = companionLevelInfo(minutes);
  return (
    <View style={[styles.row, { gap: 5 * scale, marginTop: 5 * scale }]}>
      <ChefHatIcon size={24 * scale} />
      <View style={[styles.track, { height: 4 * scale, borderRadius: 2 * scale }]}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text style={[styles.lv, { fontSize: 10 * scale }]} numberOfLines={1}>
        {t('gallery.level', { level })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 2 },
  track: { flex: 1, backgroundColor: BakeryColors.shortbread, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: BakeryColors.berry },
  lv: { color: BakeryColors.mocha, fontWeight: '800' },
});
