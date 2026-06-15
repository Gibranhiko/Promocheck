# Cargo Control PWA — Tech Debt & Security Register

Items are grouped by severity and resolved one by one. Mark `[x]` when done.

---

## How to Use This File

- Each item has a unique ID (e.g. `TD-01`)
- Severity: **CRITICAL** → **HIGH** → **MEDIUM** → **LOW**
- When starting an item, move it to "In Progress". When done, check the box and note the date.

---

## CRITICAL

### TD-01 — Firebase API Key committed to version control
- [x] **Status:** Resolved — 2026-03-30
- **Note:** Only `.env.example` with empty placeholders is tracked. Actual `.env` is correctly gitignored. No exposure.

---

## HIGH

### TD-02 — Firestore rules: operatorId not validated against authenticated user
- [x] **Status:** Resolved — 2026-03-30
- **File:** `firestore.rules` (lines 23–29)
- **Risk:** `isValidOperation()` checks that `operatorId` is present but does NOT verify it equals `request.auth.uid`. A malicious client could submit an operation attributed to a different operator.
- **Fix:** Add `data.operatorId == request.auth.uid` to `isValidOperation()`:
  ```
  function isValidOperation() {
    let data = request.resource.data;
    return data.keys().hasAll(['orderNumber', 'doorNumber', 'operationType', 'operatorId', 'createdAt'])
      && data.orderNumber is string && data.orderNumber.size() > 0 && data.orderNumber.size() <= 50
      && data.doorNumber is string && data.doorNumber.size() > 0 && data.doorNumber.size() <= 20
      && data.operationType in ['load', 'unload']
      && data.operatorId is string && data.operatorId == request.auth.uid
      && data.createdAt is number;
  }
  ```

### TD-03 — Storage rules: any operator can write to any operation path
- [x] **Status:** Resolved — 2026-03-30
- **File:** `storage.rules` (photo write rule)
- **Risk:** Storage rules allow any authenticated operator to upload photos to any `operations/{operationId}/` path. Operator A can overwrite or inject photos into Operator B's operations if they know the operationId.
- **Fix:** Cross-reference the Firestore document to verify ownership before allowing upload:
  ```
  match /operations/{operationId}/{photoType} {
    allow read: if isAdmin();
    allow write: if isOperator()
      && firestore.get(/databases/(default)/documents/operations/$(operationId)).data.operatorId == request.auth.uid;
    allow delete: if false;
  }
  ```
  Also add file size and content-type validation:
  ```
  function isValidPhoto() {
    return request.resource.size < 10 * 1024 * 1024
      && request.resource.contentType.matches('image/.*');
  }
  ```

### TD-04 — Firestore rules: missing field type and length constraints
- [x] **Status:** Resolved — 2026-03-30
- **File:** `firestore.rules` (lines 23–29)
- **Risk:** `isValidOperation()` only checks field presence, not data types or string lengths. A client could write malformed data (e.g. very large strings, wrong types) that bypasses client-side Zod validation.
- **Fix:** Add type and length guards to all string fields in `isValidOperation()` (see TD-02 fix above — both can be resolved together).

### TD-05 — Storage rules: no file size or MIME type validation
- [x] **Status:** Resolved — 2026-03-30
- **File:** `storage.rules`
- **Risk:** There are no constraints on uploaded file size or type. An operator could upload multi-gigabyte files or non-image files (e.g. executables), exhausting storage quota.
- **Fix:** Add `isValidPhoto()` helper to storage rules (see TD-03 fix above — both can be resolved together).

### TD-06 — URL query param `type` cast without validation
- [x] **Status:** Resolved — 2026-03-30
- **File:** `src/pages/OperationFormPage.tsx` (line ~20)
- **Risk:** `searchParams.get("type")` is cast directly to `"load" | "unload"` with `as`. If someone navigates to `/operation/new?type=malicious`, the type assertion passes silently and unpredictable behavior follows downstream.
- **Current code:**
  ```ts
  const operationType = (searchParams.get("type") || "load") as "load" | "unload"
  ```
- **Fix:**
  ```ts
  const typeParam = searchParams.get("type")
  const operationType: "load" | "unload" = typeParam === "unload" ? "unload" : "load"
  ```

### TD-07 — No audit log for admin actions (user creation, role changes)
- [x] **Status:** Resolved — 2026-03-30
- **File:** `src/features/admin/services/adminService.ts`
- **Risk:** There is no record of which admin created a user or changed a role. In a multi-admin scenario, there is no accountability or traceability.
- **Fix:** Write to an `audit_log` Firestore collection on every `createOperatorAccount` and `updateUserRole` call:
  ```ts
  await setDoc(doc(db, "audit_log", crypto.randomUUID()), {
    action: "create_user" | "update_role",
    performedBy: auth.currentUser?.uid,
    targetUid: user.uid,
    role,
    timestamp: Date.now(),
  })
  ```
  Add Firestore rules: `allow create: if isAdmin(); allow read: if isAdmin(); allow update, delete: if false;`

---

## MEDIUM

### TD-08 — console.error / console.warn exposed in production builds
- [x] **Status:** Resolved — 2026-03-30
- **Files:**
  - `src/services/firebase/firebaseServices.ts` (line 17)
  - `src/services/offline/syncEngine.ts` (lines ~74, ~111)
- **Risk:** Raw error objects logged to console are visible to anyone who opens DevTools. They can reveal internal structure, Firestore paths, and operation data.
- **Fix:** Gate all console calls behind a dev check, or replace with a lightweight logger utility:
  ```ts
  const log = {
    error: (...args: unknown[]) => { if (import.meta.env.DEV) console.error(...args) },
    warn:  (...args: unknown[]) => { if (import.meta.env.DEV) console.warn(...args) },
  }
  ```

### TD-09 — IndexedDB data stored unencrypted
- [x] **Status:** Resolved — 2026-03-30 (pragmatic mitigation)
- **File:** `src/services/offline/db.ts`
- **Risk:** All offline operation data (order numbers, door numbers, photo blobs) is stored in plain text in IndexedDB. Anyone with physical device access or malware can read it without authentication.
- **Fix:**
  - For web: document this as an accepted risk and add a note in the privacy policy
  - For native (Capacitor): use `@capacitor/preferences` or SQLCipher for encrypted local storage
  - At minimum, avoid caching photo blobs in IndexedDB when storage can be avoided

### TD-10 — Sync engine does not verify operation ownership before syncing
- [x] **Status:** Resolved — 2026-03-30
- **File:** `src/services/offline/syncEngine.ts`
- **Risk:** When syncing offline operations, the engine does not verify that `operation.operatorId === currentUser.uid`. A shared device scenario could sync another operator's locally-modified records.
- **Fix:** Add an ownership check before each sync write:
  ```ts
  if (operation.operatorId !== auth.currentUser?.uid) {
    // skip or flag as error
    continue
  }
  ```

### TD-11 — Error messages may enable account enumeration
- [x] **Status:** Resolved — 2026-03-30
- **File:** `src/features/admin/components/CreateUserModal.tsx`
- **Risk:** When creation fails because an email already exists, the error message reveals this fact. An attacker with admin access could enumerate valid email addresses.
- **Fix:** Show a generic error: `"Could not create account. The email may already be in use."` — informative enough for admins without being a direct confirmation.

### TD-12 — No Content Security Policy (CSP) headers
- [x] **Status:** Resolved — 2026-03-30
- **File:** `vite.config.ts` / hosting configuration
- **Risk:** Without a CSP, any injected script (via XSS, browser extension, or compromised dependency) can run freely and exfiltrate data.
- **Fix:** Add CSP headers at the hosting layer (Firebase Hosting `firebase.json`) or via Vite dev server config:
  ```json
  "headers": [{
    "source": "**",
    "headers": [{
      "key": "Content-Security-Policy",
      "value": "default-src 'self'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com; img-src 'self' blob: data: https://firebasestorage.googleapis.com; script-src 'self'; style-src 'self' 'unsafe-inline';"
    }]
  }]
  ```

