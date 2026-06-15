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
import type { Operation, OperationStatus, PhotoRecord } from "@/types/Operation"
import type { PhotoType } from "@/types/PhotoType"

const OPERATIONS_PER_PAGE = 20

export interface SyncOperationData {
  localId: string
  orderNumber: string
  doorNumber: string
  operationType: string
  operatorId: string
  operatorName: string
  photos: Partial<Record<PhotoType, string>>
  createdAt: number
}

// Uses setDoc with the local ID as the Firestore document ID so the operation is
// idempotent on retry and the doc exists before photos are uploaded.
// Preserves existing photo URLs already stored on the document (for re-submissions).
export async function syncOperationToFirestore(op: Operation): Promise<void> {
  const { id, localId, ...data } = op
  await setDoc(doc(db, "operations", id), {
    ...data,
    localId: id,
    // Keep any existing photo URLs so re-uploads only replace specific photos
    photos: op.photos ?? {},
    syncedAt: Date.now(),
    // Clear rejection reason on re-submit
    rejectionReason: null,
  })
}

export async function updateOperationPhotos(
  operationId: string,
  photos: Partial<Record<PhotoType, PhotoRecord>>
): Promise<void> {
  await updateDoc(doc(db, "operations", operationId), { photos })
}

export async function updateOperationStatus(
  operationId: string,
  status: OperationStatus,
  rejectionReason?: string
): Promise<void> {
  const update: Record<string, unknown> = { status }
  if (status === "rejected" && rejectionReason) {
    update.rejectionReason = rejectionReason
  } else if (status === "approved") {
    // Clear any previous rejection reason when approving
    update.rejectionReason = null
  }
  await updateDoc(doc(db, "operations", operationId), update)
}

export async function uploadPhotoToStorage(
  operationId: string,
  photoType: PhotoType,
  blob: Blob
): Promise<PhotoRecord> {
  const capturedAt = Date.now()
  const path = `operations/${operationId}/${photoType}_${capturedAt}.jpg`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, blob)
  const url = await getDownloadURL(storageRef)
  return { url, capturedAt }
}

export async function checkOperationExists(localId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "operations", localId))
  return snap.exists()
}

export async function fetchAllOperations(): Promise<Operation[]> {
  const snap = await getDocs(
    query(collection(db, "operations"), orderBy("createdAt", "desc"))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Operation))
}

export async function fetchOperationsPaginated(
  pageParam?: DocumentSnapshot
): Promise<{ operations: Operation[]; nextPage: DocumentSnapshot | null }> {
  let q = query(
    collection(db, "operations"),
    orderBy("createdAt", "desc"),
    limit(OPERATIONS_PER_PAGE)
  )

  if (pageParam) {
    q = query(q, startAfter(pageParam))
  }

  const snap = await getDocs(q)
  const operations = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Operation))
  const nextPage = snap.docs.length === OPERATIONS_PER_PAGE ? snap.docs[snap.docs.length - 1] : null

  return { operations, nextPage }
}

export interface OperationFilters {
  clientId?: string
  operationType?: string
  dateFrom?: number
  dateTo?: number
}

export async function fetchOperationsFiltered(
  filters: OperationFilters,
  pageParam?: DocumentSnapshot
): Promise<{ operations: Operation[]; nextPage: DocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(OPERATIONS_PER_PAGE)]

  if (filters.clientId) constraints.unshift(where("clientId", "==", filters.clientId))
  if (filters.operationType) constraints.unshift(where("operationType", "==", filters.operationType))
  if (filters.dateFrom) constraints.unshift(where("createdAt", ">=", filters.dateFrom))
  if (filters.dateTo) constraints.unshift(where("createdAt", "<=", filters.dateTo))
  if (pageParam) constraints.push(startAfter(pageParam))

  const snap = await getDocs(query(collection(db, "operations"), ...constraints))
  const operations = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Operation))
  const nextPage = snap.docs.length === OPERATIONS_PER_PAGE ? snap.docs[snap.docs.length - 1] : null

  return { operations, nextPage }
}

export async function fetchOperationsByDateRange(
  startDate: number,
  endDate: number
): Promise<Operation[]> {
  const snap = await getDocs(
    query(
      collection(db, "operations"),
      where("createdAt", ">=", startDate),
      where("createdAt", "<=", endDate),
      orderBy("createdAt", "desc")
    )
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Operation))
}

const OPERATOR_HISTORY_PAGE_SIZE = 20

export async function fetchOperationsByOperator(
  operatorId: string,
  pageParam?: DocumentSnapshot
): Promise<{ operations: Operation[]; nextPage: DocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [
    where("operatorId", "==", operatorId),
    orderBy("createdAt", "desc"),
    limit(OPERATOR_HISTORY_PAGE_SIZE),
  ]
  if (pageParam) constraints.push(startAfter(pageParam))

  const snap = await getDocs(query(collection(db, "operations"), ...constraints))
  const operations = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Operation))
  const nextPage = snap.docs.length === OPERATOR_HISTORY_PAGE_SIZE
    ? snap.docs[snap.docs.length - 1]
    : null
  return { operations, nextPage }
}

export async function fetchOperation(id: string): Promise<Operation | null> {
  const snap = await getDoc(doc(db, "operations", id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Operation
}
