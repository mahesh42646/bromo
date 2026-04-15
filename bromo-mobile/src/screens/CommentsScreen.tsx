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
import {Gift, Heart, Send, Smile, X} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {getComments, addComment, likeComment, type Comment} from '../api/postsApi';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'Comments'>;

const {height: SCREEN_H} = Dimensions.get('window');
const SNAP_HALF = SCREEN_H * 0.5;
const SNAP_FULL = 60;
const DISMISS_THRESHOLD = SCREEN_H * 0.72;

const QUICK_EMOJIS = ['❤️', '🙌', '🔥', '💯', '😍', '😂', '😮', '👏'];

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function patchCommentTree(
  nodes: Comment[],
  targetId: string,
  updater: (node: Comment) => Comment,
): [Comment[], boolean] {
  let changed = false;
  const next = nodes.map(node => {
    if (node._id === targetId) {
      changed = true;
      return updater(node);
    }
    const reps = node.replies ?? [];
    if (!reps.length) return node;
    const [patchedReplies, childChanged] = patchCommentTree(reps, targetId, updater);
    if (!childChanged) return node;
    changed = true;
    return {...node, replies: patchedReplies};
  });
  return [next, changed];
}

function insertReplyIntoTree(nodes: Comment[], parentId: string, reply: Comment): [Comment[], boolean] {
  let inserted = false;
  const next = nodes.map(node => {
    if (node._id === parentId) {
      inserted = true;
      const oldReplies = node.replies ?? [];
      return {
        ...node,
        replies: [...oldReplies, reply],
        repliesCount: (node.repliesCount ?? oldReplies.length) + 1,
      };
    }
    const reps = node.replies ?? [];
    if (!reps.length) return node;
    const [patchedReplies, childInserted] = insertReplyIntoTree(reps, parentId, reply);
    if (!childInserted) return node;
    inserted = true;
    return {...node, replies: patchedReplies};
  });
  return [next, inserted];
}

