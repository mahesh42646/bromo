import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {Heart, Send, X} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {getComments, addComment, type Comment} from '../api/postsApi';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'Comments'>;

const {height: SCREEN_H} = Dimensions.get('window');
const SNAP_HALF = SCREEN_H * 0.52;   // sheet top when half-open
const SNAP_FULL = 60;                  // sheet top when fully expanded (below status bar)
const DISMISS_THRESHOLD = SCREEN_H * 0.72; // drag past this → dismiss

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

type ThreadedComment = Comment & {replies: Comment[]};

function threadComments(flat: Comment[]): ThreadedComment[] {
  const map = new Map<string, ThreadedComment>();
  const roots: ThreadedComment[] = [];
  for (const c of flat) {
    map.set(c._id, {...c, replies: []});
  }
  for (const c of flat) {
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.replies.push(c);
    } else {
      roots.push(map.get(c._id)!);
    }
  }
  return roots;
}

function CommentRow({
  comment,
  indent,
  onReply,
  palette,
  navigation,
}: {
  comment: ThreadedComment | Comment;
  indent: number;
  onReply: (c: Comment) => void;
  palette: ReturnType<typeof useTheme>['palette'];
  navigation: Nav;
}) {
  const avatarUri = comment.author.profilePicture || `https://ui-avatars.com/api/?name=${comment.author.displayName}`;
  return (
    <>
      <View style={{
        flexDirection: 'row', gap: 10,
        paddingHorizontal: 16, paddingVertical: 8,
        marginLeft: indent * 36,
      }}>
        <Pressable onPress={() => navigation.navigate('OtherUserProfile', {userId: comment.author._id})}>
          <Image source={{uri: avatarUri}} style={{width: 32, height: 32, borderRadius: 16}} />
        </Pressable>
        <View style={{flex: 1}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
            <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 13}}>
              {comment.author.username}
            </Text>
            <Text style={{color: palette.mutedForeground, fontSize: 11}}>{timeAgo(comment.createdAt)}</Text>
          </View>
          <Text style={{color: palette.foreground, fontSize: 14, lineHeight: 20, marginTop: 2}}>
            {comment.text}
          </Text>
          <View style={{flexDirection: 'row', gap: 16, marginTop: 6, alignItems: 'center'}}>
            <Pressable onPress={() => onReply(comment)} hitSlop={8}>
              <Text style={{color: palette.mutedForeground, fontSize: 12, fontWeight: '600'}}>Reply</Text>
            </Pressable>
            <Pressable hitSlop={8}>
              <Heart size={13} color={palette.mutedForeground} />
            </Pressable>
          </View>
        </View>
      </View>
      {'replies' in comment && comment.replies.length > 0 && (
        comment.replies.map(r => (
          <CommentRow
            key={r._id}
            comment={r}
            indent={indent + 1}
            onReply={onReply}
            palette={palette}
            navigation={navigation}
          />
        ))
      )}
    </>
  );
}

