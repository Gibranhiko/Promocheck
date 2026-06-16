import { FiHome, FiList, FiUser, FiUsers, FiBriefcase } from "react-icons/fi"

export const PROMOTER_NAV = [
  { to: "/promoter",         label: "Inicio",   icon: <FiHome className="w-5 h-5" /> },
  { to: "/promoter/history", label: "Historial", icon: <FiList className="w-5 h-5" /> },
  { to: "/account",          label: "Cuenta",   icon: <FiUser className="w-5 h-5" /> },
]

export const ADMIN_NAV = [
  { to: "/admin",         label: "Dashboard", icon: <FiHome className="w-5 h-5" /> },
  { to: "/admin/users",   label: "Usuarios",  icon: <FiUsers className="w-5 h-5" /> },
  { to: "/admin/stores",  label: "Tiendas",   icon: <FiBriefcase className="w-5 h-5" /> },
  { to: "/account",       label: "Cuenta",    icon: <FiUser className="w-5 h-5" /> },
]
