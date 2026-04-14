import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import {ExternalLink, Megaphone, Volume2, VolumeX} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';
import {NetworkVideo} from './media/NetworkVideo';
import {useTheme} from '../context/ThemeContext';
import {parentNavigate} from '../navigation/parentNavigate';
import {type Ad, type AdPlacement, trackAdEvent} from '../api/adsApi';

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

interface Props {
  ad: Ad;
  placement?: AdPlacement;
}

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export function AdCard({ad, placement = 'feed'}: Props) {
  const {palette} = useTheme();
  const navigation = useNavigation() as Nav;
  const impressionSent = useRef(false);
  const [muted, setMuted] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Track impression once on mount; track video_view for video ads
  useEffect(() => {
    if (impressionSent.current) return;
    impressionSent.current = true;
    trackAdEvent(ad._id, 'impression', {placement});
    if (ad.adType === 'video') {
      trackAdEvent(ad._id, 'video_view', {placement});
    }
  }, [ad._id, ad.adType, placement]);

  const handleCta = useCallback(async () => {
    trackAdEvent(ad._id, 'click', {placement});
    if (!ad.cta) return;
    if (ad.cta.actionType === 'external_url' && ad.cta.externalUrl) {
      await Linking.openURL(ad.cta.externalUrl).catch(() => null);
    } else if (ad.cta.actionType === 'in_app' && ad.cta.inAppScreen) {
      parentNavigate(navigation, ad.cta.inAppScreen, ad.cta.inAppParams ?? {});
    }
  }, [ad, navigation, placement]);

  return (
    <View
      style={{
        backgroundColor: palette.background,
        borderBottomWidth: 8,
        borderBottomColor: palette.background,
      }}>
      {/* Sponsored label */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}>
        <Megaphone size={14} color={palette.muted} />
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 1.2,
            color: palette.muted,
            textTransform: 'uppercase',
          }}>
          Sponsored
        </Text>
      </View>

      {/* Media */}
      {ad.adType === 'image' && ad.mediaUrls[0] && (
        <Image
          source={{uri: ad.mediaUrls[0]}}
          style={{width: SCREEN_WIDTH, aspectRatio: 1}}
          resizeMode="cover"
        />
      )}

      {ad.adType === 'carousel' && (
        <View>
          <FlatList
            data={ad.mediaUrls}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setCarouselIndex(idx);
            }}
            renderItem={({item}) => (
              <Image
                source={{uri: item}}
                style={{width: SCREEN_WIDTH, aspectRatio: 1}}
                resizeMode="cover"
              />
            )}
          />
          {/* Dot indicators */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 4,
              paddingVertical: 8,
            }}>
            {ad.mediaUrls.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === carouselIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === carouselIndex ? palette.accent : palette.border,
                }}
              />
            ))}
          </View>
        </View>
      )}

      {ad.adType === 'video' && ad.mediaUrls[0] && (
        <View style={{width: SCREEN_WIDTH, aspectRatio: 16 / 9, backgroundColor: '#000'}}>
          <NetworkVideo
            uri={ad.mediaUrls[0]}
            paused={false}
            muted={muted}
            repeat
            style={{width: SCREEN_WIDTH, aspectRatio: 16 / 9}}
          />
          <Pressable
            onPress={() => setMuted(m => !m)}
            hitSlop={12}
            style={{position: 'absolute', bottom: 12, right: 12}}>
            {muted
              ? <VolumeX size={18} color="#fff" />
              : <Volume2 size={18} color="#fff" />}
          </Pressable>
        </View>
      )}

      {/* Caption + CTA */}
      <View style={{padding: 12, gap: 10}}>
        {ad.caption ? (
          <Text
            style={{color: palette.foreground, fontSize: 14, lineHeight: 20}}
            numberOfLines={3}>
            {ad.caption}
          </Text>
        ) : null}

        {ad.cta && (
          <Pressable
            onPress={handleCta}
            style={({pressed}) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: pressed ? `${palette.accent}cc` : palette.accent,
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 16,
            })}>
            <Text
              style={{
                color: '#fff',
                fontSize: 14,
                fontWeight: '700',
              }}>
              {ad.cta.label}
            </Text>
            {ad.cta.actionType === 'external_url' && (
              <ExternalLink size={14} color="#fff" />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}