export function CommentsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {postId} = route.params;
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const inputRef = useRef<TextInput>(null);

  // — sheet animation —
  const sheetY = useRef(new Animated.Value(SNAP_HALF)).current;
  const lastY = useRef(SNAP_HALF);

  const snapTo = useCallback((target: number) => {
    lastY.current = target;
    Animated.spring(sheetY, {
      toValue: target,
      useNativeDriver: true,
      bounciness: 2,
      speed: 22,
    }).start();
  }, [sheetY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        const next = lastY.current + g.dy;
        if (next >= SNAP_FULL) sheetY.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const next = lastY.current + g.dy;
        if (next > DISMISS_THRESHOLD || g.vy > 0.8) {
          navigation.goBack();
        } else if (next < SCREEN_H * 0.3) {
          snapTo(SNAP_FULL);
        } else {
          snapTo(SNAP_HALF);
        }
      },
    }),
  ).current;

  const load = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    try {
      const res = await getComments(postId, p);
      if (reset) {
        setComments(res.comments);
        setPage(2);
      } else {
        setComments(prev => [...prev, ...res.comments]);
        setPage(p + 1);
      }
      setHasMore(res.hasMore);
    } catch {}
  }, [postId, page]);

  useEffect(() => {
    setLoading(true);
    load(true).finally(() => setLoading(false));
    snapTo(SNAP_HALF);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await load(false);
    setLoadingMore(false);
  }, [hasMore, loadingMore, load]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await addComment(postId, text.trim(), replyTo?._id);
      setComments(prev => [res.comment, ...prev]);
      setText('');
      setReplyTo(null);
    } catch {}
    setSending(false);
  };

  const threaded = threadComments(comments);

  return (
    // Translucent backdrop
    <Pressable
      style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)'}}
      onPress={() => navigation.goBack()}>

      <Animated.View
        style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          top: 0,
          transform: [{translateY: sheetY}],
        }}>
        <Pressable onPress={e => e.stopPropagation()} style={{flex: 1}}>
          {/* Sheet panel */}
          <View style={{
            flex: 1,
            backgroundColor: palette.background,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            overflow: 'hidden',
          }}>
            {/* Drag handle */}
            <View {...panResponder.panHandlers} style={{alignItems: 'center', paddingVertical: 10}}>
              <View style={{width: 40, height: 4, borderRadius: 2, backgroundColor: palette.border}} />
            </View>

            {/* Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 16, paddingBottom: 12,
              borderBottomWidth: 1, borderBottomColor: palette.border,
            }}>
              <Text style={{flex: 1, color: palette.foreground, fontSize: 16, fontWeight: '800', textAlign: 'center'}}>
                Comments
              </Text>
              <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
                <X size={20} color={palette.mutedForeground} />
              </Pressable>
            </View>

            <KeyboardAvoidingView
              style={{flex: 1}}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>

              {loading ? (
                <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200}}>
                  <ActivityIndicator color={palette.primary} size="large" />
                </View>
              ) : (
                <FlatList
                  data={threaded}
                  keyExtractor={c => c._id}
                  contentContainerStyle={{paddingTop: 4, paddingBottom: 8}}
                  onEndReached={onLoadMore}
                  onEndReachedThreshold={0.4}
                  onScrollBeginDrag={() => snapTo(SNAP_FULL)}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <Text style={{textAlign: 'center', color: palette.mutedForeground, paddingTop: 40, fontSize: 14}}>
                      No comments yet. Be the first!
                    </Text>
                  }
                  ListFooterComponent={
                    loadingMore ? <ActivityIndicator color={palette.primary} style={{margin: 16}} /> : null
                  }
                  renderItem={({item}) => (
                    <CommentRow
                      comment={item}
                      indent={0}
                      onReply={c => { setReplyTo(c); inputRef.current?.focus(); snapTo(SNAP_FULL); }}
                      palette={palette}
                      navigation={navigation}
                    />
                  )}
                />
              )}

              {replyTo ? (
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 16, paddingVertical: 8,
                  backgroundColor: `${palette.primary}15`,
                  borderTopWidth: 1, borderTopColor: palette.border,
                }}>
                  <Text style={{flex: 1, color: palette.mutedForeground, fontSize: 12}}>
                    Replying to <Text style={{fontWeight: '800', color: palette.primary}}>@{replyTo.author.username}</Text>
                  </Text>
                  <Pressable onPress={() => setReplyTo(null)} hitSlop={12}>
                    <X size={14} color={palette.mutedForeground} />
                  </Pressable>
                </View>
              ) : null}

              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingHorizontal: 14, paddingTop: 10,
                paddingBottom: 10 + insets.bottom,
                borderTopWidth: 1, borderTopColor: palette.border,
                backgroundColor: palette.background,
              }}>
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  placeholder="Add a comment..."
                  placeholderTextColor={palette.mutedForeground}
                  style={{
                    flex: 1, backgroundColor: palette.input,
                    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
                    color: palette.foreground, fontSize: 14,
                  }}
                  multiline
                  maxLength={500}
                  onFocus={() => snapTo(SNAP_FULL)}
                />
                <Pressable
                  onPress={send}
                  disabled={!text.trim() || sending}
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: text.trim() ? palette.primary : palette.muted,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                  {sending
                    ? <ActivityIndicator size="small" color={palette.primaryForeground} />
                    : <Send size={16} color={text.trim() ? palette.primaryForeground : palette.mutedForeground} />}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}
