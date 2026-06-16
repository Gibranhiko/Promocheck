import { useNavigate } from "react-router-dom"
import { FiPlus } from "react-icons/fi"

interface VisitFABProps {
  disabled?: boolean
}

export function VisitFAB({ disabled = false }: VisitFABProps) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => !disabled && navigate("/visit/new")}
      disabled={disabled}
      className={`fixed right-4 z-40 w-14 h-14 rounded-full shadow-card-elevated
                  flex items-center justify-center transition-all duration-200 active:scale-95
                  ${disabled ? "bg-gray-300 cursor-not-allowed" : "bg-primary hover:bg-primary-700"}`}
      style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      aria-label={disabled ? "Sincronización en progreso" : "Nueva visita"}
    >
      <FiPlus className="w-6 h-6 text-white" />
    </button>
  )
}
