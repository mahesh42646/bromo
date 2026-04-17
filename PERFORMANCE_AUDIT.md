# Bromo Performance Audit
> Date: 2026-04-17           Scope: bromo-mobile + bromo-api

---

## TL;DR — Top 5 Fixes for Maximum Gain

| # | Fix | Where | Est. Gain |
|---|-----|--------|-----------|
| 1 | Add `compression()` middleware | `bromo-api/src/app.ts:54` | 50–80% response size |
| 2 | Fix N+1 in comments load | `posts.ts:1923` | 200–600ms per request |
| 3 | Fix N+1 in promoted story tray | `posts.ts:278` | 60–180ms per request |
| 4 | Cache `getViewerInterestScores()` (5-min LRU) | `posts.ts:78` | 80–200ms per feed load |
| 5 | Replace `setProgress` state with Reanimated shared value | `ReelsScreen.tsx:579` | Eliminates 5+ JS re-renders/sec |

---

## API Bottlenecks

### CRITICAL

#### 1. N+1 Query — Comments Load
**File:** `bromo-api/src/routes/posts.ts:1923–1973`

For each of 15 root comments, the handler fires:
- `Comment.countDocuments(replyFilter)` — 1 query/root
- `Comment.find(replyFilter)` — 1 query/root
- `Comment.exists(...)` — conditional 1 query/root
- `attachReplyingTo()` → `Comment.find` + `User.find` — 2 queries/root

**Total: 30–75 sequential DB round-trips per request.**

Fix: batch one `Comment.find({ threadRootId: { $in: [...rootIds] } })` + one `User.find`, group in JS.

**Estimated gain: 200–600ms**

---

#### 2. N+1 Query — Promoted Story Tray
**File:** `bromo-api/src/routes/posts.ts:278–319`

```ts
for (const c of campaigns) {
  const s = await Post.findOne({ _id: c.contentId, ... }) // N sequential findOne
```

Up to 12 campaigns = 12 sequential `Post.findOne` calls.

Fix:
```ts
const posts = await Post.find({ _id: { $in: contentIds }, ... })
const postMap = new Map(posts.map(p => [String(p._id), p]))
```

**Estimated gain: 60–180ms per story tray load**

---

#### 3. No gzip / Brotli Compression
**File:** `bromo-api/src/app.ts` (missing entirely)

Feed endpoints return 5–50KB JSON. No `compression` middleware exists.

Fix (one line):
```ts
import compression from 'compression'
app.use(compression()) // right after cors()
```

**Estimated gain: 50–80% reduction in transfer time → 100–500ms on mobile connections**

---

### HIGH

#### 4. `getViewerInterestScores()` — No Cache, Duplicated, 4 DB Queries Per Call
**Files:** `posts.ts:78`, `adServe.ts:24`

Function is copy-pasted into two files. Each call fires:
- `Like.find(...)` → `Post.find({ $in: likedIds })`
- `Follow.find(...)` → `Post.find({ authorId: { $in: followIds } })`

All sequential. Called on every feed + ad serve request. No memoization.

Fix: extract to shared util, wrap with 5-min per-user LRU cache (100-entry `lru-cache`).

**Estimated gain: 80–200ms per feed/ad request**

---

#### 5. Sequential Independent DB Queries in Multiple Routes

All fixable with `Promise.all`:

| Route | File:Line | Queries to parallelize | Gain |
|-------|-----------|------------------------|------|
| `GET /feed` | `posts.ts:547` | `Follow.find` + `Like.find` | 30–80ms |
| `GET /posts/user/:userId` | `posts.ts:1442` | `Post.find` + `Follow.find` + `Like.find` | 40–80ms |
| `GET /posts/stories` | `posts.ts:1026` | `Follow.find` + Post slim query | 20–50ms |
| `POST /posts/:id/like` | `posts.ts:1703` | `Like.findOne` + `Post.findById` | 15–30ms |
| `DELETE /follow` | `follow.ts:301` | Two `User.findByIdAndUpdate` | 15–30ms |

---