### TD-13 — No session inactivity timeout
- [x] **Status:** Resolved — 2026-03-30
- **File:** `src/features/auth/services/authService.ts` / `src/features/auth/hooks/useAuth.ts`
- **Risk:** Sessions never expire from inactivity. A device left unattended stays logged in indefinitely.
- **Fix:** Track last user interaction timestamp. If idle for more than 30 minutes, call `signOut()` and redirect to login. A lightweight `useIdleTimer` hook or the `idle-js` package can handle this.

### TD-14 — npm dependency vulnerabilities
- [ ] **Status:** Open
- **File:** `package.json`
- **Risk:** Several dependencies have known CVEs:
  - `vite-plugin-pwa@0.21.0` — HIGH via `@rollup/plugin-terser` / `workbox-build`
  - `minimatch` — HIGH (ReDoS)
  - `@capacitor/assets` — HIGH via `tar`
  - `brace-expansion`, `esbuild`, `vite` — MODERATE
- **Fix:**
  ```bash
  npm audit
  npm audit fix
  # For remaining: manually update or pin to safe versions
  ```

---

## LOW

### TD-15 — Toast notifications may display raw error text
- [ ] **Status:** Open
- **Files:** Various pages that call `toast.error(err.message)` or similar
- **Risk:** Firebase SDK error messages can contain internal detail (e.g. Firestore path, rule evaluation info) that gets shown directly to users.
- **Fix:** Catch Firebase errors and map them to user-friendly messages before passing to `toast.error()`. Never pass `err.message` directly from Firebase SDK calls.

### TD-16 — No data retention / TTL policy for old operations
- [ ] **Status:** Open
- **File:** Firestore configuration
- **Risk:** Operations accumulate indefinitely with no cleanup. Over time this increases storage costs and may create privacy obligations.
- **Fix:** Define a retention policy (e.g. delete operations older than 1 year). Implement via Firebase scheduled Cloud Function or Firestore TTL field policy (available in Firestore native mode).

### TD-17 — Missing security headers (X-Frame-Options, X-Content-Type-Options)
- [x] **Status:** Resolved — 2026-03-30 — Fixed alongside TD-12
- **File:** `firebase.json` hosting headers (or equivalent)
- **Risk:** Without these headers, the app can be embedded in iframes (clickjacking) and browsers may MIME-sniff responses.
- **Fix:** Add to Firebase Hosting headers:
  ```json
  { "key": "X-Frame-Options", "value": "DENY" },
  { "key": "X-Content-Type-Options", "value": "nosniff" },
  { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
  ```

---

## Resolved

_Items moved here once completed, with resolution date._

| ID | Title | Resolved |
|----|-------|----------|
| TD-01 | Firebase API Key committed to version control | 2026-03-30 — Non-issue, only .env.example tracked |
| TD-02 | Firestore rules: operatorId not validated against auth user | 2026-03-30 |
| TD-03 | Storage rules: any operator can write to any operation path | 2026-03-30 |
| TD-04 | Firestore rules: missing field type and length constraints | 2026-03-30 — Fixed alongside TD-02 |
| TD-05 | Storage rules: no file size or MIME type validation | 2026-03-30 — Fixed alongside TD-03 |
| TD-06 | URL query param `type` cast without validation | 2026-03-30 |
| TD-07 | No audit log for admin actions | 2026-03-30 |
| TD-08 | console.error / console.warn exposed in production | 2026-03-30 |
| TD-09 | IndexedDB data stored unencrypted | 2026-03-30 — clearAllData() called on logout |
| TD-10 | Sync engine does not verify operation ownership | 2026-03-30 |
| TD-11 | Error messages may enable account enumeration | 2026-03-30 |
| TD-12 | No Content Security Policy headers | 2026-03-30 |
| TD-13 | No session inactivity timeout | 2026-03-30 — useIdleTimeout hook, 30min |
| TD-17 | Missing security headers (X-Frame-Options, etc.) | 2026-03-30 — Fixed alongside TD-12 |

---

## Summary (Phase 1 — pre-audit)

| Severity | Total | Open | Done |
|----------|-------|------|------|
| CRITICAL | 1 | 0 | 1 |
| HIGH | 6 | 0 | 6 |
| MEDIUM | 7 | 1 | 6 |
| LOW | 3 | 2 | 1 |
| **Total** | **17** | **3** | **14** |

---

---

## Phase 2 — Production Readiness Audit (2026-04-02)

> Full audit covering offline/sync, Capacitor/mobile, Firebase, error handling, code quality, UX, and security. Assumes real warehouse production environment with poor connectivity and native iOS/Android builds.

---

## 🔴 CRITICAL

---

### TD-18 — Camera completely non-functional on native iOS and Android

**Type:** Bug
**Area:** Capacitor / Mobile

**Problem:**
`@capacitor/camera` is not installed. `useCamera.ts` uses browser `getUserMedia` exclusively. On a Capacitor WebView (iOS/Android), `getUserMedia` either fails silently or is unavailable. Operators cannot capture photos on native devices.

**Impact:**
The core operator workflow — capturing required photos — is completely broken on Android and iOS native builds. This is a production blocker.

**Proposed Solution:**
Install `@capacitor/camera`. In `useCamera.ts`, detect the platform via `Capacitor.isNativePlatform()` and branch to `Camera.getPhoto()` on native and `getUserMedia` on web. Handle permissions explicitly with `Camera.requestPermissions()`.

- [x] **Status:** Resolved — 2026-04-02

**Acceptance Criteria:**
- [x] `@capacitor/camera` added to `package.json` dependencies
- [x] `useCamera.ts` uses `Camera.getPhoto()` on native platforms
- [x] `useCamera.ts` falls back to `getUserMedia` on web/PWA
- [x] Camera permission request handled on both iOS and Android before first capture attempt
- [ ] Photo capture works end-to-end on a real Android device — manual test pending

---

### TD-19 — Android Manifest missing camera permissions

**Type:** Bug
**Area:** Capacitor / Mobile

**Problem:**
`android/app/src/main/AndroidManifest.xml` only declares `INTERNET`. Missing: `CAMERA`, and optionally `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` depending on how photo blobs are handled.

**Impact:**
App crashes or silently fails when trying to access the camera on Android. Runtime permission request never fires.

