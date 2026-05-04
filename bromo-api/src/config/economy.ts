export const ECONOMY_CONFIG = {
  coinPerReelView: 1,
  /** Max Bromo coins earned from reel views per viewer per UTC day (wallet credits). */
  maxReelViewCoinsPerDay: 500,
  reelViewMinPercent: 70,
  reelScrollMilestone: {count: 100, reward: 100},
  firstHundredFollowersReward: 100,
  firstHundredFollowingReward: 100,
  firstPostReward: 25,
  tenPostsReward: 100,
  hundredPostsReward: 1000,
} as const;
