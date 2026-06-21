import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  where,
} from "firebase/firestore"
import { auth, db } from "@/services/firebase"
import type { Product } from "@/types/Product"
import type { ProductFormValues } from "../schemas/stockSchema"

export async function fetchActiveProducts(): Promise<Product[]> {
  const snap = await getDocs(
    query(collection(db, "products"), where("active", "==", true), orderBy("name", "asc"))
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) }))
}

export async function fetchAllProducts(): Promise<Product[]> {
  const snap = await getDocs(
    query(collection(db, "products"), orderBy("name", "asc"))
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) }))
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const snap = await getDoc(doc(db, "products", id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Product, "id">) }
}

export async function createProduct(data: ProductFormValues): Promise<Product> {
  const payload = {
    name: data.name.trim(),
    sku: data.sku.trim(),
    unit: data.unit,
    defaultMinThreshold: data.defaultMinThreshold,
    active: true,
    createdAt: Date.now(),
    createdBy: auth.currentUser?.uid ?? null,
  }
  const ref = await addDoc(collection(db, "products"), payload)
  return { id: ref.id, ...payload } as Product
}

export async function updateProduct(
  id: string,
  data: Partial<ProductFormValues>
): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (data.name !== undefined) payload.name = data.name.trim()
  if (data.sku !== undefined) payload.sku = data.sku.trim()
  if (data.unit !== undefined) payload.unit = data.unit
  if (data.defaultMinThreshold !== undefined) payload.defaultMinThreshold = data.defaultMinThreshold
  await updateDoc(doc(db, "products", id), payload)
}

export async function deactivateProduct(id: string): Promise<void> {
  await updateDoc(doc(db, "products", id), { active: false })
}

export async function reactivateProduct(id: string): Promise<void> {
  await updateDoc(doc(db, "products", id), { active: true })
}
