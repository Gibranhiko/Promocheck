import "@testing-library/jest-dom"
import { vi, beforeEach, afterEach } from "vitest"

// ── Firebase: mock entire SDK so no real connections are made ──────────────
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(() => () => {}),
  createUserWithEmailAndPassword: vi.fn(),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserLocalPersistence: "local",
}))

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
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
  getStorage: vi.fn(() => ({})),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}))

vi.mock("firebase/app", () => {
  class FirebaseError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
      this.name = "FirebaseError"
    }
  }
  return {
    initializeApp: vi.fn(() => ({ name: "mock-app" })),
    getApps: vi.fn(() => []),
    FirebaseError,
  }
})

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
