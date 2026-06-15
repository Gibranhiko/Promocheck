import { useMemo } from "react"
import { create } from "zustand"

export type ToastType = "success" | "error" | "info" | "warning"

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastState {
  toasts: ToastMessage[]
  show: (type: ToastType, message: string, duration?: number) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (type, message, duration) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: `${Date.now()}_${Math.random()}`, type, message, duration },
      ],
    })),
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export function useToast() {
  const show = useToastStore((s) => s.show)
  return useMemo(() => ({
    success: (msg: string, duration?: number) => show("success", msg, duration),
    error:   (msg: string, duration?: number) => show("error",   msg, duration),
    info:    (msg: string, duration?: number) => show("info",    msg, duration),
    warning: (msg: string, duration?: number) => show("warning", msg, duration),
  }), [show])
}
