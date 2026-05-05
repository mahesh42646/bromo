import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {BadgeCheck, Bookmark, Heart, MessageCircle, MoreHorizontal, Pencil, Send, Trash2, Volume2, VolumeX} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {parentNavigate} from '../navigation/parentNavigate';
import {RefreshableScrollView, Screen} from '../components/ui';
import {ActionSheet} from '../components/ui/ActionSheet';
import {ThemedConfirmModal} from '../components/ui/ThemedConfirmModal';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {
  deletePost,
  getPost,
  recordShare,
  reportPost,
  resolveVideoUrl,
  resolveAttachedOriginalSoundUri,
  toggleLike,
  toggleSavePost,
  type CarouselItem,
  type Post,
  votePostPoll,
} from '../api/postsApi';
import {EditMetaLayers} from '../components/media/EditMetaLayers';
import {OriginalSoundAudioLayer} from '../components/media/OriginalSoundAudioLayer';
import {PostVideoWithClientMeta} from '../components/media/PostVideoWithClientMeta';
import {resolveMediaUrl} from '../lib/resolveMediaUrl';
import {postThumbnailUri} from '../lib/postMediaDisplay';
import {getAudioPlaybackFromMeta} from '../create/editMetaTypes';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'PostDetail'>;

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function clampAspectRatio(value: unknown, fallback = 1): number {
  const n = Number(value || fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(0.42, Math.min(2.2, n));
}

export function PostDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {postId} = route.params;
  const {width: windowWidth} = useWindowDimensions();
  const {palette, guidelines} = useTheme();
  const {dbUser} = useAuth();
  const {borderRadiusScale} = guidelines;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [pollBusy, setPollBusy] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [otherMenuOpen, setOtherMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const loadPost = useCallback(async () => {
    await getPost(postId)
      .then(res => {
        setPost(res.post);
        setBookmarked(Boolean(res.post.isSaved));
      })
      .catch(err => {
        console.error('[PostDetail] getPost failed', postId, err);
      })
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(() => {
    void loadPost();
  }, [loadPost]);

  const handleLike = useCallback(() => {
    if (!post) return;
    setPost(p => p ? {...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1} : p);
    toggleLike(postId).catch(() => {
      setPost(p => p ? {...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1} : p);
    });
  }, [post, postId]);

  const handleShare = useCallback(() => {
    navigation.navigate('ShareSend', {postId});
  }, [navigation, postId]);

  const handleSave = useCallback(async () => {
    if (!post) return;
    const previous = bookmarked;
    setBookmarked(!previous);
    try {
      const out = await toggleSavePost(post._id);
      setBookmarked(out.saved);
    } catch {
      setBookmarked(previous);
      Alert.alert('Save failed', 'Could not update saved posts.');
    }
  }, [bookmarked, post]);

  const isOwnPost = Boolean(post && dbUser?._id && String(post.author._id) === String(dbUser._id));

  const openBoost = useCallback(() => {
    if (!post) return;
    setMenuOpen(false);
    const contentType = post.type === 'reel' ? 'reel' : post.type === 'story' ? 'story' : 'post';
    parentNavigate(navigation, 'PromoteCampaign', {
      contentId: post._id,
      contentType,
    });
  }, [navigation, post]);

  const openInsights = useCallback(() => {
    if (!post) return;
    setMenuOpen(false);
    parentNavigate(navigation, 'ContentInsights', {focusPostId: post._id});
  }, [navigation, post]);

  const openEdit = useCallback(() => {
    if (!post) return;
    setMenuOpen(false);
    parentNavigate(navigation, 'CreateFlow', {editPostId: post._id});
  }, [navigation, post]);

  const confirmDelete = useCallback(() => {
    if (!post) return;
    setMenuOpen(false);
    setDeleteConfirmOpen(true);
  }, [post]);

  const runDeletePost = useCallback(() => {
    if (!post) return;
    setDeleteConfirmOpen(false);
    deletePost(post._id)
      .then(() => navigation.goBack())
      .catch(e =>
        Alert.alert('Delete failed', e instanceof Error ? e.message : 'Try again.'),
      );
  }, [navigation, post]);

  if (loading) {
    return (
      <Screen title="Post" scroll={false}>
        <StatusBar barStyle="light-content" />
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      </Screen>
    );
  }

  if (!post) {
    return (
      <Screen title="Post" scroll={false}>
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <Text style={{color: palette.mutedForeground}}>Post not found</Text>
        </View>
      </Screen>
    );
  }

  const avatarUri = post.author.profilePicture || `https://ui-avatars.com/api/?name=${post.author.displayName}`;
  const radius = borderRadiusScale === 'bold' ? 12 : 8;
  const rawVideo = resolveVideoUrl(post, false);
  const playUriDetail = resolveMediaUrl(rawVideo) ?? '';
  const isHlsDetail = rawVideo.endsWith('.m3u8');
  const carouselItems = (post.carouselItems ?? []).slice().sort((a, b) => a.order - b.order);
  const activeCarouselItem = carouselItems[Math.min(carouselIndex, Math.max(0, carouselItems.length - 1))];
  const mediaAspect = clampAspectRatio(activeCarouselItem?.aspectRatio, post.type === 'reel' ? 9 / 16 : 1);
  const mediaWidth = Math.max(1, windowWidth);
  const attachedDetailSound = resolveAttachedOriginalSoundUri(post);
  const detailAudioPb = getAudioPlaybackFromMeta(post.clientEditMeta);

  return (
    <Screen
      title="Post"
      scroll={false}
      right={
        <Pressable
          hitSlop={12}
          style={{padding: 8}}
          onPress={() => {
            if (isOwnPost) setMenuOpen(true);
            else setOtherMenuOpen(true);
          }}>
          <MoreHorizontal size={22} color={palette.foreground} />
        </Pressable>
      }>
      <ThemedConfirmModal
        visible={deleteConfirmOpen}
        title="Delete?"
        message={"Are you sure you want to delete? This can't be undone."}
        cancelLabel="Cancel"
        onCancel={() => setDeleteConfirmOpen(false)}
        confirmLabel="Delete"
        destructiveConfirm
        onConfirm={runDeletePost}
      />
      <StatusBar barStyle="light-content" />

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'}} onPress={() => setMenuOpen(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{
              backgroundColor: palette.background,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingBottom: 28,
              paddingTop: 8,
            }}>
            <View style={{alignItems: 'center', paddingBottom: 8}}>
              <View style={{width: 40, height: 4, borderRadius: 2, backgroundColor: palette.border}} />
            </View>
            <Pressable
              onPress={openInsights}
              style={{paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border}}>
              <Text style={{color: palette.primary, fontSize: 16, fontWeight: '700'}}>View insights</Text>
            </Pressable>
            <Pressable onPress={openBoost} style={{paddingVertical: 16, paddingHorizontal: 20}}>
              <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '700'}}>Boost post</Text>
            </Pressable>
            <Pressable
              onPress={openEdit}
              style={{
                paddingVertical: 16,
                paddingHorizontal: 20,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: palette.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}>
              <Pencil size={20} color={palette.foreground} />
              <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '700'}}>Edit</Text>
            </Pressable>
            <Pressable
              onPress={confirmDelete}
              style={{paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10}}>
              <Trash2 size={20} color={palette.destructive} />
              <Text style={{color: palette.destructive, fontSize: 16, fontWeight: '700'}}>Delete</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <RefreshableScrollView onRefresh={loadPost} showsVerticalScrollIndicator={false}>
        {/* Author row */}
        <Pressable
          onPress={() => navigation.navigate('OtherUserProfile', {userId: post.author._id})}
          style={{flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10}}>
          <Image source={{uri: avatarUri}} style={{width: 40, height: 40, borderRadius: 20}} />
          <View style={{flex: 1}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
              <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 14}}>{post.author.displayName}</Text>
              {(post.author.isVerified || post.author.verificationStatus === 'verified') && (
                <BadgeCheck size={13} color={palette.primary} fill={palette.primary} strokeWidth={2} />
              )}
            </View>
            <Text style={{color: palette.mutedForeground, fontSize: 12}}>@{post.author.username}</Text>
          </View>
          {post.location ? (
            <Text style={{color: palette.mutedForeground, fontSize: 11}}>{post.location}</Text>
          ) : null}
        </Pressable>

        {/* Media */}
        {carouselItems.length > 0 ? (
          <View style={{width: '100%', aspectRatio: mediaAspect, position: 'relative', backgroundColor: '#000'}}>
            <FlatList<CarouselItem>
              data={carouselItems}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, idx) => `${item.mediaUrl}_${idx}`}
              onMomentumScrollEnd={e => {
                setCarouselIndex(Math.round(e.nativeEvent.contentOffset.x / mediaWidth));
              }}
              renderItem={({item}) => (
                <View style={{width: mediaWidth, aspectRatio: mediaAspect, alignItems: 'center', justifyContent: 'center'}}>
                  <Image
                    source={{uri: resolveMediaUrl(item.thumbnailUrl || item.mediaUrl)}}
                    style={{width: '100%', height: '100%'}}
                    resizeMode="contain"
                  />
                </View>
              )}
            />
            {carouselItems.length > 1 ? (
              <View style={{position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)'}}>
                <Text style={{color: '#fff', fontSize: 11, fontWeight: '900'}}>
                  {Math.min(carouselIndex + 1, carouselItems.length)}/{carouselItems.length}
                </Text>
              </View>
            ) : null}
            <EditMetaLayers clientEditMeta={post.clientEditMeta} />
            {attachedDetailSound ? (
              <>
                <OriginalSoundAudioLayer
                  uri={attachedDetailSound}
                  muted={videoMuted}
                  paused={false}
                  repeat
                  startOffsetMs={detailAudioPb?.startOffsetMs ?? 0}
                />
                <Pressable
                  onPress={() => setVideoMuted(v => !v)}
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    right: 10,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                  }}>
                  {videoMuted ? <VolumeX size={17} color="#fff" /> : <Volume2 size={17} color="#fff" />}
                </Pressable>
              </>
            ) : null}
          </View>
        ) : post.mediaType === 'video' ? (
          <View style={{width: '100%', aspectRatio: mediaAspect, position: 'relative', backgroundColor: '#000'}}>
            <PostVideoWithClientMeta
              post={post}
              context={isHlsDetail ? 'feed-hls' : 'feed'}
              uri={playUriDetail}
              fallbackUri={isHlsDetail ? resolveMediaUrl(post.mediaUrl) ?? undefined : undefined}
              posterUri={postThumbnailUri(post) || undefined}
              style={{width: '100%', aspectRatio: mediaAspect}}
              repeat
              muted={videoMuted}
              paused={false}
              posterOverlayUntilReady
            />
            <Pressable
              onPress={() => setVideoMuted(v => !v)}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.5)',
              }}>
              {videoMuted ? <VolumeX size={17} color="#fff" /> : <Volume2 size={17} color="#fff" />}
            </Pressable>
          </View>
        ) : (
          <View style={{width: '100%', aspectRatio: mediaAspect, position: 'relative', backgroundColor: '#000'}}>
            <Image
              source={{uri: resolveMediaUrl(post.mediaUrl)}}
              style={{width: '100%', height: '100%'}}
              resizeMode="contain"
            />
            <EditMetaLayers clientEditMeta={post.clientEditMeta} />
            {attachedDetailSound ? (
              <>
                <OriginalSoundAudioLayer
                  uri={attachedDetailSound}
                  muted={videoMuted}
                  paused={false}
                  repeat
                  startOffsetMs={detailAudioPb?.startOffsetMs ?? 0}
                />
                <Pressable
                  onPress={() => setVideoMuted(v => !v)}
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    right: 10,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                  }}>
                  {videoMuted ? <VolumeX size={17} color="#fff" /> : <Volume2 size={17} color="#fff" />}
                </Pressable>
              </>
            ) : null}
          </View>
        )}

        {isOwnPost ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: palette.border,
            }}>
            <Pressable onPress={openInsights}>
              <Text style={{color: palette.primary, fontSize: 14, fontWeight: '800'}}>View insights</Text>
            </Pressable>
            <Pressable
              onPress={openBoost}
              style={{
                backgroundColor: palette.primary,
                paddingHorizontal: 18,
                paddingVertical: 8,
                borderRadius: radius,
              }}>
              <Text style={{color: palette.primaryForeground, fontSize: 14, fontWeight: '800'}}>Boost post</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Actions */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 14, paddingVertical: 10, gap: 16,
        }}>
          <Pressable onPress={handleLike} style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <Heart
              size={26}
              color={post.isLiked ? palette.destructive : palette.foreground}
              fill={post.isLiked ? palette.destructive : 'transparent'}
            />
            <Text style={{color: palette.foreground, fontWeight: '700'}}>{formatCount(post.likesCount)}</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Comments', {postId: post._id})}
            style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <MessageCircle size={26} color={palette.foreground} />
            <Text style={{color: palette.foreground, fontWeight: '700'}}>{formatCount(post.commentsCount)}</Text>
          </Pressable>

          <Pressable onPress={handleShare} style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <Send size={24} color={palette.foreground} />
          </Pressable>

          <View style={{flex: 1}} />

          <Pressable onPress={handleSave}>
            <Bookmark
              size={26}
              color={bookmarked ? palette.primary : palette.foreground}
              fill={bookmarked ? palette.primary : 'transparent'}
            />
          </Pressable>
        </View>

        {/* Poll (before caption) */}
        {post.poll?.options?.length ? (
          <View style={{paddingHorizontal: 14, paddingBottom: 8, gap: 8}}>
            {post.poll.question ? (
              <Text style={{color: palette.foreground, fontSize: 13, fontWeight: '800'}}>
                {post.poll.question}
              </Text>
            ) : null}
            {post.poll.options.map((opt, idx) => {
              const total = post.poll?.votes?.reduce((s, v) => s + Number(v || 0), 0) ?? 0;
              const count = Number(post.poll?.votes?.[idx] ?? 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <Pressable
                  key={`${post._id}_poll_${idx}`}
                  disabled={pollBusy}
                  onPress={async () => {
                    try {
                      setPollBusy(true);
                      const out = await votePostPoll(post._id, idx);
                      setPost(p => (p ? {...p, poll: out.poll} : p));
                    } catch (e) {
                      Alert.alert('Poll', e instanceof Error ? e.message : 'Try again');
                    } finally {
                      setPollBusy(false);
                    }
                  }}
                  style={{
                    borderRadius: 10,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: palette.border,
                    backgroundColor: palette.card,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}>
                  <Text style={{color: palette.foreground, fontSize: 13, fontWeight: '700'}}>
                    {opt}
                  </Text>
                  <Text style={{color: palette.mutedForeground, fontSize: 11, marginTop: 4}}>
                    {count} votes ({pct}%)
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Caption */}
        <View style={{paddingHorizontal: 14, paddingBottom: 8}}>
          {post.caption ? (
            <Text style={{color: palette.foreground, fontSize: 14, lineHeight: 20}}>
              <Text style={{fontWeight: '700'}}>{post.author.username} </Text>
              {post.caption}
            </Text>
          ) : null}
          <Text style={{color: palette.mutedForeground, fontSize: 11, marginTop: 6}}>
            {timeAgo(post.createdAt)}
          </Text>
        </View>

        {/* View comments link */}
        <Pressable
          onPress={() => navigation.navigate('Comments', {postId: post._id})}
          style={{paddingHorizontal: 14, paddingBottom: 24}}>
          <Text style={{color: palette.mutedForeground, fontSize: 13}}>
            {post.commentsCount > 0 ? `View all ${formatCount(post.commentsCount)} comments` : 'Add a comment...'}
          </Text>
        </Pressable>
      </RefreshableScrollView>

      <ActionSheet
        visible={otherMenuOpen}
        onCancel={() => setOtherMenuOpen(false)}
        title="Post options"
        options={[
          {
            label: 'Report',
            destructive: true,
            onPress: () => {
              void reportPost(post._id, 'inappropriate').catch(() => null);
            },
          },
          {
            label: 'Share…',
            onPress: () => {
              void recordShare(post._id);
              parentNavigate(navigation, 'ShareSend', {postId: post._id});
            },
          },
        ]}
      />
    </Screen>
  );
}
