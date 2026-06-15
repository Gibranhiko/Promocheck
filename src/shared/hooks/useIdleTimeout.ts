import { useEffect, useRef } from "react"
import { useAuthStore } from "@/features/auth/store/authStore"
import { logout } from "@/features/auth/services/authService"

const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const ACTIVITY_EVENTS = ["mousemove", "keydown", "pointerdown", "touchstart", "scroll"] as const

export function useIdleTimeout() {
  const user = useAuthStore((s) => s.user)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => { logout() }, IDLE_TIMEOUT_MS)
    }

    reset()
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [user])
}
