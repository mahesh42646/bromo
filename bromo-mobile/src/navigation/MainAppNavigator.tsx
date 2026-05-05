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
import {WalletScreen} from '../screens/WalletScreen';
import {PromoteCampaignScreen} from '../screens/promotions/PromoteCampaignScreen';
import {MyCampaignsScreen} from '../screens/promotions/MyCampaignsScreen';
import {CampaignAnalyticsScreen} from '../screens/promotions/CampaignAnalyticsScreen';
import {ProfessionalHubScreen} from '../screens/ProfessionalHubScreen';
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
import {CreateStoreScreen} from '../screens/store/CreateStoreScreen';
import {MyStoreDashboardScreen as ManageStoreScreen} from '../screens/store/MyStoreDashboardScreen';
import {StorePublicProfileScreen} from '../screens/store/StorePublicProfileScreen';
import {RedemptionScannerScreen} from '../screens/store/RedemptionScannerScreen';
import {LiveWatchScreen} from '../screens/LiveWatchScreen';
import {StoreProductDetailScreen} from '../screens/store/StoreProductDetailScreen';
import {AllStoresScreen} from '../screens/store/AllStoresScreen';
import {AddProductScreen} from '../screens/store/AddProductScreen';
import {CollabInboxScreen} from '../screens/CollabInboxScreen';
import {AudioDetailScreen} from '../screens/AudioDetailScreen';
import {
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
      <Stack.Screen
        name="Comments"
        component={CommentsScreen}
        options={{
          presentation: 'transparentModal',
          animation: 'slide_from_bottom',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="ShareSend"
        component={ShareSendScreen}
        options={{presentation: 'modal', animation: 'slide_from_bottom'}}
      />
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
      {/* ── New real store screens ── */}
      <Stack.Screen name="CreateStore" component={CreateStoreScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="ManageStore" component={ManageStoreScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="StorePublicProfile" component={StorePublicProfileScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="RedemptionScanner" component={RedemptionScannerScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="LiveWatch" component={LiveWatchScreen} options={{animation: 'fade'}} />
      <Stack.Screen name="StoreProductDetail" component={StoreProductDetailScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="AllStores" component={AllStoresScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="AddProduct" component={AddProductScreen} options={{animation: 'slide_from_bottom', presentation: 'modal'}} />
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
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
      <Stack.Screen name="SavedPosts" component={SavedPostsScreen} />
      <Stack.Screen name="WatchHistory" component={WatchHistoryScreen} />
      <Stack.Screen name="ManageContent" component={ManageContentScreen} />
      <Stack.Screen name="ContentInsights" component={ContentInsightsScreen} />
      <Stack.Screen name="ProfessionalHub" component={ProfessionalHubScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="CreatorDashboard" component={CreatorDashboardScreen} />
      <Stack.Screen name="CollabInbox" component={CollabInboxScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="ReferralDashboard" component={ReferralDashboardScreen} />
      <Stack.Screen name="VoiceCall" component={VoiceCallScreen} />
      <Stack.Screen name="VideoCall" component={VideoCallScreen} />
      <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
      <Stack.Screen name="MusicLibrary" component={MusicLibraryScreen} />
      <Stack.Screen name="AudioDetail" component={AudioDetailScreen} />
      <Stack.Screen name="AutoDm" component={AutoDmScreen} />
      {/* Wallet & Promotions */}
      <Stack.Screen name="PointsWallet" component={WalletScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="PromoteCampaign" component={PromoteCampaignScreen} options={{animation: 'slide_from_bottom', presentation: 'modal'}} />
      <Stack.Screen name="MyCampaigns" component={MyCampaignsScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="CampaignAnalytics" component={CampaignAnalyticsScreen} options={{animation: 'slide_from_right'}} />
    </Stack.Navigator>
    </MessagingProvider>
  );
}
