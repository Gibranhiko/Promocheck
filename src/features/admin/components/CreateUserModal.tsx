import { useState } from "react"
import { FiX } from "react-icons/fi"
import { createUserSchema } from "../schemas/createUserSchema"
import { createOperatorAccount } from "../services/adminService"
import { useToast } from "@/shared/store/toastStore"

interface CreateUserModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function CreateUserModal({ onClose, onSuccess }: CreateUserModalProps) {
  const toast = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fields, setFields] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "operator" as "operator" | "admin",
  })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof fields, string>>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const result = createUserSchema.safeParse(fields)
    if (!result.success) {
      const fieldErrors: typeof errors = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof typeof errors
        if (key) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setIsSubmitting(true)
    try {
      await createOperatorAccount(result.data.name, result.data.email, result.data.password, result.data.role)
      toast.success(`Account created for ${result.data.name}`)
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes("email-already-in-use")) {
        setErrors({ email: "This email may already be in use." })
      } else {
        toast.error("Could not create account. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-card-elevated">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">New User Account</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-tertiary"
            aria-label="Close"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fields.name}
              onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
              className={`input ${errors.name ? "input-error" : ""}`}
              placeholder="Juan García"
              autoComplete="off"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-error">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={fields.email}
              onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))}
              className={`input ${errors.email ? "input-error" : ""}`}
              placeholder="operator@company.com"
              autoComplete="off"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-error">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={fields.password}
              onChange={(e) => setFields((f) => ({ ...f, password: e.target.value }))}
              className={`input ${errors.password ? "input-error" : ""}`}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              autoComplete="new-password"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-error">{errors.password}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={fields.confirmPassword}
              onChange={(e) => setFields((f) => ({ ...f, confirmPassword: e.target.value }))}
              className={`input ${errors.confirmPassword ? "input-error" : ""}`}
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-error">{errors.confirmPassword}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={fields.role}
              onChange={(e) =>
                setFields((f) => ({ ...f, role: e.target.value as "operator" | "admin" }))
              }
              className="input"
            >
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
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
              {isSubmitting ? "Creating…" : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
