import { useState } from "react"
import { FiX } from "react-icons/fi"
import { updateUser } from "../services/adminService"
import { useToast } from "@/shared/store/toastStore"
import type { AppUser } from "../services/adminService"
import type { UserRole } from "@/types/UserRole"

interface EditUserModalProps {
  user: AppUser
  onClose: () => void
  onSuccess: (updated: AppUser) => void
}

export function EditUserModal({ user, onClose, onSuccess }: EditUserModalProps) {
  const toast = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState(user.name ?? "")
  const [role, setRole] = useState<UserRole>(user.role ?? "operator")
  const [nameError, setNameError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameError("")

    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError("Name is required")
      return
    }
    if (trimmedName.length > 100) {
      setNameError("Name must be 100 characters or less")
      return
    }

    setIsSubmitting(true)
    try {
      await updateUser(user.uid, { name: trimmedName, role })
      toast.success("User updated")
      onSuccess({ ...user, name: trimmedName, role })
    } catch {
      toast.error("Failed to update user")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-card-elevated">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">Edit User</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-tertiary"
            aria-label="Close"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <p className="input bg-gray-50 text-gray-500 cursor-not-allowed">{user.email}</p>
            <p className="mt-1 text-xs text-gray-400">Email cannot be changed here</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`input ${nameError ? "input-error" : ""}`}
              autoComplete="off"
            />
            {nameError && <p className="mt-1 text-sm text-error">{nameError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="input"
            >
              <option value="operator">Promotora</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary flex-1"
            >
              {isSubmitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
