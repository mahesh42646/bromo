import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, FlatList, Image, Pressable, Share, Text, TextInput, TouchableOpacity, View} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {Check, Link, MoreHorizontal, Users} from 'lucide-react-native';
import {useTheme} from '../../../context/ThemeContext';
import {useAuth} from '../../../context/AuthContext';
import {useMessaging} from '../../../messaging/MessagingContext';
import type {AppStackParamList} from '../../../navigation/appStackParamList';
import {SopChrome, SopMeta, SopRow} from '../ui/SopChrome';
import {PrimaryButton} from '../../../components/ui/PrimaryButton';
import {followUser, getFollowing, getNearbyUsers, updateMyLocation, type SuggestedUser} from '../../../api/followApi';
import {getHashtagPosts, type Post} from '../../../api/postsApi';
import {useAudioPickerTracks} from '../../../create/useAudioPickerTracks';
import {parentNavigate} from '../../../navigation/parentNavigate';
import {ProfileGridMedia} from '../../../components/profile/ProfileGridMedia';
import {getShareUrl} from '../../../lib/shareUrl';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const MOCK_POST = {
  id: '1',
  image: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800',
  user: 'Leader Maharashtra',
  likes: '24.5k',
  caption: 'आजचा दिवस ऐतिहासिक!',
};

export function CategoryFeedScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'CategoryFeed'>>();
  const {palette} = useTheme();
  const id = route.params.categoryId;
  return (
    <SopChrome title={`Category · ${id}`}>
      <SopMeta label="Food / Offers / Business / Lifestyle / Education / Local slices with ads suggestions per category (simulated)." />
      <Image source={{uri: MOCK_POST.image}} style={{width: '100%', aspectRatio: 1, borderRadius: 12}} />
      <Text style={{color: palette.foreground, marginTop: 12, fontWeight: '800'}}>{MOCK_POST.user}</Text>
    </SopChrome>
  );
}

export {PostDetailScreen} from '../../PostDetailScreen';

export {CommentsScreen} from '../../CommentsScreen';

export function ShareSendScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppStackParamList, 'ShareSend'>>();
  const {palette} = useTheme();
  const {dbUser} = useAuth();
  const {openThreadForUser} = useMessaging();
  const {postId} = route.params;
  const postLink = getShareUrl({kind: 'post', id: postId});

  const [following, setFollowing] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!dbUser?._id) { setLoading(false); return; }
    getFollowing(dbUser._id, 1)
      .then(res => setFollowing(res.users))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dbUser?._id]);

  const sendDm = useCallback(async (user: SuggestedUser) => {
    setSent(prev => new Set(prev).add(user._id));
    try {
      const convId = await openThreadForUser(
        user._id,
        user.displayName,
        user.profilePicture ?? '',
        user.username,
      );
      parentNavigate(navigation, 'MessagesFlow', {
        screen: 'ChatThread',
        params: {peerId: convId, sharePostId: postId},
      });
    } catch {
      parentNavigate(navigation, 'MessagesFlow');
    }
  }, [navigation, postId, openThreadForUser]);

  const shareOther = useCallback(async () => {
    try {
      await Share.share({message: postLink, url: postLink, title: 'Check this out on BROMO'});
    } catch {}
  }, [postLink]);

  const copyLink = useCallback(async () => {
    try {
      const Clipboard = require('@react-native-clipboard/clipboard').default;
      Clipboard.setString(postLink);
      Alert.alert('Link copied!');
    } catch {
      // clipboard not available, fallback
      await Share.share({message: postLink});
    }
  }, [postLink]);

  return (
    <View style={{flex: 1, backgroundColor: palette.background}}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: palette.border,
      }}>
        <Text style={{flex: 1, color: palette.foreground, fontSize: 18, fontWeight: '900'}}>Share</Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={{color: palette.primary, fontSize: 14, fontWeight: '700'}}>Done</Text>
        </Pressable>
      </View>

      {/* Quick actions */}
      <View style={{flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 20, borderBottomWidth: 1, borderBottomColor: palette.border}}>
        <TouchableOpacity onPress={copyLink} style={{alignItems: 'center', gap: 6}}>
          <View style={{width: 52, height: 52, borderRadius: 26, backgroundColor: palette.input, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border}}>
            <Link size={22} color={palette.foreground} />
          </View>
          <Text style={{color: palette.mutedForeground, fontSize: 11, fontWeight: '600'}}>Copy link</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={shareOther} style={{alignItems: 'center', gap: 6}}>
          <View style={{width: 52, height: 52, borderRadius: 26, backgroundColor: palette.input, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border}}>
            <MoreHorizontal size={22} color={palette.foreground} />
          </View>
          <Text style={{color: palette.mutedForeground, fontSize: 11, fontWeight: '600'}}>More</Text>
        </TouchableOpacity>
      </View>

      {/* Send to followers */}
      <Text style={{color: palette.mutedForeground, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8}}>
        SEND TO
      </Text>

      {loading ? (
        <ActivityIndicator color={palette.primary} style={{marginTop: 24}} />
      ) : following.length === 0 ? (
        <View style={{paddingTop: 40, alignItems: 'center'}}>
          <Users size={36} color={palette.mutedForeground} strokeWidth={1.5} />
          <Text style={{color: palette.mutedForeground, marginTop: 12, fontSize: 14}}>Follow people to send posts</Text>
        </View>
      ) : (
        <FlatList
          data={following}
          keyExtractor={u => u._id}
          contentContainerStyle={{paddingHorizontal: 16, paddingBottom: 24}}
          renderItem={({item}) => {
            const isSent = sent.has(item._id);
            const avatar = item.profilePicture || `https://ui-avatars.com/api/?name=${item.displayName}`;
            return (
              <Pressable
                onPress={() => !isSent && sendDm(item)}
                style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12}}>
                <Image source={{uri: avatar}} style={{width: 50, height: 50, borderRadius: 25}} />
                <View style={{flex: 1}}>
                  <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 15}}>{item.displayName}</Text>
                  <Text style={{color: palette.mutedForeground, fontSize: 13}}>@{item.username}</Text>
                </View>
                <Pressable
                  onPress={() => !isSent && sendDm(item)}
                  style={{
                    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8,
                    backgroundColor: isSent ? palette.input : palette.primary,
                    borderWidth: 1, borderColor: isSent ? palette.border : palette.primary,
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                  }}>
                  {isSent && <Check size={12} color={palette.mutedForeground} />}
                  <Text style={{color: isSent ? palette.mutedForeground : palette.primaryForeground, fontWeight: '800', fontSize: 13}}>
                    {isSent ? 'Sent' : 'Send'}
                  </Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

export {StoryViewScreen} from '../../StoryViewScreen';

export function SearchResultsScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'SearchResults'>>();
  const navigation = useNavigation<Nav>();
  const q = route.params.query;
  return (
    <SopChrome title={`“${q}”`}>
      <SopMeta label="Tabs: Users · Posts · Stores · Hashtags" />
      <SopRow title="Users" sub="3 matches" />
      <SopRow title="Posts" sub="12 matches" onPress={() => navigation.navigate('PostDetail', {postId: '1'})} />
      <SopRow title="Stores" sub="2 nearby" onPress={() => navigation.navigate('StoreProfile', {storeId: 's1'})} />
      <SopRow title="#maharashtra" onPress={() => navigation.navigate('HashtagDetail', {tag: 'maharashtra'})} />
    </SopChrome>
  );
}

