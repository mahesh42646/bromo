/**
 * AdReelItem — full-screen sponsored reel: same interaction rails as ReelItem, no follow / no author reel.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Heart,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Play,
  Repeat,
  Send,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';
import {NetworkVideo} from './media/NetworkVideo';
import {AdCtaGradientButton} from './AdCtaGradientButton';
import {useTheme} from '../context/ThemeContext';
import {usePlaybackMute} from '../context/PlaybackMuteContext';
import {parentNavigate} from '../navigation/parentNavigate';
import {hashString} from '../lib/adSlots';
import {type Ad, type AdPlacement, trackAdEvent} from '../api/adsApi';

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.max(0, Math.floor(n)));
}

interface Props {
  ad: Ad;
  isActive: boolean;
  reelHeight: number;
  reelWidth: number;
  placement?: AdPlacement;
}

export function AdReelItem({ad, isActive, reelHeight, reelWidth, placement = 'reels'}: Props) {
  const insets = useSafeAreaInsets();
  const {palette, contract} = useTheme();
  const navigation = useNavigation() as Nav;
  const {reelsMuted, toggleReelsMuted} = usePlaybackMute();
  const {borderRadiusScale} = contract.brandGuidelines;
  const radius = borderRadiusScale === 'bold' ? 12 : 10;
  const tabBarTopFromBottom = 56 + Math.max(insets.bottom, 10);

  const [holdPaused, setHoldPaused] = useState(false);
  const suppressMuteTap = useRef(false);
  const [progress, setProgress] = useState(0);
  const impressionSent = useRef(false);
  const watchStartMs = useRef(0);
  const durationRef = useRef(0);
  const lastProgTick = useRef(0);
  const [coverSpinner, setCoverSpinner] = useState(true);
  const clearedSpinnerOnProgress = useRef(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [adLiked, setAdLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(() => (hashString(ad._id) % 900) + 40);
  const [commentCount] = useState(() => (hashString(`${ad._id}c`) % 80) + 3);

  const hideCoverSpinner = useCallback(() => setCoverSpinner(false), []);

  useEffect(() => {
    setCoverSpinner(true);
    setProgress(0);
    durationRef.current = 0;
    clearedSpinnerOnProgress.current = false;
  }, [ad._id, ad.mediaUrls[0]]);

  useEffect(() => {
    if (!isActive) setHoldPaused(false);
  }, [isActive]);

  const paused = !isActive || holdPaused;

  useEffect(() => {
    if (!isActive) return;
    if (!impressionSent.current) {
      impressionSent.current = true;
      trackAdEvent(ad._id, 'impression', {placement});
      watchStartMs.current = Date.now();
    }
    return () => {
      if (watchStartMs.current > 0) {
        const ms = Date.now() - watchStartMs.current;
        if (ms > 1000) trackAdEvent(ad._id, 'video_view', {placement, watchTimeMs: ms});
        watchStartMs.current = 0;
      }
    };
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

  const shareAd = useCallback(async () => {
    trackAdEvent(ad._id, 'click', {placement});
    const url = ad.cta?.externalUrl ?? '';
    try {
      await Share.share({
        message: url ? `${ad.caption || 'Sponsored'}\n${url}` : ad.caption || 'Sponsored',
        url: url || undefined,
      });
    } catch {
      /* ignore */
    }
  }, [ad, placement]);

  const toggleLike = useCallback(() => {
    setAdLiked(l => {
      setLikeCount(c => c + (l ? -1 : 1));
      return !l;
    });
    trackAdEvent(ad._id, 'click', {placement});
  }, [ad._id, placement]);

  const mediaUrl = ad.mediaUrls[0] ?? '';

  return (
    <View style={{width: reelWidth, height: reelHeight, backgroundColor: '#000', position: 'relative'}}>
      <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
        <Pressable style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'}} onPress={() => setMoreOpen(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{
              backgroundColor: palette.surface,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
              gap: 8,
            }}>
            <Pressable
              onPress={() => {
                setMoreOpen(false);
                void shareAd();
              }}
              style={{paddingVertical: 12}}>
              <Text style={{color: palette.foreground, fontWeight: '700'}}>Share</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMoreOpen(false);
                Alert.alert('Sponsored', 'You can hide ads from your ad preferences soon.');
              }}
              style={{paddingVertical: 12}}>
              <Text style={{color: palette.foreground, fontWeight: '700'}}>Why am I seeing this?</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {ad.adType === 'video' ? (
        <NetworkVideo
          uri={mediaUrl}
          paused={paused}
          muted={reelsMuted}
          repeat
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          posterUri={ad.thumbnailUrl}
          posterOverlayUntilReady
          onDecoderReady={hideCoverSpinner}
          onPlaybackError={hideCoverSpinner}
          onLoad={d => {
            const dur = typeof d.duration === 'number' ? d.duration : 0;
            if (dur > 0) durationRef.current = dur;
          }}
          onProgress={d => {
            if (!clearedSpinnerOnProgress.current && d.currentTime > 0.02) {
              clearedSpinnerOnProgress.current = true;
              hideCoverSpinner();
            }
            const now = Date.now();
            if (now - lastProgTick.current < 200) return;
            lastProgTick.current = now;
            const dur = durationRef.current || d.seekableDuration || d.playableDuration || 0;
            if (dur > 0) setProgress(Math.min(1, d.currentTime / dur));
          }}
        />
      ) : (
        <Image source={{uri: mediaUrl}} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      )}

      {isActive && coverSpinner && ad.adType === 'video' && (
        <View style={[StyleSheet.absoluteFillObject, {alignItems: 'center', justifyContent: 'center'}]} pointerEvents="none">
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}

      {ad.adType === 'video' && (
        <View style={{position: 'absolute', bottom: 4, left: 0, right: 0, height: 2, zIndex: 12}} pointerEvents="none">
          <View style={{height: 2, backgroundColor: 'rgba(255,255,255,0.22)'}}>
            <View style={{height: 2, width: `${Math.round(progress * 1000) / 10}%`, backgroundColor: '#fff'}} />
          </View>
        </View>
      )}

      {(!isActive || holdPaused) && (
        <View
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: [{translateX: -24}, {translateY: -24}],
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: 'rgba(0,0,0,0.35)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          pointerEvents="none">
          <Play size={22} color="#fff" fill="#fff" />
        </View>
      )}

      <Pressable
        style={[StyleSheet.absoluteFillObject, {zIndex: 1}]}
        delayLongPress={280}
        onLongPress={() => {
          suppressMuteTap.current = true;
          setHoldPaused(true);
        }}
        onPressOut={() => setHoldPaused(false)}
        onPress={() => {
          if (suppressMuteTap.current) {
            suppressMuteTap.current = false;
            return;
          }
          toggleReelsMuted();
        }}
      />

      <View
        style={{
          position: 'absolute',
          right: 14,
          bottom: tabBarTopFromBottom - 10,
          alignItems: 'center',
          gap: 18,
          zIndex: 10,
        }}>
        <Pressable onPress={toggleLike} style={{alignItems: 'center', gap: 4}}>
          <Heart
            size={28}
            color={adLiked ? palette.destructive : '#fff'}
            fill={adLiked ? palette.destructive : 'transparent'}
          />
          <Text style={{color: '#fff', fontSize: 12, fontWeight: '700'}}>{formatCount(likeCount)}</Text>
        </Pressable>

        <Pressable onPress={() => void handleCta()} style={{alignItems: 'center', gap: 4}}>
          <MessageCircle size={28} color="#fff" />
          <Text style={{color: '#fff', fontSize: 12, fontWeight: '700'}}>{formatCount(commentCount)}</Text>
        </Pressable>

        <Pressable
          onPress={() => Alert.alert('Repost', 'Reposting sponsored content is not available.')}
          style={{alignItems: 'center', gap: 4}}>
          <Repeat size={26} color="#fff" strokeWidth={2} />
          <Text style={{color: '#fff', fontSize: 12, fontWeight: '700'}}>0</Text>
        </Pressable>

        <Pressable onPress={() => void shareAd()} style={{alignItems: 'center', gap: 4}}>
          <Send size={28} color="#fff" strokeWidth={2} />
          <Text style={{color: '#fff', fontSize: 12, fontWeight: '700'}}>Share</Text>
        </Pressable>

        <Pressable onPress={() => setMoreOpen(true)} hitSlop={8}>
          <MoreHorizontal size={28} color="#fff" strokeWidth={2} />
        </Pressable>

        <Pressable onPress={() => toggleReelsMuted()} hitSlop={12}>
          {reelsMuted ? <VolumeX size={28} color="#fff" /> : <Volume2 size={28} color="#fff" />}
        </Pressable>
      </View>

      <View
        style={{
          position: 'absolute',
          bottom: 28,
          left: 14,
          right: 76,
          gap: 8,
          zIndex: 10,
        }}
        pointerEvents="box-none">
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
            <Megaphone size={10} color="rgba(255,255,255,0.85)" />
            <Text
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 10,
                fontWeight: '800',
                letterSpacing: 1.1,
                textTransform: 'uppercase',
              }}>
              Sponsored
            </Text>
          </View>
          {ad.category ? (
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
              }}>
              <Text style={{color: '#fff', fontSize: 10, fontWeight: '700'}}>{ad.category}</Text>
            </View>
          ) : null}
        </View>

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
            numberOfLines={1}>
            {ad.caption}
          </Text>
        ) : null}

        {ad.cta ? (
          <AdCtaGradientButton
            palette={palette}
            label={ad.cta.label}
            onPress={() => void handleCta()}
            borderRadius={radius}
            showExternalIcon={ad.cta.actionType === 'external_url'}
            compact
          />
        ) : null}
      </View>

      <View style={{position: 'absolute', top: insets.top + 12, right: 14, zIndex: 10}} pointerEvents="none">
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
            Ad
          </Text>
        </View>
      </View>
    </View>
  );
}
