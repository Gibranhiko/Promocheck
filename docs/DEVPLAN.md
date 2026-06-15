# 📦 Cargo Control PWA — Agent Development Plan

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Routing | React Router DOM v6 |
| State | Zustand |
| Validation | Zod |
| Offline Storage | IndexedDB via `idb` |
| Backend | Firebase Auth, Firestore, Storage |
| PWA | vite-plugin-pwa + Workbox |
| Native | Capacitor (Android, iOS) |
| Styling | Tailwind CSS |
| Testing | Vitest + React Testing Library |

---

## Architecture: Feature-Based Folder Structure

```
cargo-control/
├── android/                    # Android native project (Capacitor)
├── ios/                        # iOS native project (Capacitor, Mac only)
├── capacitor.config.ts          # Capacitor configuration
├── src/                        # Web app (SOURCE OF TRUTH)
│   ├── app/
│   ├── features/
│   ├── shared/
│   ├── services/
│   ├── types/
│   └── pages/
├── dist/                       # Built web app
└── public/                    # Static assets (icons, favicon)
```

**Important**: Only edit files in `src/`. Native folders are auto-generated.
├── features/
│   ├── auth/
│   │   ├── components/
│   │   │   └── LoginForm.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── services/
│   │   │   └── authService.ts
│   │   ├── store/
│   │   │   └── authStore.ts
│   │   ├── schemas/
│   │   │   └── loginSchema.ts
│   │   └── index.ts             # Public API of the feature
│   │
│   ├── operations/
│   │   ├── components/
│   │   │   ├── OperationForm.tsx
│   │   │   └── OperationList.tsx
│   │   ├── hooks/
│   │   │   └── useOperations.ts
│   │   ├── services/
│   │   │   └── operationService.ts
│   │   ├── store/
│   │   │   └── operationStore.ts
│   │   ├── schemas/
│   │   │   └── operationSchema.ts
│   │   └── index.ts
│   │
│   ├── camera/
│   │   ├── components/
│   │   │   ├── CameraCapture.tsx
│   │   │   └── PhotoPreview.tsx
│   │   ├── hooks/
│   │   │   └── useCamera.ts
│   │   └── index.ts
│   │
│   └── admin/
│       ├── components/
│       │   ├── AdminDashboard.tsx
│       │   ├── OperationsTable.tsx
│       │   └── FiltersBar.tsx
│       ├── hooks/
│       │   └── useAdminOperations.ts
│       └── index.ts
│
├── shared/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Spinner.tsx
│   │   └── layout/
│   │       ├── AppShell.tsx
│   │       └── ProtectedRoute.tsx
│   ├── hooks/
│   │   ├── useOnlineStatus.ts
│   │   └── useSyncEngine.ts
│   └── utils/
│       ├── formatDate.ts
│       └── compressImage.ts
│
├── services/
│   ├── firebase/
│   │   ├── firebaseConfig.ts
│   │   └── firebaseServices.ts
│   ├── offline/
│   │   ├── db.ts
│   │   └── syncEngine.ts
│   └── storage/
│       └── photoUploadService.ts
│
├── types/
│   ├── Operation.ts
│   ├── UserRole.ts
│   ├── PhotoType.ts
│   └── OperationType.ts
│
└── config/
    └── constants.ts
```

---

## Module 1 — Project Bootstrap

### Ticket 1.0 — TypeScript paths config

File: `tsconfig.json` (add to existing or create base):
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

File: `vite.config.ts` (update):
```ts
import path from "path"
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // ... rest of config
})
```

### Ticket 1.1 — Scaffold project

```bash
npm create vite@latest cargo-control -- --template react-ts
cd cargo-control

npm install \
  firebase \
  react-router-dom \
  zustand \
  zod \
  idb \
  tailwindcss \
  autoprefixer \
  postcss \
  vite-plugin-pwa \
  workbox-window

npm install -D \
  @types/node \
  vitest \
  @testing-library/react \
  @testing-library/jest-dom \
  jsdom
```

### Ticket 1.2 — Tailwind setup

Create `tailwind.config.ts`:

```ts
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

Add to `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Ticket 1.3 — Vite config with PWA plugin

File: `vite.config.ts`

```ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",  // Let users choose when to update
      includeAssets: ["favicon.ico", "icons/*.png"],
      manifest: {
        name: "Cargo Control",
        short_name: "CargoCtrl",
        description: "Cargo operations management for operators and admins",
        theme_color: "#1e40af",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/?source=pwa",
        scope: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        categories: ["business", "productivity"],
        shortcuts: [
          { name: "New Operation", url: "/operator?action=new", description: "Start a new cargo operation" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          // App shell & static routes: CacheFirst for instant loads
          {
            urlPattern: /\/_app\/.*/,
            handler: "CacheFirst",
            options: { cacheName: "app-shell", expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
          // API data: NetworkFirst with cache fallback
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com/,
            handler: "NetworkFirst",
            options: { cacheName: "firestore-cache", networkTimeoutSeconds: 5 },
          },
          // Photos: StaleWhileRevalidate for fresh images
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "photos-cache", expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 } },
          },
          // Fonts: CacheFirst (deterministic)
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: "CacheFirst",
            options: { cacheName: "fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
        ],
      },
    }),
  ],
})
```

**2026 PWA Caching Strategies (by content type):**

| Content Type | Strategy | Rationale |
|---|---|---|
| App shell (HTML, CSS, JS) | CacheFirst | Instant loads, versioned |
| API data (Firestore) | NetworkFirst | Fresh data, 5s timeout fallback |
| Photos/Images | StaleWhileRevalidate | Show cached immediately, update in background |
| Fonts | CacheFirst | Deterministic, rarely change |
| Authenticated APIs | NetworkOnly | Never cache sensitive data |

### Ticket 1.4 — Environment variables

Create `.env`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Create `.env.example` with the same keys but empty values. Commit `.env.example`, never `.env`.

---

## Module 2 — Types & Schemas

### Ticket 2.1 — Global TypeScript types

File: `src/types/UserRole.ts`
```ts
export type UserRole = "operator" | "admin"
```

File: `src/types/OperationType.ts`
```ts
export type OperationType = "load" | "unload"
```

File: `src/types/PhotoType.ts`
```ts
export type PhotoType = "truck_plate" | "cargo_state" | "seal" | "door_number"
```

File: `src/types/Operation.ts`
```ts
import type { OperationType } from "./OperationType"
import type { PhotoType } from "./PhotoType"

export type OperationStatus = "pending_sync" | "synced" | "error"

export interface Operation {
  id: string
  orderNumber: string
  doorNumber: string
  operationType: OperationType
  operatorId: string
  operatorName: string
  photos: Partial<Record<PhotoType, string>>  // URLs or base64 strings
  status: OperationStatus
  createdAt: number   // Unix timestamp
  syncedAt?: number
}
```

### Ticket 2.2 — Zod validation schemas

File: `src/features/operations/schemas/operationSchema.ts`
```ts
import { z } from "zod"

export const operationSchema = z.object({
  orderNumber: z.string().min(1, "Order number is required"),
  doorNumber: z.string().min(1, "Door number is required"),
  operationType: z.enum(["load", "unload"]),
})

export type OperationFormValues = z.infer<typeof operationSchema>
```

File: `src/features/auth/schemas/loginSchema.ts`
```ts
import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export type LoginFormValues = z.infer<typeof loginSchema>
```

---

## Module 3 — Firebase Setup

### Ticket 3.1 — Firebase config

File: `src/services/firebase/firebaseConfig.ts`
```ts
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
```

### Ticket 3.2 — Firebase services singleton

File: `src/services/firebase/firebaseServices.ts`
```ts
import { initializeApp, getApps } from "firebase/app"
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"
import { firebaseConfig } from "./firebaseConfig"

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// Set persistence on first load
setPersistence(auth, browserLocalPersistence).catch(console.error)
```

**Session persistence**: `browserLocalPersistence` keeps users logged in across browser sessions until explicit logout.

### Ticket 3.3 — Firestore security rules (2026 best practices)

File: `firestore.rules`
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }

    function isOperator() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "operator";
    }

    function isOwnDoc(userId) {
      return request.auth.uid == userId;
    }

    function isValidOperation() {
      let data = request.resource.data;
      return data.keys().hasAll(['orderNumber', 'doorNumber', 'operationType', 'operatorId', 'createdAt'])
        && data.orderNumber.size() > 0
        && data.doorNumber.size() > 0
        && data.operationType in ['load', 'unload'];
    }

    match /operations/{operationId} {
      allow create: if isOperator() && isValidOperation();
      allow read, list: if isAdmin();
      allow update: if isAdmin();
      allow delete: if false;  // Never allow deletion
    }

    match /users/{userId} {
      allow read: if isOwnDoc(userId) || isAdmin();
      allow create: if false;  // Only admin via backend can create users
      allow update: if isAdmin() || (isOwnDoc(userId) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']));
    }
  }
}
```

**2026 Firestore best practices added:**
- Data validation in rules (`isValidOperation()`)
- No delete operations (audit trail)
- Users can only update their own profile, not their role
- Use `request.resource.data.diff()` for precise field-level updates

---

## Module 4 — Authentication Feature

### Ticket 4.1 — Auth service

File: `src/features/auth/services/authService.ts`
```ts
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/services/firebase/firebaseServices"
import type { UserRole } from "@/types/UserRole"

export interface AuthUser {
  uid: string
  email: string | null
  role: UserRole | null  // null = no role assigned yet
}

export interface AuthError {
  code: "user-not-found" | "wrong-password" | "no-role" | "network" | "unknown"
}

export async function login(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password)
}

export async function logout(): Promise<void> {
  await signOut(auth)
}

export async function getUserRole(uid: string): Promise<UserRole | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid))
    if (!snap.exists()) return null  // User doc not created yet
    return snap.data().role as UserRole
  } catch {
    return null
  }
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}
```

### Ticket 4.2 — Auth Zustand store

File: `src/features/auth/store/authStore.ts`
```ts
import { create } from "zustand"
import type { AuthUser } from "../services/authService"

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
}))
```

### Ticket 4.3 — useAuth hook

File: `src/features/auth/hooks/useAuth.ts`
```ts
import { useEffect } from "react"
import { onAuthStateChange, getUserRole } from "../services/authService"
import { useAuthStore } from "../store/authStore"

export function useAuth() {
  const { user, isLoading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        const role = await getUserRole(firebaseUser.uid)
        setUser({ uid: firebaseUser.uid, email: firebaseUser.email, role })
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return { user, isLoading }
}
```

### Ticket 4.4 — Auth state with no-role handling

Update `ProtectedRoute` to redirect users with `null` role to a "waiting approval" page:

File: `src/shared/components/layout/ProtectedRoute.tsx`
```tsx
import { Navigate } from "react-router-dom"
import { useAuthStore } from "@/features/auth/store/authStore"
import type { UserRole } from "@/types/UserRole"

interface Props {
  allowedRoles: UserRole[]
}

export function ProtectedRoute({ allowedRoles }: Props) {
  const { user, isLoading } = useAuthStore()

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role === null) return <Navigate to="/pending-approval" replace />
  if (!allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" replace />

  return <Outlet />
}
```

Also add `src/pages/PendingApprovalPage.tsx` that informs the user their account is pending admin assignment.

### Ticket 4.5 — Login page with enhanced error handling

File: `src/features/auth/components/LoginForm.tsx`
```tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { FirebaseError } from "firebase/app"
import { login } from "../services/authService"
import { loginSchema } from "../schemas/loginSchema"

type SubmitState = "idle" | "loading" | "success" | "error"

export function LoginForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitState, setSubmitState] = useState<SubmitState>("idle")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitState("idle")

    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      setError(result.error.errors[0].message)
      return
    }

    setSubmitState("loading")
    try {
      await login(email, password)
      setSubmitState("success")
      navigate("/")  // Router will redirect based on role after auth resolves
    } catch (err) {
      setSubmitState("error")
      if (err instanceof FirebaseError) {
        if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
          setError("Invalid email or password")
        } else if (err.code === "auth/network-request-failed") {
          setError("Network error. Check your connection.")
        } else {
          setError("Login failed. Please try again.")
        }
      }
    }
  }

  const handleReset = () => {
    setEmail("")
    setPassword("")
    setError(null)
    setSubmitState("idle")
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-bold">Cargo Control</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
          {error}
        </div>
      )}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={submitState === "loading"}
        className="border rounded p-2 disabled:opacity-50"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={submitState === "loading"}
        className="border rounded p-2 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={submitState === "loading"}
        className="bg-blue-600 text-white rounded p-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitState === "loading" ? "Signing in..." : "Sign In"}
      </button>
    </form>
  )
}
```

---

## Module 5 — Router & Navigation

### Ticket 5.1 — Protected route component

File: `src/shared/components/layout/ProtectedRoute.tsx`
```tsx
import { Navigate, Outlet } from "react-router-dom"
import { useAuthStore } from "@/features/auth/store/authStore"
import type { UserRole } from "@/types/UserRole"

interface Props {
  allowedRoles: UserRole[]
}

export function ProtectedRoute({ allowedRoles }: Props) {
  const { user, isLoading } = useAuthStore()

  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" replace />

  return <Outlet />
}
```

### Ticket 5.2 — App router

File: `src/app/router.tsx`
```tsx
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import { ProtectedRoute } from "@/shared/components/layout/ProtectedRoute"
import { LoginPage } from "@/pages/LoginPage"
import { OperatorPage } from "@/pages/OperatorPage"
import { AdminPage } from "@/pages/AdminPage"
import { PendingApprovalPage } from "@/pages/PendingApprovalPage"

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/pending-approval", element: <PendingApprovalPage /> },
  {
    element: <ProtectedRoute allowedRoles={["operator"]} />,
    children: [{ path: "/operator", element: <OperatorPage /> }],
  },
  {
    element: <ProtectedRoute allowedRoles={["admin"]} />,
    children: [{ path: "/admin", element: <AdminPage /> }],
  },
  { path: "*", element: <Navigate to="/login" /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
```

File: `src/pages/PendingApprovalPage.tsx`
```tsx
import { useAuthStore } from "@/features/auth/store/authStore"
import { logout } from "@/features/auth/services/authService"

export function PendingApprovalPage() {
  const { user } = useAuthStore()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Account Pending Approval</h1>
      <p className="text-gray-600 text-center mb-6">
        Your account ({user?.email}) has been created but is awaiting admin assignment of a role.
        Please contact your administrator.
      </p>
      <button
        onClick={handleLogout}
        className="bg-gray-200 text-gray-800 px-6 py-2 rounded"
      >
        Sign Out
      </button>
    </div>
  )
}
```

---

## Module 6 — Offline Database (IndexedDB)

### Ticket 6.1 — IDB setup

File: `src/services/offline/db.ts`
```ts
import { openDB, type IDBPDatabase } from "idb"
import type { Operation } from "@/types/Operation"

const DB_NAME = "cargo-control"
const DB_VERSION = 1

export interface CargoControlDB {
  operations: {
    key: string
    value: Operation
    indexes: { "by-status": OperationStatus }
  }
  photos: {
    key: string     // `${operationId}_${photoType}`
    value: { id: string; blob: Blob; operationId: string; photoType: string }
  }
}

let dbPromise: Promise<IDBPDatabase<CargoControlDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CargoControlDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const opStore = db.createObjectStore("operations", { keyPath: "id" })
        opStore.createIndex("by-status", "status")

        db.createObjectStore("photos", { keyPath: "id" })
      },
    })
  }
  return dbPromise
}

// Operations CRUD
export async function saveOperationLocally(op: Operation) {
  const db = await getDB()
  await db.put("operations", op)
}

export async function getLocalOperations(): Promise<Operation[]> {
  const db = await getDB()
  return db.getAll("operations")
}

export async function getPendingOperations(): Promise<Operation[]> {
  const db = await getDB()
  return db.getAllFromIndex("operations", "by-status", "pending_sync")
}

export async function markOperationSynced(id: string) {
  const db = await getDB()
  const op = await db.get("operations", id)
  if (op) await db.put("operations", { ...op, status: "synced", syncedAt: Date.now() })
}

// Photos CRUD
export async function savePhotoLocally(id: string, operationId: string, photoType: string, blob: Blob) {
  const db = await getDB()
  await db.put("photos", { id, blob, operationId, photoType })
}

export async function getPhotosForOperation(operationId: string) {
  const db = await getDB()
  const all = await db.getAll("photos")
  return all.filter((p) => p.operationId === operationId)
}
```