export function HashtagDetailScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'HashtagDetail'>>();
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getHashtagPosts(route.params.tag, 1)
      .then(res => {
        if (alive) setPosts(res.posts);
      })
      .catch(() => {
        if (alive) setPosts([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [route.params.tag]);

  return (
    <SopChrome title={`#${route.params.tag}`}>
      <SopMeta label={`${posts.length} posts and videos under this hashtag.`} />
      {loading ? (
        <ActivityIndicator color={palette.primary} />
      ) : posts.length === 0 ? (
        <Text style={{color: palette.mutedForeground}}>No posts found for this hashtag.</Text>
      ) : (
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 3}}>
          {posts.map(post => (
            <Pressable
              key={post._id}
              onPress={() => {
                if (post.type === 'reel' || post.mediaType === 'video') {
                  parentNavigate(navigation, 'Reels', {initialPostId: post._id});
                } else {
                  navigation.navigate('PostDetail', {postId: post._id, initialPost: post});
                }
              }}
              style={{width: '32.8%', aspectRatio: 1, borderRadius: 6, overflow: 'hidden', backgroundColor: palette.input}}>
              <ProfileGridMedia post={post} style={{width: '100%', height: '100%'}} />
            </Pressable>
          ))}
        </View>
      )}
    </SopChrome>
  );
}

export function NearbyPeopleScreen() {
  const {palette} = useTheme();
  const [rows, setRows] = useState<Array<SuggestedUser & {distanceMeters?: number}>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        updateMyLocation(lat, lng).catch(() => null);
        getNearbyUsers(lat, lng)
          .then(res => setRows(res.users))
          .catch(() => setRows([]))
          .finally(() => setLoading(false));
      },
      () => setLoading(false),
      {enableHighAccuracy: true, timeout: 12000, maximumAge: 60000},
    );
  }, []);

  return (
    <SopChrome title="Nearby people">
      <SopMeta label="GPS-based discovery using your current high-accuracy location." />
      {loading ? <ActivityIndicator color={palette.primary} /> : null}
      {!loading && rows.length === 0 ? <Text style={{color: palette.mutedForeground}}>No nearby users found.</Text> : null}
      {rows.map(r => (
        <View key={r._id} style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
            <Image source={{uri: r.profilePicture || `https://ui-avatars.com/api/?name=${r.displayName}`}} style={{width: 42, height: 42, borderRadius: 21}} />
            <View>
              <Text style={{color: palette.foreground, fontWeight: '800'}}>{r.displayName}</Text>
              <Text style={{color: palette.mutedForeground, fontSize: 12}}>
                @{r.username} {r.distanceMeters ? `· ${(r.distanceMeters / 1000).toFixed(1)}km` : ''}
              </Text>
            </View>
          </View>
          <PrimaryButton label="Follow" onPress={() => followUser(r._id, {kind: 'discover'}).catch(() => null)} />
        </View>
      ))}
    </SopChrome>
  );
}

