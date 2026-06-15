export type LoadPhotoType =
  | "reefer_temp"
  | "trailer"
  | "first_pallets"
  | "middle_pallets"
  | "last_pallets"
  | "seal"

export type UnloadPhotoType =
  | "reefer_temp"
  | "trailer"
  | "product_temp_1"
  | "product_temp_2"
  | "product_temp_3"
  | "first_pallets"
  | "middle_pallets"
  | "last_pallets"

export type IncidentPhotoType = "incident_1" | "incident_2" | "incident_3"

export type PhotoType = LoadPhotoType | UnloadPhotoType | IncidentPhotoType

export const LOAD_PHOTO_TYPES: LoadPhotoType[] = [
  "reefer_temp",
  "trailer",
  "first_pallets",
  "middle_pallets",
  "last_pallets",
  "seal",
]

export const UNLOAD_PHOTO_TYPES: UnloadPhotoType[] = [
  "reefer_temp",
  "trailer",
  "product_temp_1",
  "product_temp_2",
  "product_temp_3",
  "first_pallets",
  "middle_pallets",
  "last_pallets",
]

export const INCIDENT_PHOTO_TYPES: IncidentPhotoType[] = [
  "incident_1",
  "incident_2",
  "incident_3",
]

export const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  reefer_temp:   "Reefer Temperature",
  trailer:       "Trailer / Plate",
  first_pallets: "First Pallets",
  middle_pallets:"Middle Pallets",
  last_pallets:  "Last Pallets",
  seal:          "Trailer Seal",
  product_temp_1:"Product Temperature 1",
  product_temp_2:"Product Temperature 2",
  product_temp_3:"Product Temperature 3",
  incident_1:    "Incident Photo 1",
  incident_2:    "Incident Photo 2",
  incident_3:    "Incident Photo 3",
}

export function getRequiredPhotosForType(
  operationType: "load" | "unload"
): PhotoType[] {
  return operationType === "load" ? LOAD_PHOTO_TYPES : UNLOAD_PHOTO_TYPES
}

export function isIncidentPhoto(type: PhotoType): boolean {
  return (INCIDENT_PHOTO_TYPES as string[]).includes(type)
}
