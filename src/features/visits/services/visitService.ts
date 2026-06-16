import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  DocumentSnapshot,
  type QueryConstraint,
} from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/services/firebase/firebaseServices"
import type { Visit } from "@/types/Visit"
import type { VisitStatus } from "@/types/VisitType"
import type { PhotoCategory, PhotoRecord } from "@/types/PhotoCategory"

const VISITS_PER_PAGE = 20
const PROMOTER_HISTORY_PAGE_SIZE = 20

export async function syncVisitToFirestore(visit: Visit): Promise<void> {
  const { id, localId, ...data } = visit
  await setDoc(doc(db, "visits", id), {
    ...data,
    localId: id,
    photos: visit.photos ?? {},
    syncedAt: Date.now(),
    rejectionReason: null,
  })
}

export async function updateVisitPhotos(
  visitId: string,
  photos: Partial<Record<PhotoCategory, PhotoRecord[]>>
): Promise<void> {
  await updateDoc(doc(db, "visits", visitId), { photos })
}

export async function updateVisitStatus(
  visitId: string,
  status: VisitStatus,
  rejectionReason?: string
): Promise<void> {
  const update: Record<string, unknown> = { status }
  if (status === "rejected" && rejectionReason) {
    update.rejectionReason = rejectionReason
  } else if (status === "approved") {
    update.rejectionReason = null
  }
  await updateDoc(doc(db, "visits", visitId), update)
}

export async function uploadVisitPhoto(
  visitId: string,
  category: PhotoCategory,
  sequence: number,
  blob: Blob
): Promise<PhotoRecord> {
  const capturedAt = Date.now()
  const path = `visits/${visitId}/${category}_${sequence}_${capturedAt}.jpg`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, blob)
  const url = await getDownloadURL(storageRef)
  return { url, capturedAt }
}

export async function checkVisitExists(localId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "visits", localId))
  return snap.exists()
}

export async function fetchAllVisits(): Promise<Visit[]> {
  const snap = await getDocs(
    query(collection(db, "visits"), orderBy("createdAt", "desc"))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Visit))
}

export async function fetchVisitsPaginated(
  pageParam?: DocumentSnapshot
): Promise<{ visits: Visit[]; nextPage: DocumentSnapshot | null }> {
  let q = query(
    collection(db, "visits"),
    orderBy("createdAt", "desc"),
    limit(VISITS_PER_PAGE)
  )
  if (pageParam) q = query(q, startAfter(pageParam))

  const snap = await getDocs(q)
  const visits = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Visit))
  const nextPage = snap.docs.length === VISITS_PER_PAGE ? snap.docs[snap.docs.length - 1] : null
  return { visits, nextPage }
}

export interface VisitFilters {
  storeId?: string
  visitType?: string
  dateFrom?: number
  dateTo?: number
}

export async function fetchVisitsFiltered(
  filters: VisitFilters,
  pageParam?: DocumentSnapshot
): Promise<{ visits: Visit[]; nextPage: DocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(VISITS_PER_PAGE)]

  if (filters.storeId) constraints.unshift(where("storeId", "==", filters.storeId))
  if (filters.visitType) constraints.unshift(where("visitType", "==", filters.visitType))
  if (filters.dateFrom) constraints.unshift(where("createdAt", ">=", filters.dateFrom))
  if (filters.dateTo) constraints.unshift(where("createdAt", "<=", filters.dateTo))
  if (pageParam) constraints.push(startAfter(pageParam))

  const snap = await getDocs(query(collection(db, "visits"), ...constraints))
  const visits = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Visit))
  const nextPage = snap.docs.length === VISITS_PER_PAGE ? snap.docs[snap.docs.length - 1] : null
  return { visits, nextPage }
}

export async function fetchVisitsByDateRange(
  startDate: number,
  endDate: number
): Promise<Visit[]> {
  const snap = await getDocs(
    query(
      collection(db, "visits"),
      where("createdAt", ">=", startDate),
      where("createdAt", "<=", endDate),
      orderBy("createdAt", "desc")
    )
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Visit))
}

export async function fetchVisitsByPromoter(
  promoterId: string,
  pageParam?: DocumentSnapshot
): Promise<{ visits: Visit[]; nextPage: DocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [
    where("promoterId", "==", promoterId),
    orderBy("createdAt", "desc"),
    limit(PROMOTER_HISTORY_PAGE_SIZE),
  ]
  if (pageParam) constraints.push(startAfter(pageParam))

  const snap = await getDocs(query(collection(db, "visits"), ...constraints))
  const visits = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Visit))
  const nextPage =
    snap.docs.length === PROMOTER_HISTORY_PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null
  return { visits, nextPage }
}

export async function fetchVisit(id: string): Promise<Visit | null> {
  const snap = await getDoc(doc(db, "visits", id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Visit
}
