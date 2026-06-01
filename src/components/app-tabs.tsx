import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { router, Tabs } from 'expo-router';
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
const COMPANION_BTN = require('@/assets/images/home/companion-button.png');
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

const LEFT_ROUTES = ['index', 'tasks'];
const RIGHT_ROUTES = ['progress', 'shop'];
const ROUTE_INDEX: Record<string, number> = { index: 0, tasks: 1, progress: 2, shop: 3 };

function TabItem({ name, isFocused, onPress }: { name: string; isFocused: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[
        styles.tab,
        name === 'index' && styles.tabHome,
        name === 'tasks' && styles.tabTasks,
        name === 'progress' && styles.tabProgress,
        name === 'shop' && styles.tabShop,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
        <Image source={ICONS[name]} style={styles.icon} contentFit="contain" />
      </View>
      <Text style={[styles.label, isFocused && styles.labelActive]}>{LABELS[name]}</Text>
    </Pressable>
  );
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.laceSlot}>
        <Image source={LACE_BG} style={styles.lace} contentFit="contain" contentPosition="bottom" />
      </View>
      <Pressable
        style={({ pressed }) => [styles.heartButton, pressed && styles.heartButtonPressed]}
        onPress={() => router.push('/companion-gallery')}
      >
        <Image source={COMPANION_BTN} style={styles.companionBtn} contentFit="contain" />
      </Pressable>
      <View style={styles.dangleThread} pointerEvents="none" />
      <View style={styles.bowSlot} pointerEvents="none">
        <Image source={BOW} style={styles.bow} contentFit="contain" />
      </View>
      <View style={styles.row}>
        {LEFT_ROUTES.map((name) => {
          const index = ROUTE_INDEX[name];
          const isFocused = state.index === index;
          return (
            <TabItem
              key={name}
              name={name}
              isFocused={isFocused}
              onPress={() => {
                const route = state.routes[index];
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) navigation.navigate(name);
              }}
            />
          );
        })}

        {RIGHT_ROUTES.map((name) => {
          const index = ROUTE_INDEX[name];
          const isFocused = state.index === index;
          return (
            <TabItem
              key={name}
              name={name}
              isFocused={isFocused}
              onPress={() => {
                const route = state.routes[index];
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) navigation.navigate(name);
              }}
            />
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
    left: '5%',
    right: '5%',
    bottom: TabBarBowHeight + 14,
    height: TabBarHeight - 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabHome: {
    paddingLeft: 22,
  },
  tabTasks: {
    paddingRight: 10,
  },
  tabProgress: {
    paddingLeft: 10,
  },
  tabShop: {
    paddingRight: 22,
  },
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
    width: 60,
    height: 60,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255, 182, 205, 0.6)',
  },
  icon: {
    width: 38,
    height: 38,
  },
  label: {
    fontSize: 12,
    color: '#C4728A',
    fontWeight: '500',
    marginTop: -12,
  },
  labelActive: {
    color: '#D94F72',
    fontWeight: '700',
  },
});
