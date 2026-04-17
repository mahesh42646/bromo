import React from 'react';
import {StyleSheet} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Home,
  Search,
  Play,
  ShoppingBag,
  User as UserIcon,
} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {HomeScreen} from '../screens/HomeScreen';
import {SearchScreen} from '../screens/SearchScreen';
import {ReelsScreen} from '../screens/ReelsScreen';
import {StoreScreen} from '../screens/StoreScreen';
import {ProfileScreen} from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export function TabNavigator() {
  const {palette, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  const tabBarHeight = 56 + bottomPad;
  const inactiveTabTint = isDark ? palette.foregroundSubtle : palette.foregroundMuted;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: `${palette.background}F7`,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: palette.border,
          height: tabBarHeight,
          paddingBottom: bottomPad,
          paddingTop: 6,
        },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: inactiveTabTint,
        tabBarShowLabel: false,
        tabBarItemStyle: styles.tabItem,
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({color, size}) => <Home size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarIcon: ({color, size}) => <Search size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Reels"
        component={ReelsScreen}
        options={{
          tabBarIcon: ({color, size}) => <Play size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Store"
        component={StoreScreen}
        options={{
          tabBarIcon: ({color, size}) => <ShoppingBag size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({color, size}) => <UserIcon size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    height: 48,
    paddingTop: 0,
  },
});
