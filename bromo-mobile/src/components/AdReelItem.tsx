/**
 * AdReelItem — full-screen sponsored reel.
 * Matches ReelItem layout exactly: full-screen media, right-side column,
 * bottom overlay with caption. CTA slides up from the bottom after 5 seconds.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
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

const CTA_DELAY_MS = 5000;

interface Props {
  ad: Ad;
  isActive: boolean;
  reelHeight: number;
  reelWidth: number;
  placement?: AdPlacement;
}

export function AdReelItem({ad, isActive, reelHeight, reelWidth, placement = 'reels'}: Props) {
  const insets = useSafeAreaInsets();
  const {palette} = useTheme();
  const navigation = useNavigation() as Nav;

  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const durationRef = useRef(0);
  const lastProgTick = useRef(0);
  const impressionSent = useRef(false);
  const watchStartMs = useRef(0);

  // CTA animation: slides up + fades in after 5 seconds of being active
  const ctaTranslate = useRef(new Animated.Value(40)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const [ctaVisible, setCtaVisible] = useState(false);
  const ctaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track impression when reel becomes active
  useEffect(() => {
    if (!isActive) return;
    if (!impressionSent.current) {
      impressionSent.current = true;
      trackAdEvent(ad._id, 'impression', {placement});
      watchStartMs.current = Date.now();
    }
    // Start CTA timer
    ctaTimer.current = setTimeout(() => {
      setCtaVisible(true);
      Animated.parallel([
        Animated.timing(ctaTranslate, {toValue: 0, duration: 400, useNativeDriver: true}),
        Animated.timing(ctaOpacity, {toValue: 1, duration: 400, useNativeDriver: true}),
      ]).start();
    }, CTA_DELAY_MS);

    return () => {
      if (ctaTimer.current) clearTimeout(ctaTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, ad._id, placement]);

  // Track video view on deactivation
  useEffect(() => {
    if (isActive || watchStartMs.current === 0) return;
    const ms = Date.now() - watchStartMs.current;
    if (ms > 1000) {
      trackAdEvent(ad._id, 'video_view', {placement, watchTimeMs: ms});
    }
    watchStartMs.current = 0;
    // Reset CTA for next exposure
    setCtaVisible(false);
    ctaOpacity.setValue(0);
    ctaTranslate.setValue(40);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

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
    <View style={{width: reelWidth, height: reelHeight, backgroundColor: '#000', position: 'relative'}}>

      {/* ── Full-screen media ─────────────────────────────────────────────── */}
      {ad.adType === 'video' ? (
        <NetworkVideo
          uri={mediaUrl}
          paused={!isActive}
          muted={muted}
          repeat
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          posterUri={ad.thumbnailUrl}
          posterOverlayUntilReady
          onLoad={d => {
            const dur = typeof d.duration === 'number' ? d.duration : 0;
            if (dur > 0) durationRef.current = dur;
          }}
          onProgress={d => {
            const now = Date.now();
            if (now - lastProgTick.current < 200) return;
            lastProgTick.current = now;
            const dur = durationRef.current || d.seekableDuration || d.playableDuration || 0;
            if (dur > 0) setProgress(Math.min(1, d.currentTime / dur));
          }}
        />
      ) : (
        <Image
          source={{uri: mediaUrl}}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      )}

      {/* ── Tap to mute/unmute (same interaction as ReelItem) ────────────── */}
      <Pressable
        style={[StyleSheet.absoluteFillObject, {zIndex: 1}]}
        onPress={() => setMuted(m => !m)}
      />

      {/* ── Progress bar (for video ads) ──────────────────────────────────── */}
      {ad.adType === 'video' && (
        <View
          style={{position: 'absolute', bottom: 4, left: 0, right: 0, height: 2, zIndex: 12}}
          pointerEvents="none">
          <View style={{height: 2, backgroundColor: 'rgba(255,255,255,0.22)'}}>
            <View
              style={{height: 2, width: `${Math.round(progress * 1000) / 10}%`, backgroundColor: '#fff'}}
            />
          </View>
        </View>
      )}

      {/* ── Right column (mirrors ReelItem but ad-specific) ───────────────── */}
      <View
        style={{
          position: 'absolute',
          right: 14,
          bottom: 120,
          alignItems: 'center',
          gap: 22,
          zIndex: 10,
        }}>
        {/* Brand icon with accent ring (replaces author avatar + follow) */}
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: palette.surface,
            borderWidth: 2,
            borderColor: palette.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Megaphone size={20} color={palette.accent} />
        </View>

        {/* Mute toggle */}
        <Pressable onPress={() => setMuted(m => !m)} hitSlop={12}>
          {muted
            ? <VolumeX size={28} color="#fff" />
            : <Volume2 size={28} color="#fff" />}
        </Pressable>
      </View>

      {/* ── Bottom info overlay (mirrors ReelItem bottom section) ─────────── */}
      <View
        style={{
          position: 'absolute',
          bottom: 88,
          left: 14,
          right: 76,
          gap: 8,
          zIndex: 10,
        }}
        pointerEvents="box-none">
        {/* Sponsored label */}
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: 'rgba(0,0,0,0.45)',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
            }}>
            <Megaphone size={10} color="rgba(255,255,255,0.8)" />
            <Text
              style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: 10,
                fontWeight: '800',
                letterSpacing: 1.1,
                textTransform: 'uppercase',
              }}>
              Sponsored
            </Text>
          </View>
        </View>

        {/* Caption */}
        {ad.caption ? (
          <Text
            style={{
              color: '#fff',
              fontSize: 14,
              fontWeight: '500',
              lineHeight: 20,
              textShadowColor: 'rgba(0,0,0,0.6)',
              textShadowOffset: {width: 0, height: 1},
              textShadowRadius: 4,
            }}
            numberOfLines={3}>
            {ad.caption}
          </Text>
        ) : null}

        {/* CTA — slides up after 5 seconds */}
        {ad.cta ? (
          <Animated.View
            style={{
              opacity: ctaOpacity,
              transform: [{translateY: ctaTranslate}],
              pointerEvents: ctaVisible ? 'auto' : 'none',
            }}>
            <Pressable
              onPress={handleCta}
              style={({pressed}) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: pressed ? 'rgba(255,255,255,0.88)' : '#fff',
                alignSelf: 'flex-start',
                paddingHorizontal: 18,
                paddingVertical: 11,
                borderRadius: 12,
              })}>
              <Text style={{color: '#000', fontSize: 14, fontWeight: '800'}}>
                {ad.cta.label}
              </Text>
              {ad.cta.actionType === 'external_url' ? (
                <ExternalLink size={14} color="#000" />
              ) : null}
            </Pressable>
          </Animated.View>
        ) : null}
      </View>

      {/* ── Sponsored top-right badge (top-right overlay, always visible) ─── */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 12,
          right: 14,
          zIndex: 10,
        }}
        pointerEvents="none">
        <View
          style={{
            backgroundColor: 'rgba(0,0,0,0.5)',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
          }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>
            Sponsored
          </Text>
        </View>
      </View>
    </View>
  );
}
