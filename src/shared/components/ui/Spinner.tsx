export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin ${className}`}
    />
  )
}
