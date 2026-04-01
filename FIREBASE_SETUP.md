# Firebase Setup — Remaining Steps

Your Firebase project **bromo-platform** is configured. The config files have been placed and native build files updated. Below are the only steps left on your side.

---

## Already Done (no action needed)

| Item | Status |
|------|--------|
| `google-services.json` → `bromo-mobile/android/app/` | Placed |
| `GoogleService-Info.plist` → `bromo-mobile/ios/BromoMobile/` | Placed + added to Xcode project |
| Android `applicationId` / `namespace` → `bromo.platform` | Updated |
| iOS `PRODUCT_BUNDLE_IDENTIFIER` → `bromo.platform` | Updated |
| Google Services Gradle plugin added | Done |
| iOS URL scheme for Google Sign-In (`REVERSED_CLIENT_ID`) | Added to Info.plist |
| `iosClientId` set in `AuthContext.tsx` | Done |
| Backend Firebase Admin SDK code | Done |
| Mobile `AuthContext` + `authApi` | Done |

---

## Step 1 — Backend Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com) → **bromo-platform**
2. **Project settings** → **Service accounts** tab
3. Click **Generate new private key**
4. Save the downloaded JSON as:
   ```
   bromo-api/firebase-service-account.json
   ```

The backend already reads this path from `.env` (`FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json`).

---

## Step 2 — Enable Auth Providers

1. In Firebase console → **Authentication** → **Sign-in method**
2. Enable **Email/Password** (toggle ON)
3. Enable **Google** (toggle ON, set a support email when prompted)

---

## Step 3 — Google Sign-In Web Client ID

After enabling Google sign-in (step 2), Firebase auto-creates a Web OAuth client:

1. Go to **Authentication** → **Sign-in method** → **Google** → expand it
2. Copy the **Web client ID** (looks like `877911020224-xxxxxxxxxx.apps.googleusercontent.com`)
3. Paste it in `bromo-mobile/src/context/AuthContext.tsx`:

```typescript
GoogleSignin.configure({
  iosClientId: '877911020224-4cuqme08t2r15dn3p8kun0pucrbeqdec.apps.googleusercontent.com',
  webClientId: 'PASTE_WEB_CLIENT_ID_HERE',
});
```

You can also find it at: [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client IDs → "Web client (auto created by Google Service)".

---

## Step 4 — Android SHA-1 (required for Google Sign-In on Android)

Google Sign-In on Android requires your debug signing key's SHA-1 fingerprint.

### If `./gradlew signingReport` fails with “SDK location not found”

Create `bromo-mobile/android/local.properties` (this file is gitignored):

```properties
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
```

Or set `ANDROID_HOME` to your SDK root, then run `signingReport` again.

### Option A — Gradle

```bash
cd bromo-mobile/android
./gradlew signingReport
```

Copy the **SHA1** from the `debug` variant under `:app`.

### Option B — keytool (matches `android/app/debug.keystore` in this repo)

```bash
keytool -list -v -keystore bromo-mobile/android/app/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android
```

Copy the line labeled **SHA1**.

Then:

1. Firebase Console → **Project settings** → **Your apps** → Android app (`bromo.platform`)
2. Click **Add fingerprint** and paste the SHA-1
3. Download the **updated** `google-services.json` (it now contains `oauth_client` entries)
4. Replace `bromo-mobile/android/app/google-services.json` with the new file

---

## Step 5 — Set API Base URL

Open `bromo-mobile/src/config/settings.ts` and set your backend URL:

```typescript
export const settings = {
  apiBaseUrl: 'http://YOUR_LAN_IP:4000',  // e.g. http://192.168.1.35:4000
  // ...
} as const;
```

For physical device testing, use your Mac's LAN IP (`ifconfig | grep "inet "`) — not `localhost`.

---

## Step 6 — Install iOS Pods

```bash
cd bromo-mobile/ios
pod install
```

If pods fail on Apple Silicon:

```bash
cd bromo-mobile/ios && arch -x86_64 pod install
```

### If Xcode fails with `non-modular-include-in-framework-module` or `FirebaseAuth-Swift.h` not found

The Podfile uses **`use_frameworks! :linkage => :static`** with **`$RNFirebaseAsStaticFramework = true`** (do **not** add global `use_modular_headers!`). After any Podfile change, clean pods and DerivedData, then reinstall:

```bash
cd bromo-mobile/ios
rm -rf Pods Podfile.lock build
rm -rf ~/Library/Developer/Xcode/DerivedData/BromoMobile-*
pod install
```

Open **`BromoMobile.xcworkspace`** (not the `.xcodeproj`) and build. Avoid `USE_FRAMEWORKS=dynamic` when installing pods unless you know you need it.

---

## Step 7 — Verify

### Backend
```bash
cd bromo-api && npm run dev
```
- `http://localhost:4000/health` → `{ ok: true }`
- Console prints: `[firebase] Initialized with service account`

### Mobile
```bash
cd bromo-mobile && npm start
# Press 'i' for iOS or 'a' for Android
```

### Auth Flow
1. App opens → Onboarding → Auth screen
2. Register with email + password → check inbox for verification link → click it
3. Return to app → tap "I've Verified" → create username (min 4 chars)
4. Enter main app
5. Test Google Sign-In button

---

## Security Reminders

- **Never commit** `bromo-api/firebase-service-account.json` (listed in `bromo-api/.gitignore`).
- **Never commit** mobile `.env` files (`bromo-mobile/.gitignore`).
- `google-services.json` and `GoogleService-Info.plist` are gitignored; keep local copies under `android/app/` and `ios/BromoMobile/`.
