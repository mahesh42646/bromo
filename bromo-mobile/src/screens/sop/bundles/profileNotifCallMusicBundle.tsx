import React, {useState} from 'react';
import {Alert, Pressable, Switch, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {Phone, Video as VideoIcon} from 'lucide-react-native';
import {useTheme} from '../../../context/ThemeContext';
import type {AppStackParamList} from '../../../navigation/appStackParamList';
import {PrimaryButton} from '../../../components/ui/PrimaryButton';
import {SopChrome, SopMeta, SopRow} from '../ui/SopChrome';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function EditProfileScreen() {
  return (
    <SopChrome title="Edit profile">
      <SopMeta label="Name, mandatory username, bio, avatar, website — persisted locally in demo." />
      <SopRow title="Profile photo" />
      <SopRow title="Username" sub="@bromo_user" />
    </SopChrome>
  );
}

export function OtherUserProfileScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'OtherUserProfile'>>();
  return (
    <SopChrome title="Profile">
      <SopMeta label={`User ${route.params.userId} — follow, message, collab`} />
    </SopChrome>
  );
}

export function ShareProfileScreen() {
  return (
    <SopChrome title="Share profile">
      <SopMeta label="Shareable bromo.me link + QR; share sheet to other apps." />
      <SopRow title="Show QR" />
    </SopChrome>
  );
}

export function FollowersFollowingScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'FollowersFollowing'>>();
  return (
    <SopChrome title={route.params.tab === 'followers' ? 'Followers' : 'Following'}>
      <SopMeta label={`User ${route.params.userId}`} />
      <SopRow title="priya_vibes" />
      <SopRow title="tech_marathi" />
    </SopChrome>
  );
}

export function PointsWalletScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Points wallet">
      <SopMeta label="Earn → spend → redeem; coins convert to ad credits (simulated)." />
      <SopRow title="Transaction history" onPress={() => navigation.navigate('TransactionHistory')} />
    </SopChrome>
  );
}

export function TransactionHistoryScreen() {
  return (
    <SopChrome title="Transactions">
      <SopRow title="Watch reward +12" sub="Today" />
      <SopRow title="Store redemption −80 coins" sub="Yesterday" />
    </SopChrome>
  );
}

export function SavedPostsScreen() {
  return (
    <SopChrome title="Saved posts">
      <SopMeta label="Bookmarked feed & reels." />
    </SopChrome>
  );
}

export function WatchHistoryScreen() {
  return (
    <SopChrome title="Watch history">
      <SopMeta label="Reels watched for rewards accounting." />
    </SopChrome>
  );
}

export function ManageContentScreen() {
  return (
    <SopChrome title="Manage content">
      <SopRow title="Archive" />
      <SopRow title="Insights per post" />
    </SopChrome>
  );
}

export function ContentInsightsScreen() {
  return (
    <SopChrome title="Content insights">
      <SopMeta label="Reach, profile visits, link taps." />
    </SopChrome>
  );
}

export function CreatorDashboardScreen() {
  return (
    <SopChrome title="Creator dashboard">
      <SopMeta label="Growth, top reels, affiliate products performance." />
    </SopChrome>
  );
}

export function ReferralDashboardScreen() {
  return (
    <SopChrome title="Referrals">
      <SopMeta label="Invite friends — milestones & rewards." />
    </SopChrome>
  );
}

export function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const {palette} = useTheme();
  return (
    <SopChrome title="Notifications">
      <View style={{flexDirection: 'row', gap: 8, marginBottom: 16}}>
        {(['all', 'unread'] as const).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: tab === t ? palette.primary : palette.input,
            }}>
            <Text style={{color: tab === t ? palette.primaryForeground : palette.foreground, fontWeight: '800'}}>
              {t === 'all' ? 'All' : 'Unread'}
            </Text>
          </Pressable>
        ))}
      </View>
      <SopRow title="Auto DM: Welcome to BROMO 🎉" sub="Triggered on signup" onPress={() => navigation.navigate('AutoDm')} />
      <SopRow title="3KM: Flash sale at Coffee Republic" />
      <SopMeta label="Mark-as-read simulated via viewing list." />
    </SopChrome>
  );
}