#### 6. All Likes Fetched Instead of Page-scoped
**File:** `posts.ts:553–556` (also `:914`, `:967`)

```ts
// Current — fetches ALL likes by user for ALL posts ever:
await Like.find({ userId, targetType: "post" })

// Fix — scope to current page only:
await Like.find({ userId, targetType: "post", targetId: { $in: postIds } })
```

Power user with 10k likes = huge unnecessary result set on every feed load.

**Estimated gain: 20–200ms for active users**

---

#### 7. No MongoDB Connection Pool Config
**File:** `bromo-api/src/db/connect.ts:5–7`

Default `maxPoolSize: 5` bottlenecks concurrent requests (feed + ads + sockets firing simultaneously).

Fix:
```ts
await mongoose.connect(env.mongoUri, {
  maxPoolSize: 50,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
```

**Estimated gain: 30–100ms under concurrent load**

---

### MEDIUM

#### 8. Missing DB Indexes

| Collection | Missing Index | Queries Affected |
|------------|---------------|-----------------|
| `User` | `{ followersCount: -1 }` | suggestions sort → full scan |
| `Follow` | `{ followerId: 1, status: 1, createdAt: -1 }` | followers/following list sort |
| `Follow` | `{ followingId: 1, status: 1, createdAt: -1 }` | followers list sort |
| `saved_posts` | `{ userId: 1 }` | raw collection, zero indexes |

**Estimated gain: 20–150ms per affected query, grows with data size**

---

#### 9. Auth Middleware — 1 DB Round-trip Per Request
**File:** `bromo-api/src/middleware/firebaseAuth.ts:38`

```ts
const dbUser = await User.findOne({ firebaseUid: decoded.uid }) // every request
```

Fix: 60-second LRU cache keyed on Firebase UID.

**Estimated gain: 10–30ms per authenticated request**

---

#### 10. Story Tray "Healing" Write on Every Load
**File:** `posts.ts:1034–1044`

```ts
await Post.collection.updateMany( // fires on EVERY story tray request
  { type: "story", ..., $or: [{ expiresAt: { $exists: false } }, ...] },
  [{ $set: { expiresAt: ... } }]
)
```

Run once as a migration script, then delete this code.

**Estimated gain: 10–40ms per story tray load**

---

#### 11. Unbounded Queries — OOM Risk at Scale

| Route | File:Line | Issue |
|-------|-----------|-------|
| `GET /chat/conversations` | `chat.ts:25` | No `.limit()` — returns all conversations ever |
| `GET /follow-requests` | `follow.ts:211` | No `.limit()` — unbounded for public accounts |

Fix: add `limit(30)` + cursor-based pagination.

---

#### 12. `morgan("dev")` in Production
**File:** `app.ts:81`

Synchronous colourised logging per request. Use `morgan("combined")` in prod or switch to structured logging (pino).

**Estimated gain: 1–3ms per request**

---

## Mobile Bottlenecks

### CRITICAL

#### 13. Reel Progress via JS State (5+ Re-renders/sec During Playback)
**File:** `bromo-mobile/src/screens/ReelsScreen.tsx:579–595`

```ts
// Current — JS thread, triggers full ReelItem re-render every 180ms:
setProgress(Math.min(1, Math.max(0, d.currentTime / dur)))

// Fix — UI thread only:
const progress = useSharedValue(0)
// inside onProgress:
progress.value = Math.min(1, Math.max(0, d.currentTime / dur))
// progress bar uses useAnimatedStyle
```

**Estimated gain: eliminates ~5.5 JS re-renders/sec per active video**

---

#### 14. MessagingContext Re-creates Value on Every Message
**File:** `bromo-mobile/src/context/MessagingContext.tsx:403`

All context consumers (`ChatListScreen`, `ChatThreadScreen`, etc.) re-render on every incoming message character. The `useMemo` depends on `messagesByPeer` which is replaced entirely on each update.

Fix: split into two contexts — stable `MessagingActions` + data `MessagingData`. Or use `useReducer` with stable dispatch reference.

**Estimated gain: eliminates cascading re-renders across all chat screens**

---

