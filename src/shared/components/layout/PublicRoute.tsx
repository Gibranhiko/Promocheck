// PublicRoute.tsx
import { Navigate, Outlet } from "react-router-dom"
import { useAuthStore } from "@/features/auth/store/authStore"

export function PublicRoute() {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (user && user.role) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}