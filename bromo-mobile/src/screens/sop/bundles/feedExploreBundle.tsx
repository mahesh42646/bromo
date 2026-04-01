import React from 'react';
import {Alert, Image, Pressable, Share, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {Heart, MessageCircle, Play, Send, Users} from 'lucide-react-native';
import {useTheme} from '../../../context/ThemeContext';
import type {AppStackParamList} from '../../../navigation/appStackParamList';
import {SopChrome, SopMeta, SopRow} from '../ui/SopChrome';
import {PrimaryButton} from '../../../components/ui/PrimaryButton';
import {parentNavigate} from '../../../navigation/parentNavigate';

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

export function PostDetailScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'PostDetail'>>();
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  return (
    <SopChrome title="Post">
      <SopMeta label={`Post ${route.params.postId} — likes, comments, share.`} />
      <Image source={{uri: MOCK_POST.image}} style={{width: '100%', aspectRatio: 1, borderRadius: 12}} />
      <View style={{flexDirection: 'row', gap: 20, marginTop: 12}}>
        <Pressable style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          <Heart size={22} color={palette.foreground} />
          <Text style={{color: palette.foreground}}>{MOCK_POST.likes}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Comments', {postId: route.params.postId})} style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          <MessageCircle size={22} color={palette.foreground} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('ShareSend', {postId: route.params.postId})}>
          <Send size={22} color={palette.foreground} />
        </Pressable>
      </View>
    </SopChrome>
  );
}

export function CommentsScreen() {
  const {palette} = useTheme();
  const items = [
    {id: '1', u: 'priya_vibes', t: 'So good 🔥'},
    {id: '2', u: 'tech_marathi', t: 'Replying to @priya_vibes — agree!', reply: true},
  ];
  return (
    <SopChrome title="Comments">
      <SopMeta label="Nested comments, like replies, delete own — UI mock." />
      {items.map(c => (
        <View key={c.id} style={{marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: palette.border}}>
          <Text style={{color: palette.primary, fontWeight: '800'}}>@{c.u}</Text>
          <Text style={{color: palette.foreground, marginTop: 4}}>{c.t}</Text>
        </View>
      ))}
    </SopChrome>
  );
}

export function ShareSendScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'ShareSend'>>();
  const {palette} = useTheme();
  return (
    <SopChrome title="Share / Send">
      <SopMeta label={`Share post ${route.params.postId} to DM, other apps, or copy link (simulated).`} />
      <SopRow title="Send in DM" onPress={() => Alert.alert('DM', 'Opens composer to selected thread.')} />
      <SopRow title="Copy link" onPress={() => Share.share({message: 'https://bromo.app/p/demo'})} />
      <SopRow title="Other apps…" />
    </SopChrome>
  );
}

export function StoryViewScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'StoryView'>>();
  const {palette} = useTheme();
  return (
    <SopChrome title="Story" scroll={false}>
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111'}}>
        <Text style={{color: '#fff', fontWeight: '800'}}>@{route.params.userId}</Text>
        <Text style={{color: palette.mutedForeground, marginTop: 8}}>24h story — full-screen (simulated)</Text>
        <Play size={48} color="#fff" style={{marginTop: 24}} />
      </View>
    </SopChrome>
  );
}

export function SearchResultsScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'SearchResults'>>();
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
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
  const {palette} = useTheme();
  return (
    <SopChrome title={`#${route.params.tag}`}>
      <SopMeta label="Hashtag / category landing — grid of posts (mock)." />
      <Image source={{uri: MOCK_POST.image}} style={{width: '100%', height: 200, borderRadius: 12}} />
    </SopChrome>
  );
}

export function NearbyPeopleScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const rows = [
    {id: 'u1', name: 'Neha', mutual: '4 mutual'},
    {id: 'u2', name: 'Vikram', mutual: 'GPS 0.4km'},
  ];
  return (
    <SopChrome title="Nearby people">
      <SopMeta label="GPS-based discovery & friend suggestions; follow in one tap." />
      {rows.map(r => (
        <View key={r.id} style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
            <Users size={20} color={palette.primary} />
            <View>
              <Text style={{color: palette.foreground, fontWeight: '800'}}>{r.name}</Text>
              <Text style={{color: palette.mutedForeground, fontSize: 12}}>{r.mutual}</Text>
            </View>
          </View>
          <PrimaryButton label="Follow" onPress={() => Alert.alert('Follow', `Following ${r.name}`)} />
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
  return (
    <SopChrome title="Music / audio">
      <SopMeta label={`Pick track for ${mode}. Trending + library.`} />
      <SopRow
        title="Original · Marathi Beats"
        onPress={() => parentNavigate(navigation, 'AudioDetail', {trackId: 't1'})}
      />
      <SopRow title="Trending club mix" />
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
      <PrimaryButton label="Create reel" onPress={() => parentNavigate(navigation, 'CreateFlow')} />
    </SopChrome>
  );
}
