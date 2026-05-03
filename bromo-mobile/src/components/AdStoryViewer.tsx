/**
 * AdStoryViewer — full-screen sponsored story: progress bar, pause, mute, share, gradient CTA.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  Share,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Megaphone, Pause, Play, Share2, Volume2, VolumeX, X} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';
import {NetworkVideo} from './media/NetworkVideo';
import {AdCtaGradientButton} from './AdCtaGradientButton';
import {useTheme} from '../context/ThemeContext';
import {parentNavigate} from '../navigation/parentNavigate';
import {type Ad, trackAdEvent} from '../api/adsApi';

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

const {width: W, height: H} = Dimensions.get('window');
const AD_DURATION_MS = 15000;
const TICK_MS = 50;

interface Props {
  ad: Ad;
  visible: boolean;
  onClose: () => void;
}

export function AdStoryViewer({ad, visible, onClose}: Props) {
  const insets = useSafeAreaInsets();
  const {palette, guidelines} = useTheme();
  const navigation = useNavigation() as Nav;
  const {borderRadiusScale} = guidelines;
  const radius = borderRadiusScale === 'bold' ? 14 : 10;

  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const ctaOpacity = useRef(new Animated.Value(1)).current;
  const impressionSent = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);
  const accumulatedMsRef = useRef(0);

  pausedRef.current = paused;

  useEffect(() => {
    if (!visible) impressionSent.current = false;
  }, [visible]);

  const clearTimers = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const close = useCallback(() => {
    clearTimers();
    setProgress(0);
    setPaused(false);
    setMuted(false);
    ctaOpacity.setValue(1);
    onClose();
  }, [ctaOpacity, onClose]);

  useEffect(() => {
    if (!visible) {
      clearTimers();
      return;
    }

    if (!impressionSent.current) {
      impressionSent.current = true;
      trackAdEvent(ad._id, 'impression', {placement: 'stories'});
      if (ad.adType === 'video') trackAdEvent(ad._id, 'video_view', {placement: 'stories'});
    }

    accumulatedMsRef.current = 0;
    setProgress(0);
    setPaused(false);
    ctaOpacity.setValue(1);

    intervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      accumulatedMsRef.current += TICK_MS;
      const pct = Math.min(1, accumulatedMsRef.current / AD_DURATION_MS);
      setProgress(pct);
      if (pct >= 1) {
        clearTimers();
        close();
      }
    }, TICK_MS);

    return clearTimers;
  }, [visible, ad._id, ad.adType, close, ctaOpacity]);

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

  const shareAd = useCallback(async () => {
    trackAdEvent(ad._id, 'click', {placement: 'stories'});
    const url = ad.cta?.externalUrl ?? '';
    try {
      await Share.share({
        message: url ? `${ad.caption || 'Sponsored'}\n${url}` : ad.caption || 'Sponsored',
        url: url || undefined,
      });
    } catch {
      /* ignore */
    }
  }, [ad]);

  const mediaUrl = ad.mediaUrls[0] ?? '';
  const title = ad.brandName?.trim() || 'Sponsored';

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={{flex: 1, backgroundColor: '#000', width: W, height: H}}>
        {ad.adType === 'video' ? (
          <NetworkVideo
            uri={mediaUrl}
            paused={!visible || paused}
            muted={muted}
            repeat={false}
            style={{width: W, height: H}}
            resizeMode="cover"
            posterUri={ad.thumbnailUrl}
            posterOverlayUntilReady
          />
        ) : (
          <Image source={{uri: mediaUrl}} style={{position: 'absolute', width: W, height: H}} resizeMode="cover" />
        )}

        <Pressable
          style={{position: 'absolute', left: 0, top: 0, width: W * 0.35, height: H, zIndex: 5}}
          onPress={close}
        />
        <Pressable
          style={{position: 'absolute', right: 0, top: 0, width: W * 0.65, height: H, zIndex: 5}}
          onPress={close}
        />

        <View
          style={{
            position: 'absolute',
            top: insets.top + 6,
            left: 12,
            right: 12,
            zIndex: 20,
            gap: 10,
          }}>
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

          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1}}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: palette.surface,
                  borderWidth: 2,
                  borderColor: palette.ring,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Megaphone size={14} color={palette.accent} />
              </View>
              <View style={{flex: 1}}>
                <Text style={{color: '#fff', fontWeight: '700', fontSize: 13}} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={{color: 'rgba(255,255,255,0.65)', fontSize: 11}} numberOfLines={1}>
                  {ad.category ? `${ad.category} · Promoted` : 'Promoted story'}
                </Text>
              </View>
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <Pressable onPress={() => setPaused(p => !p)} hitSlop={12} style={{padding: 6}}>
                {paused ? <Play size={20} color="#fff" fill="#fff" /> : <Pause size={20} color="#fff" />}
              </Pressable>
              <Pressable onPress={() => setMuted(m => !m)} hitSlop={12} style={{padding: 6}}>
                {muted ? <VolumeX size={20} color="#fff" /> : <Volume2 size={20} color="#fff" />}
              </Pressable>
              <Pressable onPress={() => void shareAd()} hitSlop={12} style={{padding: 6}}>
                <Share2 size={20} color="#fff" />
              </Pressable>
              <Pressable onPress={close} hitSlop={12} style={{padding: 6}}>
                <X size={22} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>

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
              numberOfLines={1}>
              {ad.caption}
            </Text>
          ) : null}

          {ad.cta ? (
            <Animated.View style={{opacity: ctaOpacity}}>
              <AdCtaGradientButton
                palette={palette}
                label={ad.cta.label}
                onPress={() => void handleCta()}
                borderRadius={radius}
                showExternalIcon={ad.cta.actionType === 'external_url'}
              />
            </Animated.View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