export function NotificationSettingsScreen() {
  const {palette} = useTheme();
  const [push, setPush] = useState(true);
  return (
    <SopChrome title="Notification settings">
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <Text style={{color: palette.foreground}}>Push notifications</Text>
        <Switch value={push} onValueChange={setPush} />
      </View>
    </SopChrome>
  );
}

export function VoiceCallScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'VoiceCall'>>();
  const {palette} = useTheme();
  return (
    <SopChrome title="Voice call" scroll={false}>
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20}}>
        <Phone size={64} color={palette.primary} />
        <Text style={{fontWeight: '800', color: palette.foreground, fontSize: 18}}>{route.params.peerName}</Text>
        <Text style={{color: palette.mutedForeground}}>Ringing...</Text>
        <PrimaryButton label="End call" onPress={() => Alert.alert('Call ended')} variant="outline" />
      </View>
    </SopChrome>
  );
}

export function VideoCallScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'VideoCall'>>();
  const {palette} = useTheme();
  return (
    <SopChrome title="Video call" scroll={false}>
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20}}>
        <VideoIcon size={64} color={palette.primary} />
        <Text style={{fontWeight: '800', color: palette.foreground, fontSize: 18}}>{route.params.peerName}</Text>
        <Text style={{color: palette.mutedForeground}}>Connecting video...</Text>
        <PrimaryButton label="End call" onPress={() => Alert.alert('Call ended')} variant="outline" />
      </View>
    </SopChrome>
  );
}

export function AutoDmScreen() {
  const {palette} = useTheme();
  return (
    <SopChrome title="Auto DM">
      <SopMeta label="Admin-triggered automated messages sent on events like signup, store promotions, or event alerts." />
      <View style={{gap: 12}}>
        <View style={{padding: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: `${palette.primary}08`}}>
          <Text style={{color: palette.primary, fontWeight: '800', marginBottom: 4}}>Welcome message</Text>
          <Text style={{color: palette.foreground}}>Welcome to BROMO! Start exploring stores and earn points by watching reels.</Text>
          <Text style={{color: palette.mutedForeground, fontSize: 11, marginTop: 6}}>Trigger: On signup</Text>
        </View>
        <View style={{padding: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: `${palette.primary}08`}}>
          <Text style={{color: palette.primary, fontWeight: '800', marginBottom: 4}}>Store promotion</Text>
          <Text style={{color: palette.foreground}}>Flash sale at Coffee Republic — 50% off today only!</Text>
          <Text style={{color: palette.mutedForeground, fontSize: 11, marginTop: 6}}>Trigger: 3KM proximity</Text>
        </View>
        <View style={{padding: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: `${palette.primary}08`}}>
          <Text style={{color: palette.primary, fontWeight: '800', marginBottom: 4}}>Event alert</Text>
          <Text style={{color: palette.foreground}}>New music release — trending audio in your city. Use it in your next reel!</Text>
          <Text style={{color: palette.mutedForeground, fontSize: 11, marginTop: 6}}>Trigger: Admin broadcast</Text>
        </View>
      </View>
    </SopChrome>
  );
}

export function CallHistoryScreen() {
  return (
    <SopChrome title="Call history">
      <SopRow title="Missed · priya_vibes" />
      <SopRow title="Outgoing · tech_marathi" />
    </SopChrome>
  );
}

export function MusicLibraryScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Music library">
      <SopMeta label="Mood/category browse; admin-managed catalogue." />
      <SopRow title="Trending" onPress={() => navigation.navigate('AudioDetail', {trackId: 'trend1'})} />
      <SopRow title="Regional" />
    </SopChrome>
  );
}

export function AudioDetailScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'AudioDetail'>>();
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Track">
      <SopMeta label={`${route.params.trackId} — reels using audio; credit original creator.`} />
      <PrimaryButton
        label="Use for reel"
        onPress={() => navigation.navigate('ReuseAudio', {audioId: route.params.trackId})}
      />
    </SopChrome>
  );
}
