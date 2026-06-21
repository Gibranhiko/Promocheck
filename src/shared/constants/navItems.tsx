import { FiHome, FiList, FiUser, FiUsers, FiBriefcase, FiPackage, FiBarChart2, FiFileText, FiMap, FiNavigation } from "react-icons/fi"

export const PROMOTER_NAV = [
  { to: "/promoter",         label: "Inicio",   icon: <FiHome className="w-5 h-5" /> },
  { to: "/promoter/route",   label: "Mi Ruta",  icon: <FiNavigation className="w-5 h-5" /> },
  { to: "/promoter/history", label: "Historial", icon: <FiList className="w-5 h-5" /> },
  { to: "/account",          label: "Cuenta",   icon: <FiUser className="w-5 h-5" /> },
]

// First 4 items appear in the bottom nav bar.
// Items 5+ appear in the "Más" overflow sheet.
export const ADMIN_NAV = [
  { to: "/admin",          label: "Dashboard", icon: <FiHome className="w-5 h-5" /> },
  { to: "/admin/routes",   label: "Rutas",     icon: <FiMap className="w-5 h-5" /> },
  { to: "/admin/reports",  label: "Reportes",  icon: <FiFileText className="w-5 h-5" /> },
  { to: "/account",        label: "Cuenta",    icon: <FiUser className="w-5 h-5" /> },
  { to: "/admin/users",    label: "Usuarios",  icon: <FiUsers className="w-5 h-5" /> },
  { to: "/admin/stores",   label: "Tiendas",   icon: <FiBriefcase className="w-5 h-5" /> },
  { to: "/admin/products", label: "Productos", icon: <FiPackage className="w-5 h-5" /> },
  { to: "/admin/stock",    label: "Stock",     icon: <FiBarChart2 className="w-5 h-5" /> },
]
