import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { FiPlus, FiEdit2, FiToggleLeft, FiToggleRight, FiMapPin } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import {
  fetchRoutes,
  createRoute,
  updateRoute,
  deactivateRoute,
  reactivateRoute,
} from "@/features/routes/services/routeService"
import { fetchAllUsers } from "@/features/admin/services/adminService"
import { useToast } from "@/shared/store/toastStore"
import { ADMIN_NAV } from "@/shared/constants/navItems"
import type { Route } from "@/types/Route"
import type { AppUser } from "@/features/admin/services/adminService"

interface RouteFormData {
  name: string
  promoterId: string
}

const EMPTY_FORM: RouteFormData = { name: "", promoterId: "" }

export function AdminRoutesPage() {
  const toast = useToast()
  const [routes, setRoutes] = useState<Route[]>([])
  const [promoters, setPromoters] = useState<AppUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRoute, setEditingRoute] = useState<Route | null>(null)
  const [formData, setFormData] = useState<RouteFormData>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [allRoutes, users] = await Promise.all([fetchRoutes(), fetchAllUsers()])
      setRoutes(allRoutes)
      setPromoters(users.filter((u) => u.role === "operator" && u.active !== false))
    } catch {
      toast.error("Error al cargar rutas")
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const promoterMap = new Map(promoters.map((p) => [p.uid, p.name]))

  const openCreate = () => {
    setEditingRoute(null)
    setFormData(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (route: Route) => {
    setEditingRoute(route)
    setFormData({ name: route.name, promoterId: route.promoterId })
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingRoute(null); setFormData(EMPTY_FORM) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.promoterId) return
    setIsSaving(true)
    const promoterName = promoterMap.get(formData.promoterId) ?? ""
    try {
      if (editingRoute) {
        await updateRoute(editingRoute.id, { name: formData.name, promoterId: formData.promoterId, promoterName })
        setRoutes((prev) => prev.map((r) => r.id === editingRoute.id ? { ...r, name: formData.name, promoterId: formData.promoterId, promoterName } : r))
        toast.success("Ruta actualizada")
      } else {
        const created = await createRoute({ name: formData.name, promoterId: formData.promoterId, promoterName })
        setRoutes((prev) => [created, ...prev])
        toast.success(`Ruta "${created.name}" creada`)
      }
      closeForm()
    } catch {
      toast.error("Error al guardar ruta")
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggle = async (route: Route) => {
    try {
      if (route.active) await deactivateRoute(route.id)
      else await reactivateRoute(route.id)
      setRoutes((prev) => prev.map((r) => r.id === route.id ? { ...r, active: !r.active } : r))
    } catch {
      toast.error("Error al actualizar ruta")
    }
  }

  return (
    <AppShell
      title="Rutas"
      navItems={ADMIN_NAV}
      headerRight={
        <button onClick={openCreate} className="btn btn-primary text-sm">
          <FiPlus className="w-4 h-4" /> Nueva ruta
        </button>
      }
    >
      <div className="space-y-3">
        {isLoading ? (
          <SkeletonList count={3} />
        ) : routes.length === 0 ? (
          <EmptyState
            icon="🗺️"
            title="Sin rutas aún"
            description="Crea rutas para planificar las visitas de tus promotoras."
            action={<button className="btn btn-primary" onClick={openCreate}><FiPlus className="w-4 h-4" /> Nueva ruta</button>}
          />
        ) : (
          routes.map((route) => (
            <div key={route.id} className={`card flex items-center gap-3 ${!route.active ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{route.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{route.promoterName}</p>
                {!route.active && <p className="text-xs text-gray-400">Inactiva</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Link
                  to={`/admin/routes/${route.id}`}
                  className="p-2 rounded-lg hover:bg-surface-tertiary text-gray-500 touch-target"
                  title="Ver tiendas"
                >
                  <FiMapPin className="w-4 h-4" />
                </Link>
                <button onClick={() => openEdit(route)} className="p-2 rounded-lg hover:bg-surface-tertiary text-gray-500 touch-target" aria-label="Editar">
                  <FiEdit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleToggle(route)} className="p-2 rounded-lg hover:bg-surface-tertiary text-gray-500 touch-target" aria-label={route.active ? "Desactivar" : "Activar"}>
                  {route.active ? <FiToggleRight className="w-6 h-6 text-success" /> : <FiToggleLeft className="w-6 h-6" />}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-card-elevated">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-bold text-gray-900">{editingRoute ? "Editar ruta" : "Nueva ruta"}</h2>
              <button onClick={closeForm} className="p-1 rounded-lg hover:bg-surface-tertiary">
                <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  className="input"
                  placeholder="ej. Zona Norte"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Promotora *</label>
                <select
                  value={formData.promoterId}
                  onChange={(e) => setFormData((f) => ({ ...f, promoterId: e.target.value }))}
                  className="input"
                >
                  <option value="">Selecciona una promotora…</option>
                  {promoters.map((p) => (
                    <option key={p.uid} value={p.uid}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeForm} className="btn btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={isSaving || !formData.name.trim() || !formData.promoterId} className="btn btn-primary flex-1">
                  {isSaving ? "Guardando…" : editingRoute ? "Guardar cambios" : "Crear ruta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
