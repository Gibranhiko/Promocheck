import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { FiArrowLeft, FiPlus, FiTrash2, FiCalendar, FiUser, FiChevronUp, FiChevronDown } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import {
  fetchRoute,
  fetchRouteStores,
  addStoreToRoute,
  removeStoreFromRoute,
  reorderRouteStore,
  checkPromoterRouteConflict,
  reassignRoute,
} from "@/features/routes/services/routeService"
import { generateVisitPlans } from "@/features/routes/services/visitPlanService"
import { fetchActiveStores } from "@/features/admin/services/storeService"
import { fetchAllUsers } from "@/features/admin/services/adminService"
import { useToast } from "@/shared/store/toastStore"
import { ADMIN_NAV } from "@/shared/constants/navItems"
import { VISIT_FREQUENCY_LABELS } from "@/types/Store"
import type { Route, RouteStore, VisitFrequency } from "@/types/Route"
import type { Store } from "@/types/Store"
import type { AppUser } from "@/features/admin/services/adminService"

export function AdminRouteDetailPage() {
  const { routeId } = useParams<{ routeId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [route, setRoute] = useState<Route | null>(null)
  const [routeStores, setRouteStores] = useState<RouteStore[]>([])
  const [allStores, setAllStores] = useState<Store[]>([])
  const [promoters, setPromoters] = useState<AppUser[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Add store form
  const [addStoreId, setAddStoreId] = useState("")
  const [addFreq, setAddFreq] = useState<VisitFrequency>("weekly")
  const [isAdding, setIsAdding] = useState(false)

  // Generate plans
  const [isGenerating, setIsGenerating] = useState(false)

  // Reassign modal
  const [showReassign, setShowReassign] = useState(false)
  const [newPromoterId, setNewPromoterId] = useState("")
  const [isReassigning, setIsReassigning] = useState(false)
  const [conflictWarning, setConflictWarning] = useState(false)

  // Reorder

  const load = useCallback(async () => {
    if (!routeId) return
    setIsLoading(true)
    try {
      const [r, rs, stores, users] = await Promise.all([
        fetchRoute(routeId),
        fetchRouteStores(routeId),
        fetchActiveStores(),
        fetchAllUsers(),
      ])
      setRoute(r)
      setRouteStores(rs)
      setAllStores(stores)
      setPromoters(users.filter((u) => u.role === "operator" && u.active !== false))
    } catch {
      toast.error("Error al cargar ruta")
    } finally {
      setIsLoading(false)
    }
  }, [routeId, toast])

  useEffect(() => { load() }, [load])

  const storeMap = new Map(allStores.map((s) => [s.id, s]))
  const assignedIds = new Set(routeStores.map((rs) => rs.storeId))
  const availableStores = allStores.filter((s) => !assignedIds.has(s.id))

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!routeId || !addStoreId) return
    setIsAdding(true)
    try {
      const rs = await addStoreToRoute(routeId, addStoreId, routeStores.length, addFreq)
      setRouteStores((prev) => [...prev, rs])
      setAddStoreId("")
      setAddFreq("weekly")
    } catch {
      toast.error("Error al agregar tienda")
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveStore = async (rs: RouteStore) => {
    try {
      await removeStoreFromRoute(rs.id)
      setRouteStores((prev) => prev.filter((r) => r.id !== rs.id))
    } catch {
      toast.error("Error al eliminar tienda")
    }
  }

  const handleMove = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= routeStores.length) return
    const reordered = [...routeStores]
    ;[reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]]
    const updated = reordered.map((rs, i) => ({ ...rs, order: i }))
    setRouteStores(updated)
    await Promise.all(updated.map((rs) => reorderRouteStore(rs.id, rs.order)))
  }

  const handleGeneratePlans = async () => {
    if (!routeId) return
    setIsGenerating(true)
    try {
      const nextMonday = new Date()
      const day = nextMonday.getDay()
      const daysUntilMonday = day === 0 ? 1 : 8 - day
      nextMonday.setDate(nextMonday.getDate() + daysUntilMonday)
      nextMonday.setHours(0, 0, 0, 0)
      const plans = await generateVisitPlans(routeId, nextMonday)
      toast.success(`${plans.length} plan${plans.length !== 1 ? "es" : ""} generado${plans.length !== 1 ? "s" : ""} para la semana siguiente`)
    } catch {
      toast.error("Error al generar planes")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleReassignCheck = async () => {
    if (!routeId || !newPromoterId) return
    const hasConflict = await checkPromoterRouteConflict(newPromoterId, routeId)
    setConflictWarning(hasConflict)
  }

  const handleReassign = async () => {
    if (!routeId || !newPromoterId) return
    setIsReassigning(true)
    try {
      const promoter = promoters.find((p) => p.uid === newPromoterId)
      await reassignRoute(routeId, newPromoterId, promoter?.name ?? "")
      setRoute((r) => r ? { ...r, promoterId: newPromoterId, promoterName: promoter?.name ?? "" } : r)
      setShowReassign(false)
      setNewPromoterId("")
      setConflictWarning(false)
      toast.success("Ruta reasignada")
    } catch {
      toast.error("Error al reasignar ruta")
    } finally {
      setIsReassigning(false)
    }
  }

  return (
    <AppShell
      title={route?.name ?? "Ruta"}
      navItems={ADMIN_NAV}
      headerRight={
        <button onClick={() => navigate("/admin/routes")} className="btn btn-secondary text-sm">
          <FiArrowLeft className="w-4 h-4" /> Rutas
        </button>
      }
    >
      <div className="space-y-4">
        {isLoading ? (
          <SkeletonList count={4} />
        ) : (
          <>
            {/* Route info card */}
            {route && (
              <div className="card bg-surface-secondary p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-1.5">
                    <FiUser className="w-4 h-4" />
                    <span className="font-medium text-gray-900">{route.promoterName}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{routeStores.length} tienda{routeStores.length !== 1 ? "s" : ""} en la ruta</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleGeneratePlans}
                    disabled={isGenerating || routeStores.length === 0}
                    className="btn btn-secondary text-xs"
                  >
                    <FiCalendar className="w-3.5 h-3.5" />
                    {isGenerating ? "Generando…" : "Generar planes"}
                  </button>
                  <button onClick={() => { setShowReassign(true); setNewPromoterId(route.promoterId) }} className="btn btn-secondary text-xs">
                    <FiUser className="w-3.5 h-3.5" /> Reasignar
                  </button>
                </div>
              </div>
            )}

            {/* Store list (drag to reorder) */}
            {routeStores.length === 0 ? (
              <EmptyState icon="🏪" title="Sin tiendas" description="Agrega tiendas a esta ruta para generar planes de visita." />
            ) : (
              <div className="space-y-2">
                {routeStores.map((rs, index) => {
                  const store = storeMap.get(rs.storeId)
                  return (
                    <div
                      key={rs.id}
                      className="card flex items-center gap-3"
                    >
                      <span className="text-gray-300 text-sm font-medium w-5 text-center flex-shrink-0">{rs.order + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{store?.name ?? rs.storeId}</p>
                        <p className="text-xs text-gray-500">{VISIT_FREQUENCY_LABELS[rs.visitFrequency]}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleMove(index, "up")}
                          disabled={index === 0}
                          className="p-2 rounded-lg hover:bg-surface-tertiary text-gray-400 disabled:opacity-20 touch-target"
                          aria-label="Subir"
                        >
                          <FiChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMove(index, "down")}
                          disabled={index === routeStores.length - 1}
                          className="p-2 rounded-lg hover:bg-surface-tertiary text-gray-400 disabled:opacity-20 touch-target"
                          aria-label="Bajar"
                        >
                          <FiChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveStore(rs)}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-400 touch-target"
                          aria-label="Eliminar tienda"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add store form */}
            {availableStores.length > 0 && (
              <form onSubmit={handleAddStore} className="card space-y-3">
                <h3 className="font-medium text-gray-900 text-sm">Agregar tienda</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={addStoreId}
                    onChange={(e) => setAddStoreId(e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">Selecciona una tienda…</option>
                    {availableStores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <select
                    value={addFreq}
                    onChange={(e) => setAddFreq(e.target.value as VisitFrequency)}
                    className="input text-sm"
                  >
                    {(Object.entries(VISIT_FREQUENCY_LABELS) as [VisitFrequency, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" disabled={isAdding || !addStoreId} className="btn btn-primary text-sm w-full">
                  <FiPlus className="w-4 h-4" /> {isAdding ? "Agregando…" : "Agregar tienda"}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Reassign modal */}
      {showReassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-card-elevated p-6 space-y-4">
            <h2 className="font-bold text-gray-900">Reasignar ruta</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva promotora</label>
              <select
                value={newPromoterId}
                onChange={(e) => { setNewPromoterId(e.target.value); setConflictWarning(false) }}
                onBlur={handleReassignCheck}
                className="input"
              >
                <option value="">Selecciona…</option>
                {promoters.map((p) => (
                  <option key={p.uid} value={p.uid}>{p.name}</option>
                ))}
              </select>
            </div>
            {conflictWarning && (
              <p className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                Esta promotora ya tiene otra ruta activa. Verifica posibles conflictos de tiendas o días.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setShowReassign(false); setConflictWarning(false) }} className="btn btn-secondary flex-1">Cancelar</button>
              <button onClick={handleReassign} disabled={isReassigning || !newPromoterId} className="btn btn-primary flex-1">
                {isReassigning ? "Reasignando…" : "Reasignar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
