import type { VisitStatus } from "@/types/VisitType"

interface StatusBadgeProps {
  status: VisitStatus
  className?: string
}

const statusConfig: Record<VisitStatus, { label: string; className: string }> = {
  pending_sync: { label: "Pendiente",   className: "badge-warning" },
  synced:       { label: "Sincronizada", className: "badge-info" },
  approved:     { label: "Aprobada",    className: "badge-success" },
  rejected:     { label: "Rechazada",   className: "badge-error" },
  error:        { label: "Error",       className: "badge-error" },
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status ?? "Desconocido", className: "badge-secondary" }
  return (
    <span className={`badge ${config.className} ${className}`}>
      {config.label}
    </span>
  )
}
