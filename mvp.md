


PART 1 — MOBILE APP CHECKLIST 


[ AUTH ] Authentication & Onboarding (8 Screens)
--------------------------------------------------
- Splash Screen — App logo, loading
- Onboarding Slides — 3–4 intro screens
- Login — Phone/Email + OTP; social login ready
- Register — Name, phone, email; OTP mandatory
- OTP Verification — 6-digit; resend timer
- Forgot Password — Recovery flow
- Reset Password — After OTP
- Username Setup — Mandatory unique username; auto-suggest handles; shown post-OTP

[ FEED ] Home & Feed (15 Screens)
--------------------------------------------------
- Home Feed — Category + global; ad suggestions injected; autoplay video; filter/effects button
- Category Feed — Food/Offers/Business/Lifestyle/Education/Local; ads per category
- Reels Feed — Vertical swipe; ad suggestions; watch & earn; use-this-audio button
- Stories Bar — Horizontal; 24h expiry; close friends indicator
- Story View — Full-screen
- Post Detail — Likes, comments, share
- Comments — Nested; like replies; delete own
- Share / Send To — DM, apps, link
- Create Post — Media, caption, hashtags, @mention, emoji tags, location, category, music picker
- Filter / Effects Selector — AR filters & effects for camera, stories, reels; admin-managed library
- Close Friends Selector — Choose list when posting story; suggest based on interaction
- Music / Audio Picker — Browse & select track; trending audio section
- Video Trim — Trim video clip during reel/post creation
- Collaboration — Tag co-creator; post on both profiles; invite + accept flow
- Reuse Audio — Tap audio on reel → open Create Reel with audio pre-loaded; original creator credited

[ EXPLORE ] Explore & Search (4 Screens)
--------------------------------------------------
- Explore Home — Search, trending, stores, categories
- Search Results — Users, posts, stores, hashtags
- Hashtag / Category Detail
- Nearby People / Friend Suggestions — GPS-based; follow directly from list

[ STORES ] Nearby Store Module (14 Screens)
--------------------------------------------------
- Nearby Store Home — Map/list; 3KM radius; filters; sort
- Store Profile — Logo, cover, rating, distance, contact, offers
- Store Discount — Sliders, T&C, validity, menu link
- Offer Redemption — Points + cash split; wallet
- Redemption Success — QR, txn ID, OTP for store
- Store Registration — GPS, map, docs upload; onboard plan payment (₹1,600 via gateway)
- Store Subscription Plans — Basic / Gold / Premium
- My Store Dashboard — Sales, reach, coins redeemed, active offers; item-level reach per card
- Create Store Offer
- 3KM Notification History
- Store Menu — Browse items (food/clothing/services/café/hotel etc.); price + discount; coin deduction at checkout
- Store Web Link / Share — Shareable store profile link; opens store micro-site in browser
- Store Reach Detail — Reach stats per post/offer; item-level reach on dashboard cards
- Store Coin Redemption — Store sets max coins per visit & max redemptions per user per day; live limit shown

[ ADS ] Advertising (7 Screens)
--------------------------------------------------
- Create Ad — Step 1: Type, placement
- Create Ad — Step 2: Content, radius, audience
- Create Ad — Step 3: Budget, duration, points + cash (min 50% cash)
- Ad Payment — Gateway; wallet
- My Ads Dashboard
- Ad Campaign Detail
- Ad Earnings — Watch points; daily limit

[ PROFILE ] Profile & Wallet (13 Screens)
--------------------------------------------------
- My Profile
- Edit Profile — Name, username (mandatory), bio, profile picture, website link
- Other User Profile
- Share Profile — Shareable profile link; QR code; share to other apps
- Followers / Following
- Points Wallet
- Transaction History — User & store views
- Saved Posts
- Watch History
- Manage Content
- Content Insights
- Creator Dashboard
- Referral Dashboard

[ COMMUNICATION ] Notifications & Messaging (5 Screens)
--------------------------------------------------
- Notifications — Tabs; mark read
- Notification Settings
- DM Inbox
- Chat Conversation — Text, image, post share
- Auto DM — Admin-triggered messages (welcome, store promos, event alerts); received in DM inbox

