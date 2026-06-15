import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/features/auth/hooks/useAuth"

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    // If still loading, wait
    if (isLoading) return

    // If no user, redirect to login
    if (!user) {
      navigate("/login", { replace: true })
      return
    }

    // Redirect based on role
    if (user.role === "admin") {
      navigate("/admin", { replace: true })
    } else if (user.role === "operator") {
      navigate("/operator", { replace: true })
    } else {
      // role is null - user exists in Auth but not in Firestore users collection
      navigate("/pending-approval", { replace: true })
    }
  }, [user, isLoading, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  )
}
