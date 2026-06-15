# SPEC.md — Cargo Control System

## Overview

A Progressive Web App (PWA) for managing cargo loading and unloading operations at warehouse facilities. Operators capture operation data and photos in the field, even without internet connectivity, with automatic synchronization when back online.

---

## 1. User Stories

### Operator

| # | Story | Acceptance Criteria |
|---|-------|-------------------|
| 1 | I want to log in quickly to start my shift | Email/password auth with persistent session |
| 2 | I want to select load or unload operation type | Clear toggle/buttons, correct photo requirements |
| 3 | I want to enter order number and door number | Numeric/alphanumeric validation, required fields |
| 4 | I want to capture mandatory photos | Dynamic photo list per operation type, camera access |
| 5 | I want the app to work offline and sync later | IndexedDB storage, auto-sync on reconnect |

### Admin

| # | Story | Acceptance Criteria |
|---|-------|-------------------|
| 1 | I want to search orders by number | Instant filter on order number |
| 2 | I want to view all photos for an order | Photo gallery with zoom capability |
| 3 | I want to filter by date and operator | Date picker + operator dropdown |
| 4 | I want to validate operations are recorded correctly | Status badges (pending_sync, synced, error) |

---

## 2. Page Descriptions

### Login Page (`/login`)

- Email input field
- Password input field
- "Sign In" button
- Error display (invalid credentials, network error)
- Loading state during authentication
- Redirect to role-based dashboard after login

### Pending Approval Page (`/pending-approval`)

- Message: "Your account is awaiting admin role assignment"
- Sign Out button
- Display user email

### Operator Dashboard (`/operator`)

- Two large action buttons: "Load" and "Unload"
- Recent operations list (last 5, from local IndexedDB)
- Sync status indicator:
  - Online/Offline badge
  - Pending sync count
- Optional: manual sync button

### Operation Form Page (`/operation/new?type=load|unload`)

- Order number input (3-20 alphanumeric chars, required)
- Door number input (1-10 chars, required)
- Dynamic photo capture section based on operation type
- Photo checklist with capture status
- "Save Operation" button (disabled until all required)
- Validation errors inline
- Offline-aware submission
- Success confirmation with option to start new operation

### Photo Capture Component (per photo type)

- Camera access (rear camera preferred)
- Live video preview
- "Capture" button
- Preview with:
  - "Retake" button
  - "Confirm" button
- Permission error handling with retry option
- Auto-compression to ~1MB JPEG (80% quality)

### Admin Dashboard (`/admin`)

- Search bar: filter by order number (instant)
- Filters:
  - Date range picker
  - Operator dropdown (from Firestore users)
  - Status filter (all, pending, synced, error)
- Results table:
  | Column | Description |
  |--------|-------------|
  | Order # | Order number |
  | Door | Door number |
  | Type | Load / Unload |
  | Operator | Operator name |
  | Status | Badge (pending_sync, synced, error) |
  | Date | Created timestamp |
  | Actions | "View Details" link |
- Pagination: "Load More" button (20 items per page)
- Click row → navigate to detail page

### Operation Detail Page (`/admin/operation/:id`)

- Full operation information:
  - Order number
  - Door number
  - Type
  - Date & time
  - Operator name
  - Sync status
- Photo gallery:
  - Grid layout
  - Tap to view full-screen with zoom
- Back to dashboard button

---

## 3. Field Specifications

### orderNumber

| Property | Value |
|----------|-------|
| Type | string |
| Required | yes |
| Format | alphanumeric (letters + numbers) |
| Length | 3–20 characters |
| Validation | `^[A-Za-z0-9]{3,20}$` |

### doorNumber

| Property | Value |
|----------|-------|
| Type | string |
| Required | yes |
| Format | alphanumeric |
| Length | 1–10 characters |
| Validation | `^[A-Za-z0-9]{1,10}$` |

### operationType

| Property | Value |
|----------|-------|
| Type | enum |
| Values | `load` \| `unload` |
| Required | yes |

### photos

| Property | Value |
|----------|-------|
| Type | object (key-value, PhotoType → base64/Blob) |
| Max size | ~1MB per photo (after compression) |
| Format | JPEG |
| Required photos | Dynamic based on operation type |

### Photo Requirements by Operation Type

**Load (`load`):**

| Photo Type | Description | Required |
|------------|-------------|----------|
| `reefer_temp` | Reefer temperature reading | Yes |
| `trailer` | Trailer/placa | Yes |
| `first_pallets` | First pallets loaded | Yes |
| `middle_pallets` | Middle pallets loaded | Yes |
| `last_pallets` | Last pallets loaded | Yes |
| `seal` | Trailer seal | Yes |

**Unload (`unload`):**

| Photo Type | Description | Required |
|------------|-------------|----------|
| `reefer_temp` | Reefer temperature reading | Yes |
| `trailer` | Trailer/placa | Yes |
| `product_temp_1` | Product temperature probe 1 | Yes |
| `product_temp_2` | Product temperature probe 2 | Yes |
| `product_temp_3` | Product temperature probe 3 | Yes |
| `first_pallets` | First pallets unloaded | Yes |
| `middle_pallets` | Middle pallets unloaded | Yes |
| `last_pallets` | Last pallets unloaded | Yes |

---

## 4. Firebase Setup Steps

### 4.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" → name it "cargo-control"
3. Enable Google Analytics (optional)

### 4.2 Enable Authentication

1. Build → Authentication → Get started
2. Sign-in method → Enable "Email/Password"
3. No need to enable email link (password-based for v1)

