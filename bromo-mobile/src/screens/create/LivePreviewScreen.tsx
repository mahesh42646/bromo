import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  ChevronDown,
  Eye,
  Heart,
  MessageCircle,
  Radio,
  Send,
  Share2,
  ShoppingBag,
  Users,
  X,
  Zap,
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import type {ThemePalette} from '../../config/platform-theme';
import {useCreateDraft} from '../../create/CreateDraftContext';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'LivePreview'>;

type LiveComment = {
  id: string;
  username: string;
  text: string;
  isHost?: boolean;
};

const SIMULATED_COMMENTS: LiveComment[] = [
  {id: 'lc1', username: 'priya_vibes', text: 'Hey! Just joined '},
  {id: 'lc2', username: 'tech_marathi', text: 'Looks amazing!'},
  {id: 'lc3', username: 'shop_local', text: 'Can you show the product?'},
  {id: 'lc4', username: 'foodie_india', text: ''},
  {id: 'lc5', username: 'travel_squad', text: 'Love this stream!'},
  {id: 'lc6', username: 'creator_hub', text: 'When is the drop?'},
  {id: 'lc7', username: 'music_addict', text: 'Great quality!'},
  {id: 'lc8', username: 'fashion_daily', text: 'Share the link please'},
];

type LivePhase = 'preview' | 'live' | 'ended';

