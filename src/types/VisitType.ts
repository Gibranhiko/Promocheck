export type VisitType = "routine" | "audit" | "special_event"
export type VisitCondition = "good" | "regular" | "bad"
export type VisitStatus = "pending_sync" | "synced" | "approved" | "rejected" | "error"

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  routine: "Rutina",
  audit: "Auditoría",
  special_event: "Evento especial",
}

export const VISIT_CONDITION_LABELS: Record<VisitCondition, string> = {
  good: "Buena",
  regular: "Regular",
  bad: "Mala",
}
