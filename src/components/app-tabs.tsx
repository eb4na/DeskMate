import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  BottomTabInset,
  TabBarBottomOffset,
  TabBarBowHeight,
  TabBarBowWidth,
  TabBarHeight,
  TabBarTotalHeight,
} from '@/constants/theme';

const LACE_BG = require('@/assets/images/home/bottom-nav-lace.png');
const BOW = require('@/assets/images/home/bottom-nav-bow.png');

const ICONS: Record<string, ReturnType<typeof require>> = {
  index: require('@/assets/images/tabIcons/gen-home.png'),
  tasks: require('@/assets/images/tabIcons/gen-tasks.png'),
  progress: require('@/assets/images/tabIcons/gen-progress.png'),
  shop: require('@/assets/images/tabIcons/gen-shop.png'),
};

const LABELS: Record<string, string> = {
  index: 'Home',
  tasks: 'Tasks',
  progress: 'Progress',
  shop: 'Shop',
};

const ROUTES = ['index', 'tasks', 'progress', 'shop'];

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.laceSlot}>
        <Image source={LACE_BG} style={styles.lace} contentFit="contain" contentPosition="bottom" />
      </View>
      <View style={styles.bowSlot} pointerEvents="none">
        <Image source={BOW} style={styles.bow} contentFit="contain" />
      </View>
      <View style={styles.row}>
        {ROUTES.map((name, index) => {
          const isFocused = state.index === index;
          return (
            <Pressable
              key={name}
              style={styles.tab}
              onPress={() => {
                const route = state.routes[index];
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) navigation.navigate(name);
              }}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <Image source={ICONS[name]} style={styles.icon} contentFit="contain" />
              </View>
              <Text style={[styles.label, isFocused && styles.labelActive]}>{LABELS[name]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
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
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="shop" options={{ title: 'Shop' }} />
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
    left: 6,
    right: 6,
    bottom: TabBarBowHeight,
    height: TabBarHeight,
  },
  lace: {
    width: '100%',
    height: '100%',
  },
  bowSlot: {
    position: 'absolute',
    bottom: 0,
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
    left: '5%',
    right: '5%',
    bottom: TabBarBowHeight + 8,
    height: TabBarHeight - 34,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255, 182, 205, 0.6)',
  },
  icon: {
    width: 54,
    height: 54,
  },
  label: {
    fontSize: 12,
    color: '#C4728A',
    fontWeight: '500',
  },
  labelActive: {
    color: '#D94F72',
    fontWeight: '700',
  },
});
