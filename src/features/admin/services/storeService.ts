import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  where,
  limit,
} from "firebase/firestore"
import { auth, db } from "@/services/firebase"
import type { Store } from "@/types/Store"

export type CreateStoreData = Pick<
  Store,
  "name" | "storeType" | "visitFrequency"
> & {
  address?: string
  chain?: string
  contactName?: string
  contactPhone?: string
}

export type UpdateStoreData = Partial<
  Omit<Store, "id" | "createdAt" | "createdBy">
>

export async function fetchActiveStores(): Promise<Store[]> {
  const snap = await getDocs(query(collection(db, "stores"), orderBy("name", "asc")))
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Store, "id">) }))
    .filter((s) => s.active)
}

export async function fetchStore(id: string): Promise<Store | null> {
  const snap = await getDoc(doc(db, "stores", id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Store, "id">) }
}

export async function fetchAllStores(): Promise<Store[]> {
  const snap = await getDocs(query(collection(db, "stores"), orderBy("name", "asc")))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Store, "id">) }))
}

export async function createStore(data: CreateStoreData): Promise<Store> {
  const now = Date.now()
  const payload = {
    name: data.name.trim(),
    storeType: data.storeType,
    visitFrequency: data.visitFrequency,
    address: data.address?.trim() ?? null,
    chain: data.chain?.trim() ?? null,
    contactName: data.contactName?.trim() ?? null,
    contactPhone: data.contactPhone?.trim() ?? null,
    active: true,
    createdAt: now,
    createdBy: auth.currentUser?.uid ?? null,
  }
  const docRef = await addDoc(collection(db, "stores"), payload)
  return { id: docRef.id, ...payload } as Store
}

export async function updateStore(id: string, data: UpdateStoreData): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (data.name !== undefined) payload.name = data.name.trim()
  if (data.storeType !== undefined) payload.storeType = data.storeType
  if (data.visitFrequency !== undefined) payload.visitFrequency = data.visitFrequency
  if (data.address !== undefined) payload.address = data.address?.trim() ?? null
  if (data.chain !== undefined) payload.chain = data.chain?.trim() ?? null
  if (data.contactName !== undefined) payload.contactName = data.contactName?.trim() ?? null
  if (data.contactPhone !== undefined) payload.contactPhone = data.contactPhone?.trim() ?? null
  if (data.active !== undefined) payload.active = data.active
  await updateDoc(doc(db, "stores", id), payload)
}

export async function deactivateStore(id: string): Promise<void> {
  await updateDoc(doc(db, "stores", id), { active: false })
}

export async function reactivateStore(id: string): Promise<void> {
  await updateDoc(doc(db, "stores", id), { active: true })
}

export async function storeHasVisits(id: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, "visits"), where("storeId", "==", id), limit(1))
  )
  return !snap.empty
}

export async function deleteStore(id: string): Promise<void> {
  await deleteDoc(doc(db, "stores", id))
}
