import { FiLogOut, FiClock } from "react-icons/fi"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/features/auth/store/authStore"
import { logout } from "@/features/auth/services/authService"

export function PendingApprovalPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="card text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiClock className="w-8 h-8 text-yellow-600" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Account Pending Approval
          </h1>

          <p className="text-gray-600 mb-4">
            Your account has been created but is awaiting admin assignment of a
            role. Please contact your administrator.
          </p>

          {user?.email && (
            <p className="text-sm text-gray-500 mb-6">{user.email}</p>
          )}

          <button
            onClick={handleLogout}
            className="btn btn-secondary w-full flex items-center justify-center gap-2"
          >
            <FiLogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
