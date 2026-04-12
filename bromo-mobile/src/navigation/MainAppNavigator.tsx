import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {TabNavigator} from './TabNavigator';
import {CreateStackNavigator} from './CreateStackNavigator';
import {MessagesStackNavigator} from './MessagesStackNavigator';
import {ProfileScreen} from '../screens/ProfileScreen';
import type {AppStackParamList} from './appStackParamList';
import {useAuth} from '../context/AuthContext';
import {MessagingProvider} from '../messaging/MessagingContext';
import {
  AboutAppScreen,
  AccountSettingsScreen,
  HelpSupportScreen,
  PrivacyPolicyScreen,
  PrivacySettingsScreen,
  SecuritySettingsScreen,
  SettingsMainScreen,
  TermsScreen,
} from '../screens/sop/bundles/settingsBundle';
import {
  CategoryFeedScreen,
  CloseFriendsPickerScreen,
  CollaborationInviteScreen,
  CommentsScreen,
  ExploreHomeScreen,
  FilterEffectsScreen,
  HashtagDetailScreen,
  MusicPickerScreen,
  NearbyPeopleScreen,
  PostDetailScreen,
  ReuseAudioScreen,
  SearchResultsScreen,
  ShareSendScreen,
  StoryViewScreen,
  VideoTrimScreen,
} from '../screens/sop/bundles/feedExploreBundle';
import {
  AdCampaignDetailScreen,
  AdEarningsScreen,
  CreateAdStep1Screen,
  CreateAdStep2Screen,
  CreateAdStep3Screen,
  AdPaymentScreen,
  MyAdsDashboardScreen,
  CreateStoreOfferScreen,
  MyStoreDashboardScreen,
  NotificationHistory3kmScreen,
  OfferRedemptionScreen,
  RedemptionSuccessScreen,
  StoreCoinSettingsScreen,
  StoreDiscountScreen,
  StoreMenuScreen,
  StoreNearbyHomeScreen,
  StoreProfileScreen,
  StoreReachDetailScreen,
  StoreRegistrationScreen,
  StoreSubscriptionPlansScreen,
  StoreWebShareScreen,
} from '../screens/sop/bundles/storeAdsBundle';
import {
  AudioDetailScreen,
  AutoDmScreen,
  CallHistoryScreen,
  ContentInsightsScreen,
  CreatorDashboardScreen,
  EditProfileScreen,
  FollowersFollowingScreen,
  ManageContentScreen,
  MusicLibraryScreen,
  NotificationsScreen,
  NotificationSettingsScreen,
  OtherUserProfileScreen,
  PointsWalletScreen,
  ReferralDashboardScreen,
  SavedPostsScreen,
  ShareProfileScreen,
  TransactionHistoryScreen,
  VideoCallScreen,
  VoiceCallScreen,
  WatchHistoryScreen,
} from '../screens/sop/bundles/profileNotifCallMusicBundle';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function MainAppNavigator() {
  const {dbUser} = useAuth();
  return (
    <MessagingProvider myDbUserId={dbUser?._id ?? null}>
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen
        name="CreateFlow"
        component={CreateStackNavigator}
        options={{presentation: 'fullScreenModal', animation: 'slide_from_bottom'}}
      />
      <Stack.Screen
        name="MessagesFlow"
        component={MessagesStackNavigator}
        options={{presentation: 'fullScreenModal', animation: 'slide_from_right'}}
      />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="CategoryFeed" component={CategoryFeedScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="Comments" component={CommentsScreen} />
      <Stack.Screen name="ShareSend" component={ShareSendScreen} />
      <Stack.Screen name="StoryView" component={StoryViewScreen} />
      <Stack.Screen name="SearchResults" component={SearchResultsScreen} />
      <Stack.Screen name="HashtagDetail" component={HashtagDetailScreen} />
      <Stack.Screen name="NearbyPeople" component={NearbyPeopleScreen} />
      <Stack.Screen name="ExploreHome" component={ExploreHomeScreen} />
      <Stack.Screen name="FilterEffects" component={FilterEffectsScreen} />
      <Stack.Screen name="CloseFriendsPicker" component={CloseFriendsPickerScreen} />
      <Stack.Screen name="MusicPicker" component={MusicPickerScreen} />
      <Stack.Screen name="VideoTrim" component={VideoTrimScreen} />
      <Stack.Screen name="CollaborationInvite" component={CollaborationInviteScreen} />
      <Stack.Screen name="ReuseAudio" component={ReuseAudioScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="SettingsMain" component={SettingsMainScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
      <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen name="AboutApp" component={AboutAppScreen} />
      <Stack.Screen name="StoreNearbyHome" component={StoreNearbyHomeScreen} />
      <Stack.Screen name="StoreProfile" component={StoreProfileScreen} />
      <Stack.Screen name="StoreDiscount" component={StoreDiscountScreen} />
      <Stack.Screen name="OfferRedemption" component={OfferRedemptionScreen} />
      <Stack.Screen name="RedemptionSuccess" component={RedemptionSuccessScreen} />
      <Stack.Screen name="StoreRegistration" component={StoreRegistrationScreen} />
      <Stack.Screen name="StoreSubscriptionPlans" component={StoreSubscriptionPlansScreen} />
      <Stack.Screen name="MyStoreDashboard" component={MyStoreDashboardScreen} />
      <Stack.Screen name="CreateStoreOffer" component={CreateStoreOfferScreen} />
      <Stack.Screen name="NotificationHistory3km" component={NotificationHistory3kmScreen} />
      <Stack.Screen name="StoreMenu" component={StoreMenuScreen} />
      <Stack.Screen name="StoreWebShare" component={StoreWebShareScreen} />
      <Stack.Screen name="StoreReachDetail" component={StoreReachDetailScreen} />
      <Stack.Screen name="StoreCoinSettings" component={StoreCoinSettingsScreen} />
      <Stack.Screen name="CreateAdStep1" component={CreateAdStep1Screen} />
      <Stack.Screen name="CreateAdStep2" component={CreateAdStep2Screen} />
      <Stack.Screen name="CreateAdStep3" component={CreateAdStep3Screen} />
      <Stack.Screen name="AdPayment" component={AdPaymentScreen} />
      <Stack.Screen name="MyAdsDashboard" component={MyAdsDashboardScreen} />
      <Stack.Screen name="AdCampaignDetail" component={AdCampaignDetailScreen} />
      <Stack.Screen name="AdEarnings" component={AdEarningsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="OtherUserProfile" component={OtherUserProfileScreen} />
      <Stack.Screen name="ShareProfile" component={ShareProfileScreen} />
      <Stack.Screen name="FollowersFollowing" component={FollowersFollowingScreen} />
      <Stack.Screen name="PointsWallet" component={PointsWalletScreen} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
      <Stack.Screen name="SavedPosts" component={SavedPostsScreen} />
      <Stack.Screen name="WatchHistory" component={WatchHistoryScreen} />
      <Stack.Screen name="ManageContent" component={ManageContentScreen} />
      <Stack.Screen name="ContentInsights" component={ContentInsightsScreen} />
      <Stack.Screen name="CreatorDashboard" component={CreatorDashboardScreen} />
      <Stack.Screen name="ReferralDashboard" component={ReferralDashboardScreen} />
      <Stack.Screen name="VoiceCall" component={VoiceCallScreen} />
      <Stack.Screen name="VideoCall" component={VideoCallScreen} />
      <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
      <Stack.Screen name="MusicLibrary" component={MusicLibraryScreen} />
      <Stack.Screen name="AudioDetail" component={AudioDetailScreen} />
      <Stack.Screen name="AutoDm" component={AutoDmScreen} />
    </Stack.Navigator>
    </MessagingProvider>
  );
}
