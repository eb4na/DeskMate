import { Image, type ImageSource } from 'expo-image';
import { Tabs } from 'expo-router';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { subscribeDragActive } from '@/lib/drag-session';
import { setTutorialTarget } from '@/lib/tutorial-targets';
import { SoundPressable } from '@/components/sound-pressable';
import { DevKnobs } from '@/components/dev-knobs';
import { usePosTweaks } from '@/hooks/use-pos-tweaks';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';

import { BottomTabInset, Fonts } from '@/constants/theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const HOME_ICON = require('@/assets/images/tabIcons/gen-home.png');
// The gen-*-active.png variants are flat, featureless silhouettes, so selecting a tab
// used to erase its illustration. The active tab is already legible from its label
// (styles.labelActive turns it pink + bold), so every tab keeps its detailed art.

const ICONS: Record<string, ImageSource> = {
  index: HOME_ICON,
  tasks: require('@/assets/images/tabIcons/gen-tasks.png'),
  progress: require('@/assets/images/tabIcons/gen-progress.png'),
  shop: require('@/assets/images/tabIcons/gen-shop.png'),
};

const LABEL_KEYS: Record<string, string> = {
  index: 'nav.home',
  tasks: 'nav.tasks',
  progress: 'nav.progress',
  shop: 'nav.shop',
};

const ROUTE_INDEX: Record<string, number> = { index: 0, tasks: 1, progress: 2, shop: 3 };

function TabItem({ name, isFocused, onPress, iconStyle, targetId }: { name: string; isFocused: boolean; onPress: () => void; iconStyle?: StyleProp<ImageStyle>; targetId?: string }) {
  const { t } = useTranslation();
  const { scale } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale), [scale]);
  return (
    <SoundPressable
      style={[
        styles.tab,
        name === 'index' && styles.tabHome,
        name === 'tasks' && styles.tabTasks,
        name === 'progress' && styles.tabProgress,
        name === 'shop' && styles.tabShop,
      ]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={t(LABEL_KEYS[name])}
      accessibilityState={{ selected: isFocused }}
    >
      <View
        ref={targetId ? (n) => setTutorialTarget(targetId, n) : undefined}
        style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
        <Image
          source={ICONS[name]}
          style={[styles.icon, name === 'index' && styles.iconHome, iconStyle]}
          contentFit="contain"
        />
      </View>
      <Text style={[styles.label, isFocused && styles.labelActive]}>{t(LABEL_KEYS[name])}</Text>
    </SoundPressable>
  );
}

const LACE_EDGE = 'M0 10 ' + Array.from({ length: 20 }, (_, i) => `Q${i * 20 + 10} -3 ${i * 20 + 20} 10`).join(' ');

const ALL_ROUTES = ['index', 'tasks', 'progress', 'shop'];

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { scale } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale), [scale]);
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10 * scale);
  // Tablet-only per-icon nudge so each icon centers in its lace segment.
  const { knobs: twKnobs, onChange: twChange, t: tw } = usePosTweaks('menubar', [
    { name: 'index', label: 'Home icon' },
    { name: 'tasks', label: 'Tasks icon' },
    { name: 'progress', label: 'Progress icon' },
    { name: 'shop', label: 'Shop icon' },
  ]);
  return (
    <View style={[styles.wrapper, { height: 98 * scale + bottomPadding }]}>
      <View pointerEvents="none" style={styles.laceSlot}>
        <Svg width="100%" height="100%" viewBox="0 0 400 24" preserveAspectRatio="none">
          <Path d={LACE_EDGE + ' L400 24 L0 24 Z'} fill="#FFF9ED" />
          <Path d={LACE_EDGE} fill="none" stroke="#D5A653" strokeWidth="1.5" />
        </Svg>
      </View>
      <View pointerEvents="none" style={styles.panel} />
      <View style={[styles.row, { bottom: bottomPadding }]}>
        {ALL_ROUTES.map((name) => {
          const index = ROUTE_INDEX[name];
          const isFocused = state.index === index;
          return (
            <TabItem
              key={name}
              name={name}
              isFocused={isFocused}
              iconStyle={tw(name)}
              targetId={name === 'tasks' || name === 'shop' ? name : undefined}
              onPress={() => {
                const route = state.routes[index];
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) navigation.navigate(name);
              }}
            />
          );
        })}
      </View>
      {/* Adjust from a non-home tab so this doesn't stack on the home panel. */}
      {state.index !== ROUTE_INDEX.index && <DevKnobs screen="menubar" knobs={twKnobs} onChange={twChange} />}
    </View>
  );
}

export default function AppTabs() {
  const { t } = useTranslation();
  const [dragActive, setDragActive] = useState(false);
  const { activeSession } = useApp();

  useEffect(() => subscribeDragActive(setDragActive), []);

  // Hide the bottom tab bar while studying — the study room is full-screen.
  const hideBar = dragActive || !!activeSession;

  return (
    <Tabs
      tabBar={(props) => hideBar ? null : <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: BottomTabInset,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}>
      <Tabs.Screen name="index" options={{ title: t('nav.home') }} />
      <Tabs.Screen name="tasks" options={{ title: t('nav.tasks') }} />
      <Tabs.Screen name="progress" options={{ title: t('nav.progress') }} />
      <Tabs.Screen name="shop" options={{ title: t('nav.shop') }} />
    </Tabs>
  );
}

// The ivory panel reaches the screen edge; only the controls respect the safe area.
function makeStyles(s: number) {
  return StyleSheet.create({
    wrapper: {
      position: 'absolute', left: 0, right: 0, bottom: 0,
    },
    laceSlot: {
      position: 'absolute', left: 0, right: 0, top: 0, height: 24 * s,
    },
    panel: {
      position: 'absolute', left: 0, right: 0, top: 23 * s, bottom: 0,
      backgroundColor: '#FFF9ED',
    },
    row: {
      position: 'absolute', left: 0, right: 0, height: 74 * s,
      flexDirection: 'row', alignItems: 'center',
    },
    tab: {
      flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 3 * s,
    },
    tabHome: {}, tabTasks: {}, tabProgress: {}, tabShop: {},
    iconWrap: {
      width: 56 * s, height: 46 * s, borderRadius: 20 * s,
      borderWidth: 1, borderColor: 'transparent',
      alignItems: 'center', justifyContent: 'center',
    },
    iconWrapActive: {
      backgroundColor: '#FCE8E7', borderColor: '#E9C888',
    },
    icon: { width: 38 * s, height: 38 * s },
    iconHome: { width: 38 * s, height: 38 * s },
    label: {
      fontSize: 12 * s, color: '#A87868', fontWeight: '500', fontFamily: Fonts.rounded,
    },
    labelActive: { color: '#BE627A', fontWeight: '700' },
  });
}
