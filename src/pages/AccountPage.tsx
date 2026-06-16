import { useAuthStore } from "@/features/auth/store/authStore"
import { logout } from "@/features/auth/services/authService"
import { AppShell } from "@/shared/components/layout/AppShell"
import { useOnlineStatus } from "@/shared/hooks"
import { PROMOTER_NAV, ADMIN_NAV } from "@/shared/constants/navItems"
import { FiLogOut, FiUser, FiShield, FiWifi, FiWifiOff } from "react-icons/fi"

export function AccountPage() {
  const { user } = useAuthStore()
  const { isOnline } = useOnlineStatus()

  const navItems = user?.role === "admin" ? ADMIN_NAV : PROMOTER_NAV

  return (
    <AppShell title="Cuenta" navItems={navItems}>
      <div className="space-y-4">
        {/* User info */}
        <div className="card flex items-center gap-4">
          <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
            <FiUser className="w-7 h-7 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{user?.email}</p>
            <p className="text-sm text-gray-500 capitalize">
              {user?.role === "admin" ? "Administrador" : "Promotora"}
            </p>
          </div>
        </div>

        {/* Connection status */}
        <div className="card flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isOnline
              ? <FiWifi className="w-5 h-5 text-success" />
              : <FiWifiOff className="w-5 h-5 text-gray-400" />
            }
            <span className="text-sm font-medium text-gray-700">
              {isOnline ? "En línea" : "Sin conexión"}
            </span>
          </div>
          <span className={`badge ${isOnline ? "badge-success" : "badge-warning"}`}>
            {isOnline ? "Conectada" : "Sin conexión"}
          </span>
        </div>

        {/* App info */}
        <div className="card flex items-center gap-3">
          <FiShield className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-700">PromoCheck</p>
            <p className="text-xs text-gray-400">v1.0.0</p>
          </div>
        </div>

        {/* Sign out */}
        <button onClick={logout} className="btn btn-danger w-full py-3">
          <FiLogOut className="w-5 h-5" />
          Cerrar sesión
        </button>
      </div>
    </AppShell>
  )
}