---

## Module 6b — IndexedDB quota handling

Add to `src/services/offline/db.ts`:

```ts
export class StorageQuotaExceededError extends Error {
  constructor() {
    super("Storage quota exceeded. Please sync or delete some operations.")
    this.name = "StorageQuotaExceededError"
  }
}

export async function estimateStorageUsage(): Promise<{ used: number; quota: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate()
    return { used: estimate.usage ?? 0, quota: estimate.quota ?? 0 }
  }
  return { used: 0, quota: 0 }
}

export async function checkQuotaBeforeSave(): Promise<void> {
  const { used, quota } = await estimateStorageUsage()
  if (quota > 0 && used / quota > 0.9) {
    throw new StorageQuotaExceededError()
  }
}

// Wrap photo saves with quota check
export async function savePhotoLocally(id: string, operationId: string, photoType: string, blob: Blob) {
  await checkQuotaBeforeSave()
  const db = await getDB()
  await db.put("photos", { id, blob, operationId, photoType })
}

// Cleanup old synced photos to free space
export async function cleanupSyncedPhotos(): Promise<number> {
  const db = await getDB()
  const tx = db.transaction("photos", "readwrite")
  const store = tx.objectStore("photos")
  const all = await store.getAll()
  
  let deleted = 0
  for (const photo of all) {
    const op = await db.get("operations", photo.operationId)
    if (op?.status === "synced") {
      await store.delete(photo.id)
      deleted++
    }
  }
  await tx.done
  return deleted
}
```

---

## Module 7 — Camera Feature

### Ticket 7.1 — useCamera hook with permission handling

File: `src/features/camera/hooks/useCamera.ts`
```ts
import { useRef, useState, useCallback } from "react"

export type CameraError = 
  | "permission-denied" 
  | "not-found" 
  | "not-supported"

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<CameraError | null>(null)

  const startCamera = useCallback(async () => {
    setError(null)
    
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("not-supported")
      return
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      setStream(mediaStream)
      if (videoRef.current) videoRef.current.srcObject = mediaStream
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          setError("permission-denied")
        } else if (err.name === "NotFoundError") {
          setError("not-found")
        }
      }
    }
  }, [])

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop())
    setStream(null)
  }, [stream])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return
    const canvas = document.createElement("canvas")
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setCapturedBlob(blob)
        setPreviewUrl(URL.createObjectURL(blob))
        stopCamera()
      },
      "image/jpeg",
      0.8
    )
  }, [stopCamera])

  const resetCapture = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setCapturedBlob(null)
    setPreviewUrl(null)
  }, [previewUrl])

  return { videoRef, startCamera, stopCamera, capturePhoto, resetCapture, capturedBlob, previewUrl, error }
}
```

### Ticket 7.2 — CameraCapture component with fallback UI

File: `src/features/camera/components/CameraCapture.tsx`
```tsx
import { useEffect } from "react"
import { useCamera } from "../hooks/useCamera"
import type { PhotoType } from "@/types/PhotoType"

interface Props {
  photoType: PhotoType
  onCapture: (blob: Blob, type: PhotoType) => void
}

export function CameraCapture({ photoType, onCapture }: Props) {
  const { videoRef, startCamera, capturePhoto, resetCapture, capturedBlob, previewUrl, error } = useCamera()

  useEffect(() => {
    startCamera()
    return () => {
      // Cleanup stream on unmount
      const video = videoRef.current
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const handleConfirm = () => {
    if (capturedBlob) onCapture(capturedBlob, photoType)
  }

  const handleRetry = () => {
    resetCapture()
    startCamera()
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">
            {error === "permission-denied" && "Camera access denied"}
            {error === "not-found" && "No camera found on this device"}
            {error === "not-supported" && "Camera not supported in this browser"}
          </p>
          <p className="text-gray-600 text-sm">
            Please enable camera permissions in your browser settings and try again.
          </p>
        </div>
        <button
          onClick={handleRetry}
          className="bg-blue-600 text-white px-6 py-2 rounded-full"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {!previewUrl ? (
        <>
          <video ref={videoRef} autoPlay playsInline className="w-full rounded bg-black" />
          <button onClick={capturePhoto} className="bg-blue-600 text-white px-6 py-2 rounded-full">
            Capture
          </button>
        </>
      ) : (
        <>
          <img src={previewUrl} alt="Captured" className="w-full rounded" />
          <div className="flex gap-4">
            <button onClick={resetCapture} className="border px-4 py-2 rounded">Retake</button>
            <button onClick={handleConfirm} className="bg-green-600 text-white px-4 py-2 rounded">Confirm</button>
          </div>
        </>
      )}
    </div>
  )
}
```

---

## Module 8 — Operations Feature

### Ticket 8.1 — Operation service (Firestore)

File: `src/features/operations/services/operationService.ts`
```ts
import { collection, addDoc, getDocs, query, where, orderBy } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/services/firebase/firebaseServices"
import type { Operation } from "@/types/Operation"

export async function syncOperationToFirestore(op: Operation): Promise<void> {
  const { id, ...data } = op
  await addDoc(collection(db, "operations"), {
    ...data,
    syncedAt: Date.now(),
  })
}

export async function uploadPhotoToStorage(
  operationId: string,
  photoType: string,
  blob: Blob
): Promise<string> {
  const path = `operations/${operationId}/${photoType}.jpg`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, blob)
  return getDownloadURL(storageRef)
}

export async function fetchAllOperations(): Promise<Operation[]> {
  const snap = await getDocs(
    query(collection(db, "operations"), orderBy("createdAt", "desc"))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Operation))
}
```

### Ticket 8.2 — Sync engine with retry, conflict resolution, and Background Sync API

File: `src/services/offline/syncEngine.ts`
```ts
import { getPendingOperations, markOperationSynced, getPhotosForOperation } from "./db"
import { syncOperationToFirestore, uploadPhotoToStorage, checkOperationExists } from "@/features/operations/services/operationService"

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

export interface SyncResult {
  success: boolean
  operationId: string
  error?: string
  retries: number
  syncedAt?: number
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function syncOperationWithRetry(op: Operation): Promise<SyncResult> {
  let retries = 0

  while (retries < MAX_RETRIES) {
    try {
      const exists = await checkOperationExists(op.id)
      if (exists) {
        await markOperationSynced(op.id)
        return { success: true, operationId: op.id, retries, syncedAt: Date.now() }
      }

      const photos = await getPhotosForOperation(op.id)
      const photoUrls: Record<string, string> = {}

      for (const photo of photos) {
        const url = await uploadPhotoToStorage(op.id, photo.photoType, photo.blob)
        photoUrls[photo.photoType] = url
      }

      await syncOperationToFirestore({ ...op, photos: photoUrls })
      await markOperationSynced(op.id)

      return { success: true, operationId: op.id, retries, syncedAt: Date.now() }
    } catch (err) {
      retries++
      console.error(`Sync attempt ${retries} failed for operation ${op.id}:`, err)
      if (retries < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * retries)
      }
    }
  }

  return { success: false, operationId: op.id, retries, error: "Max retries exceeded" }
}

export async function runSyncEngine(): Promise<SyncResult[]> {
  const pending = await getPendingOperations()
  if (pending.length === 0) return []

  const results: SyncResult[] = []
  for (const op of pending) {
    const result = await syncOperationWithRetry(op)
    results.push(result)
  }
  return results
}

// Background Sync API (Chromium-only, fallback to interval)
let syncIntervalId: number | null = null

export function supportsBackgroundSync(): boolean {
  return "serviceWorker" in navigator && "sync" in window.SyncManager?.prototype as boolean
}

export async function registerBackgroundSync(): Promise<void> {
  if (!supportsBackgroundSync()) return
  try {
    const registration = await navigator.serviceWorker.ready
    await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register("sync-operations")
  } catch (err) {
    console.warn("Background Sync registration failed:", err)
  }
}

export function startBackgroundSync(intervalMs = 5 * 60 * 1000) {
  if (syncIntervalId !== null) return
  syncIntervalId = window.setInterval(() => {
    if (navigator.onLine) runSyncEngine()
  }, intervalMs)
}

export function stopBackgroundSync() {
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId)
    syncIntervalId = null
  }
}

// Register sync in service worker (public/sw.js)
export const serviceWorkerSyncCode = `
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-operations') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_REQUESTED' }))
      })
    );
  }
});
`
```

Also update `operationService.ts`:
```ts
export async function checkOperationExists(localId: string): Promise<boolean> {
  const snap = await getDocs(query(collection(db, "operations"), where("localId", "==", localId)))
  return !snap.empty
}
```

**Background Sync API Notes (2026):**
- **Browser support**: Chromium-only (Chrome, Edge, Opera). Firefox/Safari fallback to interval-based sync
- **Strategy**: Try Background Sync, fall back to periodic intervals
- **Conflict resolution**: Last-write-wins. Server version takes precedence if `localId` matches

### Ticket 8.3 — Optimistic updates for operations

Add optimistic updates to the operations store for a snappier feel:

File: `src/features/operations/store/operationStore.ts`
```ts
import { create } from "zustand"
import type { Operation } from "@/types/Operation"

interface OperationState {
  operations: Operation[]
  isLoading: boolean
  error: string | null
  pendingSyncCount: number
  
  addOperationOptimistic: (op: Operation) => void
  updateOperationStatus: (id: string, status: Operation["status"]) => void
  removePendingOperation: (id: string) => void
  setOperations: (ops: Operation[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  incrementPendingCount: () => void
  decrementPendingCount: () => void
}

export const useOperationStore = create<OperationState>((set) => ({
  operations: [],
  isLoading: false,
  error: null,
  pendingSyncCount: 0,

  addOperationOptimistic: (op) =>
    set((state) => ({ operations: [op, ...state.operations] })),

  updateOperationStatus: (id, status) =>
    set((state) => ({
      operations: state.operations.map((op) =>
        op.id === id ? { ...op, status } : op
      ),
    })),

  removePendingOperation: (id) =>
    set((state) => ({
      operations: state.operations.filter((op) => op.id !== id),
    })),

  setOperations: (operations) => set({ operations }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  incrementPendingCount: () => set((s) => ({ pendingSyncCount: s.pendingSyncCount + 1 })),
  decrementPendingCount: () => set((s) => ({ pendingSyncCount: Math.max(0, s.pendingSyncCount - 1) })),
}))
```

Use in operation form submission:
```tsx
interface OperationFormProps {
  onSuccess?: () => void
}

export function OperationForm({ onSuccess }: OperationFormProps) {
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [capturedPhotos, setCapturedPhotos] = useState<Partial<Record<PhotoType, Blob>>>({})
  
  const { user } = useAuth()
  const { addOperationOptimistic, removePendingOperation, incrementPendingCount } = useOperationStore()
  
  const handleSubmit = async (values: OperationFormValues) => {
    if (!user) return
    setSubmitState("loading")
    setError(null)

    const tempId = `temp_${Date.now()}`
    const optimisticOp: Operation = {
      id: tempId,
      ...values,
      operatorId: user.uid,
      operatorName: user.email ?? "Unknown",
      photos: {},
      status: navigator.onLine ? "synced" : "pending_sync",
      createdAt: Date.now(),
    }

    addOperationOptimistic(optimisticOp)

    if (!navigator.onLine) {
      incrementPendingCount()
      await saveOperationLocally(optimisticOp)
      setSubmitState("success")
      resetForm()
      onSuccess?.()
      return
    }

    try {
      await syncOperationToFirestore(optimisticOp)
      setSubmitState("success")
      resetForm()
      onSuccess?.()
    } catch {
      removePendingOperation(tempId)
      incrementPendingCount()
      await saveOperationLocally(optimisticOp)
      setSubmitState("error")
      setError("Failed to sync. Saved locally for later.")
      setTimeout(() => setSubmitState("idle"), 3000)
    }
  }

  const resetForm = () => {
    setCapturedPhotos({})
    // Reset form fields - integrate with your form library (react-hook-form, etc.)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ... form fields ... */}
      
      {/* Status feedback */}
      {submitState === "success" && (
        <div className="bg-green-100 text-green-800 p-3 rounded mb-4">
          Operation saved successfully!
        </div>
      )}
      {error && (
        <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <button 
        type="submit" 
        disabled={submitState === "loading"}
        className="w-full bg-blue-600 text-white py-3 rounded-lg disabled:opacity-50"
      >
        {submitState === "loading" ? "Saving..." : "Submit Operation"}
      </button>
    </form>
  )
}
```

### Ticket 8.4 — useOnlineStatus hook

File: `src/shared/hooks/useOnlineStatus.ts`
```ts
import { useEffect, useState, useCallback } from "react"
import { runSyncEngine, startBackgroundSync, stopBackgroundSync, registerBackgroundSync, type SyncResult } from "@/services/offline/syncEngine"
import { getPendingOperations } from "@/services/offline/db"

interface OnlineStatusState {
  isOnline: boolean
  pendingCount: number
  lastSyncAt: number | null
  syncResults: SyncResult[]
  isSyncing: boolean
}

export function useOnlineStatus() {
  const [state, setState] = useState<OnlineStatusState>({
    isOnline: navigator.onLine,
    pendingCount: 0,
    lastSyncAt: null,
    syncResults: [],
    isSyncing: false,
  })

  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingOperations()
    setState((s) => ({ ...s, pendingCount: pending.length }))
  }, [])

  const sync = useCallback(async () => {
    if (!navigator.onLine || state.isSyncing) return
    setState((s) => ({ ...s, isSyncing: true }))
    const results = await runSyncEngine()
    setState((s) => ({
      ...s,
      isSyncing: false,
      lastSyncAt: Date.now(),
      syncResults: results,
    }))
    await refreshPendingCount()
  }, [state.isSyncing, refreshPendingCount])

  useEffect(() => {
    startBackgroundSync()
    registerBackgroundSync()
    refreshPendingCount()

    const handleOnline = async () => {
      setState((s) => ({ ...s, isOnline: true }))
      await sync()
    }
    const handleOffline = () => setState((s) => ({ ...s, isOnline: false }))
    const handleSyncMessage = () => sync()

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    navigator.serviceWorker?.addEventListener("message", handleSyncMessage)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      navigator.serviceWorker?.removeEventListener("message", handleSyncMessage)
      stopBackgroundSync()
    }
  }, [sync, refreshPendingCount])

  return { ...state, sync, refreshPendingCount }
}
```

**2026 Offline UX Best Practices:**
- Show sync status badge in UI (pending count, last sync time)
- Visual indicators for offline mode (banner, icon)
- Clear feedback when sync succeeds/fails
- Disable network-only actions when offline
- Persist sync results for debugging

---

## Module 9 — Admin Dashboard

### Ticket 9.1 — AdminDashboard component with pagination

