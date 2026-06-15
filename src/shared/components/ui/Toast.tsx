import { useEffect } from "react"
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from "react-icons/fi"
import type { ToastMessage } from "@/shared/store/toastStore"

interface ToastProps {
  toast: ToastMessage
  onDismiss: (id: string) => void
}

const iconMap = {
  success: <FiCheckCircle className="w-5 h-5 text-success flex-shrink-0" />,
  error:   <FiAlertCircle className="w-5 h-5 text-error flex-shrink-0" />,
  warning: <FiAlertCircle className="w-5 h-5 text-warning flex-shrink-0" />,
  info:    <FiInfo className="w-5 h-5 text-primary flex-shrink-0" />,
} as const

const borderMap = {
  success: "border-l-4 border-l-success",
  error:   "border-l-4 border-l-error",
  warning: "border-l-4 border-l-warning",
  info:    "border-l-4 border-l-primary",
} as const

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    // Errors stay until manually dismissed so they can be read on mobile
    const ms = toast.duration ?? (toast.type === "error" ? 0 : 3500)
    if (ms === 0) return
    const timer = setTimeout(() => onDismiss(toast.id), ms)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-2xl shadow-card-elevated bg-white border border-gray-100 ${borderMap[toast.type]}`}
    >
      {iconMap[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 break-words">{toast.message}</p>
        {toast.type === "error" && (
          <p className="text-xs text-gray-400 mt-0.5">Tap × to close</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
        aria-label="Dismiss"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  )
}
