# Cargo Control

A Progressive Web App (PWA) for managing cargo loading and unloading operations at warehouse facilities. Built for Profresh.

Operators capture operation data and photos in the field — fully offline — while admins review, approve, and export from a dashboard.

---

## Overview

| Role | Responsibilities |
|------|-----------------|
| **Operator** | Create load/unload operations, capture required photos, sync to server |
| **Admin** | Review operations, approve or reject with feedback, manage users and clients |

The app is designed for warehouse environments with poor connectivity. All data is saved locally first and synced automatically when back online.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Routing | React Router DOM v6 |
| State | Zustand |
| Validation | Zod |
| Offline Storage | IndexedDB via `idb` |
| Backend | Firebase Auth, Firestore, Storage |
| PWA | vite-plugin-pwa + Workbox |
| Native | Capacitor 8 (Android, iOS) |
| Styling | Tailwind CSS |
| Testing | Vitest + React Testing Library |

---

## Features

### Operator
- Create load or unload operations with order number, door number, and client
- Capture required photos per operation type (6 for load, 8 for unload)
- Works fully offline — operations and photos are stored locally in IndexedDB
- Auto-sync when back online, with manual sync button and upload progress bar
- View recent operations and history with status tracking
- Edit and re-submit rejected operations with admin's rejection reason visible

### Admin
- Dashboard with paginated operations table and filters (status, type, client, operator, date range)
- Operation detail view with full photo gallery and lightbox
- Approve or reject operations — rejection requires a written reason sent to the operator
- Download all photos as a ZIP file
- Manage users (create, edit name/role, deactivate)
- Manage clients (create, edit name, deactivate, delete unused)
- Audit log of all admin actions

### Both roles
- Color-coded role indicator in the app header (blue = Admin, green = Operator)
- Account page with profile info
- Toast notifications
- PWA installable on Android and iOS home screens

---

## Operation Status Flow

```
[Operator creates] → pending_sync
                          ↓
                    [Sync completes] → synced
                                          ↓
                              [Admin reviews]
                             ↙              ↘
                        approved          rejected (+ reason)
                                               ↓
                                   [Operator fixes & re-submits]
                                               ↓
                                         pending_sync → synced → ...
```

---

## Project Structure

```
src/
├── app/                  # Router and App entry
├── features/
│   ├── auth/             # Login, auth hooks, Zustand store
│   ├── operations/       # Operation form, sync logic, hooks
│   ├── admin/            # Admin services, modals, utilities
│   └── camera/           # Camera capture component
├── pages/                # Route-level page components
├── services/
│   ├── firebase/         # Firebase config and service singletons
│   └── offline/          # IndexedDB (db.ts) and SyncEngine
├── shared/
│   ├── components/       # Reusable UI and layout components
│   ├── hooks/            # useOnlineStatus, useSyncEngine, etc.
│   └── utils/            # Date formatting, image compression
└── types/                # Global TypeScript interfaces and enums
```

### Firestore Collections

| Collection | Purpose |
|-----------|---------|
| `operations` | Cargo operations with photos map and status |
| `users` | User profiles and roles (document ID = Firebase Auth UID) |
| `clients` | Warehouse clients selectable during operation creation |
| `audit_log` | Admin action history (create user, update role, etc.) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Auth, Firestore, and Storage enabled

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your Firebase project values:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### 3. Deploy Firebase rules and indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 4. Run the development server

```bash
npm run dev
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Generate coverage report |
| `npm run build:android` | Build web app and sync to Android |
| `npm run build:ios` | Build web app and sync to iOS |
| `npm run open:android` | Open Android Studio |
| `npm run open:ios` | Open Xcode |

---

## Firebase Setup

The app uses three Firebase services:

**Authentication** — Email/password with persistent local sessions.

**Firestore** — Stores all operation, user, and client data. Security rules are in `firestore.rules`. Composite indexes are in `firestore.indexes.json`.

**Cloud Storage** — Stores operation photos at path `operations/{operationId}/{photoType}_{timestamp}.jpg`. Storage rules are in `storage.rules`.

Role-based access is enforced at the rules level — operators can only read/write their own operations; admins have full access.

---

## Native Builds (Capacitor)

The app targets Android and iOS via Capacitor.

- **App ID**: `com.profresh.cargocontrol`
- **Web directory**: `dist/`

See [docs/CAPACITOR_SETUP.md](docs/CAPACITOR_SETUP.md) for full platform setup instructions including Android Studio and Xcode configuration.

```bash
# Build and open on Android
npm run build:android && npm run open:android

# Build and open on iOS (macOS only)
npm run build:ios && npm run open:ios
```

---

## Documentation

| File | Contents |
|------|---------|
| [docs/SPEC.md](docs/SPEC.md) | Product specification, user stories, field validation rules |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Code architecture rules, naming conventions, patterns |
| [docs/DEVPLAN.md](docs/DEVPLAN.md) | Implementation tickets and phase history |
| [docs/CAPACITOR_SETUP.md](docs/CAPACITOR_SETUP.md) | Native build guide for Android and iOS |
| [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) | Testing strategy and examples |
| [docs/TECHDEBT.md](docs/TECHDEBT.md) | Known tech debt and deferred work |