File: `src/features/admin/components/AdminDashboard.tsx`
```tsx
import { useEffect, useState, useMemo } from "react"
import { fetchAllOperations, fetchOperationsPaginated } from "@/features/operations/services/operationService"
import type { Operation } from "@/types/Operation"

const PAGE_SIZE = 20

interface Filters {
  date: string
  operator: string
  orderNumber: string
}

export function AdminDashboard() {
  const [operations, setOperations] = useState<Operation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [filters, setFilters] = useState<Filters>({ date: "", operator: "", orderNumber: "" })
  const [page, setPage] = useState(0)

  const loadInitial = async () => {
    setIsLoading(true)
    const data = await fetchOperationsPaginated(0, PAGE_SIZE)
    setOperations(data)
    setHasMore(data.length === PAGE_SIZE)
    setPage(0)
    setIsLoading(false)
  }

  const loadMore = async () => {
    if (isLoading || !hasMore) return
    setIsLoading(true)
    const nextPage = page + 1
    const data = await fetchOperationsPaginated(nextPage * PAGE_SIZE, PAGE_SIZE)
    setOperations((prev) => [...prev, ...data])
    setHasMore(data.length === PAGE_SIZE)
    setPage(nextPage)
    setIsLoading(false)
  }

  useEffect(() => {
    loadInitial()
  }, [])

  const filtered = useMemo(() => {
    return operations.filter((op) => {
      const matchDate = filters.date
        ? new Date(op.createdAt).toDateString() === new Date(filters.date).toDateString()
        : true
      const matchOperator = filters.operator
        ? op.operatorName.toLowerCase().includes(filters.operator.toLowerCase())
        : true
      const matchOrder = filters.orderNumber
        ? op.orderNumber.toLowerCase().includes(filters.orderNumber.toLowerCase())
        : true
      return matchDate && matchOperator && matchOrder
    })
  }, [operations, filters])

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(0)  // Reset pagination on filter change
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>

      {/* Sync status indicator */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="w-2 h-2 rounded-full bg-green-500"></span>
        <span>All systems operational</span>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <input
          type="date"
          value={filters.date}
          onChange={(e) => handleFilterChange("date", e.target.value)}
          className="border rounded p-2"
        />
        <input
          placeholder="Filter by operator"
          value={filters.operator}
          onChange={(e) => handleFilterChange("operator", e.target.value)}
          className="border rounded p-2"
        />
        <input
          placeholder="Filter by order number"
          value={filters.orderNumber}
          onChange={(e) => handleFilterChange("orderNumber", e.target.value)}
          className="border rounded p-2"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Order #</th>
              <th className="border p-2 text-left">Door</th>
              <th className="border p-2 text-left">Type</th>
              <th className="border p-2 text-left">Operator</th>
              <th className="border p-2 text-left">Status</th>
              <th className="border p-2 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((op) => (
              <tr key={op.id} className="hover:bg-gray-50">
                <td className="border p-2">{op.orderNumber}</td>
                <td className="border p-2">{op.doorNumber}</td>
                <td className="border p-2 capitalize">{op.operationType}</td>
                <td className="border p-2">{op.operatorName}</td>
                <td className="border p-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    op.status === "synced" ? "bg-green-100 text-green-800" :
                    op.status === "pending_sync" ? "bg-yellow-100 text-yellow-800" :
                    "bg-red-100 text-red-800"
                  }`}>
                    {op.status}
                  </span>
                </td>
                <td className="border p-2">{new Date(op.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {filtered.length} operations
        </p>
        <div className="flex gap-2">
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={isLoading}
              className="px-4 py-2 border rounded disabled:opacity-50"
            >
              {isLoading ? "Loading..." : "Load More"}
            </button>
          )}
          {page > 0 && (
            <button
              onClick={loadInitial}
              className="px-4 py-2 border rounded"
            >
              Back to Top
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

Update `operationService.ts` to add pagination:
```ts
export async function fetchOperationsPaginated(
  offset: number,
  limit: number
): Promise<Operation[]> {
  const snap = await getDocs(
    query(
      collection(db, "operations"),
      orderBy("createdAt", "desc"),
      limit,
      startAfter(offset > 0 ? offset : undefined)
    )
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Operation))
}
```

---

## Module 10 — PWA & Deploy

### Ticket 10.1 — Security: Content Security Policy

File: `public/_headers` (for static hosts) or configure in Firebase Hosting:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://*.firebaseio.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; img-src 'self' data: blob: https://*.googleapis.com https://*.firebaseusercontent.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

### Ticket 10.2 — PWA Install Prompt Hook

File: `src/shared/hooks/useInstallPrompt.ts`
```tsx
import { useState, useEffect, useCallback } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const beforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      setIsInstallable(true)
    }

    window.addEventListener("beforeinstallprompt", beforeInstallPrompt)

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setInstallPrompt(null)
    }

    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const prompt = useCallback(async () => {
    if (!installPrompt) return false
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === "accepted") {
      setInstallPrompt(null)
      setIsInstallable(false)
    }
    return outcome === "accepted"
  }, [installPrompt])

  // Best time to show: after user has used the app meaningfully
  // Don't show immediately - wait for at least 1-2 interactions
  const canShowPrompt = isInstallable && !isInstalled && installPrompt !== null

  return { isInstallable, isInstalled, prompt, canShowPrompt }
}
```

**2026 PWA Install Prompt Best Practices:**
- **Don't show immediately** — wait for user engagement (after first operation or login)
- **Show once** — don't spam the prompt
- **Best timing**: After user completes a meaningful action (not just landing)
- **Custom prompt UI** preferred over browser's native prompt for better conversion

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Select: build/ as public dir, configure as SPA (rewrite all to index.html)
```

`firebase.json`:
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

### Ticket 10.3 — Deploy

```bash
npm run build
firebase deploy
```

---

## Module 11 — Capacitor (Native Builds)

### Ticket 11.1 — Install Capacitor dependencies

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm install @capacitor/haptics @capacitor/status-bar @capacitor/splash-screen
```

### Ticket 11.2 — Initialize Capacitor

```bash
npx cap init "Cargo Control" "com.profresh.cargocontrol" --web-dir=dist
```

### Ticket 11.3 — Add Android platform

```bash
npx cap add android
```

### Ticket 11.4 — Add iOS platform (Mac only)

```bash
npx cap add ios
```

### Ticket 11.5 — Configure Capacitor settings

File: `capacitor.config.ts`
```ts
import { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.profresh.cargocontrol",
  appName: "Cargo Control",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#ffffff",
    },
  },
}

export default config
```

### Ticket 11.6 — Update package.json scripts

File: `package.json` — add to scripts:
```json
{
  "scripts": {
    "build": "tsc && vite build",
    "build:android": "npm run build && npx cap sync android",
    "build:ios": "npm run build && npx cap sync ios",
    "open:android": "npx cap open android",
    "open:ios": "npx cap open ios"
  }
}
```

### Ticket 11.7 — Generate app icons and splash

1. Create a 1024x1024 PNG icon (e.g., `icon.png`)
2. Run:
```bash
npm install -D @capacitor/assets
npx @capacitor/assets generate --iconSource=icon.png
```

This auto-generates:
- Android icons in `android/app/src/main/res/`
- iOS icons in `ios/App/App/Assets.xcassets/`
- Splash screens for both platforms

### Ticket 11.8 — Build for Android

```bash
# Full build
npm run build:android
npx cap open android

# Then in Android Studio:
# 1. Connect device via USB (enable USB debugging)
# 2. Or use emulator: Tools → Device Manager → Create Device
# 3. Click "Run" (green triangle)
```

APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### Ticket 11.9 — Build for iOS (Mac only)

```bash
npm run build:ios
npx cap open ios

# Then in Xcode:
# 1. Select target device or simulator
# 2. Product → Build
# 3. Run on device or simulator
```

### Ticket 11.10 — Sync after web changes

After modifying web code:
```bash
npm run build && npx cap sync android
```

Use `npx cap copy android` for faster sync (copies assets only, no native rebuild needed).

---

## PWA Launch Readiness Checklist (2026)

Before deploying to production:

- [ ] HTTPS configured on all environments
- [ ] Service worker registered and passing Lighthouse SW audit
- [ ] Web App Manifest valid with maskable icons in required sizes
- [ ] Offline fallback page designed and cached
- [ ] PWA install prompt deferred and triggered contextually (after user engagement)
- [ ] Background sync queue implemented for write operations
- [ ] Lighthouse PWA audit score 90+ in all categories
- [ ] Tested on iOS Safari (home screen install flow)
- [ ] Core Web Vitals passing (LCP < 2.5s, INP < 200ms, CLS < 0.1)
- [ ] Content Security Policy headers configured
- [ ] Firebase security rules tested with Emulator Suite
- [ ] Sensitive data NOT cached in IndexedDB or service worker
- [ ] Sync status UI visible to operators

---

## Module 12 — UI/UX Redesign

> **Context**: The current UI is functional but visually plain — flat white background, minimal color, no navigation structure. This module brings it in line with 2025-2026 mobile design standards and fixes key UX gaps that affect daily usability for warehouse operators and admins.

### UX Gap Analysis

| Gap | Impact | Fix |
|-----|--------|-----|
| No bottom navigation | Users can't navigate between sections | Bottom tab bar |
| Logout buried in top-right icon | Hard to find for new users | Move to profile tab / settings section |
| No contextual feedback | Users don't know if actions succeeded | Toast notification system |
| Spinners only | Jarring empty-to-content transitions | Skeleton loaders for lists |
| No empty states | Blank screen when no data | Illustrated empty state components |
| No FAB for primary action | New operations require header navigation | Floating Action Button on operator home |
| No page transitions | Navigation feels abrupt | Subtle slide/fade transitions |
| "Capture" flow interrupts context | Full-screen modal loses form context | Keep camera modal but improve header |
| No pull-to-refresh | Standard mobile gesture missing | `useSwipeRefresh` hook |

### 2025-2026 Design Trend Application

These trends are applied as they fit the industrial/warehouse context:

- **Bold typography with strong hierarchy** — Large section titles, clear data hierarchy
- **Elevated card surfaces** — Layered depth instead of flat borders
- **Vibrant primary + tonal palette** — Richer hue family, not just one blue
- **Bottom sheet patterns** — For filters, confirmation dialogs
- **Skeleton screens** — Replace all spinners in list/table views
- **Micro-interactions** — Button press scale, success checkmark animation
- **Status-aware color system** — Synced (green), Pending (amber), Error (red) used consistently across all surfaces
- **Safe area awareness** — Padding respects iOS notch and Android navigation bar

---

### Ticket 12.1 — Updated Design Tokens (Tailwind + CSS)

**Goal**: Replace the minimal single-blue palette with a richer design system.

File: `tailwind.config.ts`
```ts
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand primary — deep indigo instead of flat blue
        primary: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          DEFAULT: "#4f46e5",  // indigo-600
          700: "#4338ca",
          dark: "#3730a3",
        },
        // Surface colors for layered depth
        surface: {
          DEFAULT: "#ffffff",
          secondary: "#f8fafc",  // Very light gray for page background
          tertiary: "#f1f5f9",   // Input backgrounds, subtle sections
        },
        // Status colors
        success: {
          DEFAULT: "#16a34a",
          light: "#dcfce7",
          dark: "#15803d",
        },
        warning: {
          DEFAULT: "#d97706",
          light: "#fef3c7",
          dark: "#b45309",
        },
        error: {
          DEFAULT: "#dc2626",
          light: "#fee2e2",
          dark: "#b91c1c",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)",
        "card-hover": "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)",
        "card-elevated": "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)",
        "bottom-nav": "0 -1px 0 0 #e2e8f0, 0 -4px 16px 0 rgb(0 0 0 / 0.06)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
}
```

File: `src/index.css` — replace component classes:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }

  body {
    @apply bg-surface-secondary text-gray-900 antialiased;
    min-height: 100vh;
    min-height: 100dvh;
  }

  /* Safe area padding for iOS notch / Android nav bar */
  .safe-top    { padding-top: env(safe-area-inset-top); }
  .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
}

@layer components {
  /* Buttons */
  .btn {
    @apply inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm
           transition-all duration-150 active:scale-[0.97] select-none;
  }
  .btn-primary {
    @apply bg-primary text-white shadow-sm
           hover:bg-primary-700 active:bg-primary-dark
           disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100;
  }
  .btn-secondary {
    @apply bg-surface-tertiary text-gray-800
           hover:bg-gray-200 active:bg-gray-300
           disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100;
  }
  .btn-danger {
    @apply bg-error text-white shadow-sm
           hover:bg-error-dark
           disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100;
  }
  .btn-ghost {
    @apply bg-transparent text-gray-600
           hover:bg-surface-tertiary;
  }

  /* Inputs */
  .input {
    @apply w-full bg-surface-tertiary border border-transparent rounded-xl px-4 py-3 text-base text-gray-900
           placeholder:text-gray-400
           focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:bg-white
           transition-colors duration-150
           disabled:opacity-50 disabled:cursor-not-allowed;
  }
  .input-error {
    @apply ring-2 ring-error border-error bg-error-light;
  }

  /* Cards */
  .card {
    @apply bg-surface rounded-2xl shadow-card border border-gray-100/80 p-4;
  }
  .card-interactive {
    @apply card cursor-pointer hover:shadow-card-hover active:scale-[0.99] transition-all duration-150;
  }

  /* Badges */
  .badge {
    @apply inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold;
  }
  .badge-success { @apply bg-success-light text-success-dark; }
  .badge-warning { @apply bg-warning-light text-warning-dark; }
  .badge-error   { @apply bg-error-light   text-error-dark;   }

  /* Skeleton loader */
  .skeleton {
    @apply bg-gray-200 rounded-lg animate-pulse;
  }

  /* Section title */
  .section-title {
    @apply text-lg font-bold text-gray-900 tracking-tight;
  }
}

@layer utilities {
  .touch-target { @apply min-h-[44px] min-w-[44px]; }
  .pb-nav       { padding-bottom: calc(4rem + env(safe-area-inset-bottom)); }
}
```

---

### Ticket 12.2 — Bottom Navigation Component

**Goal**: Add a persistent bottom tab bar so operators and admins can navigate without hunting for links.

File: `src/shared/components/layout/BottomNav.tsx`
```tsx
import { NavLink } from "react-router-dom"
import { FiHome, FiPlusCircle, FiList, FiUser } from "react-icons/fi"

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

interface BottomNavProps {
  items: NavItem[]
}

export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 bg-white safe-bottom"
      style={{ boxShadow: "0 -1px 0 0 #e2e8f0, 0 -4px 16px 0 rgb(0 0 0 / 0.06)" }}
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-150 min-w-[60px] touch-target
              ${isActive
                ? "text-primary bg-primary-50 font-semibold"
                : "text-gray-400 hover:text-gray-600"
              }`
            }
          >
            <span className="w-6 h-6">{item.icon}</span>
            <span className="text-[11px] leading-none">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
```

Operator nav items:
```ts
const operatorNavItems = [
  { to: "/operator",       label: "Home",     icon: <FiHome /> },
  { to: "/operation/new",  label: "New Op",   icon: <FiPlusCircle /> },
  { to: "/operator/history", label: "History", icon: <FiList /> },
  { to: "/account",        label: "Account",  icon: <FiUser /> },
]
```

Admin nav items:
```ts
const adminNavItems = [
  { to: "/admin",          label: "Dashboard", icon: <FiHome /> },
  { to: "/admin/reports",  label: "Reports",   icon: <FiList /> },
  { to: "/account",        label: "Account",   icon: <FiUser /> },
]
```

---

### Ticket 12.3 — Redesigned AppShell

**Goal**: Modernize the app shell with a cleaner header, better branding, and bottom nav integration. The header becomes a lean top bar; bottom nav handles all navigation.