[ SETTINGS ] Settings & Support (8 Screens)
--------------------------------------------------
- Settings Main
- Account Settings
- Privacy Settings
- Security Settings
- Terms & Conditions
- Privacy Policy
- Help & Support
- About App

[ CALLING ] Voice & Video Calling (3 Screens)
--------------------------------------------------
- Voice Call — Mute, speaker, end call controls
- Video Call — Camera toggle, mute, end call; front/rear switch
- Call History — Missed, incoming, outgoing; call back shortcut

[ MUSIC ] Music Library (2 Screens)
--------------------------------------------------
- Music Library Browser — Browse by mood/category; search; trending audio; admin-managed
- Audio Detail — Track info; reels using audio; one-tap use; original creator credit



PART 2 — BACKEND API CHECKLIST


[ AUTH ] Authentication & User Management
--------------------------------------------------
- Phone/Email + OTP login & registration
- Social login integration (ready)
- JWT auth implementation
- Username uniqueness validation + auto-suggest logic
- Forgot password / reset password via OTP
- Sub-admin roles & permissions system

[ FEED & CONTENT ]
--------------------------------------------------
- Post CRUD — create, read, update, delete
- Reels CRUD with video processing
- Stories CRUD — 24h expiry logic
- Category feed filtering logic
- Ad injection logic in feed & reels
- Watch & earn points trigger on reel view
- @mention parsing & notification trigger
- Hashtag indexing & trending logic
- Collab post invite + accept flow
- Close friends list management
- Reuse audio endpoint — pre-load audio on create reel
- Post/reel/story sharing logic

[ EXPLORE & DISCOVERY ]
--------------------------------------------------
- Full-text search — users, posts, stores, hashtags
- GPS-based nearby user/friend suggestion (3KM)
- Trending hashtag computation

[ STORES ]
--------------------------------------------------
- Store registration with GPS coordinates
- 3KM geolocation query for nearby stores
- Store subscription plan management (Basic/Gold/Premium)
- Store onboard plan (₹1,600 now + ₹1,600 post-reach); reach target tracking
- Ads credit fallback if second store payment pending
- Store offer CRUD
- QR + OTP redemption flow with fraud safeguards
- Store menu CRUD — items, prices, discount %
- Coin redemption at checkout — deduct and record
- Per-store coin limits — max coins per visit; max redemptions per user per day
- Store micro-site data endpoint (store.bromo.in/[slug])
- Store reach stats per post/offer/item
- 3KM push notification trigger for nearby store offers

[ ADS ]
--------------------------------------------------
- Ad campaign creation — type, placement, content, radius, audience
- Budget & duration management
- Points + cash hybrid payment (min 50% cash enforcement)
- Ad moderation queue logic
- Ad earnings — watch points allocation; daily limit enforcement
- Coins → ads credits auto-conversion logic
- Ads credit balance management per user/store

[ POINTS & WALLET ]
--------------------------------------------------
- Points earn logic — watch reels, post content
- Points spend logic — ads, offers
- Coin redemption at stores
- Coins → ads credits conversion (configurable rate)
- Transaction history for users and stores
- Manual points adjustment (admin)
- Fraud detection logic for points/referrals
- Referral system with OTP fraud safeguards

[ NOTIFICATIONS & MESSAGING ]
--------------------------------------------------
- Push notification service integration
- Notification types — likes, comments, follows, mentions, DMs, store alerts
- Notification tabs & mark-as-read
- DM inbox — text, image, post share
- Auto DM campaigns — admin-triggered; welcome on signup, store promos, event alerts

[ VOICE & VIDEO CALLING ]
--------------------------------------------------
- WebRTC peer-to-peer 1-to-1 calling
- TURN/STUN server configuration
- Voice call — mute, speaker, end
- Video call — camera toggle, mute, front/rear switch
- Call history logging — missed, incoming, outgoing

[ MUSIC LIBRARY ]
--------------------------------------------------
- Track upload, edit, delete (admin-managed)
- Category/mood tagging for tracks
- Availability toggle per content type (reel/story/post)
- Trending audio curation & ranking
- Usage stats per track (how many reels/stories using it)
- Original creator credit on audio reuse

[ MEDIA & FILES ]
--------------------------------------------------
- AWS S3 (or EC2/VPS) media upload — images, videos, audio
- Firebase Auth integration
- Profile picture upload & management

