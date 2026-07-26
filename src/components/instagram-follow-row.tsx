// "Follow us on Instagram" row for Settings. Opens the Instagram app if it's
// installed (instagram:// deep link) and falls back to the web profile otherwise.
// A present box jumps next to it until the user taps it once; the first tap grants
// a one-time +100 coins (claimInstagramFollow) and the present settles.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { CoinIcon } from '@/components/coin-icon';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { BakeryColors, Spacing } from '@/constants/theme';

const IG_USERNAME = 'memobun.app';
const APP_URL = `instagram://user?username=${IG_USERNAME}`;
const WEB_URL = `https://instagram.com/${IG_USERNAME}`;

// Generic camera-in-rounded-square glyph (not the trademarked wordmark/gradient).
function InstagramGlyph({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="18" height="18" rx="5.4" stroke="#C13584" strokeWidth={2} />
      <Circle cx="12" cy="12" r="4.2" stroke="#C13584" strokeWidth={2} />
      <Circle cx="17.2" cy="6.8" r="1.3" fill="#C13584" />
    </Svg>
  );
}

// Little wrapped present box with a ribbon + bow.
function PresentGlyph({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* box body */}
      <Rect x="4" y="9.5" width="16" height="11" rx="2" fill={BakeryColors.berry} />
      {/* lid */}
      <Rect x="3" y="7.5" width="18" height="3.6" rx="1.4" fill="#E68AA0" />
      {/* vertical ribbon */}
      <Rect x="10.8" y="7.5" width="2.4" height="13" fill="#FBE3B6" />
      {/* bow */}
      <Path d="M12 7.5 C12 5 9 4.6 9 6.4 C9 7.6 10.8 7.5 12 7.5 Z" fill="#FBE3B6" />
      <Path d="M12 7.5 C12 5 15 4.6 15 6.4 C15 7.6 13.2 7.5 12 7.5 Z" fill="#FBE3B6" />
      <Circle cx="12" cy="6.9" r="1" fill="#F2C879" />
    </Svg>
  );
}

export function InstagramFollowRow() {
  const { t } = useTranslation();
  const { instagramFollowClaimed, claimInstagramFollow } = useApp();
  const [justClaimed, setJustClaimed] = useState(false);
  const jump = useRef(new Animated.Value(0)).current;

  // Keep the present hopping until it's been tapped (claimed).
  useEffect(() => {
    if (instagramFollowClaimed) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(jump, { toValue: 1, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(jump, { toValue: 0, duration: 420, easing: Easing.bounce, useNativeDriver: true }),
        Animated.delay(700),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [instagramFollowClaimed, jump]);

  const jumpY = jump.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  const openInstagram = async () => {
    // openURL opens the app when installed and rejects when no handler exists, so
    // the catch is our reliable web fallback (no Info.plist query-scheme needed).
    try {
      await Linking.openURL(APP_URL);
    } catch {
      Linking.openURL(WEB_URL).catch(() => {});
    }
  };

  const onPress = () => {
    openInstagram();
    if (!instagramFollowClaimed) {
      claimInstagramFollow();
      setJustClaimed(true);
    }
  };

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <InstagramGlyph size={30} />
      </View>
      <View style={styles.body}>
        <ThemedText type="smallBold">{t('settings.followInstagram')}</ThemedText>
        {/* Full-size subtitle that wraps to a 2nd line for long translations,
            rather than shrinking to fit one line (which read as tiny in ja/de). */}
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {instagramFollowClaimed ? t('settings.followInstagramNote') : t('settings.followInstagramReward')}
        </ThemedText>
      </View>

      {justClaimed ? (
        <View style={styles.rewardPill}>
          <CoinIcon size={18} />
          <ThemedText type="smallBold" style={styles.rewardText}>+100</ThemedText>
        </View>
      ) : !instagramFollowClaimed ? (
        <Animated.View style={{ transform: [{ translateY: jumpY }] }}>
          <PresentGlyph size={30} />
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Matches SettingRow's geometry so the Instagram icon lines up with the others.
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three, paddingHorizontal: Spacing.three },
  pressed: { opacity: 0.7 },
  iconWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(124,111,90,0.12)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rewardText: { color: BakeryColors.cocoaDark },
});