File: `src/shared/components/layout/AppShell.tsx`
```tsx
import { useNavigate } from "react-router-dom"
import { FiChevronLeft } from "react-icons/fi"
import { BottomNav } from "./BottomNav"
import { useAuthStore } from "@/features/auth/store/authStore"

interface AppShellProps {
  children: React.ReactNode
  title?: string
  showBack?: boolean
  headerRight?: React.ReactNode
  navItems?: { to: string; label: string; icon: React.ReactNode }[]
  /** If true, content scrolls under header. Use false for camera views. */
  scrollable?: boolean
}

export function AppShell({
  children,
  title,
  showBack,
  headerRight,
  navItems,
  scrollable = true,
}: AppShellProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  return (
    <div className="min-h-screen min-h-dvh bg-surface-secondary flex flex-col">
      {/* Header */}
      <header
        className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10 safe-top"
      >
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {showBack ? (
              <button
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 rounded-xl hover:bg-surface-tertiary touch-target flex-shrink-0"
                aria-label="Go back"
              >
                <FiChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
            ) : (
              <span className="text-primary font-bold text-xl tracking-tight mr-1">
                📦
              </span>
            )}
            <h1 className="text-base font-bold text-gray-900 truncate">
              {title || "Cargo Control"}
            </h1>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {headerRight}
          </div>
        </div>
      </header>

      {/* Main content — bottom padding accounts for nav bar */}
      <main className={`flex-1 p-4 ${navItems ? "pb-nav" : ""}`}>
        {children}
      </main>

      {/* Bottom navigation */}
      {navItems && <BottomNav items={navItems} />}
    </div>
  )
}
```

---

### Ticket 12.4 — Toast Notification System

**Goal**: Replace inline success/error banners with non-intrusive toast notifications that auto-dismiss.

File: `src/shared/components/ui/Toast.tsx`
```tsx
import { useEffect } from "react"
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from "react-icons/fi"

export type ToastType = "success" | "error" | "info" | "warning"

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  duration?: number  // ms, default 3500
}

interface ToastProps {
  toast: ToastMessage
  onDismiss: (id: string) => void
}

const iconMap = {
  success: <FiCheckCircle className="w-5 h-5 text-success" />,
  error:   <FiAlertCircle className="w-5 h-5 text-error" />,
  warning: <FiAlertCircle className="w-5 h-5 text-warning" />,
  info:    <FiInfo className="w-5 h-5 text-primary" />,
}

const bgMap = {
  success: "bg-white border-success/30",
  error:   "bg-white border-error/30",
  warning: "bg-white border-warning/30",
  info:    "bg-white border-primary/30",
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration ?? 3500)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-card-elevated border ${bgMap[toast.type]}
                  animate-in slide-in-from-bottom-2 duration-200`}
    >
      {iconMap[toast.type]}
      <p className="flex-1 text-sm font-medium text-gray-800">{toast.message}</p>
      <button onClick={() => onDismiss(toast.id)} className="text-gray-400 hover:text-gray-600 p-1">
        <FiX className="w-4 h-4" />
      </button>
    </div>
  )
}
```

File: `src/shared/components/ui/ToastContainer.tsx`
```tsx
import { Toast } from "./Toast"
import { useToastStore } from "@/shared/store/toastStore"

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 flex flex-col gap-2 px-4 pb-2">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  )
}
```

File: `src/shared/store/toastStore.ts`
```ts
import { create } from "zustand"
import type { ToastMessage, ToastType } from "../components/ui/Toast"

