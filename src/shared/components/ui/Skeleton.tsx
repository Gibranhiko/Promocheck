export function SkeletonRow() {
  return (
    <div className="card flex items-center gap-3">
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-3 w-1/2" />
      </div>
      <div className="skeleton h-6 w-16 rounded-full" />
    </div>
  )
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}

export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 pr-4">
          <div className="skeleton h-4 rounded" style={{ width: `${55 + i * 8}%` }} />
        </td>
      ))}
    </tr>
  )
}
