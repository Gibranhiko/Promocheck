import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { FiPlus, FiTruck, FiPackage } from "react-icons/fi"

interface OperationFABProps {
  disabled?: boolean
}

export function OperationFAB({ disabled = false }: OperationFABProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={close}
        />
      )}

      {/* Action options — appear above FAB */}
      <div
        className="fixed right-4 z-40 flex flex-col items-end gap-3 transition-all duration-200"
        style={{ bottom: "calc(9rem + env(safe-area-inset-bottom))" }}
      >
        {open && (
          <>
            <button
              onClick={() => { navigate("/operation/new?type=unload"); close() }}
              className="flex items-center gap-3 btn btn-secondary shadow-card-elevated"
            >
              <FiPackage className="w-5 h-5" />
              New Unload
            </button>
            <button
              onClick={() => { navigate("/operation/new?type=load"); close() }}
              className="flex items-center gap-3 btn btn-primary shadow-card-elevated"
            >
              <FiTruck className="w-5 h-5" />
              New Load
            </button>
          </>
        )}
      </div>

      {/* FAB button */}
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`fixed right-4 z-40 w-14 h-14 rounded-full shadow-card-elevated
                    flex items-center justify-center transition-all duration-200 active:scale-95
                    ${disabled ? "bg-gray-300 cursor-not-allowed" : open ? "bg-gray-700" : "bg-primary hover:bg-primary-700"}`}
        style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
        aria-label={disabled ? "Upload in progress" : open ? "Close menu" : "New operation"}
      >
        <FiPlus
          className={`w-6 h-6 text-white transition-transform duration-200 ${open ? "rotate-45" : ""}`}
        />
      </button>
    </>
  )
}