interface ToastState {
  toasts: ToastMessage[]
  show: (type: ToastType, message: string, duration?: number) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (type, message, duration) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: `${Date.now()}_${Math.random()}`, type, message, duration },
      ],
    })),
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
```

Hook for convenience:
```ts
export function useToast() {
  const { show } = useToastStore()
  return {
    success: (msg: string) => show("success", msg),
    error:   (msg: string) => show("error", msg),
    info:    (msg: string) => show("info", msg),
    warning: (msg: string) => show("warning", msg),
  }
}
```

Mount `<ToastContainer />` in `src/app/App.tsx` or `src/app/root.tsx` once.

---

### Ticket 12.5 — Skeleton Loaders

**Goal**: Replace all loading spinners in list/table views with skeleton screens that match the content layout.

File: `src/shared/components/ui/SkeletonRow.tsx`
```tsx
export function SkeletonRow() {
  return (
    <div className="card flex items-center gap-3 animate-pulse">
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-1/3 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
      <div className="skeleton h-6 w-16 rounded-full" />
    </div>
  )
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}
```

File: `src/shared/components/ui/SkeletonTable.tsx`
```tsx
export function SkeletonTableRow() {
  return (
    <tr className="border-b animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="py-3 pr-4">
          <div className="skeleton h-4 rounded" style={{ width: `${60 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  )
}
```

Usage: replace `isLoading` spinner blocks with `<SkeletonList />` or `<SkeletonTableRow />` inside `<tbody>`.

---

### Ticket 12.6 — Empty State Components

**Goal**: Replace blank areas when there's no data with helpful, context-aware empty states.

File: `src/shared/components/ui/EmptyState.tsx`
```tsx
interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-16 h-16 bg-surface-tertiary rounded-3xl flex items-center justify-center mb-4 text-2xl">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-gray-800 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mb-5">{description}</p>
      )}
      {action}
    </div>
  )
}
```

Usage examples:
```tsx
// Operator history page — no operations yet
<EmptyState
  icon="📋"
  title="No operations yet"
  description="Your completed loads and unloads will appear here."
/>

// Admin page — no results for filter
<EmptyState
  icon="🔍"
  title="No operations found"
  description="Try adjusting your filters."
  action={<button className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>}
/>
```

---

### Ticket 12.7 — Floating Action Button (Operator)

**Goal**: Give operators a prominent one-tap entry point to start a new operation. This replaces the "New Load" / "New Unload" buttons buried in the card on OperatorPage.

File: `src/shared/components/ui/FAB.tsx`
```tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { FiPlus, FiTruck, FiPackage, FiX } from "react-icons/fi"

export function OperationFAB() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Action options */}
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-end gap-3">
        {open && (
          <>
            <button
              onClick={() => { navigate("/operation/new?type=unload"); setOpen(false) }}
              className="flex items-center gap-3 btn btn-secondary shadow-card-elevated"
            >
              <FiPackage className="w-5 h-5" />
              New Unload
            </button>
            <button
              onClick={() => { navigate("/operation/new?type=load"); setOpen(false) }}
              className="flex items-center gap-3 btn btn-primary shadow-card-elevated"
            >
              <FiTruck className="w-5 h-5" />
              New Load
            </button>
          </>
        )}
      </div>

      {/* FAB trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40
                    w-14 h-14 rounded-full shadow-card-elevated flex items-center justify-center
                    transition-all duration-200 active:scale-95
                    ${open ? "bg-gray-700 rotate-45" : "bg-primary hover:bg-primary-700"}`}
        aria-label={open ? "Close menu" : "New operation"}
      >
        <FiPlus className="w-6 h-6 text-white" />
      </button>
    </>
  )
}
```

---

### Ticket 12.8 — Account / Profile Page

**Goal**: Move logout and user info to a dedicated Account page accessible from the bottom nav, so the top header stays clean.

File: `src/pages/AccountPage.tsx`
```tsx
import { AppShell } from "@/shared/components/layout/AppShell"
import { useAuthStore } from "@/features/auth/store/authStore"
import { logout } from "@/features/auth/services/authService"
import { FiLogOut, FiUser, FiShield, FiWifi } from "react-icons/fi"
import { useOnlineStatus } from "@/shared/hooks"
import { OPERATOR_NAV, ADMIN_NAV } from "@/shared/constants/navItems"

export function AccountPage() {
  const { user } = useAuthStore()
  const { isOnline } = useOnlineStatus()

  const navItems = user?.role === "admin" ? ADMIN_NAV : OPERATOR_NAV

  return (
    <AppShell title="Account" navItems={navItems}>
      <div className="space-y-4">
        {/* User info card */}
        <div className="card flex items-center gap-4">
          <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
            <FiUser className="w-7 h-7 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{user?.email}</p>
            <p className="text-sm text-gray-500 capitalize">{user?.role ?? "—"}</p>
          </div>
        </div>

        {/* Status */}
        <div className="card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FiWifi className={`w-5 h-5 ${isOnline ? "text-success" : "text-gray-400"}`} />
            <span className="text-sm font-medium text-gray-700">
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
          <span className={`badge ${isOnline ? "badge-success" : "badge-warning"}`}>
            {isOnline ? "Connected" : "No connection"}
          </span>
        </div>

        {/* App info */}
        <div className="card flex items-center gap-3">
          <FiShield className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-700">Cargo Control</p>
            <p className="text-xs text-gray-400">v1.0.0 · Profresh Logistics</p>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={logout}
          className="btn btn-danger w-full py-3"
        >
          <FiLogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </AppShell>
  )
}
```

---

### Ticket 12.9 — Wire Navigation Constants

**Goal**: Define nav items in one place so AppShell, BottomNav, and the router all use the same source.

File: `src/shared/constants/navItems.tsx`
```tsx
import { FiHome, FiList, FiUser } from "react-icons/fi"

export const OPERATOR_NAV = [
  { to: "/operator",         label: "Home",    icon: <FiHome className="w-5 h-5" /> },
  { to: "/operator/history", label: "History", icon: <FiList className="w-5 h-5" /> },
  { to: "/account",          label: "Account", icon: <FiUser className="w-5 h-5" /> },
]

export const ADMIN_NAV = [
  { to: "/admin",   label: "Dashboard", icon: <FiHome className="w-5 h-5" /> },
  { to: "/account", label: "Account",   icon: <FiUser className="w-5 h-5" /> },
]
```

Update `router.tsx` to add the `/account` route (accessible to both roles) and `/operator/history`.

---

### Ticket 12.10 — Apply Redesign to All Pages

**Goal**: Update every page to use the new design tokens, skeleton loaders, toast feedback, and bottom nav.

#### OperatorPage
- Use `OPERATOR_NAV` in AppShell `navItems`
- Add `<OperationFAB />` at page root
- Show `<SkeletonList count={3} />` while loading recent ops
- Show `<EmptyState>` when no recent ops
- Replace inline success alerts with `useToast().success()`
- Remove the "New Load / New Unload" button card (replaced by FAB)

#### OperationFormPage
- Keep existing logic; update styles to new `.input`, `.btn`, `.card` classes
- Replace success banner with `useToast().success("Operation saved!")` then navigate

#### AdminPage
- Pass `ADMIN_NAV` to AppShell
- Show `<SkeletonTableRow>` × 6 in `<tbody>` while loading
- Show `<EmptyState>` when no filtered results
- Use toast for errors instead of inline red banner

#### OperationDetailPage
- Add `<SkeletonList count={2} />` while loading
- Replace error banner with toast

#### LoginPage
- Update to new `.input`, `.btn` classes; larger logo/brand area at top

---

### Ticket 12.11 — Operator History Page (New)

**Goal**: Operators currently have no way to browse their past operations. Add a dedicated page.

File: `src/pages/OperatorHistoryPage.tsx`
- Uses `getLocalOperations()` + `fetchOperationsByOperator(user.uid)` (merge, deduplicate by `localId`)
- Shows list of operations sorted by `createdAt` desc
- Each row: order number, type badge, date, status badge — tappable to detail page
- Infinite scroll or "Load More" button
- `<EmptyState>` when no history
- Uses `OPERATOR_NAV` in AppShell

---

### Module 12 — Acceptance Criteria

- [ ] Bottom tab bar visible on all main pages for both roles
- [ ] Logout accessible via Account tab (not top-right icon)
- [ ] FAB opens New Load / New Unload options on operator home
- [ ] All list/table loading states use skeleton screens (no spinners in list views)
- [ ] All empty states show helpful message + optional action
- [ ] Success/error feedback shown as toast, not inline banner
- [ ] New design tokens applied globally (indigo primary, elevated cards, Inter font)
- [ ] Safe area insets applied (iOS notch / Android nav bar)
- [ ] Operator History page accessible from bottom nav
- [ ] Account page shows user email, role, online status, and sign-out button
- [ ] All pages pass TypeScript (`tsc --noEmit`)

---

## Module 13 — Unit Tests

> **Context**: No test infrastructure exists yet. This module establishes Vitest + React Testing Library, defines the mock strategy (no live Firebase/IndexedDB calls), and covers every layer of the app with a discrete ticket per area. All tests must be runnable offline with zero external dependencies.

### Mock Strategy

| Layer | Mock approach |
|-------|--------------|
| Firebase Auth | `vi.mock("firebase/auth")` — stub `signInWithEmailAndPassword`, `signOut`, `onAuthStateChanged` |
| Firestore | `vi.mock("firebase/firestore")` — stub `getDoc`, `getDocs`, `addDoc`, `setDoc`, `query`, `where` |
| Firebase Storage | `vi.mock("firebase/storage")` — stub `ref`, `uploadBytes`, `getDownloadURL` |
| IndexedDB (`idb`) | `fake-indexeddb` in-memory implementation, reset between tests |
| `navigator.mediaDevices` | `vi.stubGlobal` with mock `getUserMedia` returning a fake MediaStream |
| `navigator.onLine` | `vi.stubGlobal` / `Object.defineProperty` per test |
| React Router | `MemoryRouter` wrapper with preset routes |
| Zustand stores | `store.setState({})` reset in `beforeEach` |
| Timers | `vi.useFakeTimers()` where needed (retry delays, toast timeouts) |

---

### Ticket 13.1 — Test Infrastructure Setup

**Goal**: Install dependencies, configure Vitest, create global test setup and shared test utilities.

#### Install dependencies
```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom fake-indexeddb
```

#### `vitest.config.ts`
```ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/services/firebase/**",   // Config files, not logic
        "src/**/*.d.ts",
      ],
    },
  },
})
```

#### `package.json` — add test scripts
```json
"scripts": {
  "test":          "vitest",
  "test:run":      "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

#### `src/test/setup.ts`
```ts
import "@testing-library/jest-dom"
import { vi, beforeEach, afterEach } from "vitest"

// ── Firebase: mock entire SDK so no real connections are made ──────────────
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(() => () => {}),
  setPersistence: vi.fn(),
  browserLocalPersistence: "local",
}))

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
}))

vi.mock("firebase/storage", () => ({
  getStorage: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}))

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}))

// ── navigator.mediaDevices stub ───────────────────────────────────────────
Object.defineProperty(global.navigator, "mediaDevices", {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
  configurable: true,
  writable: true,
})

// ── fake-indexeddb — replaces native IDB with in-memory version ──────────
import "fake-indexeddb/auto"

// ── Reset mocks between tests ─────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})
```

#### `src/test/factories.ts` — shared test data builders
```ts
import type { Operation } from "@/types/Operation"
import type { AuthUser } from "@/features/auth/store/authStore"

export function makeOperation(overrides: Partial<Operation> = {}): Operation {
  return {
    id: "op_test_001",
    localId: "op_test_001",
    orderNumber: "ORD001",
    doorNumber: "D01",
    operationType: "load",
    operatorId: "user_001",
    operatorName: "test@example.com",
    photos: {},
    status: "pending_sync",
    createdAt: 1711756800000,  // fixed timestamp for deterministic tests
    ...overrides,
  }
}

export function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    uid: "user_001",
    email: "operator@example.com",
    role: "operator",
    ...overrides,
  }
}

export function makeAdminUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return makeUser({ role: "admin", email: "admin@example.com", uid: "admin_001", ...overrides })
}
```

---

### Ticket 13.2 — Schema Tests

**Goal**: Verify all Zod schemas accept valid data and reject invalid data with correct messages.

File: `src/features/auth/schemas/__tests__/loginSchema.test.ts`

```ts
import { describe, it, expect } from "vitest"
import { loginSchema } from "../loginSchema"

describe("loginSchema", () => {
  it("accepts valid email and password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "secret123" })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email format", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret123" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Invalid email address")
  })

  it("rejects empty email", () => {
    const result = loginSchema.safeParse({ email: "", password: "secret123" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Email is required")
  })

  it("rejects password shorter than 6 characters", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "abc" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Password must be at least 6 characters")
  })
})
```

File: `src/features/operations/schemas/__tests__/operationSchema.test.ts`

```ts
import { describe, it, expect } from "vitest"
import { operationSchema } from "../operationSchema"

describe("operationSchema", () => {
  it("accepts valid load operation", () => {
    const result = operationSchema.safeParse({ orderNumber: "ORD001", doorNumber: "D01", operationType: "load" })
    expect(result.success).toBe(true)
  })

  it("accepts valid unload operation", () => {
    const result = operationSchema.safeParse({ orderNumber: "ABC123", doorNumber: "B5", operationType: "unload" })
    expect(result.success).toBe(true)
  })

  it("rejects orderNumber shorter than 3 characters", () => {
    const result = operationSchema.safeParse({ orderNumber: "AB", doorNumber: "D01", operationType: "load" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/at least 3/)
  })

  it("rejects orderNumber longer than 20 characters", () => {
    const result = operationSchema.safeParse({ orderNumber: "A".repeat(21), doorNumber: "D01", operationType: "load" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/at most 20/)
  })

  it("rejects orderNumber with special characters", () => {
    const result = operationSchema.safeParse({ orderNumber: "ORD-001", doorNumber: "D01", operationType: "load" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/alphanumeric/)
  })

  it("rejects empty doorNumber", () => {
    const result = operationSchema.safeParse({ orderNumber: "ORD001", doorNumber: "", operationType: "load" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid operationType", () => {
    const result = operationSchema.safeParse({ orderNumber: "ORD001", doorNumber: "D01", operationType: "ship" })
    expect(result.success).toBe(false)
  })

  it("rejects doorNumber with special characters", () => {
    const result = operationSchema.safeParse({ orderNumber: "ORD001", doorNumber: "D-01", operationType: "load" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/alphanumeric/)
  })
})
```

---

### Ticket 13.3 — Utility Function Tests

**Goal**: Test all date/time formatting utilities with deterministic fixed timestamps.

File: `src/shared/utils/__tests__/formatDate.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { formatDate, formatDateTime, formatRelativeTime } from "../formatDate"

// Use a fixed "now" so relative time tests are deterministic
const FIXED_NOW = new Date("2024-03-30T12:00:00Z").getTime()

describe("formatDate", () => {
  it("formats timestamp to readable date string", () => {
    const result = formatDate(FIXED_NOW)
    expect(result).toContain("2024")
    expect(result).toContain("Mar")
  })
})

describe("formatDateTime", () => {
  it("includes both date and time", () => {
    const result = formatDateTime(FIXED_NOW)
    expect(result).toMatch(/Mar/)
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })
  afterEach(() => { vi.useRealTimers() })

  it('returns "Just now" for timestamps within the last minute', () => {
    expect(formatRelativeTime(FIXED_NOW - 30_000)).toBe("Just now")
  })

  it('returns minutes ago for timestamps 1-59 minutes old', () => {
    expect(formatRelativeTime(FIXED_NOW - 5 * 60_000)).toBe("5m ago")
  })

  it('returns hours ago for timestamps 1-23 hours old', () => {
    expect(formatRelativeTime(FIXED_NOW - 3 * 3_600_000)).toBe("3h ago")
  })

  it('returns days ago for timestamps 1+ days old', () => {
    expect(formatRelativeTime(FIXED_NOW - 2 * 86_400_000)).toBe("2d ago")
  })
})
```

---

### Ticket 13.4 — Zustand Store Tests

**Goal**: Verify store state transitions for `authStore`, `operationStore`, and `toastStore` in isolation.

File: `src/features/auth/store/__tests__/authStore.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { useAuthStore } from "../authStore"

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: true })
  })

  it("starts with null user and isLoading true", () => {
    const { user, isLoading } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(isLoading).toBe(true)
  })

  it("setUser updates user state", () => {
    useAuthStore.getState().setUser({ uid: "u1", email: "a@b.com", role: "operator" })
    expect(useAuthStore.getState().user?.uid).toBe("u1")
  })

  it("setUser(null) clears user", () => {
    useAuthStore.getState().setUser({ uid: "u1", email: "a@b.com", role: "admin" })
    useAuthStore.getState().setUser(null)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it("setLoading updates loading state", () => {
    useAuthStore.getState().setLoading(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
  })
})
```

File: `src/features/operations/store/__tests__/operationStore.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { useOperationStore } from "../operationStore"
import { makeOperation } from "@/test/factories"

describe("operationStore", () => {
  beforeEach(() => {
    useOperationStore.setState({
      operations: [],
      isLoading: false,
      error: null,
      pendingSyncCount: 0,
      lastSyncedAt: null,
    })
  })

  it("addOperation prepends to list", () => {
    const op = makeOperation()
    useOperationStore.getState().addOperation(op)
    expect(useOperationStore.getState().operations[0].id).toBe("op_test_001")
  })

  it("setOperations replaces the list", () => {
    const ops = [makeOperation({ id: "a" }), makeOperation({ id: "b" })]
    useOperationStore.getState().setOperations(ops)
    expect(useOperationStore.getState().operations).toHaveLength(2)
  })

  it("updateOperation patches matching record", () => {
    const op = makeOperation()
    useOperationStore.getState().addOperation(op)
    useOperationStore.getState().updateOperation("op_test_001", { status: "synced" })
    expect(useOperationStore.getState().operations[0].status).toBe("synced")
  })

  it("removeOperation removes matching record", () => {
    useOperationStore.getState().addOperation(makeOperation())
    useOperationStore.getState().removeOperation("op_test_001")
    expect(useOperationStore.getState().operations).toHaveLength(0)
  })

  it("incrementPendingCount increments by 1", () => {
    useOperationStore.getState().incrementPendingCount()
    useOperationStore.getState().incrementPendingCount()
    expect(useOperationStore.getState().pendingSyncCount).toBe(2)
  })

  it("decrementPendingCount never goes below 0", () => {
    useOperationStore.getState().decrementPendingCount()
    expect(useOperationStore.getState().pendingSyncCount).toBe(0)
  })

  it("setError stores error message", () => {
    useOperationStore.getState().setError("Something went wrong")
    expect(useOperationStore.getState().error).toBe("Something went wrong")
  })
})
```

File: `src/shared/store/__tests__/toastStore.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { useToastStore } from "../toastStore"

describe("toastStore", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it("show() adds a toast with correct type and message", () => {
    useToastStore.getState().show("success", "Saved!")
    const { toasts } = useToastStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe("success")
    expect(toasts[0].message).toBe("Saved!")
  })

  it("dismiss() removes the correct toast by id", () => {
    useToastStore.getState().show("error", "Oops")
    const id = useToastStore.getState().toasts[0].id
    useToastStore.getState().dismiss(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it("multiple toasts can coexist", () => {
    useToastStore.getState().show("info", "Hello")
    useToastStore.getState().show("warning", "Watch out")
    expect(useToastStore.getState().toasts).toHaveLength(2)
  })
})
```

---

### Ticket 13.5 — authService Tests

**Goal**: Test login, logout, and getUserRole against mocked Firebase SDK — no real network calls.

File: `src/features/auth/services/__tests__/authService.test.ts`

```ts
import { describe, it, expect, vi } from "vitest"
import { signInWithEmailAndPassword, signOut } from "firebase/auth"
import { getDoc, doc } from "firebase/firestore"
import { login, logout, getUserRole } from "../authService"

// Firebase modules are already mocked globally in setup.ts

describe("login()", () => {
  it("calls signInWithEmailAndPassword with correct args", async () => {
    vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({} as any)
    await login("user@example.com", "password123")
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      "user@example.com",
      "password123"
    )
  })

  it("propagates Firebase errors to the caller", async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(
      new Error("auth/user-not-found")
    )
    await expect(login("bad@example.com", "pass")).rejects.toThrow("auth/user-not-found")
  })
})

describe("logout()", () => {
  it("calls signOut", async () => {
    vi.mocked(signOut).mockResolvedValueOnce(undefined)
    await logout()
    expect(signOut).toHaveBeenCalledOnce()
  })
})

describe("getUserRole()", () => {
  it("returns the role from the user document", async () => {
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ role: "operator" }),
    } as any)
    const role = await getUserRole("user_001")
    expect(role).toBe("operator")
  })

  it("returns null when user document does not exist", async () => {
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => null,
    } as any)
    const role = await getUserRole("unknown_uid")
    expect(role).toBeNull()
  })

  it("returns null when Firestore throws", async () => {
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(getDoc).mockRejectedValueOnce(new Error("permission-denied"))
    const role = await getUserRole("user_001")
    expect(role).toBeNull()
  })
})
```

---

### Ticket 13.6 — operationService Tests

**Goal**: Test Firestore read/write operations against mocked SDK. Verify data mapping and error paths.

File: `src/features/operations/services/__tests__/operationService.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { getDocs, getDoc, addDoc, doc } from "firebase/firestore"
import {
  fetchOperationsPaginated,
  fetchOperationsByOperator,
  fetchOperation,
  syncOperationToFirestore,
} from "../operationService"
import { makeOperation } from "@/test/factories"

// Helper: build a fake Firestore QuerySnapshot
function makeQuerySnapshot(docs: object[]) {
  return {
    docs: docs.map((data) => ({
      id: "firestore_id_001",
      data: () => data,
    })),
  }
}

describe("fetchOperationsPaginated()", () => {
  it("returns mapped operations from Firestore", async () => {
    vi.mocked(getDocs).mockResolvedValueOnce(
      makeQuerySnapshot([makeOperation()]) as any
    )
    const { operations } = await fetchOperationsPaginated()
    expect(operations).toHaveLength(1)
    expect(operations[0].orderNumber).toBe("ORD001")
  })

  it("returns empty array when no documents found", async () => {
    vi.mocked(getDocs).mockResolvedValueOnce(makeQuerySnapshot([]) as any)
    const { operations } = await fetchOperationsPaginated()
    expect(operations).toHaveLength(0)
  })
})

describe("fetchOperationsByOperator()", () => {
  it("returns operations filtered by operatorId", async () => {
    vi.mocked(getDocs).mockResolvedValueOnce(
      makeQuerySnapshot([makeOperation({ operatorId: "user_001" })]) as any
    )
    const ops = await fetchOperationsByOperator("user_001")
    expect(ops[0].operatorId).toBe("user_001")
  })
})

describe("fetchOperation()", () => {
  it("returns a single operation by id", async () => {
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: "op_001",
      data: () => makeOperation({ id: "op_001" }),
    } as any)
    const op = await fetchOperation("op_001")
    expect(op?.id).toBe("op_001")
  })

  it("returns null when document does not exist", async () => {
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as any)
    const op = await fetchOperation("missing")
    expect(op).toBeNull()
  })
})

describe("syncOperationToFirestore()", () => {
  it("calls addDoc and returns the new document id", async () => {
    vi.mocked(addDoc).mockResolvedValueOnce({ id: "new_firestore_id" } as any)
    const id = await syncOperationToFirestore(makeOperation({ photos: {} }))
    expect(id).toBe("new_firestore_id")
    expect(addDoc).toHaveBeenCalledOnce()
  })
})
```

---

### Ticket 13.7 — syncEngine Tests

**Goal**: Test the retry logic, success path, and error path of `runSyncEngine` against mocked IndexedDB helpers and Firestore.

File: `src/services/offline/__tests__/syncEngine.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { runSyncEngine, supportsBackgroundSync } from "../syncEngine"
import * as db from "../db"
import * as operationService from "@/features/operations/services/operationService"
import { makeOperation } from "@/test/factories"

vi.mock("../db")
vi.mock("@/features/operations/services/operationService")

describe("runSyncEngine()", () => {
  beforeEach(() => {
    vi.mocked(db.getPendingOperations).mockResolvedValue([])
    vi.mocked(db.getPhotosForOperation).mockResolvedValue([])
    vi.mocked(db.markOperationSynced).mockResolvedValue(undefined)
    vi.mocked(db.markOperationError).mockResolvedValue(undefined)
    vi.mocked(db.saveOperationLocally).mockResolvedValue(undefined)
    vi.mocked(operationService.checkOperationExists).mockResolvedValue(false)
    vi.mocked(operationService.syncOperationToFirestore).mockResolvedValue("firestore_id")
    vi.mocked(operationService.uploadPhotoToStorage).mockResolvedValue("https://storage.example/photo.jpg")
  })

  it("returns empty array when no pending operations", async () => {
    const results = await runSyncEngine()
    expect(results).toHaveLength(0)
  })

  it("syncs a pending operation successfully", async () => {
    vi.mocked(db.getPendingOperations).mockResolvedValueOnce([makeOperation()])
    const results = await runSyncEngine()
    expect(results).toHaveLength(1)
    expect(results[0].success).toBe(true)
    expect(db.markOperationSynced).toHaveBeenCalledOnce()
  })

  it("skips upload if operation already exists in Firestore", async () => {
    vi.mocked(db.getPendingOperations).mockResolvedValueOnce([makeOperation()])
    vi.mocked(operationService.checkOperationExists).mockResolvedValueOnce(true)
    const results = await runSyncEngine()
    expect(results[0].success).toBe(true)
    expect(operationService.syncOperationToFirestore).not.toHaveBeenCalled()
  })

  it("marks operation as error after max retries", async () => {
    vi.useFakeTimers()
    vi.mocked(db.getPendingOperations).mockResolvedValueOnce([makeOperation()])
    vi.mocked(operationService.syncOperationToFirestore).mockRejectedValue(
      new Error("Firestore unavailable")
    )

    const resultPromise = runSyncEngine()
    // Advance past all retry delays (3 retries × 2s each)
    await vi.runAllTimersAsync()
    const results = await resultPromise

    expect(results[0].success).toBe(false)
    expect(db.markOperationError).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it("syncs photos and includes URLs in Firestore doc", async () => {
    const fakePhoto = { photoType: "front_exterior" as const, blob: new Blob(["img"]), id: "p1", operationId: "op_test_001" }
    vi.mocked(db.getPendingOperations).mockResolvedValueOnce([makeOperation()])
    vi.mocked(db.getPhotosForOperation).mockResolvedValueOnce([fakePhoto])
    await runSyncEngine()
    expect(operationService.uploadPhotoToStorage).toHaveBeenCalledOnce()
    expect(operationService.syncOperationToFirestore).toHaveBeenCalledWith(
      expect.objectContaining({ photos: { front_exterior: "https://storage.example/photo.jpg" } })
    )
  })
})

describe("supportsBackgroundSync()", () => {
  it("returns false when SyncManager is not available", () => {
    expect(supportsBackgroundSync()).toBe(false)
  })
})
```

---

### Ticket 13.8 — UI Component Tests

**Goal**: Render-test shared UI components. Verify correct output for each variant — no user interactions that require live data.

File: `src/shared/components/ui/__tests__/StatusBadge.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import { StatusBadge } from "../StatusBadge"

describe("StatusBadge", () => {
  it('renders "Synced" label for synced status', () => {
    render(<StatusBadge status="synced" />)
    expect(screen.getByText("Synced")).toBeInTheDocument()
  })

  it('renders "Pending" label for pending_sync status', () => {
    render(<StatusBadge status="pending_sync" />)
    expect(screen.getByText("Pending")).toBeInTheDocument()
  })

  it('renders "Error" label for error status', () => {
    render(<StatusBadge status="error" />)
    expect(screen.getByText("Error")).toBeInTheDocument()
  })
})
```

File: `src/shared/components/ui/__tests__/EmptyState.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EmptyState } from "../EmptyState"

describe("EmptyState", () => {
  it("renders icon, title, and description", () => {
    render(<EmptyState icon="📋" title="Nothing here" description="Add something to start." />)
    expect(screen.getByText("Nothing here")).toBeInTheDocument()
    expect(screen.getByText("Add something to start.")).toBeInTheDocument()
  })

  it("renders optional action and fires callback on click", async () => {
    const onClear = vi.fn()
    render(
      <EmptyState
        icon="🔍"
        title="No results"
        action={<button onClick={onClear}>Clear</button>}
      />
    )
    await userEvent.click(screen.getByText("Clear"))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it("renders nothing for description if omitted", () => {
    render(<EmptyState icon="📋" title="Empty" />)
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument()
  })
})
```

File: `src/shared/components/ui/__tests__/Toast.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { Toast } from "../Toast"

const baseToast = { id: "t1", type: "success" as const, message: "Saved successfully!" }

describe("Toast", () => {
  it("renders the message", () => {
    render(<Toast toast={baseToast} onDismiss={vi.fn()} />)
    expect(screen.getByText("Saved successfully!")).toBeInTheDocument()
  })

  it("calls onDismiss when X button is clicked", async () => {
    const dismiss = vi.fn()
    render(<Toast toast={baseToast} onDismiss={dismiss} />)
    await userEvent.click(screen.getByLabelText("Dismiss"))
    expect(dismiss).toHaveBeenCalledWith("t1")
  })

  it("auto-dismisses after the given duration", async () => {
    vi.useFakeTimers()
    const dismiss = vi.fn()
    render(<Toast toast={{ ...baseToast, duration: 1000 }} onDismiss={dismiss} />)
    vi.advanceTimersByTime(1001)
    expect(dismiss).toHaveBeenCalledWith("t1")
    vi.useRealTimers()
  })
})
```

File: `src/shared/components/ui/__tests__/Skeleton.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import { SkeletonList, SkeletonRow } from "../Skeleton"

describe("Skeleton", () => {
  it("SkeletonRow renders two skeleton divs", () => {
    const { container } = render(<SkeletonRow />)
    expect(container.querySelectorAll(".skeleton")).toHaveLength(3)
  })

  it("SkeletonList renders the requested count", () => {
    const { container } = render(<SkeletonList count={5} />)
    // 5 rows × 3 skeleton divs each
    expect(container.querySelectorAll(".skeleton")).toHaveLength(15)
  })
})
```

---

### Ticket 13.9 — Page Component Tests

**Goal**: Test key page-level behaviors with mocked hooks and services. Focus on: loading states, empty states, error states, and form submission flows.

File: `src/pages/__tests__/LoginPage.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { LoginPage } from "../LoginPage"
import * as authService from "@/features/auth/services/authService"

vi.mock("@/features/auth/services/authService")

function renderLoginPage() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>)
}

describe("LoginPage", () => {
  it("renders email and password fields", () => {
    renderLoginPage()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it("shows validation error for invalid email", async () => {
    renderLoginPage()
    await userEvent.type(screen.getByLabelText(/email/i), "bad-email")
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }))
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument()
  })

  it("calls login() with correct credentials on valid submit", async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(undefined)
    renderLoginPage()
    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com")
    await userEvent.type(screen.getByLabelText(/password/i), "secret123")
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }))
    expect(authService.login).toHaveBeenCalledWith("user@example.com", "secret123")
  })

  it("shows error message when login fails", async () => {
    vi.mocked(authService.login).mockRejectedValueOnce({ code: "auth/wrong-password" })
    renderLoginPage()
    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com")
    await userEvent.type(screen.getByLabelText(/password/i), "wrongpass")
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }))
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()
  })
})
```

File: `src/pages/__tests__/OperationFormPage.test.tsx`

```tsx
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { OperationFormPage } from "../OperationFormPage"
import * as operationsHook from "@/features/operations/hooks"
import { useAuthStore } from "@/features/auth/store/authStore"
import { makeUser } from "@/test/factories"

vi.mock("@/features/operations/hooks")
vi.mock("@/features/camera", () => ({
  CameraCapture: ({ onCapture }: { onCapture: (b: Blob, t: string) => void }) => (
    <button onClick={() => onCapture(new Blob(["photo"]), "front_exterior")}>
      Mock Capture
    </button>
  ),
}))

function renderFormPage(type = "load") {
  useAuthStore.setState({ user: makeUser(), isLoading: false })
  const saveMock = vi.fn().mockResolvedValue(undefined)
  vi.mocked(operationsHook.useOperations).mockReturnValue({
    saveOperationOffline: saveMock,
    operations: [],
    isLoading: false,
    error: null,
    pendingSyncCount: 0,
    loadLocalOperations: vi.fn(),
    loadServerOperations: vi.fn(),
    syncPendingOperations: vi.fn(),
    refreshPendingCount: vi.fn(),
  })
  render(
    <MemoryRouter initialEntries={[`/operation/new?type=${type}`]}>
      <Routes>
        <Route path="/operation/new" element={<OperationFormPage />} />
        <Route path="/operator" element={<div>Operator Home</div>} />
      </Routes>
    </MemoryRouter>
  )
  return { saveMock }
}

describe("OperationFormPage", () => {
  it("shows validation error when order number is too short", async () => {
    renderFormPage()
    await userEvent.type(screen.getByLabelText(/order number/i), "AB")
    await userEvent.tab()
    expect(await screen.findByText(/at least 3/i)).toBeInTheDocument()
  })

  it("disables submit button until all fields and photos are valid", () => {
    renderFormPage()
    expect(screen.getByRole("button", { name: /save operation/i })).toBeDisabled()
  })

  it("calls saveOperationOffline on valid submit", async () => {
    const { saveMock } = renderFormPage()
    await userEvent.type(screen.getByLabelText(/order number/i), "ORD001")
    await userEvent.type(screen.getByLabelText(/door number/i), "D01")
    // Capture all required photos
    for (const btn of screen.getAllByText("Mock Capture")) {
      await userEvent.click(btn)
    }
    await userEvent.click(screen.getByRole("button", { name: /save operation/i }))
    await waitFor(() => expect(saveMock).toHaveBeenCalledOnce())
  })
})
```

File: `src/pages/__tests__/OperatorPage.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import { vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { OperatorPage } from "../OperatorPage"
import * as offlineDb from "@/services/offline"
import * as onlineStatusHook from "@/shared/hooks"
import { makeOperation } from "@/test/factories"

vi.mock("@/services/offline")
vi.mock("@/shared/hooks")
vi.mock("@/shared/store/toastStore", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

function renderPage() {
  vi.mocked(onlineStatusHook.useOnlineStatus).mockReturnValue({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    sync: vi.fn(),
    lastSyncAt: null,
    lastSyncResults: [],
    backgroundSyncSupported: false,
    refreshPendingCount: vi.fn(),
  })
  return render(<MemoryRouter><OperatorPage /></MemoryRouter>)
}

describe("OperatorPage", () => {
  it("shows skeleton while loading operations", async () => {
    // getLocalOperations never resolves during this test
    vi.mocked(offlineDb.getLocalOperations).mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(document.querySelectorAll(".skeleton").length).toBeGreaterThan(0)
  })

  it("shows empty state when no operations exist", async () => {
    vi.mocked(offlineDb.getLocalOperations).mockResolvedValueOnce([])
    renderPage()
    expect(await screen.findByText(/no operations yet/i)).toBeInTheDocument()
  })

  it("shows recent operations when data loads", async () => {
    vi.mocked(offlineDb.getLocalOperations).mockResolvedValueOnce([
      makeOperation({ orderNumber: "ORD999" }),
    ])
    renderPage()
    expect(await screen.findByText("ORD999")).toBeInTheDocument()
  })

  it("shows pending sync count when pendingCount > 0", async () => {
    vi.mocked(offlineDb.getLocalOperations).mockResolvedValueOnce([])
    vi.mocked(onlineStatusHook.useOnlineStatus).mockReturnValueOnce({
      isOnline: true,
      isSyncing: false,
      pendingCount: 3,
      sync: vi.fn(),
      lastSyncAt: null,
      lastSyncResults: [],
      backgroundSyncSupported: false,
      refreshPendingCount: vi.fn(),
    })
    renderPage()
    expect(await screen.findByText(/3 pending/i)).toBeInTheDocument()
  })
})
```

---

### Ticket 13.10 — ProtectedRoute Tests

**Goal**: Verify that `ProtectedRoute` correctly redirects unauthenticated users and users with the wrong role.

File: `src/shared/components/layout/__tests__/ProtectedRoute.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { ProtectedRoute } from "../ProtectedRoute"
import { useAuthStore } from "@/features/auth/store/authStore"
import { makeUser, makeAdminUser } from "@/test/factories"

function renderRoute(allowedRoles: string[], userOverride = null) {
  useAuthStore.setState({ user: userOverride, isLoading: false })
  render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={allowedRoles as any} />}>
          <Route path="/protected" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe("ProtectedRoute", () => {
  it("redirects to /login when no user is authenticated", () => {
    renderRoute(["operator"])
    expect(screen.getByText("Login Page")).toBeInTheDocument()
  })

  it("renders children when user role is allowed", () => {
    renderRoute(["operator"], makeUser() as any)
    expect(screen.getByText("Protected Content")).toBeInTheDocument()
  })

  it("redirects to /unauthorized when role does not match", () => {
    renderRoute(["admin"], makeUser() as any)  // operator trying to access admin
    expect(screen.getByText("Unauthorized Page")).toBeInTheDocument()
  })

  it("allows admin to access admin-only routes", () => {
    renderRoute(["admin"], makeAdminUser() as any)
    expect(screen.getByText("Protected Content")).toBeInTheDocument()
  })
})
```

---

### Module 13 — Acceptance Criteria

- [ ] `npm test` runs all tests with `vitest` — no live API calls made
- [ ] `npm run test:coverage` reports ≥ 70% coverage across `src/`
- [ ] All Zod schema valid/invalid cases covered (13.2)
- [ ] All utility functions covered with deterministic timestamps (13.3)
- [ ] All Zustand store mutations covered (13.4)
- [ ] `authService` mocked at Firebase SDK level — no real auth calls (13.5)
- [ ] `operationService` mocked at Firestore level — no real DB calls (13.6)
- [ ] `syncEngine` retry logic tested with fake timers (13.7)
- [ ] UI component rendering and key interactions verified (13.8)
- [ ] Page-level loading, empty, and error states tested (13.9)
- [ ] Route guard redirects verified for all role/auth combinations (13.10)
- [ ] CI script: `npm run test:run` exits non-zero on failure

---

## Module 14 — Admin User Management

> **Context**: Currently, creating operator accounts requires direct Firebase Console access. This module adds an in-app flow where admins can register new operator accounts, view all users, and change roles — without ever touching Firebase Console.

### Architecture Decision: Secondary Firebase App

Creating a new Firebase Auth user with `createUserWithEmailAndPassword` signs in that user immediately, which would log the admin out. The standard client-side solution is to initialize a **secondary Firebase app instance** for the create-user call only. The secondary app signs out immediately after account creation, leaving the admin session untouched.

```
Admin session ──► firebaseApp (primary)     ← admin stays logged in here
New user creation ─► secondaryApp (isolated) ← sign in/out here only
```

---

### Ticket 14.1 — Admin Service

**Goal**: All user management logic lives in a single service. No Firestore or Auth calls outside this file.

File: `src/features/admin/services/adminService.ts`
```ts
import { initializeApp, getApps } from "firebase/app"
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth"
import {
  doc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore"
import { firebaseConfig } from "@/services/firebase/firebaseConfig"
import { db } from "@/services/firebase"
import type { UserRole } from "@/types/UserRole"

// ── Secondary app — isolated from the admin's active session ────────────────
const SECONDARY_APP_NAME = "cargo-control-secondary"
const secondaryApp = getApps().find((a) => a.name === SECONDARY_APP_NAME)
  ?? initializeApp(firebaseConfig, SECONDARY_APP_NAME)
const secondaryAuth = getAuth(secondaryApp)

export interface AppUser {
  uid: string
  email: string
  role: UserRole | null
  createdAt: number
}

/**
 * Creates a new Firebase Auth account and writes the user document to Firestore.
 * Uses a secondary app instance so the admin's session is not interrupted.
 */
export async function createOperatorAccount(
  email: string,
  password: string,
  role: UserRole = "operator"
): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, password)
  // Sign out from secondary app immediately — we don't need this session
  await firebaseSignOut(secondaryAuth)
  await setDoc(doc(db, "users", user.uid), {
    email: user.email,
    role,
    createdAt: Date.now(),
  })
}

/**
 * Fetches all user documents from Firestore (admin-only in security rules).
 */
export async function fetchAllUsers(): Promise<AppUser[]> {
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({
    uid: d.id,
    ...(d.data() as Omit<AppUser, "uid">),
  }))
}

/**
 * Updates the role field on an existing user document.
 */
export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(doc(db, "users", uid), { role })
}
```

---

### Ticket 14.2 — Create User Schema

File: `src/features/admin/schemas/createUserSchema.ts`
```ts
import { z } from "zod"

export const createUserSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
  confirmPassword: z.string(),
  role: z.enum(["operator", "admin"], {
    required_error: "Role is required",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

export type CreateUserFormValues = z.infer<typeof createUserSchema>
```

---

### Ticket 14.3 — Create User Modal Component

File: `src/features/admin/components/CreateUserModal.tsx`
```tsx
import { useState } from "react"
import { FiX } from "react-icons/fi"
import { createUserSchema } from "../schemas/createUserSchema"
import { createOperatorAccount } from "../services/adminService"
import { useToast } from "@/shared/store/toastStore"

interface CreateUserModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function CreateUserModal({ onClose, onSuccess }: CreateUserModalProps) {
  const toast = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fields, setFields] = useState({ email: "", password: "", confirmPassword: "", role: "operator" as "operator" | "admin" })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof fields, string>>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const result = createUserSchema.safeParse(fields)
    if (!result.success) {
      const fieldErrors: typeof errors = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof typeof errors
        if (key) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setIsSubmitting(true)
    try {
      await createOperatorAccount(result.data.email, result.data.password, result.data.role)
      toast.success(`Account created for ${result.data.email}`)
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create account"
      if (msg.includes("email-already-in-use")) {
        setErrors({ email: "An account with this email already exists" })
      } else {
        toast.error(msg)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-card-elevated">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">New User Account</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-tertiary" aria-label="Close">
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={fields.email}
              onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))}
              className={`input ${errors.email ? "input-error" : ""}`}
              placeholder="operator@company.com"
              autoComplete="off"
            />
            {errors.email && <p className="mt-1 text-sm text-error">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={fields.password}
              onChange={(e) => setFields((f) => ({ ...f, password: e.target.value }))}
              className={`input ${errors.password ? "input-error" : ""}`}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              autoComplete="new-password"
            />
            {errors.password && <p className="mt-1 text-sm text-error">{errors.password}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={fields.confirmPassword}
              onChange={(e) => setFields((f) => ({ ...f, confirmPassword: e.target.value }))}
              className={`input ${errors.confirmPassword ? "input-error" : ""}`}
              autoComplete="new-password"
            />
            {errors.confirmPassword && <p className="mt-1 text-sm text-error">{errors.confirmPassword}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={fields.role}
              onChange={(e) => setFields((f) => ({ ...f, role: e.target.value as "operator" | "admin" }))}
              className="input"
            >
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1">
              {isSubmitting ? "Creating…" : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

---

### Ticket 14.4 — Admin Users Page

File: `src/pages/AdminUsersPage.tsx`
```tsx
import { useState, useEffect, useCallback } from "react"
import { FiPlus, FiUser, FiShield } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import { CreateUserModal } from "@/features/admin/components/CreateUserModal"
import { fetchAllUsers, updateUserRole, type AppUser } from "@/features/admin/services/adminService"
import { useToast } from "@/shared/store/toastStore"
import { ADMIN_NAV } from "@/shared/constants/navItems"

export function AdminUsersPage() {
  const toast = useToast()
  const [users, setUsers] = useState<AppUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const list = await fetchAllUsers()
      setUsers(list)
    } catch {
      toast.error("Failed to load users")
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleRoleChange = async (uid: string, newRole: "operator" | "admin") => {
    try {
      await updateUserRole(uid, newRole)
      setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, role: newRole } : u))
      toast.success("Role updated")
    } catch {
      toast.error("Failed to update role")
    }
  }

  return (
    <AppShell
      title="Users"
      navItems={ADMIN_NAV}
      headerRight={
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary text-sm">
          <FiPlus className="w-4 h-4" />
          New User
        </button>
      }
    >
      {isLoading ? (
        <SkeletonList count={5} />
      ) : users.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No users yet"
          description="Create the first operator account."
          action={
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <FiPlus className="w-4 h-4" /> New User
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.uid} className="card flex items-center gap-4">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                {user.role === "admin"
                  ? <FiShield className="w-5 h-5 text-primary" />
                  : <FiUser className="w-5 h-5 text-primary" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{user.email}</p>
              </div>
              <select
                value={user.role ?? "operator"}
                onChange={(e) => handleRoleChange(user.uid, e.target.value as "operator" | "admin")}
                className="input w-auto text-sm py-1.5"
              >
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); loadUsers() }}
        />
      )}
    </AppShell>
  )
}
```

---

### Ticket 14.5 — Update Admin Nav + Router

**Goal**: Add "Users" tab to admin bottom nav and wire the new page to the router.

Update `src/shared/constants/navItems.tsx`:
```tsx
import { FiHome, FiList, FiUser, FiUsers } from "react-icons/fi"