#### 15. `filterThreads` — O(n×m) on Render Thread, No Debounce
**File:** `MessagingContext.tsx:379–400`

Iterates all conversations × all messages per conversation synchronously on every render pass of `ChatListScreen`. No debounce on search input.

Fix: `useTransition` or `useDeferredValue` for search, move scan to `useMemo` with stable deps.

---

### HIGH

#### 16. Serial `getFeed` After Parallel Batch
**File:** `bromo-mobile/src/screens/HomeScreen.tsx:886`

```ts
const [storiesRes, suggestionsRes, adsRes, storyAdsRes, trendingRes] = await Promise.all([...])
// then separately:
let res = await getFeed({...}) // blocks full screen render
```

Include `getFeed` in the `Promise.all` batch, or split into two render phases (skeleton → content).

**Estimated gain: reduces initial load by 1 full network RTT**

---

#### 17. Home FlatList Missing Key Optimizations
**File:** `HomeScreen.tsx:1397`

| Missing Prop | Impact |
|---|---|
| `getItemLayout` | Can't pre-compute scroll positions, causes jank on back-navigation |
| `initialNumToRender` | Default 10 heavy `PostCard` components mount simultaneously |
| `maxToRenderPerBatch` | Not set — Metro renders in large bursts |

ReelsScreen already sets `initialNumToRender={1}` correctly.

---

#### 18. `feedItems` useMemo Recomputes on Every Socket Event
**File:** `HomeScreen.tsx:1157–1185`

Every `post:like` socket event calls `setPosts(prev => prev.map(...))` → new array reference → `feedItems` recomputes → FlatList diffs entire list.

Fix: use `useImmer` or store posts as `Map<id, Post>`, update only changed entry, derive array via stable selector.

---

#### 19. AuthContext Spreads `firebaseUser` on Token Refresh
**File:** `AuthContext.tsx:195`

```ts
setFirebaseUser({...user}) // new object reference on every token refresh
```

Every component using `useAuth()` re-renders — includes `PostCard`, `ReelItem`, `HomeScreen`. Remove the spread; pass `user` directly.

---

#### 20. Story Tray Uses ScrollView (No Virtualization)
**File:** `HomeScreen.tsx:1438–1543`

All `StoryRing` + `Image` components mount simultaneously. With 50+ followed users, this is 50 image loads and DOM nodes on first render.

Fix: replace with `FlatList horizontal={true}` + fixed `getItemLayout`.

---

### MEDIUM

#### 21. No `FastImage` — No Persistent Image Cache
All screens use React Native's built-in `<Image>`. No disk cache, no priority queuing.

Fix: install `react-native-fast-image`, replace `<Image>` on `PostCard`, `ReelItem`, `StoryRing`, `SuggestionCard`.

**Estimated gain: 50–200ms per image load on repeat views**

---

#### 22. HLS Prefetch Downloads Segments Serially
**File:** `hlsPrefetch.ts:151–161`

```ts
for (const seg of segments) {
  await download(seg) // sequential — 15 awaits for a 30-sec reel
}
```

Fix: use `p-limit` with concurrency 3–4.

**Estimated gain: 4–5x faster prefetch**

---

#### 23. Avatar Fallback URL Reconstructed Every Render
**File:** `HomeScreen.tsx:200` (also `ReelItem`, `SuggestionCard`)