function CommentRow({
  comment,
  depth,
  onReply,
  onLike,
  palette,
  navigation,
}: {
  comment: Comment;
  depth: number;
  onReply: (c: Comment) => void;
  onLike: (c: Comment) => void;
  palette: ReturnType<typeof useTheme>['palette'];
  navigation: Nav;
}) {
  const avatarUri = comment.author.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author.displayName)}&size=64`;
  const replies = comment.replies ?? [];

  return (
    <View style={{marginLeft: depth * 22}}>
      <View style={{flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 8}}>
        <Pressable onPress={() => navigation.navigate('OtherUserProfile', {userId: comment.author._id})}>
          <Image source={{uri: avatarUri}} style={{width: 36, height: 36, borderRadius: 18}} />
        </Pressable>
        <View style={{flex: 1}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8}}>
            <View style={{flex: 1, paddingRight: 12}}>
              <Text style={{color: palette.foreground, fontSize: 13, lineHeight: 20}}>
                <Text style={{fontWeight: '800'}}>{comment.author.username}</Text>
                <Text style={{color: palette.mutedForeground}}> {timeAgo(comment.createdAt)}</Text>
              </Text>
              <Text style={{color: palette.foreground, fontSize: 16, lineHeight: 22}}>
                {comment.text}
              </Text>
              <View style={{flexDirection: 'row', gap: 16, marginTop: 6, alignItems: 'center'}}>
                <Pressable onPress={() => onReply(comment)} hitSlop={8}>
                  <Text style={{color: palette.foreground, fontSize: 13, fontWeight: '700'}}>Reply</Text>
                </Pressable>
              </View>
            </View>
            <Pressable
              onPress={() => onLike(comment)}
              hitSlop={10}
              style={{
                alignItems: 'center',
                gap: 6,
                paddingTop: 6,
                minWidth: 34,
                // backgroundColor: palette.input,
                // borderWidth: 1,
                // borderColor: palette.border,
                borderRadius: 18,
                paddingHorizontal: 8,
                paddingBottom: 6,
              }}>
              <Heart
                size={22}
                color={comment.likesCount > 0 ? palette.destructive : palette.foreground}
                fill={comment.likesCount > 0 ? palette.destructive : 'transparent'}
              />
              {comment.likesCount > 0 && (
                <Text style={{color: palette.mutedForeground, fontSize: 14, fontWeight: '700'}}>{comment.likesCount}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {replies.length > 0 && (
        <View>
          {replies.map(r => (
            <CommentRow
              key={r._id}
              comment={r}
              depth={depth + 1}
              onReply={onReply}
              onLike={onLike}
              palette={palette}
              navigation={navigation}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function CommentsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {postId} = route.params;
  const {palette} = useTheme();
  const {dbUser} = useAuth();
  const insets = useSafeAreaInsets();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const inputRef = useRef<TextInput>(null);

  // Sheet animation — use layout-based top (not transform) so bottom stays pinned
  const sheetTop = useRef(new Animated.Value(SNAP_HALF)).current;
  const lastY = useRef(SNAP_HALF);

  const snapTo = useCallback((target: number) => {
    lastY.current = target;
    Animated.spring(sheetTop, {toValue: target, useNativeDriver: false, bounciness: 2, speed: 22}).start();
  }, [sheetTop]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        const next = lastY.current + g.dy;
        if (next >= SNAP_FULL) sheetTop.setValue(next);
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
        setTotalCount(res.totalCount ?? res.comments.length);
        setPage(2);
      } else {
        setComments(prev => [...prev, ...res.comments]);
        if (typeof res.totalCount === 'number') setTotalCount(res.totalCount);
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
      setComments(prev => {
        if (!replyTo) return [res.comment, ...prev];
        const [patched, inserted] = insertReplyIntoTree(prev, replyTo._id, res.comment);
        return inserted ? patched : prev;
      });
      setTotalCount(n => n + 1);
      setText('');
      setReplyTo(null);
    } catch {}
    setSending(false);
  };

  const handleLike = useCallback((comment: Comment) => {
    const wasLiked = (comment.likesCount ?? 0) > 0;
    const optimisticCount = Math.max(0, (comment.likesCount ?? 0) + (wasLiked ? -1 : 1));
    setComments(prev => patchCommentTree(prev, comment._id, c => ({...c, likesCount: optimisticCount}))[0]);
    likeComment(postId, comment._id)
      .then(({likesCount}) => {
        setComments(prev => patchCommentTree(prev, comment._id, c => ({...c, likesCount}))[0]);
      })
      .catch(() => {
        setComments(prev => patchCommentTree(prev, comment._id, c => ({...c, likesCount: comment.likesCount ?? 0}))[0]);
      });
  }, [postId]);

  const myAvatarUri = dbUser?.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(dbUser?.displayName ?? 'U')}&size=64`;

  return (
    <Pressable
      style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)'}}
      onPress={() => navigation.goBack()}>
      <Animated.View
        style={{position: 'absolute', left: 0, right: 0, bottom: 0, top: sheetTop}}>
        <Pressable onPress={e => e.stopPropagation()} style={{flex: 1}}>
          <View style={{
            flex: 1,
            backgroundColor: palette.background,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            overflow: 'hidden',
          }}>
            {/* Drag handle */}
            <View {...panResponder.panHandlers} style={{alignItems: 'center', paddingTop: 10, paddingBottom: 4}}>
              <View style={{width: 36, height: 4, borderRadius: 2, backgroundColor: palette.border}} />
            </View>

            {/* Header: title + close */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 16, paddingBottom: 10,
            }}>
              <Text style={{flex: 1, color: palette.foreground, fontSize: 15, fontWeight: '800', textAlign: 'center'}}>
                Comments {totalCount > 0 ? totalCount : ''}
              </Text>
              <Pressable onPress={() => navigation.goBack()} hitSlop={12}
                style={{position: 'absolute', right: 16}}>
                <X size={20} color={palette.mutedForeground} />
              </Pressable>
            </View>

            <View style={{height: 1, backgroundColor: palette.border}} />

            <KeyboardAvoidingView
              style={{flex: 1}}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={0}>

              {loading ? (
                <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200}}>
                  <ActivityIndicator color={palette.primary} size="large" />
                </View>
              ) : (
                <FlatList
                  data={comments}
                  keyExtractor={c => c._id}
                  contentContainerStyle={{paddingTop: 8, paddingBottom: 8}}
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
                      depth={0}
                      onReply={c => { setReplyTo(c); inputRef.current?.focus(); snapTo(SNAP_FULL); }}
                      onLike={handleLike}
                      palette={palette}
                      navigation={navigation}
                    />
                  )}
                />
              )}

              {/* Reply-to banner */}
              {replyTo ? (
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 16, paddingVertical: 6,
                  backgroundColor: `${palette.primary}12`,
                  borderTopWidth: 1, borderTopColor: palette.border,
                }}>
                  <Text style={{flex: 1, color: palette.mutedForeground, fontSize: 12}}>
                    Replying to{' '}
                    <Text style={{fontWeight: '800', color: palette.primary}}>@{replyTo.author.username}</Text>
                  </Text>
                  <Pressable onPress={() => setReplyTo(null)} hitSlop={12}>
                    <X size={13} color={palette.mutedForeground} />
                  </Pressable>
                </View>
              ) : null}

              {/* Quick emoji row */}
              <View style={{
                flexDirection: 'row', gap: 4,
                paddingHorizontal: 14, paddingVertical: 6,
                borderTopWidth: 1, borderTopColor: palette.border,
              }}>
                {QUICK_EMOJIS.map(e => (
                  <Pressable
                    key={e}
                    onPress={() => setText(t => t + e)}
                    style={{
                      width: 34, height: 30, borderRadius: 15,
                      backgroundColor: palette.input,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                    <Text style={{fontSize: 16}}>{e}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Input row */}
              <View style={{
                flexDirection: 'row', alignItems: 'flex-end', gap: 8,
                paddingHorizontal: 12, paddingVertical: 8,
                paddingBottom: 8 + insets.bottom,
                backgroundColor: palette.background,
                borderTopWidth: 1, borderTopColor: palette.border,
              }}>
                <Image source={{uri: myAvatarUri}} style={{width: 32, height: 32, borderRadius: 16, marginBottom: 2}} />
                <View
                  style={{
                    flex: 1,
                    minHeight: 42,
                    maxHeight: 88,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: palette.border,
                    backgroundColor: palette.input,
                    paddingHorizontal: 14,
                    justifyContent: 'center',
                  }}>
                  <TextInput
                    ref={inputRef}
                    value={text}
                    onChangeText={setText}
                    placeholder={replyTo ? `Reply to @${replyTo.author.username}...` : 'Add a comment...'}
                    placeholderTextColor={palette.mutedForeground}
                    style={{
                      flex: 1, color: palette.foreground, fontSize: 14,
                      maxHeight: 80, paddingTop: 8, paddingBottom: 8,
                    }}
                    multiline
                    maxLength={500}
                    onFocus={() => snapTo(SNAP_FULL)}
                  />
                </View>
                <Pressable hitSlop={8} onPress={() => setText(t => t + '😊')}>
                  <Smile size={22} color={palette.foreground} />
                </Pressable>
                <Pressable hitSlop={8}>
                  <Gift size={22} color={palette.foreground} />
                </Pressable>
                <Pressable
                  onPress={send}
                  disabled={sending || !text.trim()}
                  style={{padding: 4, opacity: text.trim() ? 1 : 0.45}}>
                  {sending
                    ? <ActivityIndicator size="small" color={palette.primary} />
                    : <Send size={20} color={palette.primary} />}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}