### 4.3 Create Firestore Database

1. Build → Firestore Database → Create database
2. Start in "production mode" (rules will be configured later)
3. Select region closest to users

### 4.4 Enable Storage

1. Build → Storage → Get started
2. Start in "production mode"
3. Select same region as Firestore

### 4.5 Create User Profiles (Admin Setup)

1. In Authentication → Users → Add user
2. Create admin user(s) and operator user(s)
3. In Firestore → create collection `users`:
   ```json
   {
     "uid": "<auth-uid>",
     "email": "user@example.com",
     "role": "admin" | "operator",
     "createdAt": <timestamp>
   }
   ```

### 4.6 Deploy Security Rules

Deploy rules from `firestore.rules` and `storage.rules` (see DEVPLAN.md)

### 4.7 Get SDK Configuration

1. Project Settings → General → Your apps → Web app (</>)
2. Copy config object:
   ```env
   VITE_FIREBASE_API_KEY=
   VITE_FIREBASE_AUTH_DOMAIN=
   VITE_FIREBASE_PROJECT_ID=
   VITE_FIREBASE_STORAGE_BUCKET=
   VITE_FIREBASE_MESSAGING_SENDER_ID=
   VITE_FIREBASE_APP_ID=
   ```

### 4.8 Optional: Enable Hosting

1. Build → Hosting → Get started
2. Install Firebase CLI: `npm install -g firebase-tools`
3. Run `firebase init hosting` in project root
4. Select `dist/` as public directory
5. Configure as SPA (rewrite all to index.html)

---

## 5. Offline Behavior

### Storage Architecture

| Data | Storage | Sync Strategy |
|------|---------|---------------|
| Operations | IndexedDB + Firestore | Pending queue → sync on reconnect |
| Photos | IndexedDB (Blob) + Storage | Upload with operation metadata |
| Auth | Firebase persistence | `browserLocalPersistence` |

### Sync Flow

```
User submits operation
        ↓
   [Offline?]
    /     \
   Yes      No
    ↓        ↓
Save to   Sync to
IndexedDB  Firestore
    ↓        ↓
Set status  Set status
"pending"   "synced"
    ↓
When online:
    ↓
1. Upload all photos to Firebase Storage
    ↓
2. Write operation metadata to Firestore
    ↓
3. Mark as synced in IndexedDB
    ↓
4. Clean up local photos
```

### Sync States

| State | Meaning | UI Treatment |
|-------|---------|--------------|
| `pending_sync` | Saved locally, waiting to sync | Yellow badge |
| `synced` | Successfully pushed to Firestore | Green badge |
| `error` | Sync failed after retries | Red badge |

### Conflict Resolution

- Last-write-wins based on `createdAt` timestamp
- If `localId` exists on server, skip duplicate sync
- Failed syncs remain in queue with `error` status

---

## 6. Design Direction

### Visual Style

- Clean, functional, industrial aesthetic
- Optimized for mobile use in warehouse environments
- Large touch targets (minimum 44x44px)
- High contrast for outdoor/bright environments

### Color Palette

| Role | Color | Tailwind |
|------|-------|----------|
| Primary | Blue | `blue-600` (#2563eb) |
| Primary Dark | Dark Blue | `blue-700` (#1d4ed8) |
| Success | Green | `green-600` (#16a34a) |
| Warning | Yellow | `yellow-500` (#eab308) |
| Error | Red | `red-600` (#dc2626) |
| Background | White | `white` |
| Text Primary | Gray 900 | `gray-900` (#111827) |
| Text Secondary | Gray 500 | `gray-500` (#6b7280) |
| Border | Gray 200 | `gray-200` (#e5e7eb) |

### Typography

- Font: System font stack (Tailwind default)
- Headings: font-bold
- Body: text-base (16px minimum)
- Labels: text-sm text-gray-600

### Spacing

- Container padding: p-4 (16px)
- Card padding: p-4
- Gap between elements: gap-4 (16px)
- Section spacing: my-6 (24px)

### Components

- Buttons: Full-width on mobile, rounded-lg, py-3 (48px height)
- Inputs: Full-width, border, rounded, py-2.5
- Cards: White background, subtle shadow, rounded-xl
- Status badges: Rounded-full, px-3 py-1, text-xs

### Dark Mode

- Not required for v1
- Can add later with Tailwind `dark:` classes

### Responsive Breakpoints

- Mobile-first (design for 375px)
- Tablet: `md:` (768px)
- Desktop: `lg:` (1024px)

---

## 7. Success Criteria

A feature is complete when:

- [ ] Works on mobile (iOS Safari, Chrome Android)
- [ ] Works offline (airplane mode test)
- [ ] Syncs correctly (verify in Firestore)
- [ ] Validates required fields with clear errors
- [ ] Handles basic errors (network, camera permission)
- [ ] Usable without training (clear labels, intuitive flow)
- [ ] Passes Lighthouse PWA audit (90+ score)

---

## 8. Non-Goals (v1)

- Push notifications
- External integrations (ERP, WMS)
- Advanced reports / analytics / exports
- Multi-language support (i18n)
- Offline map / location tracking
- User management UI (admin creates users manually in Firebase Console)
- Photo editing / annotation
- Barcode/QR scanning
- Real-time admin dashboard updates (polling is fine)

---

## 9. Result

A PWA that:

- Enables structured capture of loading/unloading operations
- Works fully offline in warehouses with poor connectivity
- Syncs automatically when connection restored
- Provides admin visibility into all operations and photos
- Can be installed on home screen as a native-like app
- Requires minimal training to operate