[ AR FILTERS & EFFECTS ]
--------------------------------------------------
- AR filter/effects library — serve to app
- Admin toggle per effect (enable/disable)
- Effects usable in camera, stories, reels

[ STORE MICRO-SITE ]
--------------------------------------------------
- Dynamic store micro-site API (Next.js SSR) for store.bromo.in/[slug]
- Store profile data — logo, cover, rating, menu, offers accessible without app

[ DEPLOYMENT & INFRA ]
--------------------------------------------------
- Node.js + Express REST API setup
- MongoDB database setup
- VPS / AWS EC2, Ubuntu, SSL/HTTPS
- Staging environment deployment
- PM2 process management
- Nginx reverse proxy + SSL
- UAT deployment & sign-off support



PART 3 — ADMIN DASHBOARD CHECKLIST (69 Pages)


[ AUTH ] Admin Authentication (3 Pages)
--------------------------------------------------
- Admin Login — Email/password; 2FA optional
- Forgot Password
- My Account

[ OVERVIEW ] Main Dashboard (1 Page)
--------------------------------------------------
- Dashboard Home — KPIs, charts, activity feed

[ USERS ] User Management (5 Pages)
--------------------------------------------------
- All Users List
- User Detail
- Add Sub-Admin
- Admin Roles & Permissions
- Banned / Suspended Users

[ CONTENT ] Content Moderation (6 Pages)
--------------------------------------------------
- All Posts List
- All Reels List
- Reported Content Queue
- Content Detail Review
- Hashtag Management
- Comments Moderation

[ STORES ] Store Management (10 Pages)
--------------------------------------------------
- All Stores List
- Store Detail
- Pending Store Approvals
- Store Categories
- Store Offers Overview
- Subscription Management
- Store Menu Management — Add/edit items, prices, discount % per item
- Store Coin Redemption Settings — Max coins per redemption; max per user per day per store
- Store Onboard Plan Manager — 3200-plan; reach tracking; ads-credit fallback config
- Store Web Link & Reach — Assign slug; view item-level reach; reach stats

[ ADS ] Advertising Management (7 Pages)
--------------------------------------------------
- All Ad Campaigns
- Ad Campaign Detail
- Ad Moderation Queue
- Ad Revenue Overview
- Ad Settings
- Ads Credit Management — View/adjust balances per user/store; manual allocation; auto-convert coins
- Coins → Ads Credit Rules — Configure conversion rate; trigger conditions; audit log

[ WALLET ] Points & Wallet (6 Pages)
--------------------------------------------------
- Points Economy Overview
- All Transactions
- User Wallet Detail
- Points Settings
- Manual Points Adjustment
- Fraud Detection

[ ANALYTICS ] Analytics & Reports (5 Pages)
--------------------------------------------------
- User Analytics
- Content Analytics
- Store Analytics
- Revenue Reports
- Points Flow Analytics

[ CONFIG ] App Configuration (10 Pages)
--------------------------------------------------
- General Settings
- Maintenance Mode
- Feature Flags
- Feed Settings
- Reels Settings
- Nearby Store Settings
- Notification Templates
- Content Policy
- Auto DM Campaigns — Create/manage triggered DM templates; schedule & targeting rules
- Mention & Username Settings — Availability rules; auto-suggest config; @mention notification toggles

[ UI/UX ] Dynamic UI Control (5 Pages)
--------------------------------------------------
- Banner Manager
- Home Layout Manager
- Onboarding Slides Editor
- Splash & Logo Manager
- Theme Settings — Including AR filter/effects config exposed in admin

[ SUPPORT ] Support & Legal (6 Pages)
--------------------------------------------------
- Support Tickets
- Ticket Detail
- FAQ Manager
- Terms & Conditions Editor
- Privacy Policy Editor
- Audit Log

[ MUSIC ] Music Library Management (3 Pages)
--------------------------------------------------
- Music Library — All tracks; upload, edit, delete; category/mood tags; availability toggle per content type
- Track Detail — Usage stats; enable/disable; copyright info
- Trending Audio — Curate trending tracks; set ranking; featured playlists

[ CALLING ] Call Management (2 Pages)
--------------------------------------------------
- Call Logs — Voice & video history; duration, participants, status; moderation flags
- Calling Settings — Enable/disable per user tier; TURN/STUN server config; call recording policy

