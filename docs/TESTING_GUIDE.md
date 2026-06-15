# Cargo Control — Manual Testing Guide

## Prerequisites

### Firebase Setup
Before testing, ensure these are set up in Firebase Console:
1. At least one **operator** user in Firebase Auth + Firestore `users` collection:
   ```json
   { "uid": "<auth-uid>", "email": "operator@test.com", "role": "operator", "createdAt": <timestamp> }
   ```
2. At least one **admin** user:
   ```json
   { "uid": "<auth-uid>", "email": "admin@test.com", "role": "admin", "createdAt": <timestamp> }
3. A user with **no role** (exists in Auth but not in Firestore `users` collection)

### Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

---

## Platform Setup

### Web
```bash
npm run dev        # Local dev server at http://localhost:5173
# or
npm run build && npm run preview   # Production build preview
```

### Android
```bash
npm run build
npx cap sync android
npx cap open android
# Run on device or emulator from Android Studio
```

### iOS (Mac only)
```bash
npm run build
npx cap sync ios
npx cap open ios
# Run on device or simulator from Xcode
```

---

## Test Cases

---

### T01 — Authentication

#### T01.1 Login — Valid Operator
1. Open app → should land on `/login`
2. Enter operator credentials → tap **Sign In**
3. **Expected:** Redirect to `/operator` dashboard
4. Close app, reopen → **Expected:** Still logged in (session persists)

#### T01.2 Login — Valid Admin
1. Enter admin credentials → tap **Sign In**
2. **Expected:** Redirect to `/admin` dashboard

#### T01.3 Login — No Role Assigned
1. Enter credentials for user with no Firestore role document
2. **Expected:** Redirect to `/pending-approval` page showing email and Sign Out button

#### T01.4 Login — Wrong Password
1. Enter valid email + wrong password
2. **Expected:** Error message "Invalid email or password" (not a Firebase error code)

#### T01.5 Login — Network Error
1. Turn off WiFi/data, attempt login
2. **Expected:** Error message "Network error. Check your connection."

#### T01.6 Role-Based Route Guard
1. Log in as operator, manually navigate to `/admin`
2. **Expected:** Redirect to `/unauthorized` page
3. Log in as admin, navigate to `/operator`
4. **Expected:** Redirect to `/unauthorized` page

#### T01.7 Logout
1. Sign out from pending-approval page or any page with logout option
2. **Expected:** Redirect to `/login`, cannot access protected routes

---

### T02 — Operator Dashboard

#### T02.1 Initial State
1. Log in as operator
2. **Expected:** Two large buttons: **Load** and **Unload**
3. **Expected:** Online/offline status badge visible
4. **Expected:** "No recent operations" when no operations saved locally

#### T02.2 Online Status Badge
1. With WiFi on → **Expected:** Green WiFi icon + "Online"
2. Turn off WiFi → **Expected:** Gray icon + "Offline" (updates in real time)

#### T02.3 Recent Operations List
1. Submit 3+ operations (see T03)
2. Return to operator dashboard
3. **Expected:** Up to 5 most recent operations shown with order number, door, relative time, and status badge
4. **Expected:** Sorted newest first

#### T02.4 Sync Button
1. While offline, submit an operation
2. Return to dashboard → **Expected:** "1 pending sync" label + Sync button visible
3. Turn WiFi on → tap **Sync**
4. **Expected:** Sync button shows spinner while syncing
5. **Expected:** After sync: pending count goes to 0, operation status changes to green "synced"

---

### T03 — Operation Form

#### T03.1 Navigate to Form
1. Tap **Load** on operator dashboard
2. **Expected:** URL becomes `/operation/new?type=load`
3. **Expected:** Form shows 6 required photo slots (reefer temp, trailer, first/middle/last pallets, seal)
4. Tap **Unload**
5. **Expected:** Form shows 8 required photo slots (adds 3 product temp probes, no seal)

#### T03.2 Field Validation
1. Leave order number blank → tap Save
2. **Expected:** Save button remains disabled
3. Enter 2 characters → **Expected:** Save still disabled (min 3)
4. Enter special characters like `ORD-123` → **Expected:** Rejected (alphanumeric only)
5. Enter valid `ORD123` → **Expected:** Accepted
6. Same for door number (1-10 alphanumeric chars)

#### T03.3 Photo Capture
1. Tap **Capture** on any photo slot
2. **Expected:** Camera modal opens with live video (rear camera)
3. Tap **Capture** → **Expected:** Preview image shown
4. Tap **Retake** → **Expected:** Camera reopens
5. Tap **Use Photo** → **Expected:** Slot shows "Captured" in green

#### T03.4 Camera Permission Denied
1. Deny camera permission when prompted
2. **Expected:** Error message shown with **Try Again** button

#### T03.5 Submit Online
1. Fill all fields + capture all required photos
2. **Expected:** Save button becomes active
3. Tap **Save Operation** (online)
4. **Expected:** Success message "Synced to server"
5. **Expected:** Redirect to `/operator` after ~1.5 seconds

#### T03.6 Submit Offline
1. Turn off WiFi
2. Fill form + capture all photos → tap **Save Operation**
3. **Expected:** Success message "Saved locally. Will sync when online."
4. Return to dashboard → **Expected:** Operation appears in recent list with yellow "pending_sync" badge

#### T03.7 Offline Banner
1. While offline, open operation form
2. **Expected:** Yellow banner "You're offline. This operation will be saved locally…"

---

### T04 — Photo Capture Details

#### T04.1 Rear Camera Default
1. Open camera on a device with front + rear cameras
2. **Expected:** Rear camera activates by default

#### T04.2 Compression
1. Capture a photo
2. **Expected:** Saved file size is approximately ≤1MB (verify via browser DevTools > Application > IndexedDB)

#### T04.3 Load Photo Requirements
Verify all 6 appear for Load operations:
- [ ] Reefer Temperature
- [ ] Trailer / Plate
- [ ] First Pallets
- [ ] Middle Pallets
- [ ] Last Pallets
- [ ] Trailer Seal

#### T04.4 Unload Photo Requirements
Verify all 8 appear for Unload operations:
- [ ] Reefer Temperature
- [ ] Trailer / Plate
- [ ] Product Temperature 1
- [ ] Product Temperature 2
- [ ] Product Temperature 3
- [ ] First Pallets
- [ ] Middle Pallets
- [ ] Last Pallets

---

### T05 — Offline Sync

#### T05.1 Auto-Sync on Reconnect
1. Turn off WiFi, submit 2 operations
2. Turn WiFi back on
3. **Expected:** Sync triggers automatically within a few seconds
4. **Expected:** Both operations change from yellow "pending_sync" to green "synced"
5. Verify in Firebase Console → Firestore → `operations` collection

#### T05.2 Sync with Photos
1. Submit operation offline with all photos captured
2. Turn WiFi on and wait for auto-sync
3. In Firebase Console → Storage → `operations/<id>/` folder
4. **Expected:** All photo files present as `.jpg` files
5. In Firestore operation document → **Expected:** `photos` field contains Storage URLs

#### T05.3 Duplicate Prevention
1. Submit operation offline
2. Sync once → operation marked "synced"
3. Manually trigger sync again
4. **Expected:** No duplicate document created in Firestore

#### T05.4 Error State
1. Submit operation offline
2. Corrupt test: modify Firestore rules to reject writes temporarily
3. Trigger sync → after 3 retries: **Expected:** Operation shows red "error" badge

---

### T06 — Admin Dashboard

#### T06.1 View All Operations
1. Log in as admin
2. **Expected:** Operations table loads from Firestore
3. **Expected:** Columns: Order #, Door, Type, Operator, Status, Date, Actions

#### T06.2 Search by Order Number
1. Type partial order number in search box
2. **Expected:** Table filters in real-time, showing only matching rows

#### T06.3 Status Filter
1. Select "Pending" from status dropdown
2. **Expected:** Only `pending_sync` operations shown
3. Select "Error" → only error operations shown
4. Select "All Status" → all operations shown

#### T06.4 Operator Filter
1. Type operator name or email in operator filter field
2. **Expected:** Table filters to matching operators

#### T06.5 Date Range Filter
1. Set **From** date to today
2. **Expected:** Only today's operations shown
3. Set **To** date to yesterday (From > To)
4. **Expected:** Empty results (no operations in that range)
5. Clear filters → **Expected:** All operations restored

#### T06.6 Clear Filters Button
1. Set any filter → **Expected:** "Clear" button appears
2. Tap **Clear** → **Expected:** All filters reset, full list shown

#### T06.7 Pagination
1. If more than 20 operations exist: **Expected:** "Load More" button visible
2. Tap **Load More** → **Expected:** Next 20 operations appended to table

#### T06.8 Navigate to Detail
1. Click any table row
2. **Expected:** Navigate to `/admin/operation/<id>`
3. Alternatively: click "View Details" text in Actions column

#### T06.9 Offline State
1. Turn off WiFi, reload admin page
2. **Expected:** Error message "Failed to load operations" (admin requires internet)

---

### T07 — Operation Detail Page

#### T07.1 View Synced Operation
1. From admin dashboard, click a synced operation
2. **Expected:** All fields shown: Order #, Door, Type, Operator, Status badge, Created date, Synced date

#### T07.2 Photo Gallery
1. **Expected:** Photos displayed in 2-column grid with label below each
2. **Expected:** Photo count shown in section header

#### T07.3 Fullscreen Photo Viewer
1. Tap any photo
2. **Expected:** Full-screen black overlay with photo
3. Tap **X** button → **Expected:** Returns to detail page
4. Tap outside photo area → **Expected:** Closes lightbox

#### T07.4 Pinch to Zoom (Mobile)
1. In fullscreen view, pinch to zoom on photo
2. **Expected:** Photo zooms in/out (native gesture)

#### T07.5 Back Navigation
1. Tap back arrow in header
2. **Expected:** Returns to admin dashboard

---

### T08 — PWA Install

#### T08.1 Web Install Prompt (Chrome/Edge)
1. Open app in Chrome on Android
2. **Expected:** After using the app, browser shows install prompt or address bar install icon
3. Tap install → **Expected:** App added to home screen
4. Open from home screen → **Expected:** Opens in standalone mode (no browser chrome)

#### T08.2 Offline App Shell
1. Install PWA, open once to cache
2. Turn off WiFi completely
3. Reopen app from home screen
4. **Expected:** App loads (login screen visible) — not a "no connection" browser page

---

### T09 — Android (Capacitor)

#### T09.1 Build and Install
```bash
npm run build:android
npx cap open android
# Run → deploy to device
```

#### T09.2 Camera on Physical Device
1. Create operation, tap Capture on any photo
2. **Expected:** Native camera permission prompt appears
3. Grant permission → **Expected:** Rear camera activates in-app

#### T09.3 Offline on Device
1. Enable airplane mode
2. Submit operation → **Expected:** Saves locally with "pending_sync"
3. Disable airplane mode → **Expected:** Auto-syncs

#### T09.4 Firebase on Device
If sync fails on device:
1. Download `google-services.json` from Firebase Console → Project Settings → Your apps → Android
2. Place at `android/app/google-services.json`
3. Run `npx cap sync android` and rebuild

---

### T10 — iOS (Mac + Xcode required)

#### T10.1 Build and Install
```bash
npx cap add ios          # Only needed first time
npm run build:ios
npx cap open ios
# Select simulator or device → Build → Run
```

#### T10.2 Camera on iOS
Same as T09.2 — verify rear camera default, JPEG compression

#### T10.3 Offline on iOS Simulator
Same as T09.3

---

## Lighthouse PWA Audit (Target: 90+)

1. Build and serve: `npm run build && npm run preview`
2. Open Chrome DevTools → Lighthouse tab
3. Select: Performance, PWA, Best Practices
4. Click **Analyze page load**

**Expected scores:**
- PWA: 90+
- Performance: 70+ (large bundle warning exists — acceptable for v1)
- Best Practices: 90+

---

## Known Limitations (v1)

- Admin page requires internet (no offline support for admin view)
- No push notifications
- No user management UI (create users via Firebase Console)
- No barcode/QR scanning
- Icons require manual PNG generation before Android branding shows (see `public/icons/README.md`)
- iOS build requires Mac + Xcode
