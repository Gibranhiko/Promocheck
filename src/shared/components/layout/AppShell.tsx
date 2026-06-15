import { useNavigate } from "react-router-dom"
import { FiChevronLeft } from "react-icons/fi"
import { BottomNav } from "./BottomNav"
import { useAuthStore } from "@/features/auth/store/authStore"

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

interface AppShellProps {
  children: React.ReactNode
  title?: string
  showBack?: boolean
  headerRight?: React.ReactNode
  navItems?: NavItem[]
}

export function AppShell({ children, title, showBack, headerRight, navItems }: AppShellProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const isAdmin = user?.role === "admin"
  const accentColor = isAdmin ? "bg-blue-600" : "bg-green-600"
  const roleLabel = isAdmin ? "Admin" : "Operator"

  return (
    <div className="min-h-screen min-h-dvh bg-surface-secondary flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10 safe-top">
        {/* Role accent strip */}
        {user && (
          <div className={`${accentColor} px-4 py-0.5 flex items-center gap-2`}>
            <span className="text-white text-[10px] font-semibold tracking-wide uppercase">
              {roleLabel}
            </span>
            {user.name && (
              <>
                <span className="text-white/50 text-[10px]">·</span>
                <span className="text-white/90 text-[10px] truncate max-w-[180px]">
                  {user.name}
                </span>
              </>
            )}
          </div>
        )}
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {showBack ? (
              <button
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 rounded-xl hover:bg-surface-tertiary touch-target flex-shrink-0"
                aria-label="Go back"
              >
                <FiChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
            ) : (
              <span className="text-xl mr-1">📦</span>
            )}
            <h1 className="text-base font-bold text-gray-900 truncate">
              {title || "Cargo Control"}
            </h1>
          </div>
          {headerRight && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {headerRight}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className={`flex-1 p-4 ${navItems ? "pb-nav" : ""}`}>
        {children}
      </main>

      {/* Bottom navigation */}
      {navItems && <BottomNav items={navItems} />}
    </div>
  )
}
