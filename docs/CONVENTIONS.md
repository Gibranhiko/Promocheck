# CONVENTIONS.md — Cargo Control PWA

> This file is the source of truth for all architectural decisions.
> Read it entirely before writing any code.

---

## 1. Architecture: Feature-Based

The app is organized by **feature**, not by file type.

```
src/features/<feature-name>/
  components/    ← React UI components for this feature
  hooks/         ← Custom hooks for this feature
  services/      ← API/Firestore calls for this feature
  store/         ← Zustand store slices for this feature
  schemas/       ← Zod schemas for this feature
  index.ts       ← Public API: only export what other modules need
```

### Rules
- A feature may only import from: `shared/`, `services/`, `types/`, or its own folder.
- A feature **must not** import directly from another feature folder. Use `index.ts` exports only.
- If logic is needed by 2+ features, move it to `shared/` or `services/`.

---

## 2. File Naming

| Type | Convention | Example |
|---|---|---|
| Components | PascalCase | `LoginForm.tsx` |
| Hooks | camelCase prefixed with `use` | `useAuth.ts` |
| Services | camelCase suffixed with `Service` | `authService.ts` |
| Stores | camelCase suffixed with `Store` | `authStore.ts` |
| Schemas | camelCase suffixed with `Schema` | `loginSchema.ts` |
| Types | PascalCase | `Operation.ts` |
| Utils | camelCase | `formatDate.ts` |

---

## 3. TypeScript Rules

- **Always** use explicit types on function parameters and return values.
- **Never** use `any`. Use `unknown` if the type is truly unknown.
- Use `type` for unions/primitives, `interface` for object shapes.
- Prefer `Partial<Record<K, V>>` over index signatures.
- All async functions should be typed: `async function foo(): Promise<Bar>`.

```ts
// ✅ Good
export async function login(email: string, password: string): Promise<void> { }

// ❌ Bad
export async function login(email, password) { }
```

---

## 4. Validation: Always Use Zod

- Every form and every Firestore write must be validated with a Zod schema first.
- Schemas live in `features/<feature>/schemas/`.
- Use `schema.safeParse()` in UI to get user-friendly errors.
- Use `schema.parse()` in services when data should already be clean.

```ts
// ✅ In a form handler
const result = operationSchema.safeParse(formValues)
if (!result.success) {
  setError(result.error.errors[0].message)
  return
}
// Proceed with result.data (fully typed and validated)
```

---

## 5. Firebase: Service Layer Only

- Firestore and Storage calls are **only allowed** inside `src/features/<feature>/services/` or `src/services/`.
- Components and hooks **never** call Firebase directly.
- Always use the singleton from `src/services/firebase/firebaseServices.ts`.

```ts
// ✅ Good — inside operationService.ts
import { db } from "@/services/firebase/firebaseServices"

// ❌ Bad — inside a component
import { getFirestore } from "firebase/firestore"
```

---

## 6. Offline-First Data Flow

All operations follow this write path:

```
User Action
  → Validate with Zod
  → Save to IndexedDB (status: "pending_sync")
  → UI updates immediately (optimistic)
  → SyncEngine runs when online
    → Upload photos to Firebase Storage
    → Write operation to Firestore
    → Mark local record as "synced"
```

- **Never** skip the local save step, even when online.
- The sync engine (`syncEngine.ts`) is the only place that writes to Firestore for operations.
- Photos are always stored as `Blob` in IndexedDB, never as base64 strings.

---

## 7. State Management: Zustand

- Each feature has its own Zustand store slice.
- Stores are in `features/<feature>/store/<feature>Store.ts`.
- Keep stores flat — avoid deeply nested state.
- Never put async logic inside a store. Use hooks or services, then call `set()`.

```ts
// ✅ Good
const { setUser } = useAuthStore()
const user = await getUserRole(uid)
setUser(user)

// ❌ Bad — async inside store
actions: {
  async login() { ... }
}
```

---

## 8. Component Rules

- Every component file exports exactly **one** named component.
- No default exports (except pages in `src/pages/`).
- Props interfaces are defined inline above the component or in the same file.
- No inline styles — use Tailwind utility classes only.
- No `className` strings longer than one line — break them up with a variable.

