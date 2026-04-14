import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {BottomTabBarButtonProps} from '@react-navigation/bottom-tabs';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {AppStackParamList, MainTabParamList} from './appStackParamList';
import {
  Home,
  Search,
  Play,
  ShoppingBag,
  Plus,
} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {HomeScreen} from '../screens/HomeScreen';
import {SearchScreen} from '../screens/SearchScreen';
import {ReelsScreen} from '../screens/ReelsScreen';
import {StoreScreen} from '../screens/StoreScreen';

const Tab = createBottomTabNavigator();

function EmptyCreateScreen() {
  return <View />;
}

function CreateTabButton({style, children: _children, accessibilityState, testID}: BottomTabBarButtonProps) {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const {palette} = useTheme();

  return (
    <View style={[style, styles.createSlot]} collapsable={false}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel="Create post"
        accessibilityState={accessibilityState}
        onPress={() => {
          const parent = navigation.getParent() as NativeStackNavigationProp<AppStackParamList> | undefined;
          if (!parent) return;
          const tabState = navigation.getState();
          const tabName = tabState?.routes[tabState.index ?? 0]?.name;
          // Reels tab → reel creator; Home → story creator directly; others → post creator
          if (tabName === 'Reels') {
            parent.navigate('CreateFlow', {
              screen: 'CreateHub',
              params: {mode: 'reel', bootstrapTs: Date.now()},
            });
          } else if (tabName === 'Home') {
            // Direct story creation from Home tab — Instagram-style
            parent.navigate('CreateFlow', {
              screen: 'StoryCreator',
            });
          } else {
            parent.navigate('CreateFlow', {
              screen: 'CreateHub',
              params: {mode: 'post', bootstrapTs: Date.now()},
            });
          }
        }}>
        <View
          style={[
            styles.fab,
            {
              backgroundColor: palette.primary,
              borderColor: palette.background,
              shadowColor: palette.primary,
            },
          ]}>
          <Plus size={26} color={palette.primaryForeground} strokeWidth={2.75} />
        </View>
      </Pressable>
    </View>
  );
}

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
        name="Create"
        component={EmptyCreateScreen}
        options={{
          tabBarButton: props => <CreateTabButton {...props} />,
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
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    height: 48,
    paddingTop: 0,
  },
  createSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    borderWidth: 3,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
  },
});
