import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
} from "firebase/firestore"
import { db } from "@/services/firebase"
import type { StoreProduct } from "@/types/StoreProduct"
import type { Product } from "@/types/Product"

export interface StoreProductWithDetails extends StoreProduct {
  product: Product
}

export async function fetchAllActiveStoreProducts(): Promise<StoreProduct[]> {
  const snap = await getDocs(
    query(collection(db, "store_products"), where("active", "==", true))
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoreProduct, "id">) }))
}

export async function fetchStoreProducts(storeId: string): Promise<StoreProduct[]> {
  const snap = await getDocs(
    query(
      collection(db, "store_products"),
      where("storeId", "==", storeId),
      where("active", "==", true)
    )
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoreProduct, "id">) }))
}

export async function fetchStoreProductsWithDetails(
  storeId: string
): Promise<StoreProductWithDetails[]> {
  const storeProducts = await fetchStoreProducts(storeId)
  if (storeProducts.length === 0) return []

  const productSnaps = await Promise.all(
    storeProducts.map((sp) => getDoc(doc(db, "products", sp.productId)))
  )

  const results: StoreProductWithDetails[] = []
  for (let i = 0; i < storeProducts.length; i++) {
    const snap = productSnaps[i]
    if (snap.exists()) {
      results.push({
        ...storeProducts[i],
        product: { id: snap.id, ...(snap.data() as Omit<Product, "id">) },
      })
    }
  }
  return results
}

export async function setStoreProduct(
  storeId: string,
  productId: string,
  minThreshold: number
): Promise<StoreProduct> {
  // Check if assignment already exists (active or inactive)
  const existing = await getDocs(
    query(
      collection(db, "store_products"),
      where("storeId", "==", storeId),
      where("productId", "==", productId)
    )
  )

  if (!existing.empty) {
    const ref = existing.docs[0].ref
    await updateDoc(ref, { minThreshold, active: true })
    return {
      id: ref.id,
      storeId,
      productId,
      minThreshold,
      active: true,
      createdAt: existing.docs[0].data().createdAt as number,
    }
  }

  const payload: Omit<StoreProduct, "id"> = {
    storeId,
    productId,
    minThreshold,
    active: true,
    createdAt: Date.now(),
  }
  const ref = await addDoc(collection(db, "store_products"), payload)
  return { id: ref.id, ...payload }
}

export async function deactivateStoreProduct(id: string): Promise<void> {
  await updateDoc(doc(db, "store_products", id), { active: false })
}
