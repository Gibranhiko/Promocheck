import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/services/firebase"
import { clearAllData } from "@/services/offline/db"
import type { UserRole } from "@/types"

export interface AuthUser {
  uid: string
  email: string | null
  role: UserRole | null
}

export type AuthErrorCode =
  | "user-not-found"
  | "wrong-password"
  | "network"
  | "unknown"

export async function login(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password)
}

export async function logout(): Promise<void> {
  await clearAllData()
  await signOut(auth)
}

export async function getUserProfile(uid: string): Promise<{ role: UserRole | null; name: string | null }> {
  try {
    const snap = await getDoc(doc(db, "users", uid))
    if (!snap.exists()) return { role: null, name: null }
    const data = snap.data()
    return { role: data.role as UserRole ?? null, name: data.name as string ?? null }
  } catch {
    return { role: null, name: null }
  }
}

export async function getUserRole(uid: string): Promise<UserRole | null> {
  const { role } = await getUserProfile(uid)
  return role
}

export function onAuthStateChange(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback)
}