export const ADMIN_NAV = [
  { to: "/admin",       label: "Dashboard", icon: <FiHome className="w-5 h-5" /> },
  { to: "/admin/users", label: "Users",     icon: <FiUsers className="w-5 h-5" /> },
  { to: "/account",     label: "Account",   icon: <FiUser className="w-5 h-5" /> },
]
```

Update `src/app/router.tsx` — add inside the admin-only route group:
```tsx
import { AdminUsersPage } from "@/pages/AdminUsersPage"

// Inside admin-only ProtectedRoute children:
{
  path: "/admin/users",
  element: <AdminUsersPage />,
},
```

---

### Ticket 14.6 — Firestore Security Rules Update

**Goal**: Allow admins to read the full users collection (for the user list) while keeping operators blocked.

Update `firestore.rules`:
```
match /users/{userId} {
  // Operators can read their own document; admins can read all
  allow read: if isOwnDoc(userId) || isAdmin();
  // Only admins can list the collection (query)
  allow list: if isAdmin();
  // User documents are created server-side (via secondary Firebase app with client SDK)
  // setDoc() call uses the admin's Firebase session — allowed here
  allow create: if isAdmin();
  // Role updates are admin-only; operators cannot change their own role
  allow update: if isAdmin() ||
    (isOwnDoc(userId) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(["role"]));
  allow delete: if false;
}
```

---

### Ticket 14.7 — Unit Tests for Admin Feature

File: `src/features/admin/services/__tests__/adminService.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth"
import { setDoc, getDocs, updateDoc, doc, collection, query, orderBy } from "firebase/firestore"
import { createOperatorAccount, fetchAllUsers, updateUserRole } from "../adminService"

