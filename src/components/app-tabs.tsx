import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

const TAB_BAR_FULL = require('@/assets/images/home/bottom-nav-lace.png');

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const routes = ['index', 'tasks', 'progress', 'shop'];

  return (
    <View style={styles.wrapper}>
      <Image
        source={TAB_BAR_FULL}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
        contentFit="fill"
      />
      <View style={styles.tapRow}>
        {routes.map((name, index) => {
          const isFocused = state.index === index;
          return (
            <Pressable
              key={name}
              style={styles.tapZone}
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
      screenOptions={{ headerShown: false }}>
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
    bottom: 0,
    aspectRatio: 1.6,
    backgroundColor: 'transparent',
  },
  tapRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '30%',
    flexDirection: 'row',
  },
  tapZone: {
    flex: 1,
  },
});
