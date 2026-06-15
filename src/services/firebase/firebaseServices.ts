import { initializeApp, getApps } from "firebase/app"
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"
import { firebaseConfig } from "./firebaseConfig"

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

setPersistence(auth, browserLocalPersistence).catch((err) => {
  if (import.meta.env.DEV) console.error("Failed to set auth persistence:", err)
})
