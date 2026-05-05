import type {NavigatorScreenParams} from '@react-navigation/native';
import type {CreateStackParamList} from './CreateStackNavigator';
import type {MessagesStackParamList} from './MessagesStackNavigator';

/** Bottom tabs inside `Main`. */
export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Reels: {initialPostId?: string} | undefined;
  Store: undefined;
  Profile: {openSettings?: boolean} | undefined;
};

/** Screens registered on the main app stack (post-login). */
export type AppStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  CreateFlow: NavigatorScreenParams<CreateStackParamList> | undefined;
  MessagesFlow: NavigatorScreenParams<MessagesStackParamList> | undefined;
  Profile: {openSettings?: boolean} | undefined;

  CategoryFeed: {categoryId: string};
  PostDetail: {postId: string; initialPost?: import('../api/postsApi').Post};
  Comments: {postId: string};
  ShareSend: {postId: string};
  StoryView: {userId?: string; storyId?: string};
  SearchResults: {query: string};
  HashtagDetail: {tag: string};
  NearbyPeople: undefined;
  ExploreHome: undefined;

  FilterEffects: undefined;
  CloseFriendsPicker: undefined;
  MusicPicker: {mode: 'reel' | 'story' | 'post'};
  VideoTrim: {uri: string};
  CollaborationInvite: undefined;
  ReuseAudio: {audioId: string};

  Notifications: undefined;
  NotificationSettings: undefined;

  SettingsMain: undefined;
  AccountSettings: undefined;
  PrivacySettings: undefined;
  SecuritySettings: undefined;
  Terms: undefined;
  PrivacyPolicy: undefined;
  HelpSupport: undefined;
  AboutApp: undefined;

  StoreNearbyHome: undefined;
  StoreProfile: {storeId: string};
  StoreDiscount: {storeId: string};
  OfferRedemption: {storeId: string; offerId: string};
  RedemptionSuccess: {txnId: string};
  StoreRegistration: undefined;
  StoreSubscriptionPlans: undefined;
  MyStoreDashboard: undefined;
  CreateStoreOffer: undefined;
  NotificationHistory3km: undefined;
  StoreMenu: {storeId: string};
  StoreWebShare: {storeId: string};
  StoreReachDetail: {storeId: string};
  StoreCoinSettings: {storeId: string};
  // ── New real store system ──
  CreateStore: undefined;
  ManageStore: undefined;
  StorePublicProfile: {storeId: string};
  /** Owner scans customer redemption QR + enters OTP */
  RedemptionScanner: undefined;
  StoreProductDetail: {storeId: string; productId: string};
  AllStores: undefined;
  AddProduct: {storeId: string};

  CreateAdStep1: undefined;
  CreateAdStep2: undefined;
  CreateAdStep3: undefined;
  AdPayment: {campaignId: string};
  MyAdsDashboard: undefined;
  AdCampaignDetail: {campaignId: string};
  AdEarnings: undefined;

  EditProfile: undefined;
  OtherUserProfile: {userId?: string; username?: string};
  ShareProfile: undefined;
  FollowersFollowing: {tab: 'followers' | 'following'; userId: string};
  PointsWallet: undefined;
  TransactionHistory: undefined;
  SavedPosts: undefined;
  WatchHistory: undefined;
  ManageContent: undefined;
  ContentInsights: {focusPostId?: string} | undefined;
  ProfessionalHub: undefined;
  CreatorDashboard: undefined;
  CollabInbox: undefined;
  ReferralDashboard: undefined;

  /** Voice/video — `peerId` kept as conversation id for deep links; signaling uses `remoteUserId`. */
  VoiceCall: {
    peerId?: string;
    remoteUserId: string;
    peerName: string;
    direction: 'outgoing' | 'incoming';
    callId?: string;
    callerName?: string;
  };
  VideoCall: {
    peerId?: string;
    remoteUserId: string;
    peerName: string;
    direction: 'outgoing' | 'incoming';
    callId?: string;
    callerName?: string;
  };
  LiveWatch: {hlsUrl: string; title?: string; streamerName?: string};
  CallHistory: undefined;

  MusicLibrary: undefined;
  /** Original audio detail — pass `audioId`; `trackId` is legacy alias only. */
  AudioDetail: {audioId?: string; trackId?: string};

  AutoDm: undefined;

  // Wallet & Promotions
  PromoteCampaign: {contentId: string; contentType: 'post' | 'reel' | 'story'};
  MyCampaigns: undefined;
  CampaignAnalytics: {campaignId: string};
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  EmailVerification: {email: string; pendingUsername?: string};
  ForgotPassword: undefined;
  UsernameSetup: {displayName: string; pendingUsername?: string};
};
