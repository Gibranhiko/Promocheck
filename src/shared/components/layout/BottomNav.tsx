import { NavLink } from "react-router-dom"

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

interface BottomNavProps {
  items: NavItem[]
}

export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 bg-white safe-bottom"
      style={{ boxShadow: "0 -1px 0 0 #e2e8f0, 0 -4px 16px 0 rgb(0 0 0 / 0.06)" }}
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-150 min-w-[60px] touch-target
              ${isActive
                ? "text-primary bg-primary-50 font-semibold"
                : "text-gray-400 hover:text-gray-600"
              }`
            }
          >
            <span className="w-6 h-6 flex items-center justify-center">{item.icon}</span>
            <span className="text-[11px] leading-none">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
