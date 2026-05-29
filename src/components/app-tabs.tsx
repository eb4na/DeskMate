import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Platform, useColorScheme, type ColorValue } from 'react-native';

import { BakeryColors, BakeryRadii, Colors } from '@/constants/theme';

type IosSymbol = SymbolViewProps['name'];

function TabIcon({ name, color }: { name: IosSymbol; color: ColorValue }) {
  return (
    <SymbolView
      name={name}
      size={22}
      weight="semibold"
      tintColor={typeof color === 'string' ? color : undefined}
      fallback={null}
    />
  );
}

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
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
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        },
        tabBarItemStyle: {
          borderRadius: 14,
          marginHorizontal: 4,
        },
        tabBarActiveBackgroundColor: '#F3E6D6',
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
          tabBarIcon: ({ color }) => <TabIcon name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => <TabIcon name="checklist" color={color} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color }) => <TabIcon name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color }) => <TabIcon name="basket.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