function makeUserSnap(data: object) {
  return {
    docs: [{ id: "uid_001", data: () => data }],
  }
}

describe("createOperatorAccount()", () => {
  it("creates auth user and writes Firestore doc", async () => {
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({
      user: { uid: "new_uid", email: "op@example.com" },
    } as any)
    vi.mocked(signOut).mockResolvedValueOnce(undefined)
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(setDoc).mockResolvedValueOnce(undefined)

    await createOperatorAccount("op@example.com", "Password1")

    expect(createUserWithEmailAndPassword).toHaveBeenCalledOnce()
    expect(signOut).toHaveBeenCalledOnce()  // must sign out of secondary app
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: "op@example.com", role: "operator" })
    )
  })

  it("propagates Firebase errors to the caller", async () => {
    vi.mocked(createUserWithEmailAndPassword).mockRejectedValueOnce(
      new Error("auth/email-already-in-use")
    )
    await expect(createOperatorAccount("dup@example.com", "Password1")).rejects.toThrow(
      "auth/email-already-in-use"
    )
    expect(setDoc).not.toHaveBeenCalled()
  })
})

describe("fetchAllUsers()", () => {
  it("returns mapped user list from Firestore", async () => {
    vi.mocked(collection).mockReturnValueOnce({} as any)
    vi.mocked(query).mockReturnValueOnce({} as any)
    vi.mocked(orderBy).mockReturnValueOnce({} as any)
    vi.mocked(getDocs).mockResolvedValueOnce(
      makeUserSnap({ email: "op@example.com", role: "operator", createdAt: 0 }) as any
    )
    const users = await fetchAllUsers()
    expect(users).toHaveLength(1)
    expect(users[0].uid).toBe("uid_001")
    expect(users[0].role).toBe("operator")
  })
})

describe("updateUserRole()", () => {
  it("calls updateDoc with the new role", async () => {
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(updateDoc).mockResolvedValueOnce(undefined)
    await updateUserRole("uid_001", "admin")
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { role: "admin" })
  })
})
```

File: `src/features/admin/schemas/__tests__/createUserSchema.test.ts`

```ts
import { describe, it, expect } from "vitest"
import { createUserSchema } from "../createUserSchema"

describe("createUserSchema", () => {
  const valid = { email: "op@example.com", password: "Password1", confirmPassword: "Password1", role: "operator" }

  it("accepts valid operator registration", () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true)
  })

  it("accepts admin role", () => {
    expect(createUserSchema.safeParse({ ...valid, role: "admin" }).success).toBe(true)
  })

  it("rejects password shorter than 8 characters", () => {
    const r = createUserSchema.safeParse({ ...valid, password: "Abc1", confirmPassword: "Abc1" })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toMatch(/8 characters/)
  })

  it("rejects password without uppercase letter", () => {
    const r = createUserSchema.safeParse({ ...valid, password: "password1", confirmPassword: "password1" })
    expect(r.success).toBe(false)
    expect(r.error?.issues.some((i) => i.message.includes("uppercase"))).toBe(true)
  })

  it("rejects password without a number", () => {
    const r = createUserSchema.safeParse({ ...valid, password: "Password", confirmPassword: "Password" })
    expect(r.success).toBe(false)
    expect(r.error?.issues.some((i) => i.message.includes("number"))).toBe(true)
  })

  it("rejects when passwords do not match", () => {
    const r = createUserSchema.safeParse({ ...valid, confirmPassword: "WrongPass1" })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toMatch(/do not match/)
  })

  it("rejects invalid role", () => {
    const r = createUserSchema.safeParse({ ...valid, role: "superuser" })
    expect(r.success).toBe(false)
  })
})
```

---

### Module 14 — Acceptance Criteria

- [ ] Admin can open "New User" modal from the Users page header button
- [ ] Form validates email format, password strength, password match, and role before submitting
- [ ] Successful creation shows toast and refreshes the user list
- [ ] Duplicate email shows an inline field error, not a toast
- [ ] Admin's current session is **not** disrupted after creating a new user
- [ ] Role dropdown updates immediately in the list after a role change
- [ ] Firestore rules allow admins to create/list/update user docs; block operators from listing
- [ ] Unit tests for `adminService`, `createUserSchema`, and `CreateUserModal` all pass

---

## Conventions Summary

> ⚠️ See `CONVENTIONS.md` for full agent guidelines.

Key rules:
- All features are self-contained under `src/features/<name>/`
- No feature imports from another feature directly — use `shared/` or `services/`
- All Firestore/Storage calls live in `services/` only
- All forms validate with Zod before any async call
- All offline writes go through `src/services/offline/db.ts`
- Sync logic only lives in `src/services/offline/syncEngine.ts`

---

## 2026 Stack Alignment Summary

| Concern | 2026 Best Practice | Your Plan |
|---------|-------------------|-----------|
| React Version | React 19 (React Compiler) | React 18+ ✓ |
| Framework | Vite | Vite ✓ |
| State Management | Zustand (simple) or TanStack Query (server state) | Zustand ✓ |
| Offline Storage | IndexedDB via `idb` or Dexie.js | `idb` ✓ |
| Service Worker | Workbox | Workbox via vite-plugin-pwa ✓ |
| Caching Strategies | Per-content-type (AppShell=CacheFirst, API=NetworkFirst, Images=SWR) | ✓ |
| Auth Persistence | `browserLocalPersistence` | ✓ (added) |
| Error Handling | Typed errors with user-friendly messages | ✓ (added) |
| Background Sync | Background Sync API + fallback | ✓ (added) |
| Offline UX | Sync status indicators, clear feedback | ✓ (added) |
| PWA Install | Contextual prompt after engagement | ✓ (added) |
| Native Builds | Capacitor for Android/iOS | ✓ (added) |
| Firestore Rules | Validation + field-level control | ✓ (updated) |
| Security | CSP headers, no sensitive data in cache | ✓ (added) |
| Conflict Resolution | Last-write-wins with `localId` tracking | ✓ |

---

## Additional Considerations (Not in Initial Scope)

These can be added in future iterations:

### Future: Real-time updates
Add Firestore `onSnapshot` listeners for admins to see operations appear in real-time without refresh.

### Future: Push notifications
Use Firebase Cloud Messaging to notify admins when new operations are synced, or alert operators of sync failures.

### Future: Photo compression options
Allow adjusting JPEG quality based on network conditions (lower quality on 3G, higher on WiFi).

### Future: Export functionality
Admin ability to export filtered operations to CSV/Excel for reporting.

### Future: Operation details modal
Click on a row in admin table to see full operation details including photos.

### Future: Undo/rollback for failed syncs
Allow operators to retry failed syncs manually from a "pending" queue view.

---

## Module 15 — Admin Operations View, Client Management & Enhanced Photo Flow

> **Context**: This module covers the new features requested after initial delivery. Each ticket is self-contained and can be worked independently.

---

### Ticket 15.1 — Admin: Paginated operations list with filters

**Goal**: Replace the current full-load admin table with a paginated list (newest first, 20 per page). Add filter bar for date range, operator, client, and operation type.

**Files to create/modify**:
- `src/features/admin/hooks/useAdminOperations.ts` — paginated Firestore query using `startAfter` cursor, filter params
- `src/pages/AdminPage.tsx` — wire pagination controls (Load More or page buttons), filter bar state
- `src/features/admin/components/FiltersBar.tsx` — date range pickers, operator dropdown, client dropdown, op type select
- `src/features/operations/services/operationService.ts` — add `fetchOperationsFiltered(filters, pageParam)` query

**Rules**: No changes needed — admin already has `list` access.

**Notes**:
- Firestore compound queries require composite indexes — add them to `firestore.indexes.json` as needed
- Filters should be URL-searchParam driven so the admin can share/bookmark a filtered view

---

### Ticket 15.2 — Admin: Operation detail page with photos and timestamps

**Goal**: Clicking an operation in the admin list opens a detail page showing all operation fields, each photo displayed full-width with its capture timestamp below it, and the operator name.

**Files to create/modify**:
- `src/pages/AdminOperationDetailPage.tsx` — new page, route `/admin/operations/:id`
- `src/features/operations/services/operationService.ts` — add `fetchOperation(id)` if not already complete
- `src/app/Router.tsx` — add new route

**Data needed**:
- Photo download URLs are already stored in the Firestore `photos` map (keyed by PhotoType)
- Timestamp is embedded in the filename: `{photoType}_{timestamp}.jpg` — parse it client-side from the Storage path or store it explicitly alongside the URL in the `photos` map

**Recommendation**: Store `{ url, capturedAt }` per photo instead of just the URL string. Update `uploadPhotoToStorage` to return both and update `Operation.photos` type accordingly.

**Type change** (`src/types/Operation.ts`):
```ts
// Before
photos: Partial<Record<PhotoType, string>>