export function LivePreviewScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const styles = makeStyles(palette);
  const {draft, setLiveMeta, reset} = useCreateDraft();

  const [phase, setPhase] = useState<LivePhase>('preview');
  const [viewers, setViewers] = useState(0);
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [myComment, setMyComment] = useState('');
  const [duration, setDuration] = useState(0);
  const [titleLocal, setTitleLocal] = useState(draft.liveTitle);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const commentsRef = useRef<FlatList>(null);

  // Pulse animation for LIVE badge
  useEffect(() => {
    if (phase === 'live') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {toValue: 0.6, duration: 800, useNativeDriver: true}),
          Animated.timing(pulseAnim, {toValue: 1, duration: 800, useNativeDriver: true}),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [phase, pulseAnim]);

  // Simulate viewers + comments during live
  useEffect(() => {
    if (phase !== 'live') return;
    const viewerInterval = setInterval(() => {
      setViewers(v => {
        const delta = Math.floor(Math.random() * 8) - 2;
        return Math.max(1, v + delta);
      });
    }, 3000);
    const commentInterval = setInterval(() => {
      setComments(prev => {
        if (prev.length >= SIMULATED_COMMENTS.length) return prev;
        return [...prev, SIMULATED_COMMENTS[prev.length]];
      });
    }, 4000);
    const timer = setInterval(() => setDuration(d => d + 1), 1000);
    return () => {
      clearInterval(viewerInterval);
      clearInterval(commentInterval);
      clearInterval(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (comments.length > 0) {
      commentsRef.current?.scrollToEnd({animated: true});
    }
  }, [comments.length]);

  const goLive = useCallback(() => {
    setLiveMeta({liveTitle: titleLocal});
    setViewers(Math.floor(Math.random() * 5) + 1);
    setPhase('live');
  }, [titleLocal, setLiveMeta]);

  const endLive = useCallback(() => {
    setPhase('ended');
  }, []);

  const closeAll = useCallback(() => {
    reset();
    navigation.getParent()?.goBack();
  }, [navigation, reset]);

  const sendComment = useCallback(() => {
    if (!myComment.trim()) return;
    setComments(prev => [
      ...prev,
      {id: `my_${Date.now()}`, username: 'you', text: myComment.trim(), isHost: true},
    ]);
    setMyComment('');
  }, [myComment]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Ended screen
  if (phase === 'ended') {
    return (
      <ThemedSafeScreen style={styles.root}>
        <View style={styles.endedContainer}>
          <Radio size={40} color={palette.destructive} />
          <Text style={styles.endedTitle}>Live ended</Text>
          <Text style={styles.endedSub}>Duration: {formatTime(duration)}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Eye size={20} color={palette.foreground} />
              <Text style={styles.statNum}>{viewers}</Text>
              <Text style={styles.statLabel}>Peak viewers</Text>
            </View>
            <View style={styles.statCard}>
              <Heart size={20} color={palette.destructive} />
              <Text style={styles.statNum}>{likes}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
            <View style={styles.statCard}>
              <MessageCircle size={20} color={palette.accent} />
              <Text style={styles.statNum}>{comments.length}</Text>
              <Text style={styles.statLabel}>Comments</Text>
            </View>
          </View>

          <Pressable style={[styles.doneBtn, {backgroundColor: palette.accent}]} onPress={closeAll}>
            <Text style={styles.doneBtnTxt}>Done</Text>
          </Pressable>
          <Pressable style={styles.shareBtn} onPress={closeAll}>
            <Share2 size={16} color={palette.foreground} />
            <Text style={styles.shareBtnTxt}>Share to feed</Text>
          </Pressable>
        </View>
      </ThemedSafeScreen>
    );
  }

  // Preview (before going live)
  if (phase === 'preview') {
    return (
      <ThemedSafeScreen style={styles.root}>
        <View style={styles.previewContainer}>
          <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <X size={24} color={palette.foreground} />
          </Pressable>

          <View style={styles.cameraPlaceholder}>
            <Radio size={48} color={palette.accent} />
            <Text style={styles.cameraText}>Camera preview</Text>
          </View>

          <View style={styles.previewForm}>
            <TextInput
              value={titleLocal}
              onChangeText={setTitleLocal}
              placeholder="Add a title for your live..."
              placeholderTextColor={palette.foregroundSubtle}
              style={styles.titleInput}
            />

            <Pressable
              onPress={() =>
                setLiveMeta({
                  liveAudience: draft.liveAudience === 'everyone' ? 'followers' : 'everyone',
                })
              }
              style={styles.audienceBtn}>
              <Users size={16} color={palette.foreground} />
              <Text style={styles.audienceTxt}>
                {draft.liveAudience === 'everyone' ? 'Everyone' : 'Followers only'}
              </Text>
              <ChevronDown size={14} color={palette.foregroundMuted} />
            </Pressable>

            <Pressable style={styles.goLiveBtn} onPress={goLive}>
              <Radio size={20} color="#fff" />
              <Text style={styles.goLiveTxt}>Go live</Text>
            </Pressable>
          </View>
        </View>
      </ThemedSafeScreen>
    );
  }

  // Live phase
  return (
    <ThemedSafeScreen style={styles.root}>
      <View style={styles.liveContainer}>
        {/* Camera background placeholder */}
        <View style={styles.liveCameraBg}>
          <Text style={styles.liveCameraText}>LIVE Camera Feed</Text>
        </View>

        {/* Top bar */}
        <View style={styles.liveTopBar}>
          <View style={styles.liveBadgeRow}>
            <Animated.View style={[styles.liveBadge, {opacity: pulseAnim}]}>
              <Text style={styles.liveBadgeTxt}>LIVE</Text>
            </Animated.View>
            <Text style={styles.liveTimer}>{formatTime(duration)}</Text>
          </View>
          <View style={styles.viewerBadge}>
            <Eye size={14} color={palette.foreground} />
            <Text style={styles.viewerCount}>{viewers}</Text>
          </View>
          <Pressable style={styles.endBtn} onPress={endLive}>
            <X size={20} color={palette.foreground} />
          </Pressable>
        </View>

        {/* Title */}
        {draft.liveTitle ? (
          <View style={styles.liveTitleBar}>
            <Text style={styles.liveTitleTxt} numberOfLines={1}>{draft.liveTitle}</Text>
          </View>
        ) : null}

        {/* Comments */}
        <View style={styles.commentsContainer}>
          <FlatList
            ref={commentsRef}
            data={comments}
            keyExtractor={item => item.id}
            renderItem={({item}) => (
              <View style={styles.commentRow}>
                <Text style={[styles.commentUser, item.isHost && {color: palette.accent}]}>
                  {item.username}
                </Text>
                <Text style={styles.commentText}>{item.text}</Text>
              </View>
            )}
          />
        </View>

        {/* Bottom bar */}
        <View style={styles.liveBottom}>
          <View style={styles.commentInputRow}>
            <TextInput
              value={myComment}
              onChangeText={setMyComment}
              placeholder="Comment..."
              placeholderTextColor={palette.foregroundSubtle}
              style={styles.commentInput}
            />
            <Pressable onPress={sendComment} style={styles.sendBtn}>
              <Send size={18} color={palette.accent} />
            </Pressable>
          </View>
          <View style={styles.liveActions}>
            <Pressable style={styles.liveActionBtn} onPress={() => setLikes(l => l + 1)}>
              <Heart size={22} color={palette.destructive} fill={likes > 0 ? palette.destructive : 'transparent'} />
            </Pressable>
            <Pressable style={styles.liveActionBtn}>
              <ShoppingBag size={22} color={palette.foreground} />
            </Pressable>
            <Pressable style={styles.liveActionBtn}>
              <Zap size={22} color={palette.warning} />
            </Pressable>
            <Pressable style={styles.liveActionBtn}>
              <Share2 size={22} color={palette.foreground} />
            </Pressable>
          </View>
        </View>
      </View>
    </ThemedSafeScreen>
  );
}

function makeStyles(p: ThemePalette) {
  return StyleSheet.create({
    root: {flex: 1, backgroundColor: p.background},
    previewContainer: {flex: 1},
    closeBtn: {position: 'absolute', top: 8, right: 12, zIndex: 10, padding: 8},
    cameraPlaceholder: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.background, gap: 12},
    cameraText: {color: p.foregroundFaint, fontSize: 16},
    previewForm: {padding: 20, gap: 14},
    titleInput: {backgroundColor: p.card, borderRadius: 12, padding: 14, color: p.foreground, fontSize: 16, borderWidth: 1, borderColor: p.surfaceHigh},
    audienceBtn: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.surfaceHigh},
    audienceTxt: {color: p.foreground, flex: 1, fontWeight: '600'},
    goLiveBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: p.accent, paddingVertical: 16, borderRadius: 14},
    goLiveTxt: {color: p.accentForeground, fontWeight: '900', fontSize: 17},
    liveContainer: {flex: 1},
    liveCameraBg: {...StyleSheet.absoluteFillObject, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center'},
    liveCameraText: {color: p.border, fontSize: 18, fontWeight: '700'},
    liveTopBar: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 10, zIndex: 5},
    liveBadgeRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
    liveBadge: {backgroundColor: p.destructive, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6},
    liveBadgeTxt: {color: p.destructiveForeground, fontWeight: '900', fontSize: 12},
    liveTimer: {color: p.foreground, fontWeight: '700', fontSize: 14},
    viewerBadge: {flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: p.overlay, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginLeft: 'auto'},
    viewerCount: {color: p.foreground, fontWeight: '800', fontSize: 13},
    endBtn: {width: 36, height: 36, borderRadius: 18, backgroundColor: p.destructive, alignItems: 'center', justifyContent: 'center'},
    liveTitleBar: {marginHorizontal: 12, marginTop: 4, backgroundColor: p.overlay, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, zIndex: 5},
    liveTitleTxt: {color: p.foreground, fontWeight: '700', fontSize: 15},
    commentsContainer: {flex: 1, justifyContent: 'flex-end', paddingHorizontal: 12, paddingBottom: 8, zIndex: 5},
    commentRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8, backgroundColor: p.glassMid, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, maxWidth: '85%'},
    commentUser: {color: p.foreground, fontWeight: '800', fontSize: 13},
    commentText: {color: p.foregroundMuted, fontSize: 13, flex: 1},
    liveBottom: {paddingHorizontal: 12, paddingBottom: 12, zIndex: 5},
    commentInputRow: {flexDirection: 'row', alignItems: 'center', backgroundColor: p.borderFaint, borderRadius: 999, paddingHorizontal: 14, gap: 8},
    commentInput: {flex: 1, color: p.foreground, paddingVertical: 10},
    sendBtn: {padding: 6},
    liveActions: {flexDirection: 'row', justifyContent: 'space-around', marginTop: 10},
    liveActionBtn: {width: 44, height: 44, borderRadius: 22, backgroundColor: p.glassMid, alignItems: 'center', justifyContent: 'center'},
    endedContainer: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 8},
    endedTitle: {color: p.foreground, fontSize: 24, fontWeight: '900', marginTop: 12},
    endedSub: {color: p.foregroundMuted, fontSize: 15},
    statsRow: {flexDirection: 'row', gap: 16, marginTop: 24},
    statCard: {alignItems: 'center', gap: 6, backgroundColor: p.surface, borderRadius: 14, padding: 16, minWidth: 90, borderWidth: 1, borderColor: p.surfaceHigh},
    statNum: {color: p.foreground, fontWeight: '900', fontSize: 20},
    statLabel: {color: p.foregroundMuted, fontSize: 11, fontWeight: '600'},
    doneBtn: {paddingVertical: 16, paddingHorizontal: 48, borderRadius: 14, marginTop: 28},
    doneBtnTxt: {color: p.accentForeground, fontWeight: '900', fontSize: 16},
    shareBtn: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, borderWidth: 1, borderColor: p.border, marginTop: 10},
    shareBtnTxt: {color: p.foreground, fontWeight: '700', fontSize: 14},
  });
}
