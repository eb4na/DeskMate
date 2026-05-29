import { Tabs } from 'expo-router';
import { Platform, useColorScheme } from 'react-native';

import { BakeryColors, BakeryRadii, Colors } from '@/constants/theme';
import { HomeTabIcon, TasksTabIcon, ProgressTabIcon, ShopTabIcon } from '@/components/tab-icons';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFDF9',
          borderTopWidth: 0,
          height: 78,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 18 : 12,
          position: 'absolute',
          marginHorizontal: 16,
          marginBottom: 14,
          borderRadius: BakeryRadii.panel,
          borderWidth: 1,
          borderColor: '#E8D4C4',
          shadowColor: BakeryColors.shadow,
          shadowOpacity: 0.14,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
        tabBarItemStyle: {
          borderRadius: 14,
          marginHorizontal: 4,
        },
        tabBarActiveBackgroundColor: '#F5E8D6',
        tabBarActiveTintColor: BakeryColors.cocoa,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <HomeTabIcon color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => <TasksTabIcon color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color }) => <ProgressTabIcon color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color }) => <ShopTabIcon color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
