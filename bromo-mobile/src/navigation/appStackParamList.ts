/** Screens registered on the main app stack (post-login). */
export type AppStackParamList = {
  Main: undefined;
  CreateFlow: undefined;
  MessagesFlow: undefined;
  Profile: undefined;

  CategoryFeed: {categoryId: string};
  PostDetail: {postId: string};
  Comments: {postId: string};
  ShareSend: {postId: string};
  StoryView: {userId: string};
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

  CreateAdStep1: undefined;
  CreateAdStep2: undefined;
  CreateAdStep3: undefined;
  AdPayment: {campaignId: string};
  MyAdsDashboard: undefined;
  AdCampaignDetail: {campaignId: string};
  AdEarnings: undefined;

  EditProfile: undefined;
  OtherUserProfile: {userId: string};
  ShareProfile: undefined;
  FollowersFollowing: {tab: 'followers' | 'following'; userId: string};
  PointsWallet: undefined;
  TransactionHistory: undefined;
  SavedPosts: undefined;
  WatchHistory: undefined;
  ManageContent: undefined;
  ContentInsights: undefined;
  CreatorDashboard: undefined;
  ReferralDashboard: undefined;

  VoiceCall: {peerId: string; peerName: string};
  VideoCall: {peerId: string; peerName: string};
  CallHistory: undefined;

  MusicLibrary: undefined;
  AudioDetail: {trackId: string};

  AutoDm: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  EmailVerification: {email: string; pendingUsername?: string};
  ForgotPassword: undefined;
  UsernameSetup: {displayName: string; pendingUsername?: string};
};
