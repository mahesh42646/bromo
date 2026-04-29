

This is the BROMO social-commerce platform. The client has sent a list of feature additions and bug fixes across 8 sections of the app. Changes span the mobile app, backend API, and web portal. Work section by section. Do not skip or combine tasks — each numbered item is a separate deliverable.

---

## SECTION 1 — Post Editing & Creation

### 1.1 — Carousel Post (Multiple Photo Selection)
- Allow users to select 1 to 10 photos at once from their gallery
- All selected photos must be uploaded and displayed as a **carousel/slider** post (swipeable)
- While selecting photos, user must be able to set the **order** (1, 2, 3...) of photos before posting

### 1.2 — Story Customization
- Remove the restriction that forces users to tag a product when posting a story
- User should be able to pick any photo or video directly from gallery and post as story, no product required
- Allow the user to **drag and reposition** the photo anywhere on the story canvas
- Allow **resizing** (pinch to resize) of the photo on story canvas
- Add **sticker support** on stories
- Add **@mention** support — user can mention other users with `@username`
- On the viewer side, show a **mention icon** at the top of the story. When tapped, it shows a list of all users tagged/mentioned in that story

### 1.3 — Story Views & Analytics
- Show the creator a full **viewer list** (profile picture + name) of who viewed their story
- Show per-story **analytics**: total impressions, reply count, link/mention tap count

### 1.4 — Reels: Collaboration & Music
- In the reel edit screen, add an **"Invite Collaborator"** option before posting. When used, the reel appears on both collaborators' profiles simultaneously
- Add a full **Music Library** for background audio when creating reels. Include a **search bar** to find trending songs and original audio

---

## SECTION 2 — Feed Section

### 2.1 — Category-Based Feed
- When a user posts with a specific **category** (e.g. Political), that post must only appear in that category's feed
- In the **"For You"** feed, if a post belongs to a category, show the **category name** + a **"Read More" button** on it. Tapping it should navigate the user directly to that category's feed

### 2.2 — Dynamic Aspect Ratio (No Cropping)
- Posts must display in their **original aspect ratio** in the feed — no cropping
- 9:16 should show full portrait, 4:5 should show 4:5 — whatever was uploaded must appear exactly as uploaded

### 2.3 — Instagram-Style Feed Scrolling
- When user scrolls the feed, the **category bar and top options must scroll up and disappear** (like Instagram), giving full screen space to feed content

### 2.4 — Verification Badge (Manual Approval Only)
- **Stop auto-granting** blue tick or verified badge on signup
- Badge should only appear after: user sets up profile AND admin manually verifies their documents

### 2.5 — Block User from Feed
- Add a **Block button** directly on each post in the Feed and Reel sections
- User should be able to block an account right from the feed without going to their profile

### 2.6 — Auto-Play Videos in Feed
- Videos in the feed must **auto-play** when they scroll into view — no need for the user to tap play

### 2.7 — Profile View Fix (From Feed)
- Currently tapping a profile from the feed only shows the Bio
- **Fix this**: tapping a profile from feed must open the full profile with **all posts in a grid view**, same as any normal profile page

### 2.8 — Original Audio via FFmpeg
- When any video is uploaded, use **FFmpeg to extract the audio** track as a separate file
- Name the audio file as: `[Username] - Original Audio`
- Save this audio file on the server so other users can use it in their reels

### 2.9 — Save Post Bug Fix
- Currently saving a post doesn't work — **fix this bug**
- Saved posts must appear in the user's **Saved folder** correctly

### 2.10 — Reel Delete Bug Fix
- When a user deletes a reel, it must be **permanently removed** from both the database and the feed
- Fix the current bug where deleted reels still show up in the feed

---

## SECTION 3 — Reel Section

### 3.1 — Scrolling Issue Fix
- Currently reels require a **long press** to scroll — this is wrong
- Fix it so a **light swipe** moves to the next reel smoothly (standard TikTok/Instagram behavior)

### 3.2 — Auto-Scroll & New Post Refresh
- When a new reel is uploaded, the **feed must auto-refresh** and show the new reel in order
- Improve the auto-scroll logic to be smooth and accurate

### 3.3 — Original Audio + "Use Audio" Feature
- Each reel must have its own **Original Audio** generated (via FFmpeg extraction from Section 2.8)
- When a user taps **"Use Audio"** on any reel, the camera must open with that audio already playing in the background, ready for them to record a new reel in perfect sync

### 3.4 — Hide Follow Button on Own Reels
- When a user is watching their own reel, the **Follow / Following button must be hidden**
- Do not show follow button on self-profile reels

