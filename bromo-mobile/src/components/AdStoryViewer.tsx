/**
 * AdStoryViewer — full-screen modal that plays a sponsored story.
 * Progress bar at top (15s image / video duration).
 * CTA button fades in after 5 seconds.
 * Tap right = close, tap left = close (single-story ad).
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ExternalLink, Megaphone, X} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';
import {NetworkVideo} from './media/NetworkVideo';
import {useTheme} from '../context/ThemeContext';
import {parentNavigate} from '../navigation/parentNavigate';
import {type Ad, trackAdEvent} from '../api/adsApi';

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

const {width: W, height: H} = Dimensions.get('window');
const AD_DURATION_MS = 15000;
const CTA_DELAY_MS = 5000;
const TICK_MS = 50;

interface Props {
  ad: Ad;
  visible: boolean;
  onClose: () => void;
}

export function AdStoryViewer({ad, visible, onClose}: Props) {
  const insets = useSafeAreaInsets();
  const {palette} = useTheme();
  const navigation = useNavigation() as Nav;

  const [progress, setProgress] = useState(0);
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const [ctaVisible, setCtaVisible] = useState(false);
  const impressionSent = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ctaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);

  const clearTimers = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (ctaTimerRef.current) clearTimeout(ctaTimerRef.current);
  };

  const close = useCallback(() => {
    clearTimers();
    setProgress(0);
    setCtaVisible(false);
    ctaOpacity.setValue(0);
    onClose();
  }, [ctaOpacity, onClose]);

  useEffect(() => {
    if (!visible) { clearTimers(); return; }

    // Track impression
    if (!impressionSent.current) {
      impressionSent.current = true;
      trackAdEvent(ad._id, 'impression', {placement: 'stories'});
      if (ad.adType === 'video') trackAdEvent(ad._id, 'video_view', {placement: 'stories'});
    }

    startedAt.current = Date.now();
    setProgress(0);
    setCtaVisible(false);
    ctaOpacity.setValue(0);

    // Progress bar ticks
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const pct = Math.min(1, elapsed / AD_DURATION_MS);
      setProgress(pct);
      if (pct >= 1) { clearTimers(); close(); }
    }, TICK_MS);

    // CTA after 5 seconds
    ctaTimerRef.current = setTimeout(() => {
      setCtaVisible(true);
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, CTA_DELAY_MS);

    return clearTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ad._id]);

  const handleCta = useCallback(async () => {
    trackAdEvent(ad._id, 'click', {placement: 'stories'});
    close();
    if (!ad.cta) return;
    if (ad.cta.actionType === 'external_url' && ad.cta.externalUrl) {
      await Linking.openURL(ad.cta.externalUrl).catch(() => null);
    } else if (ad.cta.actionType === 'in_app' && ad.cta.inAppScreen) {
      parentNavigate(navigation, ad.cta.inAppScreen, ad.cta.inAppParams ?? {});
    }
  }, [ad, close, navigation]);

  const mediaUrl = ad.mediaUrls[0] ?? '';

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={{flex: 1, backgroundColor: '#000', width: W, height: H}}>

        {/* ── Full-screen media ──────────────────────────────────────────── */}
        {ad.adType === 'video' ? (
          <NetworkVideo
            uri={mediaUrl}
            paused={!visible}
            muted={false}
            repeat={false}
            style={{width: W, height: H}}
            resizeMode="cover"
            posterUri={ad.thumbnailUrl}
            posterOverlayUntilReady
          />
        ) : (
          <Image
            source={{uri: mediaUrl}}
            style={{position: 'absolute', width: W, height: H}}
            resizeMode="cover"
          />
        )}

        {/* ── Top bar: progress + close ─────────────────────────────────── */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 6,
            left: 12,
            right: 12,
            zIndex: 20,
            gap: 10,
          }}>
          {/* Single progress bar */}
          <View style={{height: 2.5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden'}}>
            <View
              style={{
                height: '100%',
                width: `${progress * 100}%`,
                backgroundColor: '#fff',
                borderRadius: 2,
              }}
            />
          </View>

          {/* Header row */}
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: palette.surface,
                  borderWidth: 2,
                  borderColor: palette.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Megaphone size={14} color={palette.accent} />
              </View>
              <View>
                <Text style={{color: '#fff', fontWeight: '700', fontSize: 13}}>Sponsored</Text>
                <Text style={{color: 'rgba(255,255,255,0.65)', fontSize: 11}}>Promoted story</Text>
              </View>
            </View>
            <Pressable onPress={close} hitSlop={12}>
              <X size={22} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* ── Tap areas to close (left / right — mirrors StoryViewScreen) ── */}
        <Pressable
          style={{position: 'absolute', left: 0, top: 0, width: W * 0.35, height: H, zIndex: 5}}
          onPress={close}
        />
        <Pressable
          style={{position: 'absolute', right: 0, top: 0, width: W * 0.65, height: H, zIndex: 5}}
          onPress={close}
        />

        {/* ── Bottom: caption + CTA ─────────────────────────────────────── */}
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + 20,
            left: 16,
            right: 16,
            gap: 14,
            zIndex: 20,
          }}>
          {ad.caption ? (
            <Text
              style={{
                color: '#fff',
                fontSize: 15,
                fontWeight: '500',
                lineHeight: 22,
                textShadowColor: 'rgba(0,0,0,0.7)',
                textShadowOffset: {width: 0, height: 1},
                textShadowRadius: 4,
              }}
              numberOfLines={4}>
              {ad.caption}
            </Text>
          ) : null}

          {/* CTA fades in after 5 seconds */}
          {ad.cta ? (
            <Animated.View style={{opacity: ctaOpacity, pointerEvents: ctaVisible ? 'auto' : 'none'}}>
              <Pressable
                onPress={handleCta}
                style={({pressed}) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: pressed ? 'rgba(255,255,255,0.88)' : '#fff',
                  borderRadius: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 24,
                })}>
                <Text style={{color: '#000', fontSize: 15, fontWeight: '800'}}>
                  {ad.cta.label}
                </Text>
                {ad.cta.actionType === 'external_url' ? (
                  <ExternalLink size={15} color="#000" />
                ) : null}
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