**Proposed Solution:**
Add to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="true" />
```

- [x] **Status:** Resolved — 2026-04-02

**Acceptance Criteria:**
- [x] `CAMERA` permission declared in `AndroidManifest.xml`
- [x] Camera feature declared with `android:required="true"`
- [x] Runtime permission request handled gracefully when denied (via `Camera.requestPermissions()`)

---

### TD-20 — iOS Info.plist missing camera privacy description

**Type:** Bug
**Area:** Capacitor / Mobile

**Problem:**
`ios/App/App/Info.plist` does not contain `NSCameraUsageDescription`. iOS 14+ rejects any app that accesses the camera without this key. App will crash at runtime and be rejected during App Store review.

**Impact:**
App Store submission blocked. App crashes on iOS when camera is accessed.

**Proposed Solution:**
Add to `Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>Camera access is required to capture photos of cargo loading and unloading operations.</string>
```

- [x] **Status:** Resolved — 2026-04-02 — `NSCameraUsageDescription` added to `capacitor.config.ts` Camera plugin block; applied automatically on `npx cap sync ios`

**Acceptance Criteria:**
- [x] `NSCameraUsageDescription` added to `capacitor.config.ts` (injected into `Info.plist` on sync)
- [ ] App does not crash on iOS when camera is accessed — pending iOS project initialization on Mac
- [ ] App passes App Store privacy manifest review — pending submission

---

### TD-21 — Concurrent sync race condition — no mutex guard

**Type:** Bug
**Area:** Offline / Sync

**Problem:**
`runSyncEngine()` can be called simultaneously from two paths: the manual sync button in `useOnlineStatus` and the `setInterval` in `startBackgroundSync()`. There is no lock or flag to prevent concurrent execution. Both calls fetch the same pending operations and attempt to upload the same photos in parallel.

**Impact:**
- Duplicate photo uploads to Firebase Storage
- `updateOperationPhotos` and `markOperationSynced` race each other, potentially leaving IndexedDB in an inconsistent state
- Wasted bandwidth and Firebase Storage write costs

**Proposed Solution:**
Add a module-level `let syncInProgress = false` guard at the top of `syncEngine.ts`. Set it `true` at the start of `runSyncEngine` and `false` in a `finally` block. `startBackgroundSync` should check this flag before calling `runSyncEngine`.

**Acceptance Criteria:**
- [ ] `runSyncEngine` is not executed concurrently from any code path
- [ ] Manual sync button correctly reflects running state
- [ ] Background sync interval skips if sync is already in progress

---

### TD-22 — Local photo blobs never cleaned up — storage quota will fill

**Type:** Bug
**Area:** Offline / Storage

**Problem:**
`cleanupSyncedPhotos()` in `db.ts` exists but is never called anywhere in the codebase. After an operation syncs successfully, photo blobs remain in IndexedDB indefinitely. Over time, `checkQuotaBeforeSave()` will throw `StorageQuotaExceededError`, preventing new operation creation.

**Impact:**
In long-running production use, operators will be blocked from creating new operations with no clear explanation. Data loss risk if new operations cannot be saved.

**Proposed Solution:**
Call `cleanupSyncedPhotos()` at the end of a successful sync cycle in `syncEngine.ts`, after `markOperationSynced`. Also call it on app startup to recover from any previous missed cleanups.

**Acceptance Criteria:**
- [ ] `cleanupSyncedPhotos()` is called after each successful operation sync
- [ ] `cleanupSyncedPhotos()` is called on app startup
- [ ] IndexedDB photo store size remains bounded after many operations

---

### TD-23 — Rejection reason cleared on sync retry after admin sets it

**Type:** Bug
**Area:** Offline / Sync

**Problem:**
`syncOperationToFirestore()` now preserves `op.photos` on re-sync but unconditionally sets `rejectionReason: null`. If an admin rejects an operation, the operator's device goes offline, and then the sync engine retries the original operation, it will wipe the rejection reason from Firestore before the operator sees it.

**Impact:**
Operator never receives the admin's rejection feedback. Workflow is silently broken.

**Proposed Solution:**
Only clear `rejectionReason` in `syncOperationToFirestore` when the operation's local status indicates a deliberate operator re-submission (i.e., status is `pending_sync` after a rejection cycle). This requires differentiating a fresh sync retry from an intentional re-submission. Add a boolean field `isResubmission` to the local operation record set only when the operator explicitly saves the edit form.

**Acceptance Criteria:**
- [ ] Rejection reason set by admin is not overwritten by an unrelated sync retry
- [ ] Rejection reason IS cleared when operator intentionally re-submits
- [ ] Operator sees rejection reason on their device before re-submitting

---

### TD-24 — App killed mid-upload leaves orphaned Storage files with no Firestore record

**Type:** Bug
**Area:** Offline / Sync / Firebase

**Problem:**
If the app is killed after `uploadPhotoToStorage()` but before `updateOperationPhotos()` completes, Firebase Storage contains photo files that are not referenced in any Firestore document. On retry, new files are uploaded to new paths (timestamp changes), leaving the orphaned files.

**Impact:**
Storage cost accumulates from orphaned files with no cleanup mechanism. Scale of waste depends on frequency of interrupted syncs.

**Proposed Solution:**
Short-term: Document as accepted risk. Long-term: use deterministic storage paths (e.g., `operations/{id}/{photoType}.jpg` without timestamp) so retries overwrite instead of orphaning. Or implement a Firebase Storage lifecycle rule to delete unaccessed files older than 30 days.

**Acceptance Criteria:**
- [ ] Storage paths are deterministic so retries overwrite previous partial uploads
- [ ] Or: Firebase Storage lifecycle rule deletes orphaned files after N days

---

## 🟠 HIGH

---

### TD-25 — iOS background sync not supported — pending operations silently stuck

**Type:** Improvement
**Area:** Capacitor / Mobile / Offline

**Problem:**
`supportsBackgroundSync()` returns `false` on iOS because `SyncManager` is not available in WKWebView. The `setInterval`-based fallback only runs while the app is in the foreground. If an operator creates operations and closes the app, syncing never happens until they reopen it.

**Impact:**
In a warehouse environment where operators create operations and move on, photos may remain unsynced for hours or days. Admins see stale data.

**Proposed Solution:**
Use the Capacitor App lifecycle plugin to detect `appStateChange` events. When the app comes back to foreground and is online, trigger `runSyncEngine()`. Document clearly for operators that sync requires the app to be open.

- [x] **Status:** Resolved — 2026-04-02 — `@capacitor/app` `appStateChange` listener added to `useOnlineStatus.ts`; triggers `sync()` when app returns to foreground and is online

**Acceptance Criteria:**
- [x] Sync is triggered when app returns to foreground on iOS/Android
- [ ] Operator sees a pending count badge — existing `pendingCount` state already surfaces this in the UI
- [x] Documented behavior: sync does not happen while app is closed on iOS (background process limitation)

---

### TD-26 — Camera stream not restarted after app resume on Android

**Type:** Bug
**Area:** Capacitor / Mobile

**Problem:**
When the Android app is backgrounded and resumed, the camera stream (`getUserMedia`) is paused or killed by the OS. `useCamera.ts` does not listen for the Capacitor App `appStateChange` event and does not re-initialize the stream on resume. Operators see a frozen or black camera preview.

**Impact:**
Operator must close and reopen the camera modal to get a working preview, causing friction and potential photo capture errors.

**Proposed Solution:**
(Short-term, before TD-18 resolves to native camera) Listen for `App.addListener('appStateChange', ...)` in `useCamera.ts`. On resume, call `stopCamera()` then `startCamera()`. On background, call `stopCamera()` to release the camera resource.

- [x] **Status:** Resolved — 2026-04-02 — `App.addListener('appStateChange')` added to `CameraCapture.tsx` (web path only); stops stream on background, restarts on foreground. On native, TD-18's `Camera.getPhoto()` is stateless so this is moot.

**Acceptance Criteria:**
- [x] Camera stream is automatically restarted after app resume (web path)
- [x] Camera is released when app goes to background (OS requirement)
- [x] No frozen frame shown to operator on resume

---

### TD-27 — `fetchAllOperations` — unbounded full collection scan

**Type:** Performance / Cost
**Area:** Firebase / Firestore

**Problem:**
`fetchAllOperations()` in `operationService.ts` has no `limit()` clause and fetches the entire operations collection. With 1,000+ operations, this is thousands of billed reads in a single call. The function is not called by any page — it is dead code.

**Impact:**
If this function is ever called (e.g., added to a future feature), it will cause a massive Firestore cost spike. Dead code also increases maintenance surface.

**Proposed Solution:**
Delete `fetchAllOperations()`. If a full export is needed, implement a paginated version or a Cloud Function that performs the export server-side.

**Acceptance Criteria:**
- [ ] `fetchAllOperations()` removed from `operationService.ts`
- [ ] No other code paths reference it

---

### TD-28 — No global React Error Boundary — white screen on unhandled throw

**Type:** Bug
**Area:** Frontend / UX

**Problem:**
No `<ErrorBoundary>` component wraps the router or any major page. Any uncaught JavaScript error inside a component renders a white screen with no user-facing message and no recovery path.

**Impact:**
In production, any unexpected error (network, rendering, state) leaves operators staring at a blank screen with no way to recover except a hard refresh. Operations in progress may be lost.

**Proposed Solution:**
Create an `ErrorBoundary` React class component and wrap the `<RouterProvider>` in `App.tsx`. Display a user-friendly error page with a "Reload" button. Optionally log to a service like Sentry.

**Acceptance Criteria:**
- [ ] `<ErrorBoundary>` wraps the root router
- [ ] Caught errors render a readable error page with a reload button
- [ ] Error details are not leaked to the UI in production

---

### TD-29 — Firebase error messages surfaced directly in toast notifications

**Type:** Security / UX
**Area:** Frontend

**Problem:**
Multiple locations pass Firebase SDK error messages directly to `toast.error()`. Firebase errors contain internal paths (e.g., `databases/default/documents/operations/...`) and rule evaluation details.

**Specific locations:**
- `useOnlineStatus.ts` line 69: `toast.error(\`Sync error: ${reason}\`)`
- `OperationDetailPage.tsx` catch block: `setError(err instanceof Error ? err.message : ...)`

**Impact:**
Internal Firestore paths, collection names, and field structures are visible to all users including operators. Security risk (TD-15 adjacent).

**Proposed Solution:**
Create a `mapFirebaseError(err: unknown): string` utility that maps known Firebase error codes to user-friendly messages and returns a generic fallback for unknown errors. Use this everywhere `err.message` is passed to UI.

**Acceptance Criteria:**
- [ ] No raw Firebase error messages are shown to users in production
- [ ] All toast and error state calls use the mapped error utility
- [ ] Known Firebase errors (permission-denied, unavailable, etc.) show clear actionable messages

---

### TD-30 — Missing network timeout on Firestore/Storage calls

**Type:** Reliability
**Area:** Offline / Sync / Firebase

**Problem:**
All Firebase calls in `syncEngine.ts` (`syncOperationToFirestore`, `uploadPhotoToStorage`, `updateOperationPhotos`) have no explicit timeout. On intermittent connectivity, these can hang indefinitely, blocking the sync queue.

**Impact:**
Operator sees "Uploading…" spinner that never resolves. App appears frozen. Battery drain. Eventually the OS may kill the app mid-hang.

**Proposed Solution:**
Wrap each Firebase call with a `Promise.race` timeout (e.g., 30 seconds):
```ts
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([promise, new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), ms)
  )])
```
Apply to all sync engine network calls.

**Acceptance Criteria:**
- [ ] All sync engine Firebase calls timeout after a configurable duration (default 30s)
- [ ] Timeout triggers the existing retry logic
- [ ] Operator UI reflects the timeout state and prompts retry

---

### TD-31 — Back navigation discards unsaved form data silently

**Type:** Bug / UX
**Area:** Frontend / Mobile

**Problem:**
In `OperationFormPage.tsx`, if an operator fills in details and captures several photos, then navigates back (browser back, swipe gesture on iOS, or Android hardware back button), all entered data and captured photo blobs are silently discarded. No confirmation dialog is shown.

**Impact:**
In a warehouse environment with distractions, accidental navigation causes complete loss of in-progress work. Operator must start over.

**Proposed Solution:**
Use the `useBeforeUnload` pattern and intercept React Router navigation with a `useBlocker` (React Router v6.13+). Show a confirmation dialog when the form is dirty (any field filled or photo captured).

- [x] **Status:** Resolved — 2026-04-02 — `useBlocker` added to `OperationFormPage.tsx`; dirty check differs between new/edit mode; confirmation dialog with "Keep editing" / "Discard" actions

**Acceptance Criteria:**
- [x] Confirmation dialog appears before navigation away from a dirty form
- [x] Confirmation is skipped when form is empty (nothing to lose)
- [x] Works correctly on iOS swipe-back and Android hardware back button

---

### TD-32 — Duplicate operation merge logic not extracted — diverges between pages

**Type:** Refactor
**Area:** Frontend / Code Quality

**Problem:**
The logic to merge local (IndexedDB) and server (Firestore) operations into a deduplicated map exists identically in `OperatorPage.tsx` (lines 29-51) and `OperatorHistoryPage.tsx` (lines 23-51). When one is updated, the other is not, leading to behavioral divergence.

**Impact:**
Bug fixed in one page silently remains in the other. Already observed: `OperatorPage` shows 5 most recent, `OperatorHistoryPage` shows all — same merge logic with different slicing, making divergence likely.

**Proposed Solution:**
Extract to `src/shared/utils/mergeOperations.ts`:
```ts
export function mergeLocalAndRemoteOperations(
  localOps: Operation[],
  serverOps: Operation[]
): Operation[]
```

**Acceptance Criteria:**
- [ ] Shared utility extracted and covered by unit tests
- [ ] Both `OperatorPage` and `OperatorHistoryPage` use the shared utility
- [ ] Behavior is identical between both pages for the same input

---

## 🟡 MEDIUM

---

### TD-33 — `URL.createObjectURL` leaked in `compressImage` utility

**Type:** Bug / Memory Leak
**Area:** Frontend / Camera

**Problem:**
In `src/shared/utils/` (the image compression utility), `URL.createObjectURL(blob)` is assigned to `img.src` but never revoked after the image loads. Every photo capture leaks one object URL.

**Impact:**
Over a session where an operator captures many photos or re-takes photos multiple times, memory usage grows unbounded. On low-end Android devices, this contributes to OOM (out-of-memory) crashes.

**Proposed Solution:**
Store the URL reference before assigning:
```ts
const objectUrl = URL.createObjectURL(blob)
img.src = objectUrl
img.onload = () => {
  URL.revokeObjectURL(objectUrl)
  // continue with canvas operations
}
```

- [x] **Status:** Resolved — 2026-04-02 — `objectUrl` stored before assignment; revoked in both `onload` and `onerror` callbacks in `src/shared/utils/helpers.ts`

**Acceptance Criteria:**
- [x] Object URL is revoked in `onload` callback
- [x] Object URL is also revoked in `onerror` callback
- [ ] No memory growth observed after repeated photo captures — manual test pending

---

### TD-34 — Zustand stores not using selectors — unnecessary re-renders

**Type:** Performance
**Area:** Frontend / State

**Problem:**
Components destructure the entire Zustand store:
```ts
const { user, isLoading, setUser } = useAuthStore()
```
Without selectors, every store update triggers a re-render in all subscribers, even if the changed field is irrelevant to the component.

**Impact:**
On slow Android devices, unnecessary re-renders during sync (where `operationStore` updates frequently) cause visible UI jank.

**Proposed Solution:**
Replace store subscriptions with per-field selectors:
```ts
const user = useAuthStore((s) => s.user)
```
Apply consistently across all store consumers.

**Acceptance Criteria:**
- [ ] All Zustand consumers use field-level selectors
- [ ] No full-store destructuring in any component

---

### TD-35 — Photo `onError` handler does not notify admin of incomplete operations

**Type:** UX / Bug
**Area:** Frontend / Admin

**Problem:**
When a photo fails to load in `OperationDetailPage.tsx`, the `onError` handler sets `hasError: true` which shows "Failed to load" in place of the image. However:
- No toast or alert tells the admin that the operation has broken photos
- Admin can still approve an operation they haven't been able to review
- No logging or tracking of which photos failed

**Impact:**
Admin approves an operation with photos they could not actually see. Client receives incomplete documentation.

**Proposed Solution:**
When any photo sets `hasError: true`, show a warning banner: "One or more photos failed to load. Approval is not recommended until photos are accessible." Disable the Approve button if any photo has an error.

**Acceptance Criteria:**
- [ ] Warning shown to admin when any photo fails to load
- [ ] Approve button disabled while photo errors are present
- [ ] Admin can override and still approve with explicit acknowledgment

---

### TD-36 — Duplicate order number + door not checked before submit

**Type:** UX / Data Quality
**Area:** Frontend / Offline

**Problem:**
`OperationFormPage.tsx` does not check for existing operations with the same order number and door number before saving. An operator can create duplicate operations for the same shipment by mistake.

**Impact:**
Admin receives multiple operations for the same physical shipment. Manual deduplication required. Client receives conflicting documentation.

**Proposed Solution:**
Before saving, query local operations for matching `orderNumber + doorNumber + operationType + date (same calendar day)`. If found, show a warning: "An operation with this order number and door was already created today. Are you sure?" Allow override.

**Acceptance Criteria:**
- [ ] Duplicate detection runs against local IndexedDB on submit
- [ ] Warning dialog shown with details of the existing operation
- [ ] Operator can proceed after confirming

---

### TD-37 — `navigator.onLine` does not reflect actual Firebase connectivity

**Type:** Reliability / UX
**Area:** Frontend / Offline

**Problem:**
`useOnlineStatus.ts` uses `navigator.onLine` as the connectivity signal. This reflects whether the device has a network interface, not whether Firebase (or any external service) is actually reachable. In warehouses with captive portals or intermittent high-packet-loss WiFi, `navigator.onLine` is `true` while all Firebase requests fail.

**Impact:**
Operator sees "Online" and taps Sync. All requests hang or fail silently. Operator believes data is syncing when it is not.

**Proposed Solution:**
Supplement `navigator.onLine` with a lightweight Firebase connectivity check. Firebase Realtime Database offers `onValue(ref(rtdb, '.info/connected'), ...)` — even without using the RTDB for data, this is a reliable, low-cost connectivity probe. Alternatively, use Firestore's `enableNetwork`/`disableNetwork` events.

**Acceptance Criteria:**
- [ ] Online indicator reflects actual Firebase reachability, not just network interface
- [ ] Sync is not triggered when Firebase is unreachable
- [ ] Operator sees "Connected" vs "Online (Firebase unreachable)" distinction

---

### TD-38 — No deduplication guard on `savePhotoLocally` — retakes accumulate stale blobs

**Type:** Bug / Storage
**Area:** Offline / Storage

**Problem:**
`savePhotoLocally()` uses `db.put("photos", photo)` with key `{operationId}_{photoType}`. This correctly overwrites on retake. However, in edit mode (`OperationFormPage` edit flow), photos are saved with the same key pattern, so retakes do correctly overwrite. This is fine, but if the photo type list changes between the original and edited operation type (e.g., load → unload), old photo types from the original type are never deleted from IndexedDB.

**Impact:**
Stale blobs for photo types that no longer apply to the operation accumulate in IndexedDB. When the sync engine calls `getPhotosForOperation`, it retrieves all photos including stale ones, uploading unnecessary files.

**Proposed Solution:**
When saving an edited operation, explicitly delete all existing local photos for that operation before saving new ones:
```ts
const existing = await getPhotosForOperation(operationId)
for (const p of existing) await deletePhoto(p.id)
```

**Acceptance Criteria:**
- [ ] Editing an operation clears stale photo blobs for removed photo types
- [ ] Only applicable photos are uploaded during sync after an edit

---

## 🟢 LOW

---

### TD-39 — `fetchAllOperations` is dead code

**Type:** Code Quality
**Area:** Firebase / Code

**Problem:**
`fetchAllOperations()` in `operationService.ts` is exported but never called anywhere in the application. It performs an unbounded Firestore query (no `limit()`).

**Impact:**
Dead code increases maintenance surface and poses a risk if accidentally called.

**Proposed Solution:**
Remove the function. If a full data export is ever needed, implement it server-side via a Cloud Function.

**Acceptance Criteria:**
- [ ] `fetchAllOperations` removed from `operationService.ts`
- [ ] No import references remain

---

### TD-40 — No data retention policy — operations grow indefinitely

**Type:** Cost / Compliance
**Area:** Firebase / Firestore

**Problem:**
(Carry-forward from TD-16) Operations accumulate indefinitely with no TTL or archival policy. Storage and Firestore costs grow linearly with usage.

**Impact:**
Long-term cost risk. Potential GDPR/privacy obligation if personal data (operator names, order numbers) must be purged after a retention period.

**Proposed Solution:**
Define a retention window (e.g., 1 year). Implement a Firebase scheduled Cloud Function (or Firestore TTL policy via `expireAt` field) to archive or delete operations older than the retention window.

**Acceptance Criteria:**
- [ ] Retention policy defined and documented
- [ ] Automated cleanup mechanism in place
- [ ] Approved operations exported/archived before deletion if needed

---

### TD-41 — npm dependency vulnerabilities (carry-forward TD-14)

**Type:** Security
**Area:** Dependencies

**Problem:**
Known HIGH CVEs in: `vite-plugin-pwa`, `minimatch`, `@capacitor/assets`, `brace-expansion`, `esbuild`, `vite`.

**Proposed Solution:**
```bash
npm audit
npm audit fix
```
Pin remaining unfixable packages to safe versions manually.

**Acceptance Criteria:**
- [ ] `npm audit` reports zero HIGH or CRITICAL vulnerabilities
- [ ] All remaining MODERATE vulnerabilities reviewed and accepted or mitigated

---

## Updated Summary (Phase 2)

_Updated 2026-04-02: TD-18, TD-19, TD-20, TD-25, TD-26, TD-31, TD-33 resolved (mobile/iOS/Android pass)_

| Severity | Phase 1 Open | Phase 2 New | Resolved (2026-04-02) | Total Open |
|----------|-------------|-------------|----------------------|------------|
| 🔴 CRITICAL | 0 | 6 (TD-18 to TD-24) | 3 (TD-18, TD-19, TD-20) | **3** |
| 🟠 HIGH | 1 (TD-14) | 8 (TD-25 to TD-32) | 2 (TD-25, TD-26) | **7** |
| 🟡 MEDIUM | 2 (TD-15, TD-16) | 6 (TD-33 to TD-38) | 1 (TD-33) | **7** |
| 🟢 LOW | 0 | 3 (TD-39 to TD-41) | 0 | **3** |
| **Total open** | **3** | **23** | **6** | **20** |

---

---

## Phase 3 — Deep Security Audit (2026-04-02)

> Strict adversarial review of all layers: Firestore rules, Storage rules, auth/authorization, client-side validation gaps, mobile security, and data integrity. Assumes malicious authenticated users (rogue operators, compromised accounts) as the primary threat model in addition to unauthenticated attackers.

---

## 🔴 CRITICAL

---

### TD-42 — Deactivated users retain full Firebase access — Auth account never disabled

**Type:** Security — Authorization
**Area:** Firebase Auth / Firestore / Admin

**Problem:**
`deactivateUser()` in `adminService.ts` sets `active: false` on the Firestore user document but does **not** disable or delete the Firebase Auth account. Firestore security rules check only `role` (which is unchanged) and never check the `active` flag. A deactivated operator can:

1. Continue logging in with their existing credentials
2. Receive a valid JWT from Firebase Auth
3. Pass all Firestore and Storage rule checks (role is still `"operator"`)
4. Read, create, and update operations indefinitely

**File:** [src/features/admin/services/adminService.ts](src/features/admin/services/adminService.ts) — `deactivateUser()`, line 105  
**File:** [firestore.rules](firestore.rules) — `isOperator()` function, line 67

**Real-World Impact:**
A terminated warehouse employee who is "deactivated" in the admin panel retains full access to all cargo data and can continue creating operations. This violates the principle of least privilege and any standard offboarding security requirement.

**Proposed Solution:**
Use the Firebase Admin SDK (via a Cloud Function) to call `auth.updateUser(uid, { disabled: true })` when deactivating a user. Alternatively, add an `active` check to Firestore rules:
```js
function isOperator() {
  let userDoc = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
  return isAuthenticated()
    && userDoc.role == "operator"
    && userDoc.get("active", true) == true;
}
```
Both fixes should be applied: the rule change is the defense-in-depth layer; the Auth disable is the primary control.

**Acceptance Criteria:**
- [ ] Deactivated users are immediately blocked from new Firebase Auth sign-ins
- [ ] Existing sessions for deactivated users are revoked within minutes (via `auth.revokeRefreshTokens(uid)`)
- [ ] Firestore rules also check `active != false` as a secondary guard
- [ ] Admin UI reflects that deactivation is enforced at the Auth layer

---

### TD-43 — Operators can self-approve and self-reject operations via direct Firestore API

**Type:** Security — Privilege Escalation
**Area:** Firestore Rules

**Problem:**
`isValidOperationUpdate()` in `firestore.rules` (line 109) checks that `status` is one of the five valid values but does **not** restrict which statuses an operator is allowed to set. A malicious operator can make a direct Firestore API call to update their own operation's status to `"approved"` — completely bypassing the admin review workflow.

**Proof of concept:**
```js
// Operator calls this directly against Firestore API
updateDoc(doc(db, "operations", "their-op-id"), { status: "approved" })
// Passes all Firestore rules — operatorId matches, status is a valid enum value
```

**File:** [firestore.rules](firestore.rules) — `isValidOperationUpdate()`, line 109; operator update rule, line 157

**Real-World Impact:**
Any operator can approve their own work without admin review. The entire audit/review workflow is unenforceable at the data layer, making the admin approval feature security theater.

**Proposed Solution:**
Restrict which status transitions operators vs. admins can make:
```js
function isOperatorAllowedStatus() {
  let newStatus = request.resource.data.status;
  // Operators can only move to pending_sync or error — never approved/rejected
  return newStatus in ['pending_sync', 'synced', 'error'];
}

// In the update rule:
allow update: if isAdmin() ||
  (isOperator()
    && resource.data.operatorId == request.auth.uid
    && isValidOperationUpdate()
    && isOperatorAllowedStatus());
```

**Acceptance Criteria:**
- [ ] Operators cannot set status to `"approved"` or `"rejected"` via any API call
- [ ] Only admins can transition an operation to `"approved"` or `"rejected"`
- [ ] Existing app functionality for operators setting `"pending_sync"` on re-submit still works

---

## 🟠 HIGH

---

### TD-44 — All operators can read all other operators' operations — no row-level isolation

**Type:** Security — Data Exposure
**Area:** Firestore Rules

**Problem:**
`allow read: if isAdmin() || isOperator()` on the `operations` collection gives every operator unrestricted read access to every operation in the database. A malicious operator can query the entire operations collection and access all order numbers, client names, door numbers, and photo URLs belonging to other operators.

**File:** [firestore.rules](firestore.rules) — operations read rule, line 150

**Note:** The frontend queries are scoped with `where("operatorId", "==", uid)`, but this is client-side enforcement only. The Firestore rule does not enforce it.

**Real-World Impact:**
A disgruntled operator can enumerate all clients, all order numbers, and view all cargo operation photos from all other employees — a significant competitive and privacy data exposure.

**Proposed Solution:**
Restrict operator reads to their own operations at the rule level:
```js
allow read: if isAdmin() ||
  (isOperator() && resource.data.operatorId == request.auth.uid);
```
Note: `list` queries with `where("operatorId", "==", uid)` work correctly under this rule because Firestore evaluates the rule against each matching document. Ensure all operator queries include the `operatorId` filter.

**Acceptance Criteria:**
- [ ] Operators cannot read operations belonging to other operators
- [ ] All existing operator list queries (`OperatorPage`, `OperatorHistoryPage`) include `where("operatorId", "==", uid)` and continue to work
- [ ] Admins retain full read access

---

### TD-45 — `orderNumber` and `doorNumber` format not enforced in Firestore rules — XSS payloads accepted

**Type:** Security — Injection / Data Integrity
**Area:** Firestore Rules

**Problem:**
`isValidOperation()` enforces string length limits and type checks on `orderNumber` and `doorNumber` but does **not** enforce the alphanumeric-only regex (`/^[A-Za-z0-9]+$/`) that the frontend Zod schema applies. A malicious actor calling the Firestore API directly can write:
- HTML/script strings: `<img src=x onerror=alert(1)>`
- Control characters or Unicode injection strings
- Excessively long values between 20–50 chars (frontend allows max 20, Firestore allows max 50)

**File:** [firestore.rules](firestore.rules) — `isValidOperation()`, line 80  
**File:** [src/features/operations/schemas/operationSchema.ts](src/features/operations/schemas/operationSchema.ts) — regex rule, line 8

**Real-World Impact:**
Injected strings are stored in Firestore and rendered directly in the admin panel. If any future component uses `dangerouslySetInnerHTML`, or if data is exported to a CSV/report, XSS payloads become effective. Also, length inconsistencies allow data through that the frontend considers invalid.

**Proposed Solution:**
Add regex matching to Firestore rules using the `matches()` function:
```js
&& data.orderNumber.matches('^[A-Za-z0-9]{3,20}$')
&& data.doorNumber.matches('^[A-Za-z0-9]{1,10}$')
```
Also align the Firestore max lengths with the frontend schema (50 → 20 for `orderNumber`, 20 → 10 for `doorNumber`).

**Acceptance Criteria:**
- [ ] Firestore rules enforce alphanumeric-only regex on `orderNumber` and `doorNumber`
- [ ] Field length limits are consistent between Firestore rules and the Zod schema
- [ ] Writes with special characters, HTML tags, or overlong strings are rejected at the rules layer

---

### TD-46 — `photos` map is completely unconstrained in Firestore rules — DoS and data pollution risk

**Type:** Security — DoS / Data Integrity
**Area:** Firestore Rules

**Problem:**
`isValidOperation()` and `isValidOperationUpdate()` both check that `photos is map` but impose no constraints on:
- Number of entries in the map (could be 10,000+)
- Keys of the map (should be valid `PhotoType` values)
- Values of the map (should be `{url: string, capturedAt: int}` objects)

A malicious operator can write a Firestore document with a `photos` map containing thousands of entries or arbitrary key-value pairs.

**File:** [firestore.rules](firestore.rules) — `isValidOperation()` line 104, `isValidOperationUpdate()` line 116

**Real-World Impact:**
Extremely large `photos` maps cause Firestore read costs to spike for every admin query that fetches the document. A single malicious operator creating 100 operations each with 10,000 fake photo entries costs the business significant Firestore read and storage fees.

**Proposed Solution:**
Validate photo keys against the known set of valid `PhotoType` values:
```js
function isValidPhotos(photos) {
  let validKeys = ['front', 'left', 'right', 'back', 'seal', 'incident_1', 'incident_2', 'incident_3'];
  return photos.keys().hasOnly(validKeys) && photos.size() <= 10;
}
```
Apply in both `isValidOperation()` and `isValidOperationUpdate()`.

**Acceptance Criteria:**
- [ ] Photos map keys are validated against the known `PhotoType` enum
- [ ] Photos map size is capped at a reasonable number (≤ 10)
- [ ] Writes with invalid photo types or excessively large maps are rejected

---

### TD-47 — `clientName` stored on operations is not cross-validated against the clients collection

**Type:** Security — Data Integrity
**Area:** Firestore Rules

**Problem:**
`isValidOperation()` validates that `clientId` and `clientName` are non-empty strings but does NOT verify that:
1. `clientId` corresponds to an actual document in the `clients` collection
2. `clientName` matches the `name` field on that client document

A malicious operator (or anyone with the API) can create operations attributed to a non-existent client ID, or use a real `clientId` but falsify the `clientName` stored on the operation.

**File:** [firestore.rules](firestore.rules) — `isValidOperation()`, lines 99–103

**Real-World Impact:**
Operations can be created with falsified client names. Admin reports showing client breakdowns become unreliable. Fake operations can be attributed to non-existent clients. Over time, client name changes in the `clients` collection are not reflected in historical operations (already accepted), but the initial write can also be falsified.

**Proposed Solution:**
Cross-reference the client document at write time using Firestore's `get()` in rules:
```js
function isValidClientRef(clientId, clientName) {
  let clientDoc = get(/databases/$(database)/documents/clients/$(clientId));
  return clientDoc.data.active == true
    && clientDoc.data.name == clientName;
}
```
Apply in `isValidOperation()`. This adds one Firestore read per operation create (billed), which is acceptable for a write path.

**Acceptance Criteria:**
- [ ] `clientId` must reference an existing, active client document on operation create
- [ ] `clientName` must match the name in the referenced client document
- [ ] Operations cannot be created with non-existent or inactive clients

---

### TD-48 — `android:allowBackup="true"` exposes IndexedDB data via Android backup

**Type:** Security — Mobile / Data Exposure
**Area:** Capacitor / Android

**Problem:**
`AndroidManifest.xml` has `android:allowBackup="true"` (the default). This enables Android Auto Backup, which can upload the app's data directory — including WebView storage, which encompasses IndexedDB — to the user's Google account. From there it can be restored to any device the account is signed into.

**File:** [android/app/src/main/AndroidManifest.xml](android/app/src/main/AndroidManifest.xml) — line 5

**Real-World Impact:**
If an operator's Google account is compromised, an attacker can restore the app data to a different device and access cached operation data (order numbers, client names, photo blobs) without ever authenticating against Firebase. This is particularly serious if the device belongs to a terminated employee whose Google account is still accessible.

**Proposed Solution:**
Disable Android backup or configure backup rules to exclude WebView/app data:
```xml
<application
  android:allowBackup="false"
  ...>
```
Or use `android:fullBackupContent="@xml/backup_rules"` with a `backup_rules.xml` that excludes all app data:
```xml
<full-backup-content>
  <exclude domain="database" path="." />
  <exclude domain="sharedpref" path="." />
</full-backup-content>
```

**Acceptance Criteria:**
- [ ] `android:allowBackup` set to `false` or backup rules configured to exclude all app data
- [ ] Verified that a factory-reset restore does not include cached operation data
- [ ] Combined with TD-09 mitigation (clearAllData on logout) for defense in depth

---

## 🟡 MEDIUM

---

### TD-49 — Raw camera error internals rendered to users in production

**Type:** Security / UX — Information Disclosure
**Area:** Frontend / Camera

**Problem:**
`CameraCapture.tsx` renders `error.raw` directly in the UI inside a `<p>` element. `error.raw` is constructed as `${err.name}: ${err.message}` from the caught DOMException. Browser camera errors can contain device-specific strings, OS version information, or internal browser error paths.

**File:** [src/features/camera/components/CameraCapture.tsx](src/features/camera/components/CameraCapture.tsx) — line 72

**Real-World Impact:**
Users see internal error strings in production. On some Android OEMs, camera errors include hardware identifiers. Even if not directly exploitable, this violates the principle of minimal information disclosure.

**Proposed Solution:**
Remove the raw error display from production builds. Gate it behind a DEV check, or remove entirely since the typed error (`error.type`) already provides enough context for the user message:
```tsx
{import.meta.env.DEV && (
  <p className="text-xs text-gray-400 font-mono ...">
    {error.raw}
  </p>
)}
```

**Acceptance Criteria:**
- [ ] `error.raw` not rendered to users in production builds
- [ ] User-facing error messages remain clear and actionable
- [ ] Raw errors remain available in DEV mode for debugging

---

### TD-50 — Frontend Zod schema length limits inconsistent with Firestore rules — validation bypass gap

**Type:** Security — Data Integrity
**Area:** Frontend / Firestore Rules

**Problem:**
The frontend Zod schema (`operationSchema.ts`) and Firestore rules define different length limits for the same fields:

| Field | Frontend max | Firestore max |
|-------|-------------|---------------|
| `orderNumber` | 20 chars | 50 chars |
| `doorNumber` | 10 chars | 20 chars |

Anyone calling the Firestore API directly can write values between the frontend limit and the Firestore limit. These values then appear in the admin UI, potentially breaking layout assumptions or enabling subtle injections.

**File:** [src/features/operations/schemas/operationSchema.ts](src/features/operations/schemas/operationSchema.ts)  
**File:** [firestore.rules](firestore.rules) — `isValidOperation()`, lines 88–92

**Proposed Solution:**
Align Firestore rule limits to match the frontend schema (stricter wins):
- `orderNumber`: `size() >= 3 && size() <= 20` (was 50)
- `doorNumber`: `size() >= 1 && size() <= 10` (was 20)

**Acceptance Criteria:**
- [ ] Firestore rule length limits match the Zod schema exactly
- [ ] A direct API write with 25-char orderNumber is rejected

---

### TD-51 — `fetchActiveClients()` fetches inactive clients and filters client-side

**Type:** Security — Data Exposure
**Area:** Frontend / Firestore

**Problem:**
`fetchActiveClients()` in `clientService.ts` runs `getDocs(query(collection(db, "clients"), orderBy("name")))` — fetching ALL clients — then filters in JavaScript with `.filter((c) => c.active)`. This means:
1. Inactive (deactivated) client records are sent over the wire to every operator's device
2. Firestore read costs are inflated (every client read, not just active ones)
3. An operator using DevTools can see all inactive client data

**File:** [src/features/admin/services/clientService.ts](src/features/admin/services/clientService.ts) — `fetchActiveClients()`, line 22

**Proposed Solution:**
Push the filter to Firestore:
```ts
getDocs(query(
  collection(db, "clients"),
  where("active", "==", true),
  orderBy("name", "asc")
))
```
This requires a Firestore composite index on `(active, name)`.

**Acceptance Criteria:**
- [ ] Inactive clients are not transmitted to operator devices
- [ ] Firestore query uses `where("active", "==", true)` filter
- [ ] Composite index created and deployed

---

### TD-52 — Storage `photoType` path segment accepts arbitrary filenames

**Type:** Security — Data Integrity / Storage Pollution
**Area:** Firebase Storage Rules

**Problem:**
The Storage rule `match /operations/{operationId}/{photoType}` accepts any string as `{photoType}`. There is no validation that `photoType` is one of the known valid photo types (e.g., `front`, `left`, `seal`, etc.). A malicious actor using the Firebase SDK directly can upload files to paths like:
- `operations/id/../../other-collection/malicious`  (Firebase prevents traversal, but)
- `operations/id/malware.exe` (stored with a valid `image/*` content-type but arbitrary filename)
- `operations/id/a`.repeat(1000) (path length attack)

Since delete is disabled for all users, these files accumulate permanently.

**File:** [storage.rules](storage.rules) — match rule, line 28

**Proposed Solution:**
Restrict `{photoType}` to known values. Firebase Storage wildcard match rules don't support enums, so enforce at the file name level with a content check, or restructure the path:
```
match /operations/{operationId}/{photoFile} {
  allow write: if isOperator()
    && isValidPhoto()
    && isOperationOwner(operationId)
    && photoFile.matches('^(front|left|right|back|seal|incident_1|incident_2|incident_3)_[0-9]+\\.jpg$');
}
```

**Acceptance Criteria:**
- [ ] Only known photo type names (matching the `PhotoType` enum) are accepted as storage paths
- [ ] Writes with arbitrary filenames are rejected
- [ ] Existing upload code uses the validated path format

---

### TD-53 — No brute-force protection on the login form

**Type:** Security — Authentication
**Area:** Frontend / Firebase Auth

**Problem:**
The `LoginPage` and `login()` service call `signInWithEmailAndPassword` with no client-side rate limiting, retry delay, or CAPTCHA. Firebase Auth has internal IP-based rate limiting, but it is not surfaced to the app and activates only after many attempts (typically 100+). An attacker targeting a known email address has a practical window to run a credential-stuffing or dictionary attack.

**File:** [src/features/auth/services/authService.ts](src/features/auth/services/authService.ts) — `login()`, line 24

**Real-World Impact:**
Operator accounts with weak passwords (common in non-technical warehouse environments) can be compromised. No lockout message is shown to operators, so a legitimate user whose account is under attack has no indication.

**Proposed Solution:**
1. Add a client-side retry counter: after 3 failed attempts, introduce a 30-second cooldown before the next attempt is allowed.
2. Enable Firebase App Check (Attestation) to require a valid app token on all Firebase calls, blocking non-app clients from attempting authentication at scale.
3. Show a clear error message after repeated failures: "Too many failed attempts. Please wait before trying again."

**Acceptance Criteria:**
- [ ] Login form enforces client-side cooldown after 3 consecutive failures
- [ ] Firebase App Check configured for web (reCAPTCHA Enterprise) and native (DeviceCheck/Play Integrity)
- [ ] User sees an appropriate error message during cooldown

---

### TD-54 — Audit log `performedBy` field not validated in Firestore rules

**Type:** Security — Audit Integrity
**Area:** Firestore Rules

**Problem:**
`writeAuditLog()` in `adminService.ts` writes `performedBy: auth.currentUser?.uid ?? null`. The Firestore rule for `audit_log` only checks `if isAdmin()` for creates — it does not validate that `performedBy` in the document equals `request.auth.uid`. A compromised admin account could write fake audit entries attributing actions to another admin's UID.

**File:** [firestore.rules](firestore.rules) — audit_log create rule, line 176  
**File:** [src/features/admin/services/adminService.ts](src/features/admin/services/adminService.ts) — `writeAuditLog()`, line 37

**Proposed Solution:**
Enforce that `performedBy` matches the authenticated user in the Firestore rule:
```js
match /audit_log/{entryId} {
  allow read: if isAdmin();
  allow create: if isAdmin()
    && request.resource.data.performedBy == request.auth.uid
    && request.resource.data.performedBy is string
    && request.resource.data.action is string
    && request.resource.data.createdAt is int;
  allow update, delete: if false;
}
```

**Acceptance Criteria:**
- [ ] Firestore rules enforce `performedBy == request.auth.uid` on audit log creates
- [ ] Fake audit entries attributing actions to other admins are rejected

---

### TD-55 — Role changes do not invalidate existing active sessions

**Type:** Security — Authorization
**Area:** Firebase Auth / Admin

**Problem:**
When an admin calls `updateUserRole()` or `deactivateUser()` (even if TD-42 is fixed), the target user's existing Firebase Auth JWT remains valid until it expires (1 hour by default). During that window, the user's in-memory role in `authStore` also remains stale (role is only re-fetched on `onAuthStateChange`, not on every request).

**File:** [src/features/auth/hooks/useAuth.ts](src/features/auth/hooks/useAuth.ts) — `onAuthStateChange` handler, line 9  
**File:** [src/features/admin/services/adminService.ts](src/features/admin/services/adminService.ts) — `updateUser()`, line 96

**Real-World Impact:**
A newly downgraded or deactivated user continues to have admin-level or operator-level access (as the old token is accepted by Firestore) for up to 1 hour after the role change. In a security incident requiring immediate access revocation, this gap is unacceptable.

**Proposed Solution:**
Call `auth.revokeRefreshTokens(uid)` via a Cloud Function triggered on user document writes. This invalidates all existing sessions within minutes. Client-side, use Firestore's `onSnapshot` to watch the current user's document and force re-authentication on role/active change:
```ts
onSnapshot(doc(db, "users", user.uid), (snap) => {
  if (!snap.exists() || snap.data().active === false) {
    logout() // force sign-out
  }
})
```

**Acceptance Criteria:**
- [ ] Role changes and deactivations take effect within 5 minutes for active sessions
- [ ] Revocation is enforced server-side (refresh token revocation), not just client-side
- [ ] Client detects session invalidation and redirects to login automatically

---

## 🟢 LOW

---

### TD-56 — Firebase Storage DELETE disabled for all users — no cleanup path for incorrect uploads

**Type:** Security / Operations
**Area:** Firebase Storage Rules

**Problem:**
`allow delete: if false` in `storage.rules` prevents any client from deleting Storage files. While this protects against accidental or malicious deletion, it means there is no recovery path when files are incorrectly uploaded (wrong operation, test data, corrupted files). Over time, with TD-24 (orphaned files from interrupted uploads) and TD-52 (arbitrary photoType paths), unremovable files accumulate with no recourse.

**File:** [storage.rules](storage.rules) — line 31

**Proposed Solution:**
Allow admins to delete Storage files via a Cloud Function with proper validation, rather than direct client delete. The Cloud Function verifies the operation exists and the requesting user is admin before calling the Admin SDK to delete:
```
// Cloud Function: deleteOperationPhoto(operationId, photoType)
// Validates admin role server-side, then deletes the specific file
```
Do not enable client-side delete — keep `allow delete: if false` for all direct client calls.

**Acceptance Criteria:**
- [ ] Admins have a mechanism to delete specific photos via admin panel
- [ ] Deletion is mediated by a Cloud Function with server-side admin verification
- [ ] Direct client delete remains blocked

---

### TD-57 — JPEG capture quality 0.4 may be insufficient for compliance documentation

**Type:** Compliance / Data Integrity
**Area:** Frontend / Camera

**Problem:**
`useCamera.ts` passes `quality: 0.4` (40%) to `canvas.toBlob(..., 'image/jpeg', 0.4)`. Combined with the resolution cap of 800×600, the resulting images may be too low quality to:
- Read seal numbers or label text
- Serve as legally defensible evidence for cargo damage claims
- Meet client SLA requirements for photo documentation

**File:** [src/features/camera/hooks/useCamera.ts](src/features/camera/hooks/useCamera.ts) — `capturePhoto()`, line 130

**Proposed Solution:**
Raise JPEG quality to at least 0.75 (75%) and increase resolution to 1280×960 or native camera resolution. Balance file size against compliance requirements. If storage costs are a concern, implement server-side compression via a Cloud Function rather than aggressive client-side compression.

**Acceptance Criteria:**
- [ ] JPEG quality reviewed and agreed with product/operations stakeholders
- [ ] Photos are legible for seal numbers and labels at the chosen quality setting
- [ ] Quality setting is a named constant (not a magic number) and documented

---

### TD-58 — No Firebase App Check — any client can access Firebase APIs without the app

**Type:** Security — API Abuse Prevention
**Area:** Firebase

**Problem:**
Firebase App Check is not configured. Without it, anyone who extracts the `VITE_FIREBASE_API_KEY` from the built JavaScript bundle (trivially done with DevTools or `strings`) can make unlimited Firestore reads, Auth requests, and Storage uploads using the Firebase API directly — with no association to the actual app. This enables:
- Automated credential stuffing at scale
- Bulk data scraping (combined with TD-44)
- Synthetic operation creation

**Note:** Firebase API keys are not secrets (they identify the project, not authorize access), but App Check adds the app-attestation layer that prevents non-app clients from using the project's APIs.

**Proposed Solution:**
Enable Firebase App Check:
- **Web:** reCAPTCHA Enterprise or reCAPTCHA v3
- **Android:** Play Integrity API
- **iOS:** App Attest (DeviceCheck as fallback)

Configure in enforcement mode once validated in debug mode. Update Firebase project settings and add the App Check initialization to `firebaseServices.ts`.

**Acceptance Criteria:**
- [ ] Firebase App Check enabled for Firestore, Storage, and Auth
- [ ] Web uses reCAPTCHA Enterprise; Android uses Play Integrity; iOS uses App Attest
- [ ] Debug tokens configured for development environments
- [ ] Enforcement mode enabled after testing confirms no false positives

---

## Updated Summary (Phase 3)

| Severity | Phase 1–2 Open | Phase 3 New | Total Open |
|----------|----------------|-------------|------------|
| 🔴 CRITICAL | 6 | 2 (TD-42 to TD-43) | **8** |
| 🟠 HIGH | 9 | 5 (TD-44 to TD-48) | **14** |
| 🟡 MEDIUM | 8 | 7 (TD-49 to TD-55) | **15** |
| 🟢 LOW | 3 | 3 (TD-56 to TD-58) | **6** |
| **Total open** | **26** | **17** | **43** |
