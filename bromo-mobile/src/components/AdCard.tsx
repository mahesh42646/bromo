/**
 * AdCard — renders a sponsored post in the home feed.
 * Visually identical to PostCard: header / media / caption layout.
 * CTA button fades in after 5 seconds.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import {ExternalLink, MoreHorizontal, Volume2, VolumeX} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';
import {NetworkVideo} from './media/NetworkVideo';
import {useTheme} from '../context/ThemeContext';
import {parentNavigate} from '../navigation/parentNavigate';
import {type Ad, type AdPlacement, trackAdEvent} from '../api/adsApi';

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const CTA_DELAY_MS = 5000;

interface Props {
  ad: Ad;
  placement?: AdPlacement;
}

export function AdCard({ad, placement = 'feed'}: Props) {
  const {palette, contract} = useTheme();
  const navigation = useNavigation() as Nav;
  const {borderRadiusScale} = contract.brandGuidelines;
  const radius = borderRadiusScale === 'bold' ? 14 : 10;

  const impressionSent = useRef(false);
  const [muted, setMuted] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const [ctaVisible, setCtaVisible] = useState(false);

  // Track impression once on mount
  useEffect(() => {
    if (impressionSent.current) return;
    impressionSent.current = true;
    trackAdEvent(ad._id, 'impression', {placement});
  }, [ad._id, placement]);

  // CTA appears after 5 seconds
  useEffect(() => {
    const t = setTimeout(() => {
      setCtaVisible(true);
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }, CTA_DELAY_MS);
    return () => clearTimeout(t);
  }, [ctaOpacity]);

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

      {/* ── Header (mirrors PostCard header) ─────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
          {/* Brand placeholder avatar */}
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: palette.surface,
              borderWidth: 1.5,
              borderColor: palette.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{color: palette.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5}}>
              AD
            </Text>
          </View>
          <View style={{gap: 1}}>
            <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 14}}>
              Sponsored
            </Text>
            <Text
              style={{
                color: palette.muted,
                fontSize: 11,
                fontWeight: '500',
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}>
              Promoted post
            </Text>
          </View>
        </View>
        <Pressable hitSlop={10}>
          <MoreHorizontal size={20} color={palette.muted} />
        </Pressable>
      </View>

      {/* ── Media ────────────────────────────────────────────────────────── */}
      {ad.adType === 'image' && ad.mediaUrls[0] ? (
        <Image
          source={{uri: ad.mediaUrls[0]}}
          style={{width: SCREEN_WIDTH, aspectRatio: 1}}
          resizeMode="cover"
        />
      ) : null}

      {ad.adType === 'carousel' ? (
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
              position: 'absolute',
              bottom: 10,
              left: 0,
              right: 0,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 4,
            }}>
            {ad.mediaUrls.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === carouselIndex ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === carouselIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {ad.adType === 'video' && ad.mediaUrls[0] ? (
        <View style={{width: SCREEN_WIDTH, aspectRatio: 16 / 9, backgroundColor: '#000'}}>
          <NetworkVideo
            uri={ad.mediaUrls[0]}
            paused={false}
            muted={muted}
            repeat
            style={{width: SCREEN_WIDTH, aspectRatio: 16 / 9}}
            posterUri={ad.thumbnailUrl}
          />
          <Pressable
            onPress={() => setMuted(m => !m)}
            hitSlop={12}
            style={{position: 'absolute', bottom: 10, right: 10}}>
            <View
              style={{
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderRadius: 999,
                padding: 6,
              }}>
              {muted
                ? <VolumeX size={16} color="#fff" />
                : <Volume2 size={16} color="#fff" />}
            </View>
          </Pressable>
        </View>
      ) : null}

      {/* ── Caption + CTA ────────────────────────────────────────────────── */}
      <View style={{paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, gap: 10}}>
        {ad.caption ? (
          <Text
            style={{color: palette.foreground, fontSize: 14, lineHeight: 20}}
            numberOfLines={3}>
            {ad.caption}
          </Text>
        ) : null}

        {/* CTA — fades in after 5 seconds */}
        {ad.cta ? (
          <Animated.View style={{opacity: ctaOpacity, pointerEvents: ctaVisible ? 'auto' : 'none'}}>
            <Pressable
              onPress={handleCta}
              style={({pressed}) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                backgroundColor: pressed ? `${palette.accent}cc` : palette.accent,
                borderRadius: radius,
                paddingVertical: 12,
                paddingHorizontal: 20,
              })}>
              <Text style={{color: '#fff', fontSize: 15, fontWeight: '700'}}>
                {ad.cta.label}
              </Text>
              {ad.cta.actionType === 'external_url' ? (
                <ExternalLink size={15} color="#fff" />
              ) : null}
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}
