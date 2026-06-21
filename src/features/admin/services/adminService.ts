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
  addDoc,
} from "firebase/firestore"
import { firebaseConfig } from "@/services/firebase/firebaseConfig"
import { auth, db } from "@/services/firebase"
import type { UserRole } from "@/types/UserRole"

// ── Secondary app — isolated from the admin's active session ────────────────
const SECONDARY_APP_NAME = "promocheck-secondary"
const secondaryApp =
  getApps().find((a) => a.name === SECONDARY_APP_NAME) ??
  initializeApp(firebaseConfig, SECONDARY_APP_NAME)
const secondaryAuth = getAuth(secondaryApp)

export interface AppUser {
  uid: string
  name: string
  email: string
  role: UserRole | null
  createdAt: number
  active?: boolean
}

async function writeAuditLog(
  action: "create_user" | "update_role" | "update_user" | "deactivate_user",
  targetUid: string,
  details: Record<string, unknown>
): Promise<void> {
  await addDoc(collection(db, "audit_log"), {
    action,
    performedBy: auth.currentUser?.uid ?? null,
    targetUid,
    ...details,
    timestamp: Date.now(),
  })
}

/**
 * Creates a new Firebase Auth account and writes the user document to Firestore.
 * Uses a secondary app instance so the admin's session is not interrupted.
 */
export async function createOperatorAccount(
  name: string,
  email: string,
  password: string,
  role: UserRole = "operator"
): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, password)
  // Sign out from secondary app immediately — we don't need this session
  await firebaseSignOut(secondaryAuth)
  await setDoc(doc(db, "users", user.uid), {
    name,
    email: user.email,
    role,
    createdAt: Date.now(),
  })
  await writeAuditLog("create_user", user.uid, { name, email: user.email, role })
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
  await writeAuditLog("update_role", uid, { role })
}

/**
 * Updates the name (and optionally role) of an existing user document.
 */
export async function updateUser(uid: string, data: { name: string; role: UserRole }): Promise<void> {
  await updateDoc(doc(db, "users", uid), { name: data.name, role: data.role })
  await writeAuditLog("update_user", uid, { name: data.name, role: data.role })
}

/**
 * Soft-deletes a user by setting active = false.
 * The Firestore delete rule is `if false`, so hard-delete is not possible from the client.
 */
export async function deactivateUser(uid: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), { active: false })
  await writeAuditLog("deactivate_user", uid, {})
}
