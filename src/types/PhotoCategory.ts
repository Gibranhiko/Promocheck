export type PhotoCategory = "display" | "cleanliness" | "promo_materials" | "general"

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  display: "Exhibición / Anaquel",
  cleanliness: "Limpieza",
  promo_materials: "Materiales Promocionales",
  general: "General",
}

export const ALL_PHOTO_CATEGORIES: PhotoCategory[] = [
  "display",
  "cleanliness",
  "promo_materials",
  "general",
]

export const DEFAULT_REQUIRED_CATEGORIES: PhotoCategory[] = [
  "display",
  "cleanliness",
]

export interface PhotoRecord {
  url: string
  capturedAt: number
}

export interface LocalPhoto {
  id: string
  blob: Blob
  visitId: string
  category: PhotoCategory
  sequence: number
}
