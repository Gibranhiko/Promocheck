import { useState, useEffect, useCallback } from "react"
import { FiPlus, FiToggleLeft, FiToggleRight, FiEdit2, FiTrash2, FiCheck, FiX } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import {
  fetchAllStores,
  createStore,
  updateStore,
  deactivateStore,
  reactivateStore,
  storeHasVisits,
  deleteStore,
  type CreateStoreData,
} from "@/features/admin/services/storeService"
import { useToast } from "@/shared/store/toastStore"
import { ADMIN_NAV } from "@/shared/constants/navItems"
import type { Store, StoreType, VisitFrequency } from "@/types/Store"
import { STORE_TYPE_LABELS, VISIT_FREQUENCY_LABELS } from "@/types/Store"

const EMPTY_FORM: CreateStoreData = {
  name: "",
  storeType: "supermarket",
  visitFrequency: "weekly",
  address: "",
  chain: "",
  contactName: "",
  contactPhone: "",
}

export function AdminStoresPage() {
  const toast = useToast()
  const [stores, setStores] = useState<Store[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState<CreateStoreData>(EMPTY_FORM)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<CreateStoreData>(EMPTY_FORM)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadStores = useCallback(async () => {
    setIsLoading(true)
    try {
      setStores(await fetchAllStores())
    } catch {
      toast.error("Error al cargar tiendas")
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadStores()
  }, [loadStores])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    setIsAdding(true)
    try {
      const store = await createStore(formData)
      setStores((prev) => [...prev, store].sort((a, b) => a.name.localeCompare(b.name)))
      setFormData(EMPTY_FORM)
      setShowForm(false)
      toast.success(`Tienda "${store.name}" creada`)
    } catch {
      toast.error("Error al crear tienda")
    } finally {
      setIsAdding(false)
    }
  }

  const handleToggle = async (store: Store) => {
    try {
      if (store.active) {
        await deactivateStore(store.id)
      } else {
        await reactivateStore(store.id)
      }
      setStores((prev) =>
        prev.map((s) => (s.id === store.id ? { ...s, active: !s.active } : s))
      )
    } catch {
      toast.error("Error al actualizar tienda")
    }
  }

  const startEdit = (store: Store) => {
    setEditingId(store.id)
    setEditDraft({
      name: store.name,
      storeType: store.storeType,
      visitFrequency: store.visitFrequency,
      address: store.address ?? "",
      chain: store.chain ?? "",
      contactName: store.contactName ?? "",
      contactPhone: store.contactPhone ?? "",
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id: string) => {
    if (!editDraft.name.trim()) return
    setIsSavingEdit(true)
    try {
      await updateStore(id, editDraft)
      setStores((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, ...editDraft, address: editDraft.address ?? undefined, chain: editDraft.chain ?? undefined, contactName: editDraft.contactName ?? undefined, contactPhone: editDraft.contactPhone ?? undefined }
            : s
        )
      )
      setEditingId(null)
      toast.success("Tienda actualizada")
    } catch {
      toast.error("Error al actualizar tienda")
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteRequest = async (id: string) => {
    const hasVisits = await storeHasVisits(id)
    if (hasVisits) {
      toast.error("Esta tienda tiene visitas y no puede eliminarse. Desactívala en su lugar.")
      return
    }
    setConfirmDeleteId(id)
  }

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return
    setIsDeleting(true)
    try {
      await deleteStore(confirmDeleteId)
      setStores((prev) => prev.filter((s) => s.id !== confirmDeleteId))
      toast.success("Tienda eliminada")
    } catch {
      toast.error("Error al eliminar tienda")
    } finally {
      setIsDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  const StoreFormFields = ({ data, onChange }: {
    data: CreateStoreData
    onChange: (d: CreateStoreData) => void
  }) => (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          className="input"
          placeholder="ej. Walmart Monterrey"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
          <select
            value={data.storeType}
            onChange={(e) => onChange({ ...data, storeType: e.target.value as StoreType })}
            className="input"
          >
            {(Object.keys(STORE_TYPE_LABELS) as StoreType[]).map((k) => (
              <option key={k} value={k}>{STORE_TYPE_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia</label>
          <select
            value={data.visitFrequency}
            onChange={(e) => onChange({ ...data, visitFrequency: e.target.value as VisitFrequency })}
            className="input"
          >
            {(Object.keys(VISIT_FREQUENCY_LABELS) as VisitFrequency[]).map((k) => (
              <option key={k} value={k}>{VISIT_FREQUENCY_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
        <input
          type="text"
          value={data.address}
          onChange={(e) => onChange({ ...data, address: e.target.value })}
          className="input"
          placeholder="Opcional"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cadena</label>
          <input
            type="text"
            value={data.chain}
            onChange={(e) => onChange({ ...data, chain: e.target.value })}
            className="input"
            placeholder="ej. OXXO"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contacto</label>
          <input
            type="text"
            value={data.contactName}
            onChange={(e) => onChange({ ...data, contactName: e.target.value })}
            className="input"
            placeholder="Nombre"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono de contacto</label>
        <input
          type="tel"
          value={data.contactPhone}
          onChange={(e) => onChange({ ...data, contactPhone: e.target.value })}
          className="input"
          placeholder="Opcional"
        />
      </div>
    </div>
  )

  return (
    <AppShell
      title="Tiendas"
      navItems={ADMIN_NAV}
      headerRight={
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn btn-primary text-sm"
        >
          <FiPlus className="w-4 h-4" />
          Nueva tienda
        </button>
      }
    >
      <div className="space-y-4">
        {showForm && (
          <form onSubmit={handleAdd} className="card space-y-4">
            <h3 className="font-semibold text-gray-800">Nueva tienda</h3>
            <StoreFormFields data={formData} onChange={setFormData} />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isAdding || !formData.name.trim()}
                className="btn btn-primary flex-1"
              >
                {isAdding ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormData(EMPTY_FORM) }}
                className="btn btn-secondary flex-1"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <SkeletonList count={4} />
        ) : stores.length === 0 ? (
          <EmptyState
            icon="🏪"
            title="Sin tiendas aún"
            description="Agrega la primera tienda para que las promotoras puedan registrar visitas."
            action={
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                <FiPlus className="w-4 h-4" /> Nueva tienda
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {stores.map((store) => (
              <div
                key={store.id}
                className={`card ${!store.active ? "opacity-50" : ""}`}
              >
                {editingId === store.id ? (
                  <div className="space-y-4">
                    <StoreFormFields data={editDraft} onChange={setEditDraft} />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(store.id)}
                        disabled={isSavingEdit || !editDraft.name.trim()}
                        className="btn btn-primary flex-1 text-sm"
                      >
                        <FiCheck className="w-4 h-4" /> Guardar
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="btn btn-secondary flex-1 text-sm"
                      >
                        <FiX className="w-4 h-4" /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{store.name}</p>
                      <div className="flex gap-2 mt-1 flex-wrap text-xs text-gray-500">
                        <span>{STORE_TYPE_LABELS[store.storeType]}</span>
                        {store.chain && <span>· {store.chain}</span>}
                        <span>· {VISIT_FREQUENCY_LABELS[store.visitFrequency]}</span>
                        {store.address && <span>· {store.address}</span>}
                      </div>
                      {store.contactName && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Contacto: {store.contactName}
                          {store.contactPhone && ` — ${store.contactPhone}`}
                        </p>
                      )}
                      {!store.active && (
                        <p className="text-xs text-gray-400 mt-0.5">Inactiva</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEdit(store)}
                        className="p-2 rounded-lg hover:bg-surface-tertiary text-gray-500"
                        aria-label="Editar tienda"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggle(store)}
                        className="p-2 rounded-lg hover:bg-surface-tertiary text-gray-500"
                        aria-label={store.active ? "Desactivar" : "Activar"}
                      >
                        {store.active
                          ? <FiToggleRight className="w-6 h-6 text-success" />
                          : <FiToggleLeft className="w-6 h-6" />
                        }
                      </button>
                      <button
                        onClick={() => handleDeleteRequest(store.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-400"
                        aria-label="Eliminar tienda"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-card-elevated p-6 space-y-4">
            <h2 className="font-bold text-gray-900">¿Eliminar tienda?</h2>
            <p className="text-sm text-gray-600">
              Esta tienda no tiene visitas y será eliminada permanentemente. No se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
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
                {isDeleting ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
