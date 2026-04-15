/**
 * AdCard — sponsored post in home / explore: mirrors PostCard actions + gradient CTA.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Bookmark,
  Eye,
  EyeOff,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
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
import {type Ad, type AdPlacement, trackAdEvent, fetchAdSummary, likeAd, unlikeAd, saveAd, unsaveAd, shareAd as shareAdApi} from '../api/adsApi';

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

const {width: SCREEN_WIDTH} = Dimensions.get('window');

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.max(0, Math.floor(n)));
}

interface Props {
  ad: Ad;
  placement?: AdPlacement;
  /** When false, video ad pauses (feed viewability). Defaults true (e.g. explore). */
  isVideoVisible?: boolean;
}

export function AdCard({ad, placement = 'feed', isVideoVisible = true}: Props) {
  const {palette, contract} = useTheme();
  const navigation = useNavigation() as Nav;
  const {homeFeedMuted, toggleHomeFeedMuted} = usePlaybackMute();
  const {borderRadiusScale} = contract.brandGuidelines;
  const radius = borderRadiusScale === 'bold' ? 14 : 10;

  const impressionSent = useRef(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [adLiked, setAdLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hidden, setHidden] = useState(false);

  const title = ad.brandName?.trim() || 'Sponsored';

  // Fetch real engagement counts from server
  useEffect(() => {
    fetchAdSummary(ad._id).then(s => {
      if (!s) return;
      setLikeCount(s.likesCount);
      setAdLiked(s.liked);
      setBookmarked(s.saved);
    }).catch(() => null);
  }, [ad._id]);

  useEffect(() => {
    if (impressionSent.current) return;
    impressionSent.current = true;
    trackAdEvent(ad._id, 'impression', {placement});
  }, [ad._id, placement]);

  const handleCta = useCallback(async () => {
    trackAdEvent(ad._id, 'click', {placement});
    if (!ad.cta) return;
    if (ad.cta.actionType === 'external_url' && ad.cta.externalUrl) {
      await Linking.openURL(ad.cta.externalUrl).catch(() => null);
    } else if (ad.cta.actionType === 'in_app' && ad.cta.inAppScreen) {
      parentNavigate(navigation, ad.cta.inAppScreen, ad.cta.inAppParams ?? {});
    }
  }, [ad, navigation, placement]);

  const doShare = useCallback(async () => {
    trackAdEvent(ad._id, 'click', {placement});
    const url = ad.cta?.externalUrl ?? '';
    try {
      await Share.share({
        message: url ? `${ad.caption || 'Sponsored'}\n${url}` : ad.caption || 'Sponsored',
        url: url || undefined,
      });
      // Record share on server (fire-and-forget)
      shareAdApi(ad._id).catch(() => null);
    } catch {
      /* ignore */
    }
  }, [ad, placement]);

  const onAdComment = useCallback(() => {
    trackAdEvent(ad._id, 'click', {placement});
    void handleCta();
  }, [handleCta, placement, ad._id]);

  const toggleLike = useCallback(async () => {
    const next = !adLiked;
    setAdLiked(next);
    setLikeCount(c => c + (next ? 1 : -1));
    try {
      const result = next ? await likeAd(ad._id) : await unlikeAd(ad._id);
      setLikeCount(result.likesCount);
      setAdLiked(result.liked);
    } catch {
      // revert optimistic update
      setAdLiked(!next);
      setLikeCount(c => c + (next ? -1 : 1));
    }
    trackAdEvent(ad._id, 'click', {placement});
  }, [ad._id, adLiked, placement]);

  const toggleSave = useCallback(async () => {
    const next = !bookmarked;
    setBookmarked(next);
    try {
      next ? await saveAd(ad._id) : await unsaveAd(ad._id);
    } catch {
      setBookmarked(!next);
    }
  }, [ad._id, bookmarked]);

  const videoPaused = !isVideoVisible || userPaused;

  if (hidden) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: palette.background,
        borderBottomWidth: 8,
        borderBottomColor: palette.background,
      }}>
      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end'}} onPress={() => setMenuOpen(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{
              backgroundColor: palette.surface,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              paddingBottom: 28,
              paddingTop: 6,
            }}>
            <View style={{alignItems: 'center', paddingBottom: 8}}>
              <View style={{width: 40, height: 4, borderRadius: 2, backgroundColor: palette.border}} />
            </View>
            {[
              {
                icon: <Send size={20} color={palette.foreground} />,
                label: 'Share',
                onPress: () => {
                  setMenuOpen(false);
                  void doShare();
                },
              },
              {
                icon: <Bookmark size={20} color={palette.foreground} />,
                label: bookmarked ? 'Unsave' : 'Save',
                onPress: () => {
                  setMenuOpen(false);
                  void toggleSave();
                },
              },
              {
                icon: <EyeOff size={20} color={palette.foreground} />,
                label: 'Hide ad',
                onPress: () => {
                  setMenuOpen(false);
                  setHidden(true);
                },
              },
              {
                icon: <Flag size={20} color={palette.destructive} />,
                label: 'Report',
                danger: true,
                onPress: () => {
                  setMenuOpen(false);
                  trackAdEvent(ad._id, 'click', {placement});
                },
              },
            ].map(row => (
              <Pressable
                key={row.label}
                onPress={row.onPress}
                style={({pressed}) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  backgroundColor: pressed ? `${palette.foreground}0f` : 'transparent',
                })}>
                {row.icon}
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '500',
                    color: 'danger' in row && row.danger ? palette.destructive : palette.foreground,
                  }}>
                  {row.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: palette.surface,
              borderWidth: 1.5,
              borderColor: palette.ring,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{color: palette.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5}}>AD</Text>
          </View>
          <View style={{gap: 1}}>
            <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 14}}>{title}</Text>
            <Text
              style={{
                color: palette.foreground,
                opacity: 0.55,
                fontSize: 11,
                fontWeight: '600',
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}>
              {ad.category ? `${ad.category} · Sponsored` : 'Sponsored'}
            </Text>
          </View>
        </View>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={10}>
          <MoreHorizontal size={20} color={palette.foreground} style={{opacity: 0.75}} />
        </Pressable>
      </View>

      {ad.caption ? (
        <View style={{paddingHorizontal: 14, paddingBottom: 8}}>
          <Text style={{color: palette.foreground, fontSize: 13, lineHeight: 19}} numberOfLines={1}>
            {ad.caption}
          </Text>
        </View>
      ) : null}

      {ad.adType === 'image' && ad.mediaUrls[0] ? (
        <Image source={{uri: ad.mediaUrls[0]}} style={{width: SCREEN_WIDTH, aspectRatio: 1}} resizeMode="cover" />
      ) : null}

      {ad.adType === 'carousel' ? (
        <View>
          <FlatList
            data={ad.mediaUrls}
            keyExtractor={(_, i) => `${ad._id}_c_${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setCarouselIndex(idx);
            }}
            renderItem={({item}) => (
              <Image source={{uri: item}} style={{width: SCREEN_WIDTH, aspectRatio: 1}} resizeMode="cover" />
            )}
          />
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
        <Pressable onPress={() => setUserPaused(p => !p)} style={{width: SCREEN_WIDTH, aspectRatio: 16 / 9, backgroundColor: '#000'}}>
          <NetworkVideo
            uri={ad.mediaUrls[0]}
            paused={videoPaused}
            muted={homeFeedMuted}
            repeat
            style={{width: SCREEN_WIDTH, aspectRatio: 16 / 9}}
            posterUri={ad.thumbnailUrl}
          />
          <Pressable
            onPress={() => toggleHomeFeedMuted()}
            hitSlop={12}
            style={{position: 'absolute', bottom: 10, right: 10}}>
            <View
              style={{
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderRadius: 999,
                padding: 6,
              }}>
              {homeFeedMuted ? <VolumeX size={16} color="#fff" /> : <Volume2 size={16} color="#fff" />}
            </View>
          </Pressable>
          {userPaused && isVideoVisible ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)'},
              ]}>
              <Text style={{color: '#fff', fontWeight: '800', fontSize: 13}}>Paused · tap to play</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12}}>
        <View style={{flexDirection: 'row', gap: 20, alignItems: 'center'}}>
          <Pressable onPress={() => void toggleLike()} style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
            <Heart
              size={24}
              color={adLiked ? palette.destructive : palette.foreground}
              fill={adLiked ? palette.destructive : 'transparent'}
            />
            <Text style={{color: palette.foreground, fontSize: 13, fontWeight: '600'}}>{formatCount(likeCount)}</Text>
          </Pressable>
          <Pressable onPress={onAdComment} style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
            <MessageCircle size={24} color={palette.foreground} />
          </Pressable>
          <Pressable onPress={() => void doShare()}>
            <Send size={24} color={palette.foreground} />
          </Pressable>
        </View>
        <Pressable onPress={() => void toggleSave()}>
          <Bookmark
            size={24}
            color={bookmarked ? palette.primary : palette.foreground}
            fill={bookmarked ? palette.primary : 'transparent'}
          />
        </Pressable>
      </View>

      <View style={{paddingHorizontal: 14, paddingBottom: 10, gap: 10}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
          <Eye size={11} color={palette.foreground} style={{opacity: 0.55}} />
          <Text style={{color: palette.foreground, opacity: 0.55, fontSize: 12}}>Sponsored</Text>
        </View>
        {ad.cta ? (
          <AdCtaGradientButton
            palette={palette}
            label={ad.cta.label}
            onPress={() => void handleCta()}
            borderRadius={radius}
            showExternalIcon={ad.cta.actionType === 'external_url'}
          />
        ) : null}
      </View>
    </View>
  );
}
