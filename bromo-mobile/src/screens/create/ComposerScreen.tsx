import React, {useEffect} from 'react';
import {ActivityIndicator, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useTheme} from '../../context/ThemeContext';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'Composer'>;

export function ComposerScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('ShareFinal');
    }, 0);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <ThemedSafeScreen style={{flex: 1, backgroundColor: palette.background}}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}>
        <ActivityIndicator color={palette.accent} />
        <Text
          style={{
            color: palette.foreground,
            fontSize: 15,
            fontWeight: '800',
            marginTop: 14,
          }}>
          Loading details...
        </Text>
      </View>
    </ThemedSafeScreen>
  );
}
