import { useState, useEffect, useCallback } from "react"
import { FiPlus, FiUser, FiShield, FiEdit2, FiTrash2 } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import { CreateUserModal } from "@/features/admin/components/CreateUserModal"
import { EditUserModal } from "@/features/admin/components/EditUserModal"
import { fetchAllUsers, deactivateUser, type AppUser } from "@/features/admin/services/adminService"
import { useToast } from "@/shared/store/toastStore"
import { ADMIN_NAV } from "@/shared/constants/navItems"
import { useAuthStore } from "@/features/auth/store/authStore"

export function AdminUsersPage() {
  const toast = useToast()
  const currentUser = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<AppUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const list = await fetchAllUsers()
      setUsers(list)
    } catch {
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleEditSuccess = (updated: AppUser) => {
    setUsers((prev) => prev.map((u) => (u.uid === updated.uid ? updated : u)))
    setEditingUser(null)
  }

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteUid) return
    setIsDeleting(true)
    try {
      await deactivateUser(confirmDeleteUid)
      setUsers((prev) =>
        prev.map((u) => (u.uid === confirmDeleteUid ? { ...u, active: false } : u))
      )
      toast.success("Usuario desactivado")
    } catch {
      toast.error("Error al desactivar usuario")
    } finally {
      setIsDeleting(false)
      setConfirmDeleteUid(null)
    }
  }

  const activeUsers = users.filter((u) => u.active !== false)
  const inactiveUsers = users.filter((u) => u.active === false)

  const renderUserCard = (user: AppUser) => {
    const isInactive = user.active === false
    const isSelf = user.uid === currentUser?.uid

    return (
      <div
        key={user.uid}
        className={`card flex items-center gap-3 ${isInactive ? "opacity-50" : ""}`}
      >
        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
          {user.role === "admin" ? (
            <FiShield className="w-5 h-5 text-primary" />
          ) : (
            <FiUser className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{user.name || user.email}</p>
          {user.name && (
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
          )}
          <p className="text-xs text-gray-400">
            {user.role === "admin" ? "Administrador" : "Promotora"}
          </p>
          {isInactive && (
            <span className="text-xs text-red-500 font-medium">Inactivo</span>
          )}
        </div>
        {!isInactive && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setEditingUser(user)}
              className="p-2 rounded-lg hover:bg-surface-tertiary text-gray-500"
              aria-label="Editar usuario"
            >
              <FiEdit2 className="w-4 h-4" />
            </button>
            {!isSelf && (
              <button
                onClick={() => setConfirmDeleteUid(user.uid)}
                className="p-2 rounded-lg hover:bg-red-50 text-red-400"
                aria-label="Desactivar usuario"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <AppShell
      title="Usuarios"
      navItems={ADMIN_NAV}
      headerRight={
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary text-sm"
        >
          <FiPlus className="w-4 h-4" />
          Nuevo usuario
        </button>
      }
    >
      {isLoading ? (
        <SkeletonList count={5} />
      ) : users.length === 0 ? (
        <EmptyState
          icon="👥"
          title="Sin usuarios aún"
          description="Crea la primera cuenta de promotora."
          action={
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <FiPlus className="w-4 h-4" /> Nuevo usuario
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {activeUsers.map(renderUserCard)}
          </div>

          {inactiveUsers.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Inactivos ({inactiveUsers.length})
              </p>
              <div className="space-y-3">
                {inactiveUsers.map(renderUserCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadUsers()
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {confirmDeleteUid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-card-elevated p-6 space-y-4">
            <h2 className="font-bold text-gray-900">¿Desactivar usuario?</h2>
            <p className="text-sm text-gray-600">
              El usuario quedará inactivo y no podrá usar la app.
              Un administrador puede reactivarlo después.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteUid(null)}
                className="btn btn-secondary flex-1"
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="btn flex-1 bg-red-600 text-white hover:bg-red-700"
              >
                {isDeleting ? "Desactivando…" : "Desactivar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