### 3.5 — Follow Status Sync
- If a user follows someone from the feed, going to that person's profile must show **"Following"** — not "Follow"
- Keep follow status **consistent** across feed and profile everywhere in the app

### 3.6 — Creator Store & Product Tagging in Reels
- Only show the **Store icon** on reels from **Verified Creators**
- When a creator tags products in a reel, viewers should be able to tap a specific icon to see all tagged products and purchase from there

### 3.7 — Earnings via View Count (Points System)
- Creators earn **reward points** based on reel view count
- These points can only be redeemed for **offers/discounts** inside the Store section (not cash)

### 3.8 — Share Count Fix
- The share count on reels is not updating — **fix this**
- Every time someone taps the share button, the count must increment and be visible to all viewers

### 3.9 — Share to Story Flow
- When sharing a reel to story, it must NOT post directly
- It must first open the **Create Story editor** where user can add text and stickers, then post it as a story

### 3.10 — Reel Remix Feature
- Add a **Remix** option on reels
- Remix logic: use the original reel's audio, user records their own video on top of it (side-by-side or synced)
- When remix is posted, **original creator's credit** must be visible on the remix reel

### 3.11 — Profile Navigation from Reels
- When user taps a username while watching a reel (own or someone else's), it must open the **full profile page** (with posts, followers, following counts)
- Fix the current behavior where it opens a wrong/different page

### 3.12 — Block Option in Reels
- Add a **Block** option in the reel section (same as feed block)
- Blocked creator's content should never appear again

### 3.13 — Report Options Update
- When reporting a reel, show more **report reason options**
- Add options like: "Copied/Stolen song", "Irrelevant/Spam content" (expand existing report reasons)

---

## SECTION 4 — Messages & Notifications

### 4.1 — Follow Notification Fix
- When a user follows someone or sends a follow request, the **target user must receive an instant notification**
- This is currently broken — fix the notification trigger logic

### 4.2 — Chat List Long Press Actions
- In the chat list, **long pressing** a user's name must show a quick action menu with:
  - **Share** — share that user's profile to someone else
  - **Block** — block that user
  - **Mute / Unmute** — mute or unmute message notifications from that user

### 4.3 — Push Notifications for Messages
- Every new message must trigger a **push notification**, even when the app is closed/background

### 4.4 — Message Controls
- Add **Seen/Unseen indicator** (blue tick or similar) so sender knows if message was read
- Add **Edit message** option (edit a sent message)
- Add **Delete for Everyone** option (unsend a message from both sides)

### 4.5 — Reel Share with Thumbnail Preview
- When sharing a reel in chat, don't just send a link — show a **thumbnail image preview** of the reel inline in the chat so the receiver knows what it's about without opening it

### 4.6 — Accurate Location Sharing
- Use **Google Maps API Key** for location sharing
- Location pinned on map must be accurate, not approximate

### 4.7 — Online Status & Chat Detail Section
- Show **"Active Now"** / online status clearly in the chat section
- When tapping a user's name inside a chat, open a **separate detail screen** that shows:
  - **Shared Media** — all photos and videos ever shared in that conversation
  - Actions: **View Profile**, **Block**, **Unblock**, **Restrict**

---

## SECTION 5 — Explore Section

### 5.1 — Hashtag Search
- In the Explore page search, when user types a `#hashtag`, show **top trending hashtags** first
- Tapping a hashtag must show all posts and videos under that hashtag on one screen

### 5.2 — Nearby People & Global Search
- Show **nearby users** based on the user's current location (location-based discovery)
- Also allow searching users by **typing their name directly** (global people search)

### 5.3 — Explore Feed & Profile Navigation
- Explore page must show a **mixed feed** of all types of posts and videos below the search bar
- Tapping a video in Explore must open it **full screen**
- From full screen, user must be able to tap the creator's profile and navigate to their full profile (Instagram-style flow — study Instagram's explore → video → profile flow and replicate it)

### 5.4 — Original Audio Search
- In the audio/music search when creating reels, searching a song name must actually **show results**
- Results should primarily show **original audios extracted via FFmpeg** from uploaded videos
- This enables users to use other creators' original sounds for their reels

---

## SECTION 6 — Store Section (D2C & B2B)

### 6.1 — Two Store Types
- Store must have two clearly separated sections: **D2C (Direct to Customer)** and **B2B (Business to Business)**
- D2C = for discount/offer buying using coins
- B2B = for bulk/wholesale purchasing via inquiry

### 6.2 — Coin-Based Discounts (D2C)
- Users must **earn coins** to unlock store discounts
- Discounts are only accessible if user uses their earned coins — no coins = no offer