export function ExploreHomeScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Explore">
      <SopMeta label="Search, trending, stores, categories — SOP explore hub." />
      <SopRow title="Trending now" onPress={() => navigation.navigate('SearchResults', {query: 'trending'})} />
      <SopRow title="Stores near you" onPress={() => navigation.navigate('StoreNearbyHome')} />
      <SopRow title="People nearby" onPress={() => navigation.navigate('NearbyPeople')} />
      <SopRow title="Search" sub="Open results" onPress={() => navigation.navigate('SearchResults', {query: 'bromo'})} />
    </SopChrome>
  );
}

export function FilterEffectsScreen() {
  return (
    <SopChrome title="Filters & effects">
      <SopMeta label="AR filters & aesthetic pack selector; assets managed via admin theme / feature flags in production." />
      <SopRow title="Glow" />
      <SopRow title="Local Pulse duotone" />
      <SopRow title="Vintage film" />
    </SopChrome>
  );
}

export function CloseFriendsPickerScreen() {
  return (
    <SopChrome title="Close friends">
      <SopMeta label="Choose audience for story; suggestions from interaction graph (mock list)." />
      <SopRow title="priya_vibes" sub="Close friend" />
      <SopRow title="tech_marathi" />
    </SopChrome>
  );
}

export function MusicPickerScreen() {
  const route = useRoute();
  const mode = (route.params as {mode?: 'reel' | 'story' | 'post'} | undefined)?.mode ?? 'reel';
  const navigation = useNavigation();
  const {palette} = useTheme();
  const [query, setQuery] = useState('');
  const {tracks, loading} = useAudioPickerTracks(true, query);

  return (
    <SopChrome title="Music / audio">
      <SopMeta label={`Pick track for ${mode}. Trending songs and creator original audio.`} />
      <Text style={{color: palette.foreground, fontSize: 12, fontWeight: '800', marginBottom: 6}}>Search audio</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search song or original audio"
        placeholderTextColor={palette.mutedForeground}
        style={{
          color: palette.foreground,
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 12,
        }}
      />
      {loading ? <ActivityIndicator color={palette.primary} /> : null}
      {tracks.map(track => (
        <SopRow
          key={`${track.id}-${track.originalAudioId ?? track.musicTrackId ?? ''}`}
          title={track.title}
          sub={
            track.originalAudioId
              ? `Original · ${track.artist}`
              : track.musicTrackId
              ? `Licensed · ${track.artist}`
              : track.artist
          }
          onPress={() => {
            if (track.originalAudioId) {
              parentNavigate(navigation, 'CreateFlow', {
                mode: 'reel',
                bootstrapTs: Date.now(),
                preselectedAudioId: track.originalAudioId,
              });
            } else {
              parentNavigate(navigation, 'CreateFlow', {
                mode: mode === 'story' ? 'story' : 'reel',
                bootstrapTs: Date.now(),
              });
            }
          }}
        />
      ))}
    </SopChrome>
  );
}

export function VideoTrimScreen() {
  const route = useRoute();
  const uri = (route.params as {uri?: string} | undefined)?.uri ?? 'file://clip';
  return (
    <SopChrome title="Trim video">
      <SopMeta label={`Timeline trim for reel/post — source ${uri.slice(0, 32)}…`} />
      <PrimaryButton label="Save trim" onPress={() => Alert.alert('Trim', 'Duration saved (simulated).')} />
    </SopChrome>
  );
}

export function CollaborationInviteScreen() {
  return (
    <SopChrome title="Collaboration">
      <SopMeta label="Invite co-creator; post appears on both profiles after accept (Instagram collab-style)." />
      <SopRow title="Invite @tech_marathi" />
      <SopRow title="Pending invites" sub="None" />
    </SopChrome>
  );
}

export function ReuseAudioScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'ReuseAudio'>>();
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Use this audio">
      <SopMeta label={`Audio ${route.params.audioId} — opens create reel with attribution to original creator.`} />
      <PrimaryButton
        label="Create reel"
        onPress={() => parentNavigate(navigation, 'CreateFlow', {mode: 'reel'})}
      />
    </SopChrome>
  );
}
