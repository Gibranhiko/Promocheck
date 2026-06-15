import { FiHome, FiList, FiUser, FiUsers, FiBriefcase } from "react-icons/fi"

export const OPERATOR_NAV = [
  { to: "/operator",         label: "Home",    icon: <FiHome className="w-5 h-5" /> },
  { to: "/operator/history", label: "History", icon: <FiList className="w-5 h-5" /> },
  { to: "/account",          label: "Account", icon: <FiUser className="w-5 h-5" /> },
]

export const ADMIN_NAV = [
  { to: "/admin",          label: "Dashboard", icon: <FiHome className="w-5 h-5" /> },
  { to: "/admin/users",    label: "Users",     icon: <FiUsers className="w-5 h-5" /> },
  { to: "/admin/clients",  label: "Clients",   icon: <FiBriefcase className="w-5 h-5" /> },
  { to: "/account",        label: "Account",   icon: <FiUser className="w-5 h-5" /> },
]