// After
photos: Partial<Record<PhotoType, { url: string; capturedAt: number }>>
```

---

### Ticket 15.3 — Admin: Change operation status

**Goal**: Admin can change an operation's status (e.g. mark as "completed", "reviewed") directly from the detail page via a select/dropdown.

**Files to create/modify**:
- `src/types/Operation.ts` — extend `OperationStatus` to include `"completed"` and `"reviewed"`
- `src/features/operations/services/operationService.ts` — add `updateOperationStatus(id, status)`
- `src/pages/AdminOperationDetailPage.tsx` — add status select UI with confirm action
- `src/shared/components/ui/StatusBadge.tsx` — add styles for new statuses

**Firestore rule**: Already allows admin `update` on operations — no rule change needed.

---

### Ticket 15.4 — User creation: capture name field

**Goal**: When admin creates a new user, capture a `name` field in addition to email/password/role. Display operator name (not email) in the admin operations list.

**Files to modify**:
- `src/features/admin/services/adminService.ts` — add `name` param to `createOperatorAccount`, write to Firestore user doc
- `src/features/admin/components/CreateUserModal.tsx` (or equivalent) — add name input field
- `src/types` — update `AppUser` interface to include `name: string`
- `src/features/operations/services/operationService.ts` — write `operatorName` from user doc at sync time (already saved in operation; ensure it uses display name not email)
- `src/pages/AdminPage.tsx` — show `operatorName` column instead of `operatorId`

---

### Ticket 15.5 — Incident photos (optional extra photo field)

**Goal**: Add an optional "Incident" photo section at the bottom of the operation form. Operator can attach 1 or more photos if there is a problem (broken pallet, damaged goods, etc.). These are optional — form can be submitted without them.

**Files to modify**:
- `src/types/PhotoType.ts` — add `incident_1`, `incident_2`, `incident_3` (or a dynamic list) to PhotoType
- `src/pages/OperationFormPage.tsx` — add collapsible "Report an incident" section below required photos; allow adding up to 3 optional photos
- `src/services/offline/db.ts` — no change needed, photos are stored generically by PhotoType
- `src/pages/AdminOperationDetailPage.tsx` — show incident photos in a separate "Incidents" section with a warning color if present

---

### Ticket 15.6 — Download all operation photos as ZIP

**Goal**: On the admin operation detail page, a "Download ZIP" button fetches all photo URLs for that operation, packages them as a ZIP file client-side, and triggers a browser download. Admin can then share the ZIP via email or WhatsApp.

**Implementation**: Use the `jszip` library — no backend needed.

```bash
npm install jszip
```

**Files to create/modify**:
- `src/features/admin/utils/downloadOperationZip.ts` — new utility: fetch each photo URL via `fetch()`, add to JSZip instance, trigger download as `{orderNumber}_{date}.zip`
- `src/pages/AdminOperationDetailPage.tsx` — add "Download ZIP" button, show loading state while fetching

**Notes**:
- Firebase Storage download URLs are public-readable by admins (storage rules allow admin read) — `fetch()` will work
- Name each file in the zip as `{photoType}.jpg` for clarity
- Incident photos should be included in a subfolder `/incidents/`

---

### Ticket 15.7 — Client management (admin) + client selector (operator)

**Goal**: Admin can create and manage a list of client names. Operators see a "Client" dropdown when logging an operation and must select one before submitting.

**Sub-tasks**:

**15.7a — Firestore clients collection**
- Collection: `clients` with docs `{ name: string, createdAt: number, createdBy: uid }`
- Firestore rules: admin can create/read/update, operators can only read (to populate dropdown)

**15.7b — Admin: client management page**
- `src/pages/AdminClientsPage.tsx` — list of clients, "Add client" button, inline delete (soft delete with `active: false` flag)
- `src/features/admin/services/clientService.ts` — `fetchClients()`, `createClient(name)`, `deactivateClient(id)`
- Add route `/admin/clients` and nav item

**15.7c — Operator: client selector on operation form**
- `src/pages/OperationFormPage.tsx` — add required "Client" dropdown above order number field
- Fetch clients from Firestore on form mount (cache in Zustand to avoid re-fetching)
- Store `clientId` and `clientName` on the operation document

**15.7d — Update Operation type**
```ts
// src/types/Operation.ts — add fields
clientId: string
clientName: string
```

**15.7e — Firestore rules update**
```
match /clients/{clientId} {
  allow read: if isAuthenticated();
  allow create, update: if isAdmin();
  allow delete: if false;
}
```

---

### Ticket 15.8 — Admin: filter operations by client

**Goal**: Extend the filters bar from Ticket 15.1 to include a "Client" dropdown. Firestore query adds `where("clientId", "==", selectedClientId)` when a client is selected.

**Files to modify**:
- `src/features/admin/components/FiltersBar.tsx` — add client dropdown (fetches from `clients` collection)
- `src/features/admin/hooks/useAdminOperations.ts` — add `clientId` to filter params

**Note**: This ticket depends on 15.1 and 15.7 being complete.

---

## Phase 16 — UX Improvements, Status Rework & CRUD Enhancements

> Priority: High — These tickets address core workflow gaps and usability issues.

---

### Ticket 16.1 — Navbar: Role indicator for operator vs admin

**Goal**: Make it immediately obvious whether the logged-in user is an operator or admin. Since this is a mobile-first PWA with limited screen space, use a combination of a subtle color accent and a small role badge.

**Approach**:
- Add a thin top bar (or header strip) above the page content inside `AppShell` that shows the role
- Use a colored accent: blue for admin, green for operator
- Display a small pill/badge with text "Admin" or "Operator" (abbreviated "Op." if space is tight)
- The bar should be compact — max 28–32px height

**Files to modify**:
- `src/shared/components/layout/AppShell.tsx` — add role indicator header strip
- `src/features/auth/store/authStore.ts` — ensure role is readily available (already is)

**Acceptance criteria**:
- [ ] A colored strip/bar appears at the top of the app showing the user's role
- [ ] Admin sees a blue-accented "Admin" badge
- [ ] Operator sees a green-accented "Operator" badge
- [ ] Does not interfere with bottom nav or page content scrolling

---

### Ticket 16.2 — Navbar: Display logged-in user name

**Goal**: Show the currently logged-in user's name in the app. Since space is limited on mobile, integrate it into the role indicator bar from Ticket 16.1.

**Approach**:
- In the top header strip (from 16.1), display: `[RoleBadge]  User Name`
- Truncate name with ellipsis if it exceeds available width (use `truncate` Tailwind class)
- Name comes from `authStore` user object (`user.name`)

**Files to modify**:
- `src/shared/components/layout/AppShell.tsx` — add user name display next to role badge

**Depends on**: Ticket 16.1

**Acceptance criteria**:
- [ ] User's name is visible in the header strip
- [ ] Long names are truncated gracefully with ellipsis
- [ ] Layout doesn't break on small screens (320px width)

---

### Ticket 16.3 — Operator: Open and edit operations from Home

**Goal**: Allow operators to tap on an operation from the Home screen (OperatorPage) to open it and edit its details and photos. This should NOT apply to the History section — only the Home screen (recent/active operations).

**Approach**:
- Create an operator-specific operation edit page or reuse `OperationFormPage` in edit mode
- From `OperatorPage`, clicking an operation navigates to an edit route (e.g., `/operation/:id/edit`)
- The edit form pre-populates with existing operation data
- Operator can update: orderNumber, doorNumber, operationType, clientId, and photos
- Only operations with status `pending_sync`, `synced`, or `rejected` should be editable
- `approved` operations should open as read-only
- On save, if operation was `rejected`, status resets to `pending_sync` for re-sync

**Files to create/modify**:
- `src/app/router.tsx` — add route `/operation/:id/edit` for operators
- `src/pages/OperationFormPage.tsx` — extend to support edit mode (load existing operation, pre-fill form)
- `src/pages/OperatorPage.tsx` — make operation cards clickable, navigate to edit route
- `src/features/operations/services/operationService.ts` — add `updateOperation()` method
- `src/features/operations/services/localDb.ts` — add `updateLocalOperation()` for offline edits
- `firestore.rules` — ensure operators can update their own operations (already partially allowed)

**Acceptance criteria**:
- [ ] Tapping an operation on Home opens it in edit mode
- [ ] All fields and photos are pre-populated
- [ ] Operator can modify details and re-take/add photos
- [ ] Saving triggers re-sync if the operation was already synced
- [ ] Rejected operations reset to `pending_sync` on save
- [ ] Approved operations are read-only
- [ ] History section operations are NOT editable (view-only or no navigation)

---

### Ticket 16.4 — Admin: Fix photos not displaying in Operation Details

**Goal**: Photos are not appearing in the admin operation detail view. Diagnose and fix.

**Likely causes to investigate**:
1. Photo URLs from Firebase Storage may have expired or be incorrectly formed
2. The `photos` field structure in Firestore may not match what `OperationDetailPage` expects
3. CORS or Storage rules may be blocking image loads
4. Photos stored as `Partial<Record<PhotoType, PhotoRecord>>` — some photo types may be keyed differently than expected

**Approach**:
- Verify that synced operations in Firestore have correct `photos` map with valid `url` fields
- Check `storage.rules` to ensure admin can read photo files
- In `OperationDetailPage.tsx`, add error handling for broken image URLs (fallback/placeholder)
- Test with both load and unload operation types
- Ensure the photo grid renders even when only some photo types are present

**Files to inspect/modify**:
- `src/pages/OperationDetailPage.tsx` — photo rendering logic, check how photos are iterated
- `src/features/operations/services/operationService.ts` — check how photo URLs are stored during sync
- `storage.rules` — verify read permissions for admins
- `firestore.rules` — verify admin can read operations

**Acceptance criteria**:
- [ ] All synced operation photos are visible in the admin detail view
- [ ] Photos display correctly for both load and unload operations
- [ ] Broken/missing photos show a placeholder instead of nothing
- [ ] Admin can still download photos as ZIP

---

### Ticket 16.5 — Users: Add edit and delete functionality

**Goal**: Admins should be able to edit user details (name, email, role) and delete users from the Users management page.

**Approach — Edit**:
- Add an "Edit" button/icon on each user row
- Opens a modal (similar to `CreateUserModal`) pre-filled with the user's current data
- Editable fields: name, role (email change is complex with Firebase Auth — defer or flag)
- Uses `updateDoc` on `users/{uid}` for Firestore fields
- Log changes to `audit_log`

**Approach — Delete**:
- Add a "Delete" button/icon on each user row
- Show a confirmation dialog before deleting
- Soft-delete preferred: set `active: false` on the user document (similar to clients)
- Alternatively, disable the Firebase Auth account using Admin SDK (requires Cloud Function)
- For now, implement soft-delete at Firestore level + hide inactive users from operator-facing lists
- Log deletion to `audit_log`

**Files to create/modify**:
- `src/pages/AdminUsersPage.tsx` — add edit/delete buttons, edit modal, confirmation dialog
- `src/features/admin/components/EditUserModal.tsx` — new component for editing user details
- `src/features/admin/services/adminService.ts` — add `updateUser()`, `deactivateUser()` methods
- `firestore.rules` — update to allow admin updates on user docs (name field), consider soft-delete rules
- `src/types/` — add `active` field to user type if not present

**Acceptance criteria**:
- [ ] Admin can click edit on a user and modify their name and role
- [ ] Admin can click delete on a user with a confirmation prompt
- [ ] Deleted users are soft-deleted (marked inactive), not hard-deleted
- [ ] Inactive users don't appear in operator-facing dropdowns
- [ ] All changes are logged in audit_log

---

### Ticket 16.6 — Clients: Add edit and delete functionality

**Goal**: Admins should be able to edit client names and delete clients from the Clients management page.

**Current state**: Clients can be created and activated/deactivated, but there's no way to edit a client's name or fully remove them.

**Approach — Edit**:
- Add an "Edit" button/icon on each client row
- Inline editing (click name to make it editable) or a small modal
- Uses `updateDoc` on `clients/{id}` to update name
- Validate: name is required, non-empty

**Approach — Delete**:
- Existing deactivation is a form of soft-delete, which is good
- Add a hard "Delete" option for clients that have never been used in any operation
- For clients with operations, only allow deactivation (soft-delete) — show a message explaining why
- Confirmation dialog required before any delete

**Files to modify**:
- `src/pages/AdminClientsPage.tsx` — add edit functionality (inline or modal), delete button with logic
- `src/features/admin/services/clientService.ts` — add `updateClientName()`, `deleteClient()` (hard delete only for unused clients), add `clientHasOperations()` check
- `firestore.rules` — allow admin delete on clients collection (conditional or unconditional)

**Acceptance criteria**:
- [ ] Admin can edit a client's name
- [ ] Admin can delete a client that has no associated operations
- [ ] Clients with operations can only be deactivated, with an explanatory message
- [ ] Confirmation dialog appears before delete
- [ ] Deactivated clients remain visible in admin view but hidden from operator forms

---

### Ticket 16.7 — Status rework: New operation lifecycle

**Goal**: Rework the operation status system to match the actual business workflow between operators and admins.

**New status definitions**:

| Status | Meaning | Set by |
|--------|---------|--------|
| `pending_sync` | Created locally, not yet uploaded to server | System (on create) |
| `synced` | Uploaded to server with photos, awaiting admin review | System (after sync) |
| `approved` | Admin reviewed and approved the photos/operation | Admin |
| `rejected` | Admin reviewed and rejected — operator must fix | Admin |
| `error` | Technical sync failure | System |

**Status flow diagram**:
```
[Operator creates] → pending_sync → [sync completes] → synced
                                                          ↓
                                              ┌───── [Admin reviews] ─────┐
                                              ↓                           ↓
                                          approved                    rejected
                                                                         ↓
                                                              [Operator fixes photos]
                                                                         ↓
                                                                    pending_sync → synced → ...
```

**Rejection details**:
- When admin rejects, they MUST provide a rejection reason (text field, required)
- The rejection reason is stored on the operation document as `rejectionReason: string`
- Operator sees the rejection reason when they open a rejected operation
- When operator re-submits, `rejectionReason` is cleared and status resets to `pending_sync`

**Changes required**:

**Step 1 — Update types**:
- `src/types/Operation.ts`:
  - Change `OperationStatus` to: `"pending_sync" | "synced" | "approved" | "rejected" | "error"`
  - Add `rejectionReason?: string` to `Operation` interface
  - Remove `completed` and `reviewed` statuses

**Step 2 — Update status badge UI**:
- `src/shared/components/ui/StatusBadge.tsx`:
  - Remove `completed`/`reviewed` badge styles
  - Add `approved` (green) and `rejected` (red) badge styles
  - `rejected` badge should also show a tooltip or inline hint that a reason exists

**Step 3 — Update admin operation detail page**:
- `src/pages/OperationDetailPage.tsx`:
  - Replace status dropdown options: only `approved` and `rejected` available for `synced` operations
  - When "rejected" is selected, show a required text input for the rejection reason
  - Disable status change for operations already `approved` (or allow re-review — TBD)
  - Show rejection reason if operation is in `rejected` status

**Step 4 — Update admin dashboard**:
- `src/pages/AdminPage.tsx`:
  - Update filter options to match new statuses
  - Rejected operations should be visually distinct (e.g., red border or icon)

**Step 5 — Update operator views**:
- `src/pages/OperatorPage.tsx`:
  - Show rejection reason prominently on rejected operations (red banner/alert)
  - Make rejected operations clearly actionable (edit button/tap to fix)
- `src/pages/OperatorHistoryPage.tsx`:
  - Show updated status badges (read-only)

**Step 6 — Update services**:
- `src/features/operations/services/operationService.ts`:
  - Update `updateOperationStatus()` to accept optional `rejectionReason`
  - When approving, clear any existing `rejectionReason`
  - When operator re-submits a rejected operation, clear `rejectionReason` and reset to `pending_sync`

**Step 7 — Update Firestore rules**:
- `firestore.rules`:
  - Admin can set status to `approved` or `rejected`
  - Operator can update own operations (to re-submit after rejection)
  - `rejectionReason` can only be set by admin

**Step 8 — Data migration**:
- Any existing operations with `completed` status → map to `approved`
- Any existing operations with `reviewed` status → map to `approved`
- Can be done via a one-time script or Cloud Function

**Acceptance criteria**:
- [ ] Old `completed`/`reviewed` statuses are fully replaced by `approved`/`rejected`
- [ ] Admin can approve or reject a `synced` operation
- [ ] Rejection requires a reason (cannot submit empty)
- [ ] Operator sees rejection reason on their rejected operations
- [ ] Operator can edit and re-submit rejected operations
- [ ] Re-submitted operations go back to `pending_sync` → `synced` cycle
- [ ] Status badges reflect new statuses with appropriate colors
- [ ] Admin dashboard filters work with new statuses
- [ ] Existing data is migrated to new status values

---

### Ticket 16.8 — Operator: Rejection notification and re-submission flow

**Goal**: When an admin rejects an operation, the operator needs a clear, guided experience to understand what went wrong and re-submit.

**Depends on**: Tickets 16.3 (edit operations) and 16.7 (status rework)

**Approach**:
- On `OperatorPage`, rejected operations appear at the top with a red/warning visual treatment
- Each rejected operation card shows:
  - A "Rejected" badge
  - The rejection reason in a visible callout (not hidden behind a tap)
  - A clear "Fix & Re-submit" button
- Tapping "Fix & Re-submit" opens the operation in edit mode (from 16.3)
- After saving, status resets to `pending_sync` and the sync engine picks it up

**Files to modify**:
- `src/pages/OperatorPage.tsx` — prioritize rejected operations, show rejection details
- `src/features/operations/components/OperationCard.tsx` (or equivalent) — add rejected state styling
- Integration with Ticket 16.3 edit flow

**Acceptance criteria**:
- [ ] Rejected operations appear prominently at the top of the operator's Home
- [ ] Rejection reason is visible without extra taps
- [ ] "Fix & Re-submit" action is obvious and functional
- [ ] After re-submission, operation follows normal sync flow
- [ ] Re-submitted operation appears as `pending_sync` and then `synced` after upload

---

### Implementation order (suggested)

| Order | Ticket | Reason |
|-------|--------|--------|
| 1 | 16.1 | Quick win, no dependencies |
| 2 | 16.2 | Builds on 16.1, quick win |
| 3 | 16.4 | Bug fix, no dependencies, unlocks admin workflow |
| 4 | 16.5 | CRUD enhancement, no dependencies |
| 5 | 16.6 | CRUD enhancement, no dependencies |
| 6 | 16.7 | Core workflow rework — most complex ticket |
| 7 | 16.3 | Depends on 16.7 for status-aware editing |
| 8 | 16.8 | Depends on 16.3 + 16.7, final UX polish |

