import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { router, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { subscribeDragActive } from '@/lib/drag-session';
import { setTutorialTarget } from '@/lib/tutorial-targets';
import { SoundPressable } from '@/components/sound-pressable';
import { DevKnobs } from '@/components/dev-knobs';
import { usePosTweaks } from '@/hooks/use-pos-tweaks';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';

import {
  BottomTabInset,
  TabBarBottomOffset,
  TabBarBowHeight,
  TabBarBowWidth,
  TabBarHeight,
  TabBarTotalHeight,
} from '@/constants/theme';

const LACE_BG = require('@/assets/images/home/bottom-nav-lace.png');
const COMPANION_BTN = require('@/assets/images/home/companion-button.png');
const BOW = require('@/assets/images/home/bottom-nav-bow.png');

const HOME_ICON = require('@/assets/images/tabIcons/gen-home.png');
const HOME_ICON_ACTIVE = require('@/assets/images/tabIcons/gen-home-active.png');
const TASKS_ICON_ACTIVE = require('@/assets/images/tabIcons/gen-tasks-active.png');
const PROGRESS_ICON_ACTIVE = require('@/assets/images/tabIcons/gen-progress-active.png');
const SHOP_ICON_ACTIVE = require('@/assets/images/tabIcons/gen-shop-active.png');

const ICONS: Record<string, ReturnType<typeof require>> = {
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

const LEFT_ROUTES = ['index', 'tasks'];
const RIGHT_ROUTES = ['progress', 'shop'];
const ROUTE_INDEX: Record<string, number> = { index: 0, tasks: 1, progress: 2, shop: 3 };

function TabItem({ name, isFocused, onPress, iconStyle, targetId }: { name: string; isFocused: boolean; onPress: () => void; iconStyle?: StyleProp<ImageStyle>; targetId?: string }) {
  const { t } = useTranslation();
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
    >
      <View
        ref={targetId ? (n) => setTutorialTarget(targetId, n) : undefined}
        style={[styles.iconWrap, isFocused && name !== 'index' && name !== 'tasks' && name !== 'progress' && name !== 'shop' && styles.iconWrapActive]}>
        <Image
          source={
            name === 'index' && isFocused ? HOME_ICON_ACTIVE :
            name === 'tasks' && isFocused ? TASKS_ICON_ACTIVE :
            name === 'progress' && isFocused ? PROGRESS_ICON_ACTIVE :
            name === 'shop' && isFocused ? SHOP_ICON_ACTIVE :
            ICONS[name]
          }
          style={[styles.icon, name === 'index' && styles.iconHome, iconStyle]}
          contentFit="contain"
        />
      </View>
      <Text style={[styles.label, isFocused && styles.labelActive]}>{t(LABEL_KEYS[name])}</Text>
    </SoundPressable>
  );
}

const ALL_ROUTES = ['index', 'tasks', 'progress', 'shop'];

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  // Tablet-only per-icon nudge so each icon centers in its lace segment.
  const { knobs: twKnobs, onChange: twChange, t: tw } = usePosTweaks('menubar', [
    { name: 'index', label: 'Home icon' },
    { name: 'tasks', label: 'Tasks icon' },
    { name: 'progress', label: 'Progress icon' },
    { name: 'shop', label: 'Shop icon' },
  ]);
  return (
    <View style={styles.wrapper}>
      <View style={styles.laceSlot}>
        <Image source={LACE_BG} style={styles.lace} contentFit="fill" />
      </View>
      <View style={styles.row}>
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
        tabBarSafeAreaInsets: { bottom: 0 },
      }}>
      <Tabs.Screen name="index" options={{ title: t('nav.home') }} />
      <Tabs.Screen name="tasks" options={{ title: t('nav.tasks') }} />
      <Tabs.Screen name="progress" options={{ title: t('nav.progress') }} />
      <Tabs.Screen name="shop" options={{ title: t('nav.shop') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: TabBarBottomOffset,
    height: TabBarTotalHeight,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  laceSlot: {
    position: 'absolute',
    left: -26,
    right: -26,
    bottom: 60,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lace: {
    width: '100%',
    height: 100,
  },
  dangleThread: {
    position: 'absolute',
    bottom: TabBarBowHeight - 2,
    alignSelf: 'center',
    width: 3,
    height: 14,
    backgroundColor: '#E8C4B8',
    borderRadius: 2,
  },
  bowSlot: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    height: TabBarBowHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bow: {
    width: TabBarBowWidth,
    height: TabBarBowHeight,
  },
  row: {
    position: 'absolute',
    left: '3%',
    right: '3%',
    bottom: 80,
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabHome: {},
  tabTasks: {},
  tabProgress: {},
  tabShop: {},
  heartButton: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: TabBarBowHeight + 52,
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heartButtonPressed: {
    opacity: 0.75,
  },
  companionBtn: {
    width: 62,
    height: 62,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255, 182, 205, 0.6)',
  },
  icon: {
    width: 36,
    height: 36,
  },
  iconHome: {
    width: 36,
    height: 36,
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    color: '#C4728A',
    fontWeight: '500',
    marginTop: -6,
  },
  labelActive: {
    color: '#D94F72',
    fontWeight: '700',
  },
});
