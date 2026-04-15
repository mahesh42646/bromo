import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {Gift, Heart, Send, Smile, X} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {addComment, getCommentThread, getComments, likeComment, type Comment} from '../api/postsApi';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'Comments'>;

const {height: SCREEN_H} = Dimensions.get('window');
const SNAP_HALF = SCREEN_H * 0.5;
const SNAP_FULL = 60;
const DISMISS_THRESHOLD = SCREEN_H * 0.72;

const QUICK_EMOJIS = ['❤️', '🙌', '🔥', '💯', '😍', '😂', '😮', '👏', '👀', '👍', '👎', '🤔', '🤷‍♀️'];
const MENTION_BLUE = '#3b82f6';

type ThreadBundle = {
  root: Comment;
  replies: Comment[];
  threadReplyCount: number;
  hasMoreThread: boolean;
  loadingMore: boolean;
  nextCursor: string | null;
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function apiRootToBundle(c: Comment): ThreadBundle {
  const replies = (c.replies ?? []) as Comment[];
  const trc = c.threadReplyCount ?? c.repliesCount ?? replies.length;
  const hasMore = c.hasMoreThreadReplies ?? c.hasMoreReplies ?? false;
  return {
    root: {...c, replies: undefined},
    replies,
    threadReplyCount: trc,
    hasMoreThread: hasMore,
    loadingMore: false,
    nextCursor: replies.length > 0 ? replies[replies.length - 1]!._id : null,
  };
}

function patchLikeBundles(threads: ThreadBundle[], id: string, likesCount: number): ThreadBundle[] {
  return threads.map(b => {
    if (b.root._id === id) {
      return {...b, root: {...b.root, likesCount}};
    }
    const ri = b.replies.findIndex(r => r._id === id);
    if (ri >= 0) {
      const replies = [...b.replies];
      replies[ri] = {...replies[ri]!, likesCount};
      return {...b, replies};
    }
    return b;
  });
}

function CommentCell({
  comment,
  palette,
  navigation,
  onReply,
  onLike,
  compactAvatar,
}: {
  comment: Comment;
  palette: ReturnType<typeof useTheme>['palette'];
  navigation: Nav;
  onReply: (c: Comment) => void;
  onLike: (c: Comment) => void;
  compactAvatar?: boolean;
}) {
  const avatarUri =
    comment.author.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author.displayName)}&size=64`;
  const size = compactAvatar ? 32 : 36;

  return (
    <View style={{flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 8}}>
      <Pressable onPress={() => navigation.navigate('OtherUserProfile', {userId: comment.author._id})}>
        <Image source={{uri: avatarUri}} style={{width: size, height: size, borderRadius: size / 2}} />
      </Pressable>
      <View style={{flex: 1}}>
        <Text style={{color: palette.foreground, fontSize: 13, lineHeight: 20}}>
          <Text style={{fontWeight: '800'}}>{comment.author.username}</Text>
          <Text style={{color: palette.foreground, opacity: 0.55}}> {timeAgo(comment.createdAt)}</Text>
        </Text>
        <Text style={{color: palette.foreground, fontSize: 16, lineHeight: 22}}>
          {comment.replyingTo ? (
            <Text
              style={{color: MENTION_BLUE, fontWeight: '700'}}
              onPress={() =>
                navigation.navigate('OtherUserProfile', {userId: comment.replyingTo!.userId})
              }>
              @{comment.replyingTo.username}{' '}
            </Text>
          ) : null}
          {comment.text}
        </Text>
        <Pressable onPress={() => onReply(comment)} hitSlop={8} style={{marginTop: 6, alignSelf: 'flex-start'}}>
          <Text style={{color: palette.foreground, opacity: 0.78, fontWeight: '700', fontSize: 13}}>Reply</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => onLike(comment)}
        hitSlop={10}
        style={{alignItems: 'center', gap: 4, paddingTop: 6, minWidth: 40}}>
        <Heart
          size={22}
          color={comment.likesCount > 0 ? palette.destructive : palette.foreground}
          fill={comment.likesCount > 0 ? palette.destructive : 'transparent'}
          strokeWidth={2}
        />
        <Text
          style={{
            color: palette.foreground,
            opacity: comment.likesCount > 0 ? 0.78 : 0.45,
            fontSize: 13,
            fontWeight: '700',
            minHeight: 16,
          }}>
          {comment.likesCount > 0 ? String(comment.likesCount) : ' '}
        </Text>
      </Pressable>
    </View>
  );
}

function ThreadBlock({
  bundle,
  repliesHidden,
  onToggleRepliesHidden,
  onReply,
  onLike,
  onLoadMore,
  palette,
  navigation,
}: {
  bundle: ThreadBundle;
  repliesHidden: boolean;
  onToggleRepliesHidden: () => void;
  onReply: (c: Comment) => void;
  onLike: (c: Comment) => void;
  onLoadMore: (b: ThreadBundle) => void;
  palette: ReturnType<typeof useTheme>['palette'];
  navigation: Nav;
}) {
  const showThread = bundle.threadReplyCount > 0 && !repliesHidden;

  return (
    <View style={{marginBottom: 6}}>
      <CommentCell
        comment={bundle.root}
        palette={palette}
        navigation={navigation}
        onReply={onReply}
        onLike={onLike}
      />

      {repliesHidden && bundle.threadReplyCount > 0 ? (
        <Pressable onPress={onToggleRepliesHidden} style={{paddingLeft: 16 + 36 + 10, paddingVertical: 6}}>
          <Text style={{color: palette.foreground, opacity: 0.78, fontWeight: '700', fontSize: 13}}>
            — View {bundle.threadReplyCount}{' '}
            {bundle.threadReplyCount === 1 ? 'reply' : 'replies'}
          </Text>
        </Pressable>
      ) : null}

      {showThread ? (
        <View
          style={{
            borderLeftWidth: 2,
            borderLeftColor: palette.border,
            marginLeft: 16 + 17,
            paddingLeft: 10,
          }}>
          {bundle.replies.map(r => (
            <CommentCell
              key={r._id}
              comment={r}
              palette={palette}
              navigation={navigation}
              onReply={onReply}
              onLike={onLike}
              compactAvatar
            />
          ))}
          {bundle.loadingMore ? (
            <ActivityIndicator color={palette.primary} style={{marginVertical: 8}} />
          ) : null}
          {bundle.hasMoreThread ? (
            <Pressable onPress={() => onLoadMore(bundle)} style={{paddingVertical: 8}}>
              <Text style={{color: palette.foreground, opacity: 0.78, fontWeight: '700', fontSize: 13}}>
                View more replies
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showThread && bundle.threadReplyCount > 0 ? (
        <Pressable onPress={onToggleRepliesHidden} style={{paddingLeft: 16 + 36 + 10, paddingVertical: 6}}>
          <Text style={{color: palette.foreground, opacity: 0.78, fontWeight: '700', fontSize: 13}}>Hide replies</Text>
        </Pressable>
      ) : null}
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

  const [threads, setThreads] = useState<ThreadBundle[]>([]);
  const [repliesHiddenByRoot, setRepliesHiddenByRoot] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const totalCountRef = useRef(0);
  const inputRef = useRef<TextInput>(null);

  totalCountRef.current = totalCount;

  const sheetTop = useRef(new Animated.Value(SNAP_HALF)).current;
  const lastY = useRef(SNAP_HALF);

  const snapTo = useCallback(
    (target: number) => {
      lastY.current = target;
      Animated.spring(sheetTop, {toValue: target, useNativeDriver: false, bounciness: 2, speed: 22}).start();
    },
    [sheetTop],
  );

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

  const load = useCallback(
    async (reset = false) => {
      const p = reset ? 1 : page;
      try {
        const res = await getComments(postId, p);
        if (reset) {
          setThreads(res.comments.map(apiRootToBundle));
          setTotalCount(res.totalCount ?? 0);
          setPage(2);
        } else {
          setThreads(prev => [...prev, ...res.comments.map(apiRootToBundle)]);
          if (typeof res.totalCount === 'number') setTotalCount(res.totalCount);
          setPage(pr => pr + 1);
        }
        setHasMore(res.hasMore);
      } catch {
        /* keep list */
      }
    },
    [postId, page],
  );

  useEffect(() => {
    setLoading(true);
    load(true).finally(() => setLoading(false));
    snapTo(SNAP_HALF);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', () => {
      DeviceEventEmitter.emit('bromo:postCommentsCount', {
        postId,
        commentsCount: totalCountRef.current,
      });
    });
    return sub;
  }, [navigation, postId]);

  const onLoadMoreRoots = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await load(false);
    setLoadingMore(false);
  }, [hasMore, loadingMore, load]);

  const loadMoreReplies = useCallback(
    async (bundle: ThreadBundle) => {
      if (bundle.loadingMore || !bundle.hasMoreThread) return;
      setThreads(prev =>
        prev.map(b => (b.root._id === bundle.root._id ? {...b, loadingMore: true} : b)),
      );
      try {
        const res = await getCommentThread(postId, bundle.root._id, {
          after: bundle.nextCursor ?? undefined,
          limit: 15,
        });
        setThreads(prev =>
          prev.map(b => {
            if (b.root._id !== bundle.root._id) return b;
            const merged = [...b.replies, ...res.replies];
            return {
              ...b,
              replies: merged,
              hasMoreThread: res.hasMore,
              nextCursor: res.nextCursor,
              loadingMore: false,
              threadReplyCount: Math.max(b.threadReplyCount, res.totalInThread),
            };
          }),
        );
      } catch {
        setThreads(prev =>
          prev.map(b => (b.root._id === bundle.root._id ? {...b, loadingMore: false} : b)),
        );
      }
    },
    [postId],
  );

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await addComment(postId, text.trim(), replyTo?._id);
      const newComment = res.comment as Comment;
      if (!replyTo) {
        setThreads(prev => [
          {
            root: {...newComment, replies: undefined},
            replies: [],
            threadReplyCount: 0,
            hasMoreThread: false,
            loadingMore: false,
            nextCursor: null,
          },
          ...prev,
        ]);
      } else {
        setThreads(prev => {
          let rid = newComment.threadRootId;
          if (!rid) {
            for (const b of prev) {
              if (b.root._id === replyTo._id) {
                rid = b.root._id;
                break;
              }
              if (b.replies.some(r => r._id === replyTo._id)) {
                rid = b.root._id;
                break;
              }
            }
          }
          if (!rid) return prev;
          return prev.map(b =>
            b.root._id === rid
              ? {
                  ...b,
                  replies: [...b.replies, newComment],
                  threadReplyCount: b.threadReplyCount + 1,
                  nextCursor: newComment._id,
                }
              : b,
          );
        });
      }
      setTotalCount(n => n + 1);
      setText('');
      setReplyTo(null);
    } catch {
      /* toast optional */
    }
    setSending(false);
  };

  const handleLike = useCallback(
    (comment: Comment) => {
      likeComment(postId, comment._id)
        .then(({likesCount}) => {
          setThreads(prev => patchLikeBundles(prev, comment._id, likesCount));
        })
        .catch(() => {});
    },
    [postId],
  );

  const myAvatarUri =
    dbUser?.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(dbUser?.displayName ?? 'U')}&size=64`;

  return (
    <Pressable style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)'}} onPress={() => navigation.goBack()}>
      <Animated.View style={{position: 'absolute', left: 0, right: 0, bottom: 0, top: sheetTop}}>
        <Pressable onPress={e => e.stopPropagation()} style={{flex: 1}}>
          <View
            style={{
              flex: 1,
              backgroundColor: palette.background,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              overflow: 'hidden',
            }}>
            <View {...panResponder.panHandlers} style={{alignItems: 'center', paddingTop: 10, paddingBottom: 4}}>
              <View style={{width: 36, height: 4, borderRadius: 2, backgroundColor: palette.border}} />
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingBottom: 10,
              }}>
              <Text
                style={{
                  flex: 1,
                  color: palette.foreground,
                  fontSize: 15,
                  fontWeight: '800',
                  textAlign: 'center',
                }}>
                Comments{totalCount > 0 ? ` ${totalCount}` : ''}
              </Text>
              <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{position: 'absolute', right: 16}}>
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
                  data={threads}
                  keyExtractor={t => t.root._id}
                  contentContainerStyle={{paddingTop: 8, paddingBottom: 8}}
                  onEndReached={onLoadMoreRoots}
                  onEndReachedThreshold={0.35}
                  onScrollBeginDrag={() => snapTo(SNAP_FULL)}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <Text
                      style={{textAlign: 'center', color: palette.mutedForeground, paddingTop: 40, fontSize: 14}}>
                      No comments yet. Be the first!
                    </Text>
                  }
                  ListFooterComponent={
                    loadingMore ? <ActivityIndicator color={palette.primary} style={{margin: 16}} /> : null
                  }
                  renderItem={({item}) => (
                    <ThreadBlock
                      bundle={item}
                      repliesHidden={repliesHiddenByRoot[item.root._id] === true}
                      onToggleRepliesHidden={() =>
                        setRepliesHiddenByRoot(h => ({
                          ...h,
                          [item.root._id]: !h[item.root._id],
                        }))
                      }
                      onReply={c => {
                        setReplyTo(c);
                        inputRef.current?.focus();
                        snapTo(SNAP_FULL);
                      }}
                      onLike={handleLike}
                      onLoadMore={loadMoreReplies}
                      palette={palette}
                      navigation={navigation}
                    />
                  )}
                />
              )}

              {replyTo ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 6,
                    backgroundColor: `${palette.primary}12`,
                    borderTopWidth: 1,
                    borderTopColor: palette.border,
                  }}>
                  <Text style={{flex: 1, color: palette.foreground, opacity: 0.78, fontSize: 14}}>
                    Replying to <Text style={{fontWeight: '800', color: palette.primary}}>@{replyTo.author.username}</Text>
                  </Text>
                  <Pressable onPress={() => setReplyTo(null)} hitSlop={12}>
                    <X size={13} color={palette.mutedForeground} />
                  </Pressable>
                </View>
              ) : null}

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: palette.border,
                  backgroundColor: palette.background,
                }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    flexDirection: 'row',
                    gap: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                  }}
                  keyboardShouldPersistTaps="handled"
                >
                  {QUICK_EMOJIS.map((e, i) => (
                    <Pressable
                      key={`quick-emoji-${i}`}
                      onPress={() => setText(t => t + e)}
                      style={{
                        width: 34,
                        height: 26,
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderColor: palette.border,
                      }}>
                      <Text style={{fontSize: 17}}>{e}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
         

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  paddingBottom: 8 + insets.bottom,
                  backgroundColor: palette.background,
                  borderTopWidth: 1,
                  borderTopColor: palette.border,
                }}>
                <Image
                  source={{uri: myAvatarUri}}
                  style={{width: 32, height: 32, borderRadius: 16, marginBottom: 2}}
                />
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
                    placeholderTextColor={palette.foreground}
                    style={{
                      flex: 1,
                      color: palette.foreground,
                      fontSize: 18,
                      maxHeight: 80,
                      paddingTop: 8,
                      paddingBottom: 8,
                    }}
                    multiline
                    maxLength={500}
                    onFocus={() => snapTo(SNAP_FULL)}
                  />
                </View>
                <Pressable hitSlop={8} onPress={() => setText(t => t + '😊')}>
                  <Smile size={22} color={palette.foreground} strokeWidth={2} />
                </Pressable>
                <Pressable hitSlop={8}>
                  <Gift size={22} color={palette.foreground} strokeWidth={2} />
                </Pressable>
                <Pressable
                  onPress={send}
                  disabled={sending || !text.trim()}
                  style={{padding: 4, opacity: text.trim() ? 1 : 0.45}}>
                  {sending ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <Send size={20} color={palette.primary} strokeWidth={2} />
                  )}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}
