import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Pressable,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {ChevronLeft, Heart, Send, Share2} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {useMessaging} from '../messaging/MessagingContext';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {getStories, toggleLike, type StoryGroup} from '../api/postsApi';
import {NetworkVideo} from '../components/media/NetworkVideo';
import {resolveMediaUrl} from '../lib/resolveMediaUrl';
import {postThumbnailUri} from '../lib/postMediaDisplay';
import {parentNavigate} from '../navigation/parentNavigate';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'StoryView'>;

const STORY_DURATION = 5000;
const {width: W, height: H} = Dimensions.get('window');

export function StoryViewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {palette} = useTheme();
  const {dbUser} = useAuth();
  const {openThreadForUser} = useMessaging();
  const {userId} = route.params;

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [groupIdx, setGroupIdx] = useState(0);
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressRef = useRef<Animated.CompositeAnimation | null>(null);
  const inputRef = useRef<TextInput>(null);

  const load = useCallback(() => {
    setLoading(true);
    getStories()
      .then(r => setGroups(r.stories))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Find the group for the given userId
  useEffect(() => {
    if (groups.length === 0) return;
    const i = groups.findIndex(g => g.author._id === userId || g.author.username === userId);
    setGroupIdx(Math.max(0, i));
    setStoryIdx(0);
  }, [groups, userId]);

  const group = groups[groupIdx];
  const stories = group?.stories ?? [];
  const current = stories[storyIdx];

  const goNext = useCallback(() => {
    if (storyIdx < stories.length - 1) {
      setStoryIdx(i => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(gi => gi + 1);
      setStoryIdx(0);
    } else {
      navigation.goBack();
    }
    setLiked(false);
  }, [storyIdx, stories.length, groupIdx, groups.length, navigation]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx(i => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx(gi => gi - 1);
      setStoryIdx(0);
    }
    setLiked(false);
  }, [storyIdx, groupIdx]);

  // Auto-advance timer
  useEffect(() => {
    if (!current || paused || showReply) return;
    progressAnim.setValue(0);
    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    progressRef.current = anim;
    anim.start(({finished}) => {
      if (finished) goNext();
    });
    return () => { anim.stop(); };
  }, [current?._id, paused, showReply, goNext]);

  const handleLike = useCallback(async () => {
    if (!current) return;
    setLiked(l => !l);
    try { await toggleLike(current._id); } catch {}
  }, [current]);

  const handleReply = useCallback(async () => {
    if (!replyText.trim() || !group) return;
    try {
      const convId = await openThreadForUser(
        group.author._id,
        group.author.displayName,
        group.author.profilePicture ?? '',
        group.author.username,
      );
      parentNavigate(navigation, 'MessagesFlow', {
        screen: 'ChatThread',
        params: {peerId: convId, prefilledText: `Replied to your story: ${replyText.trim()}`},
      });
    } catch {}
    setReplyText('');
    setShowReply(false);
  }, [replyText, group, openThreadForUser, navigation]);

  if (loading) {
    return (
      <View style={{flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center'}}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!group || stories.length === 0 || !current) {
    return (
      <View style={{flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 24}}>
        <StatusBar barStyle="light-content" />
        <Text style={{color: '#fff', fontWeight: '700', textAlign: 'center'}}>No stories available</Text>
        <Pressable onPress={() => navigation.goBack()} style={{marginTop: 20}} hitSlop={12}>
          <ChevronLeft color="#fff" size={28} />
        </Pressable>
      </View>
    );
  }

  const mediaUri = resolveMediaUrl(current.mediaUrl);
  const poster = postThumbnailUri(current) || undefined;
  const avatarUri = group.author.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(group.author.displayName)}&size=64`;

  return (
    <View style={{flex: 1, backgroundColor: '#000'}}>
      <StatusBar barStyle="light-content" hidden />

      {/* Media */}
      {current.mediaType === 'video' ? (
        <NetworkVideo
          key={current._id}
          context="story"
          uri={mediaUri}
          posterUri={poster}
          style={{width: W, height: H}}
          repeat={false}
          muted={false}
          paused={paused || showReply}
          resizeMode="cover"
          posterOverlayUntilReady
        />
      ) : (
        <Image source={{uri: mediaUri}} style={{width: W, height: H}} resizeMode="cover" />
      )}

      {/* Progress bars */}
      <View style={{position: 'absolute', top: 12, left: 8, right: 8, flexDirection: 'row', gap: 3}}>
        {stories.map((s, i) => (
          <View key={s._id} style={{flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1, overflow: 'hidden'}}>
            {i < storyIdx ? (
              <View style={{flex: 1, backgroundColor: '#fff'}} />
            ) : i === storyIdx ? (
              <Animated.View style={{
                height: 2, backgroundColor: '#fff',
                width: progressAnim.interpolate({inputRange: [0, 1], outputRange: ['0%', '100%']}),
              }} />
            ) : null}
          </View>
        ))}
      </View>

      {/* Author row */}
      <View style={{
        position: 'absolute', top: 24, left: 12, right: 12,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft color="#fff" size={22} />
        </Pressable>
        <Image source={{uri: avatarUri}} style={{width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff'}} />
        <Text style={{color: '#fff', fontWeight: '700', fontSize: 14, flex: 1}}>@{group.author.username}</Text>
      </View>

      {/* Tap zones for navigation */}
      <View
        pointerEvents="box-none"
        style={{position: 'absolute', top: 70, left: 0, right: 0, bottom: 100, flexDirection: 'row'}}>
        <Pressable
          style={{flex: 1}}
          onPress={goPrev}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
        />
        <Pressable
          style={{flex: 1}}
          onPress={goNext}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
        />
      </View>

      {/* Bottom controls */}
      {showReply ? (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: 'rgba(0,0,0,0.7)',
          paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 28,
        }}>
          <TextInput
            ref={inputRef}
            value={replyText}
            onChangeText={setReplyText}
            placeholder={`Reply to @${group.author.username}…`}
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={{
              flex: 1,
              color: '#fff',
              fontSize: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.3)',
              borderRadius: 22,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
            autoFocus
            onSubmitEditing={handleReply}
            returnKeyType="send"
          />
          <Pressable onPress={handleReply} hitSlop={8}
            style={{padding: 10, backgroundColor: palette.primary, borderRadius: 22}}>
            <Send size={18} color="#fff" />
          </Pressable>
          <Pressable onPress={() => setShowReply(false)} hitSlop={8}>
            <Text style={{color: 'rgba(255,255,255,0.7)', fontWeight: '700'}}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          flexDirection: 'row', alignItems: 'center', gap: 14,
          paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 28,
        }}>
          {/* Reply input trigger */}
          <Pressable
            onPress={() => { setShowReply(true); setPaused(true); }}
            style={{
              flex: 1,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
              borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11,
            }}>
            <Text style={{color: 'rgba(255,255,255,0.5)', fontSize: 14}}>
              {group.author._id === dbUser?._id ? 'Viewers can reply…' : `Reply to @${group.author.username}…`}
            </Text>
          </Pressable>

          {/* Like */}
          <Pressable onPress={handleLike} hitSlop={12}
            style={{alignItems: 'center', justifyContent: 'center', width: 40, height: 40}}>
            <Heart
              size={26}
              color={liked ? '#ef4444' : '#fff'}
              fill={liked ? '#ef4444' : 'transparent'}
            />
          </Pressable>

          {/* Share */}
          <Pressable
            onPress={() => parentNavigate(navigation, 'ShareSend', {postId: current._id})}
            hitSlop={12}
            style={{alignItems: 'center', justifyContent: 'center', width: 40, height: 40}}>
            <Share2 size={26} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}