```tsx
// ✅ Good
const buttonClass = "bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
<button className={buttonClass}>Submit</button>
```

---

## 9. Error Handling

- All async calls inside components use try/catch.
- Errors shown to the user must be human-readable strings (not raw Firebase error codes).
- Log errors to console in development only.
- Never let an error silently fail.

```ts
try {
  await login(email, password)
} catch (err) {
  // Map to friendly message
  setError("Invalid email or password. Please try again.")
  console.error(err)
}
```

---

## 10. Path Aliases

Use `@/` as the alias for `src/`. This is configured in `vite.config.ts` and `tsconfig.json`.

```ts
// ✅ Good
import { db } from "@/services/firebase/firebaseServices"

// ❌ Bad
import { db } from "../../../services/firebase/firebaseServices"
```

Configure in `vite.config.ts`:
```ts
resolve: {
  alias: { "@": path.resolve(__dirname, "src") }
}
```

Configure in `tsconfig.json`:
```json
"paths": { "@/*": ["./src/*"] }
```

---

## 11. Camera & Media

- Always use `facingMode: "environment"` to default to rear camera on mobile.
- Compress photos to JPEG at 80% quality (`canvas.toBlob(..., "image/jpeg", 0.8)`).
- Revoke object URLs after use with `URL.revokeObjectURL()`.
- Never store base64 in Firestore — store URLs only (after upload to Firebase Storage).

---

## 12. PWA Rules

- All pages must be accessible offline (the service worker caches app shell).
- Firestore reads that require internet should show a clear "You are offline" state.
- The sync indicator (online/offline badge) must always be visible in the operator view.

---

## 13. Folder Quick Reference

```
src/
├── app/           ← Root app setup (router, providers)
├── features/      ← Self-contained feature modules
├── shared/        ← Reusable components and hooks
├── services/      ← Firebase + IndexedDB setup & sync engine
├── types/         ← Global TypeScript types
└── config/        ← Constants, env config
```

---

## 14. Git Commit Convention

```
feat: add camera capture component
fix: resolve offline sync race condition
refactor: move photo upload to service layer
chore: update firebase dependencies
```

---

## 15. Capacitor (Native Builds)

### Folder Structure

```
cargo-control/
├── android/           ← Android native project (auto-generated)
├── ios/              ← iOS native project (auto-generated, Mac only)
├── src/              ← Web app (SOURCE OF TRUTH)
├── dist/             ← Built web app
└── capacitor.config.ts
```

### Rules

- **NEVER** edit files inside `android/` or `ios/` directly
- Always edit web files in `src/` first
- Run `npx cap sync` after web builds to update native projects
- Run `npx cap copy` to copy web assets only (faster)

### Build Commands

| Command | What it does |
|---------|--------------|
| `npm run build` | Build web app to `dist/` |
| `npm run build:android` | Build web + sync to Android |
| `npm run build:ios` | Build web + sync to iOS |
| `npx cap sync android` | Sync current build to Android |
| `npx cap open android` | Open Android Studio |
| `npx cap open ios` | Open Xcode (Mac only) |

### Workflow

```
1. Edit web code in src/
2. npm run build
3. npx cap sync android
4. npx cap open android
5. Build & run in Android Studio
```

### Assets

- App icons: `android/app/src/main/res/drawable-*` and `ios/App/App/Assets.xcassets`
- Use `@capacitor/assets` to auto-generate from a 1024x1024 PNG
- Splash screens are auto-scaled by Capacitor plugins

### Capacitor Plugins

```bash
# Core plugins (install these)
npm install @capacitor/haptics @capacitor/status-bar @capacitor/splash-screen

# Optional plugins
npm install @capacitor/camera @capacitor/geolocation @capacitor/push-notifications
```

---

## Do NOT Do These

| Anti-pattern | Why |
|---|---|
| `import { db } from "firebase/firestore"` in a component | Breaks service layer separation |
| Using `any` type | Defeats TypeScript |
| Calling Firestore without Zod validation | Data integrity risk |
| Storing base64 photos in Firestore | Document size limit (1MB) |
| Skipping local IndexedDB save | Breaks offline-first guarantee |
| Importing one feature directly from another | Creates tight coupling |
