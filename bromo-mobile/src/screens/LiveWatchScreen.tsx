import React from 'react';
import {Pressable, StatusBar, StyleSheet, Text, View} from 'react-native';
import Video from 'react-native-video';
import {ChevronLeft} from 'lucide-react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {useTheme} from '../context/ThemeContext';
import {resolvedLiveHlsUrl} from '../api/liveApi';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type R = RouteProp<AppStackParamList, 'LiveWatch'>;

export function LiveWatchScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const {palette} = useTheme();
  const {hlsUrl, title, streamerName} = route.params;
  const uri = resolvedLiveHlsUrl(hlsUrl);

  return (
    <View style={[styles.root, {backgroundColor: '#000'}]}>
      <StatusBar barStyle="light-content" hidden />
      {uri ? (
        <Video
          source={{uri}}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          controls
          muted={false}
          repeat={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
        />
      ) : (
        <Text style={{color: '#fff', padding: 24}}>Missing stream URL.</Text>
      )}
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={16}
        style={[styles.back, {backgroundColor: 'rgba(0,0,0,0.45)'}]}>
        <ChevronLeft color="#fff" size={26} />
      </Pressable>
      <View style={[styles.meta, {borderTopColor: palette.border}]}>
        <Text style={[styles.name, {color: '#fff'}]} numberOfLines={1}>
          {streamerName ?? 'Live'}
        </Text>
        {title ? (
          <Text style={[styles.title, {color: 'rgba(255,255,255,0.75)'}]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  back: {
    position: 'absolute',
    top: 52,
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  name: {fontSize: 16, fontWeight: '900'},
  title: {fontSize: 13, marginTop: 4, fontWeight: '600'},
});
