import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { FiMoreHorizontal } from "react-icons/fi"

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

interface BottomNavProps {
  items: NavItem[]
}

const MAX_PRIMARY = 4

export function BottomNav({ items }: BottomNavProps) {
  const location = useLocation()
  const [showMore, setShowMore] = useState(false)

  const hasOverflow = items.length > MAX_PRIMARY
  const primaryItems = hasOverflow ? items.slice(0, MAX_PRIMARY) : items
  const moreItems = hasOverflow ? items.slice(MAX_PRIMARY) : []
  const isMoreActive = moreItems.some(
    (item) => location.pathname === item.to || location.pathname.startsWith(item.to + "/")
  )

  const itemClass = (isActive: boolean) =>
    `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150 min-w-[60px] touch-target
    ${isActive ? "text-primary bg-primary-50 font-semibold" : "text-gray-400 hover:text-gray-600"}`

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 bg-white safe-bottom"
        style={{ boxShadow: "0 -1px 0 0 #e2e8f0, 0 -4px 16px 0 rgb(0 0 0 / 0.06)" }}
      >
        <div className="flex items-center justify-around px-2 pt-2 pb-1">
          {primaryItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin" || item.to === "/promoter"}
              className={({ isActive }) => itemClass(isActive)}
            >
              <span className="w-6 h-6 flex items-center justify-center">{item.icon}</span>
              <span className="text-[11px] leading-none">{item.label}</span>
            </NavLink>
          ))}

          {hasOverflow && (
            <button
              onClick={() => setShowMore(true)}
              className={itemClass(isMoreActive)}
            >
              <span className="w-6 h-6 flex items-center justify-center">
                <FiMoreHorizontal className="w-5 h-5" />
              </span>
              <span className="text-[11px] leading-none">Más</span>
            </button>
          )}
        </div>
      </nav>

      {hasOverflow && showMore && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setShowMore(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl safe-bottom"
            style={{ boxShadow: "0 -4px 24px 0 rgb(0 0 0 / 0.12)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-2" />
            <p className="text-xs text-gray-400 text-center mb-3">Más opciones</p>
            <div className="grid grid-cols-3 gap-1 px-4 pb-6">
              {moreItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setShowMore(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1.5 p-4 rounded-2xl transition-all duration-150
                    ${isActive ? "text-primary bg-primary-50 font-semibold" : "text-gray-700 hover:bg-gray-50"}`
                  }
                >
                  <span className="w-7 h-7 flex items-center justify-center">{item.icon}</span>
                  <span className="text-xs">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
