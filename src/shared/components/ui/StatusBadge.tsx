import type { OperationStatus } from "@/types"

interface StatusBadgeProps {
  status: OperationStatus
  className?: string
}

const statusConfig: Record<
  OperationStatus,
  { label: string; className: string }
> = {
  pending_sync: { label: "Pending",   className: "badge-warning" },
  synced:       { label: "Synced",    className: "badge-info" },
  approved:     { label: "Approved",  className: "badge-success" },
  rejected:     { label: "Rejected",  className: "badge-error" },
  error:        { label: "Error",     className: "badge-error" },
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status ?? "Unknown", className: "badge-secondary" }
  return (
    <span className={`badge ${config.className} ${className}`}>
      {config.label}
    </span>
  )
}
