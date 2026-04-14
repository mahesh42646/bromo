import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Image,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ExternalLink, Megaphone, Volume2, VolumeX} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';
import {NetworkVideo} from './media/NetworkVideo';
import {parentNavigate} from '../navigation/parentNavigate';
import {type Ad, type AdPlacement, trackAdEvent} from '../api/adsApi';

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

interface Props {
  ad: Ad;
  isActive: boolean;
  reelHeight: number;
  reelWidth: number;
  placement?: AdPlacement;
}

export function AdReelItem({ad, isActive, reelHeight, reelWidth, placement = 'reels'}: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation() as Nav;
  const [muted, setMuted] = useState(false);
  const impressionSent = useRef(false);
  const watchStartMs = useRef(0);

  // Track impression once when this reel becomes active
  useEffect(() => {
    if (!isActive || impressionSent.current) return;
    impressionSent.current = true;
    trackAdEvent(ad._id, 'impression', {placement});
    watchStartMs.current = Date.now();
  }, [isActive, ad._id, placement]);

  // Track video view on deactivation
  useEffect(() => {
    if (isActive || watchStartMs.current === 0) return;
    const watchTimeMs = Date.now() - watchStartMs.current;
    if (watchTimeMs > 1000) {
      trackAdEvent(ad._id, 'video_view', {placement, watchTimeMs});
    }
    watchStartMs.current = 0;
  }, [isActive, ad._id, placement]);

  const handleCta = useCallback(async () => {
    trackAdEvent(ad._id, 'click', {placement});
    if (!ad.cta) return;
    if (ad.cta.actionType === 'external_url' && ad.cta.externalUrl) {
      await Linking.openURL(ad.cta.externalUrl).catch(() => null);
    } else if (ad.cta.actionType === 'in_app' && ad.cta.inAppScreen) {
      parentNavigate(navigation, ad.cta.inAppScreen, ad.cta.inAppParams ?? {});
    }
  }, [ad, navigation, placement]);

  const mediaUrl = ad.mediaUrls[0] ?? '';

  return (
    <View style={{width: reelWidth, height: reelHeight, backgroundColor: '#000'}}>
      {/* Full-screen media */}
      {ad.adType === 'video' ? (
        <NetworkVideo
          uri={mediaUrl}
          paused={!isActive}
          muted={muted}
          repeat
          style={{width: reelWidth, height: reelHeight}}
          posterUri={ad.thumbnailUrl}
        />
      ) : (
        <Image
          source={{uri: mediaUrl}}
          style={{width: reelWidth, height: reelHeight}}
          resizeMode="cover"
        />
      )}

      {/* Sponsored badge — top right */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 12,
          right: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: 'rgba(0,0,0,0.55)',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
        }}>
        <Megaphone size={11} color="rgba(255,255,255,0.8)" />
        <Text
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 1.1,
            textTransform: 'uppercase',
          }}>
          Sponsored
        </Text>
      </View>

      {/* Mute toggle for video ads */}
      {ad.adType === 'video' && (
        <Pressable
          onPress={() => setMuted(m => !m)}
          hitSlop={12}
          style={{position: 'absolute', top: insets.top + 12, left: 14}}>
          <View
            style={{
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 999,
              padding: 8,
            }}>
            {muted
              ? <VolumeX size={18} color="#fff" />
              : <Volume2 size={18} color="#fff" />}
          </View>
        </Pressable>
      )}

      {/* Bottom overlay: caption + CTA */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 16,
          gap: 12,
          paddingTop: 80,
        }}>
        {/* Gradient-like shadow via bg */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 240,
            // React Native doesn't support CSS gradients — use semi-transparent black
            backgroundColor: 'rgba(0,0,0,0.35)',
          }}
          pointerEvents="none"
        />

        {/* Caption */}
        {ad.caption ? (
          <Text
            style={{
              color: '#fff',
              fontSize: 14,
              lineHeight: 20,
              fontWeight: '500',
              textShadowColor: 'rgba(0,0,0,0.6)',
              textShadowOffset: {width: 0, height: 1},
              textShadowRadius: 4,
            }}
            numberOfLines={3}>
            {ad.caption}
          </Text>
        ) : null}

        {/* CTA Button */}
        {ad.cta && (
          <Pressable
            onPress={handleCta}
            style={({pressed}) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: pressed ? 'rgba(255,255,255,0.9)' : '#fff',
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 20,
              alignSelf: 'flex-start',
            })}>
            <Text style={{color: '#000', fontSize: 14, fontWeight: '800'}}>
              {ad.cta.label}
            </Text>
            {ad.cta.actionType === 'external_url' && (
              <ExternalLink size={14} color="#000" />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}