### 6.3 — B2B Inquiry System
- B2B section allows businesses to **place bulk inquiries**
- B2B store owners receive **leads** (contact numbers + details) from interested buyers so they can close deals directly
- When a store owner registers, ask them if their brand is **D2C or B2B** — if B2B, give them separate plans/features that have **no connection to the coin discount system**

### 6.4 — Store Management Dashboard (Discount Store)
- Store owner dashboard must show: **reviews, ratings, daily reach, engagement, views**
- Owner can manage their **products, descriptions, and external links** (e.g. their own food store website)
- **QR Code redemption**: when a user visits the physical store and scans the QR code, their coins transfer to the store and the offer gets redeemed automatically
- **Billing calculator example logic**:
  - User orders food totaling ₹200
  - Store rule: 1500 coins = 10% discount
  - System deducts 1500 coins from user's wallet, shows message: "Pay ₹180 to Store"
  - Store owner gets notified: "Collect only ₹180 from this customer"

### 6.5 — Plan-Based Push Notifications for Store Owners
- Store owners can send push notifications to their customers. Limits based on plan:
  - **Basic Plan** — limited notifications
  - **Premium Plan** — more notifications, targeted audience
  - **Gold Plan** — unlimited notifications, high-priority push

---

## SECTION 7 — Profile & Creator Dashboard

### 7.1 — Creator Account Registration
- A user is **not considered a Creator** until they fill out the **Creator Form** in settings
- Once form is submitted and verified:
  - A **"Creator" badge** appears in their profile bio
  - A **confirmation email** is sent to them
  - Their account converts from standard user to **Creator Dashboard**

### 7.2 — User vs Creator Dashboard
- Default login shows **User Dashboard** for everyone
- Only Creators can **tag products** in reels/posts — regular users cannot
- Creator Dashboard shows detailed **analytics per reel**:
  - Total clicks on reel
  - Total views
  - Engagement (likes + comments)
  - Store icon clicks
  - **Estimated earnings** from all the above

### 7.3 — Paid & Unpaid Collaborations
- Collaborations from brands can be marked as **Paid** or **Unpaid**
- Platform (Insay/Bromo) can **suggest brand deals** to relevant creators — creator can accept or decline
- Creator Dashboard must show a **full history** of all deals received and total income earned from them

### 7.4 — Store Types & "Connect My Store" Feature
- Three types of stores available:
  1. **Discount Store** (for customer discount offers)
  2. **B2B Store** (for wholesale trade)
  3. **Online Selling Store** (for direct e-commerce)
- **Connect My Store** feature for creators: if creator purchases this plan, a **store icon appears on all their feed posts and reels**
  - Creator must have a website (can be Shopify)
  - App shows product images; tapping a product redirects user to that product's buy page
  - No need to tag products on individual reels — store icon on all content links to entire store

---

## SECTION 8 — Store Approval Process

### 8.1 — Admin Approval & Pending Status
- When a store owner submits the registration form, it goes to the **Admin Panel for approval**
- Until admin approves, store owner's profile must show **"Request Pending"** status
- Store goes **live only after admin approval**

### 8.2 — Partner Certificate via Email
- Once store is approved, send an official **Partner Certificate** to the store owner's registered email
- Certificate must state they are now an official **Insay Business Partner**

### 8.3 — Terms & Conditions (Mandatory Acceptance)
- Store registration form must have a **mandatory "Accept Terms & Conditions" checkbox** — form cannot be submitted without it
- When accepted, automatically generate a **PDF file** with: user's name, date, and timestamp
- This PDF must be saved securely in the **Admin Panel** for future legal reference

### 8.4 — Mandatory KYC Upload
- KYC document upload is **compulsory** to proceed with store approval
- Required documents:
  - GST Number **or** Shop Act License
  - PAN Card and Aadhaar Card
  - Store photos and Address Proof
- Store approval process cannot move forward without these documents

---



- **Mobile app** (`bromo-mobile`): Most UI changes go here — feed, reels, stories, chat, explore, profile
- **Backend API** (`bromo-api`): FFmpeg audio extraction, push notifications, follow notifications, save/delete bug fixes, coin system, B2B lead generation, KYC document storage, PDF generation for T&C
- **Admin Portal** (`bromo-portal`): Store approval flow, KYC review, partner certificate email trigger, verification badge manual approval
- **Start with bug fixes first** (2.9, 2.10, 3.1, 3.5, 3.8, 4.1) before adding new features — these affect core UX
- FFmpeg integration (2.8) is a dependency for 3.3, 3.7, and 5.4 — implement it early
- All new features must follow existing code style .