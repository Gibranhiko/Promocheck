import { useState, useEffect, useCallback } from "react"
import { FiPlus, FiToggleLeft, FiToggleRight, FiEdit2, FiTrash2, FiCheck, FiX } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import {
  fetchAllClients,
  createClient,
  deactivateClient,
  reactivateClient,
  updateClientName,
  clientHasOperations,
  deleteClient,
  type Client,
} from "@/features/admin/services/clientService"
import { useToast } from "@/shared/store/toastStore"
import { ADMIN_NAV } from "@/shared/constants/navItems"

export function AdminClientsPage() {
  const toast = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Inline edit state: clientId -> draft name
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadClients = useCallback(async () => {
    setIsLoading(true)
    try {
      setClients(await fetchAllClients())
    } catch {
      toast.error("Failed to load clients")
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) return
    setIsAdding(true)
    try {
      const client = await createClient(trimmed)
      setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName("")
      setShowForm(false)
      toast.success(`Client "${trimmed}" added`)
    } catch {
      toast.error("Failed to add client")
    } finally {
      setIsAdding(false)
    }
  }

  const handleToggle = async (client: Client) => {
    try {
      if (client.active) {
        await deactivateClient(client.id)
      } else {
        await reactivateClient(client.id)
      }
      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, active: !c.active } : c))
      )
    } catch {
      toast.error("Failed to update client")
    }
  }

  const startEdit = (client: Client) => {
    setEditingId(client.id)
    setEditDraft(client.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft("")
  }

  const saveEdit = async (id: string) => {
    const trimmed = editDraft.trim()
    if (!trimmed) return
    setIsSavingEdit(true)
    try {
      await updateClientName(id, trimmed)
      setClients((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c))
      )
      setEditingId(null)
      toast.success("Client updated")
    } catch {
      toast.error("Failed to update client")
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteRequest = async (id: string) => {
    const hasOps = await clientHasOperations(id)
    if (hasOps) {
      toast.error("This client has operations and cannot be deleted. Deactivate it instead.")
      return
    }
    setConfirmDeleteId(id)
  }

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return
    setIsDeleting(true)
    try {
      await deleteClient(confirmDeleteId)
      setClients((prev) => prev.filter((c) => c.id !== confirmDeleteId))
      toast.success("Client deleted")
    } catch {
      toast.error("Failed to delete client")
    } finally {
      setIsDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  return (
    <AppShell
      title="Clients"
      navItems={ADMIN_NAV}
      headerRight={
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn btn-primary text-sm"
        >
          <FiPlus className="w-4 h-4" />
          Add Client
        </button>
      }
    >
      <div className="space-y-4">
        {showForm && (
          <form onSubmit={handleAdd} className="card flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input"
                placeholder="e.g. Walmart Monterrey"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={isAdding || !newName.trim()}
              className="btn btn-primary"
            >
              {isAdding ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setNewName("") }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </form>
        )}

        {isLoading ? (
          <SkeletonList count={4} />
        ) : clients.length === 0 ? (
          <EmptyState
            icon="🏢"
            title="No clients yet"
            description="Add your first client so operators can select it when logging operations."
            action={
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                <FiPlus className="w-4 h-4" /> Add Client
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {clients.map((client) => (
              <div
                key={client.id}
                className={`card flex items-center gap-3 ${!client.active ? "opacity-50" : ""}`}
              >
                {editingId === client.id ? (
                  <>
                    <input
                      type="text"
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="input flex-1 py-1.5 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(client.id)
                        if (e.key === "Escape") cancelEdit()
                      }}
                    />
                    <button
                      onClick={() => saveEdit(client.id)}
                      disabled={isSavingEdit || !editDraft.trim()}
                      className="p-2 rounded-lg hover:bg-green-50 text-green-600"
                      aria-label="Save"
                    >
                      <FiCheck className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-2 rounded-lg hover:bg-surface-tertiary text-gray-500"
                      aria-label="Cancel"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{client.name}</p>
                      {!client.active && (
                        <p className="text-xs text-gray-400">Inactive — hidden from operators</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEdit(client)}
                        className="p-2 rounded-lg hover:bg-surface-tertiary text-gray-500"
                        aria-label="Edit client name"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggle(client)}
                        className="p-2 rounded-lg hover:bg-surface-tertiary text-gray-500"
                        aria-label={client.active ? "Deactivate" : "Activate"}
                      >
                        {client.active
                          ? <FiToggleRight className="w-6 h-6 text-success" />
                          : <FiToggleLeft className="w-6 h-6" />
                        }
                      </button>
                      <button
                        onClick={() => handleDeleteRequest(client.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-400"
                        aria-label="Delete client"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-card-elevated p-6 space-y-4">
            <h2 className="font-bold text-gray-900">Delete Client?</h2>
            <p className="text-sm text-gray-600">
              This client has no operations and will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="btn btn-secondary flex-1"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="btn flex-1 bg-red-600 text-white hover:bg-red-700"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
