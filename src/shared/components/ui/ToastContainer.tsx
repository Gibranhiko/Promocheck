import { Toast } from "./Toast"
import { useToastStore } from "@/shared/store/toastStore"

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-24 left-0 right-0 z-50 flex flex-col gap-2 px-4">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  )
}
