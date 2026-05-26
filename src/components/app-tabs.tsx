import { Tabs } from 'expo-router';
import { Text, useColorScheme } from 'react-native';

import { BakeryColors, BakeryRadii, Colors } from '@/constants/theme';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: BakeryColors.glass,
          borderTopColor: BakeryColors.border,
          borderTopWidth: 1.5,
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          position: 'absolute',
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: BakeryRadii.panel,
        },
        tabBarItemStyle: {
          borderRadius: BakeryRadii.chip,
          marginHorizontal: 4,
        },
        tabBarActiveTintColor: BakeryColors.cocoa,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: () => <TabIcon emoji="🏠" />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: () => <TabIcon emoji="🧁" />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: () => <TabIcon emoji="🍓" />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: () => <TabIcon emoji="🥐" />,
        }}
      />
    </Tabs>
  );
}
