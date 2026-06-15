import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  query,
  orderBy,
  where,
  limit,
} from "firebase/firestore"
import { auth, db } from "@/services/firebase"

export interface Client {
  id: string
  name: string
  active: boolean
  createdAt: number
}

export async function fetchActiveClients(): Promise<Client[]> {
  const snap = await getDocs(query(collection(db, "clients"), orderBy("name", "asc")))
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Client, "id">) }))
    .filter((c) => c.active)
}

export async function fetchAllClients(): Promise<Client[]> {
  const q = query(collection(db, "clients"), orderBy("name", "asc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Client, "id">) }))
}

export async function createClient(name: string): Promise<Client> {
  const docRef = await addDoc(collection(db, "clients"), {
    name: name.trim(),
    active: true,
    createdAt: Date.now(),
    createdBy: auth.currentUser?.uid ?? null,
  })
  return { id: docRef.id, name: name.trim(), active: true, createdAt: Date.now() }
}

export async function deactivateClient(id: string): Promise<void> {
  await updateDoc(doc(db, "clients", id), { active: false })
}

export async function reactivateClient(id: string): Promise<void> {
  await updateDoc(doc(db, "clients", id), { active: true })
}

export async function updateClientName(id: string, name: string): Promise<void> {
  await updateDoc(doc(db, "clients", id), { name: name.trim() })
}

export async function clientHasOperations(id: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, "operations"), where("clientId", "==", id), limit(1))
  )
  return !snap.empty
}

export async function deleteClient(id: string): Promise<void> {
  await deleteDoc(doc(db, "clients", id))
}
