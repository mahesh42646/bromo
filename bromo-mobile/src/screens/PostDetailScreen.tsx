import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {BadgeCheck, Bookmark, ChevronLeft, Heart, MessageCircle, MoreHorizontal, Send} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {getPost, toggleLike, type Post} from '../api/postsApi';

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

export function PostDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {postId} = route.params;
  const {palette, contract} = useTheme();
  const {borderRadiusScale} = contract.brandGuidelines;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    getPost(postId)
      .then(res => setPost(res.post))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId]);

  const handleLike = useCallback(() => {
    if (!post) return;
    setPost(p => p ? {...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1} : p);
    toggleLike(postId).catch(() => {
      setPost(p => p ? {...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1} : p);
    });
  }, [post, postId]);

  const handleShare = useCallback(async () => {
    await Share.share({message: `Check out this post on Bromo!`});
  }, []);

  if (loading) {
    return (
      <ThemedSafeScreen>
        <StatusBar barStyle="light-content" />
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{padding: 16}}>
          <ChevronLeft size={26} color={palette.foreground} />
        </Pressable>
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      </ThemedSafeScreen>
    );
  }

  if (!post) {
    return (
      <ThemedSafeScreen>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{padding: 16}}>
          <ChevronLeft size={26} color={palette.foreground} />
        </Pressable>
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <Text style={{color: palette.mutedForeground}}>Post not found</Text>
        </View>
      </ThemedSafeScreen>
    );
  }

  const avatarUri = post.author.profilePicture || `https://ui-avatars.com/api/?name=${post.author.displayName}`;

  return (
    <ThemedSafeScreen>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 8, paddingVertical: 8,
        borderBottomWidth: 1, borderBottomColor: palette.border,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{padding: 8}}>
          <ChevronLeft size={26} color={palette.foreground} />
        </Pressable>
        <Text style={{flex: 1, color: palette.foreground, fontSize: 17, fontWeight: '800', textAlign: 'center'}}>
          Post
        </Text>
        <Pressable hitSlop={12} style={{padding: 8}}>
          <MoreHorizontal size={22} color={palette.foreground} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Author row */}
        <Pressable
          onPress={() => navigation.navigate('OtherUserProfile', {userId: post.author._id})}
          style={{flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10}}>
          <Image source={{uri: avatarUri}} style={{width: 40, height: 40, borderRadius: 20}} />
          <View style={{flex: 1}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
              <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 14}}>{post.author.displayName}</Text>
              {post.author.emailVerified && (
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
        <Image
          source={{uri: post.mediaUrl}}
          style={{width: '100%', aspectRatio: 1}}
          resizeMode="cover"
        />

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

          <Pressable onPress={() => setBookmarked(b => !b)}>
            <Bookmark
              size={26}
              color={bookmarked ? palette.primary : palette.foreground}
              fill={bookmarked ? palette.primary : 'transparent'}
            />
          </Pressable>
        </View>

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
      </ScrollView>
    </ThemedSafeScreen>
  );
}