```ts
post.author.profilePicture || `https://ui-avatars.com/api/?name=${post.author.displayName}`
```

Creates a new string + new `{uri}` object every render → `<Image>` treats as source change → re-fetch.

Fix: compute once in `useMemo` or at data normalization layer.

---

#### 24. `PostCard` and `ReelItem` Not Memoized
**File:** `HomeScreen.tsx:154`, `ReelsScreen.tsx:435`

Neither component is wrapped in `React.memo`. Parent state changes (socket events, scroll position) re-render every visible card.

Fix: `export default React.memo(PostCard, (prev, next) => prev.post._id === next.post._id && prev.post.likesCount === next.post.likesCount && ...)`

---

#### 25. Socket Starts on Long-polling, Upgrades to WebSocket
**File:** `socketService.ts:49`

```ts
transports: ['polling', 'websocket'] // starts with 2 HTTP round-trips before WS upgrade
```

Fix (if proxy supports WS):
```ts
transports: ['websocket', 'polling'] // connect via WS immediately
```

**Estimated gain: reduces connection time by 1–2 RTTs on app launch**

---

#### 26. `refreshHeaderCounts` Fires Even When Socket Connected
**File:** `HomeScreen.tsx:1025–1042`

On `AppState` resume, `getUnreadCount()` + `getConversations()` fire via HTTP even when socket is live (which already pushes these counts).

Fix: check `socketService.isConnected()` before firing HTTP fallback.

---

## Full Priority Matrix

| Priority |           Issue            |           File            |           Est. Gain            |

| P0           Add `compression()`           `app.ts`           50–80% transfer size |
| P0           Fix comments N+1           `posts.ts:1923`           200–600ms |
| P0           Fix story tray N+1           `posts.ts:278`           60–180ms |
| P0           Reel progress → Reanimated shared value           `ReelsScreen.tsx:579`           5+ re-renders/sec |
| P1           Cache `getViewerInterestScores`           `posts.ts:78`           80–200ms |
| P1           Parallelize sequential route queries           `posts.ts:547,1442,1703`           15–80ms each |
| P1           Scope Like.find to page post IDs           `posts.ts:553`           20–200ms |
| P1           Configure Mongoose connection pool           `db/connect.ts`           30–100ms under load |
| P1           MessagingContext split / stable ref           `MessagingContext.tsx:403`           cascading re-renders |
| P1           Include `getFeed` in Promise.all           `HomeScreen.tsx:886`           1 RTT |
| P2           Add missing DB indexes           models           20–150ms |
| P2           Cache DB user in auth middleware           `firebaseAuth.ts:38`           10–30ms |
| P2           `AuthContext` stop spreading firebaseUser           `AuthContext.tsx:195`           global re-renders |
| P2           Home FlatList: `getItemLayout` + `initialNumToRender`           `HomeScreen.tsx:1397`           scroll jank |
| P2           Memoize `PostCard` + `ReelItem`           `HomeScreen.tsx:154`           feed re-renders |
| P2           `feedItems` useMemo — stable post map           `HomeScreen.tsx:1157`           list diffs |
| P2           Story tray → FlatList horizontal           `HomeScreen.tsx:1438`           50+ image mounts |
| P3           Install `react-native-fast-image`           all screens           50–200ms repeat loads |
| P3           HLS prefetch — parallel with `p-limit`           `hlsPrefetch.ts:151`           4–5x prefetch speed |
| P3           Socket: prefer WebSocket transport           `socketService.ts:49`           1–2 RTT on connect |
| P3           Remove story heal updateMany           `posts.ts:1034`           10–40ms |
| P3           Pagination on `/conversations` + `/follow-requests`           `chat.ts:25`           scale risk |
| P3           `morgan("dev")` → structured logging           `app.ts:81`           1–3ms + noise |
| P3           `refreshHeaderCounts` — skip if socket live           `HomeScreen.tsx:1025`           2 RTTs on resume |
| P3           Avatar fallback URL memoized           `HomeScreen.tsx:200`           re-fetch on render |

---

## Quick Wins (< 30 min each)

1. `app.use(compression())` — `bromo-api/src/app.ts` after `cors()`
2. Mongoose pool config — `db/connect.ts`
3. `transports: ['websocket', 'polling']` — `socketService.ts:49`
4. `morgan("dev")` → `morgan("tiny")` — `app.ts:81`
5. `setFirebaseUser(user)` not `setFirebaseUser({...user})` — `AuthContext.tsx:195`
6. `React.memo(PostCard)` + `React.memo(ReelItem)`
7. Parallelize `Like.find` + `Follow.find` in `/feed` with `Promise.all`
8. Add `followersCount: -1` index to `userSchema`
9. `transports: ['websocket', 'polling']` in socket
10. Delete story tray healing `updateMany`
