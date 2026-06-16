import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { FiSearch, FiRefreshCw, FiWifi, FiWifiOff, FiX } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { StatusBadge } from "@/shared/components/ui/StatusBadge"
import { SkeletonTableRow } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import { useOnlineStatus } from "@/shared/hooks"
import { useToast } from "@/shared/store/toastStore"
import {
  fetchVisitsPaginated,
  fetchVisitsFiltered,
  type VisitFilters,
} from "@/features/visits/services/visitService"
import { fetchActiveStores } from "@/features/admin/services/storeService"
import { formatDateTime } from "@/shared/utils"
import { ADMIN_NAV } from "@/shared/constants/navItems"
import { VISIT_TYPE_LABELS, VISIT_CONDITION_LABELS } from "@/types/VisitType"
import type { Visit } from "@/types"
import type { Store } from "@/types/Store"
import type { DocumentSnapshot } from "firebase/firestore"

const PAGE_SIZE = 20

export function AdminPage() {
  const navigate = useNavigate()
  const { isOnline, pendingCount, sync, isSyncing } = useOnlineStatus()
  const toast = useToast()

  const [visits, setVisits] = useState<Visit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextPage, setNextPage] = useState<DocumentSnapshot | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [promoterFilter, setPromoterFilter] = useState("")

  const [storeFilter, setStoreFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [stores, setStores] = useState<Store[]>([])

  const serverFilters: VisitFilters = {
    storeId: storeFilter || undefined,
    visitType: typeFilter || undefined,
    dateFrom: dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : undefined,
    dateTo: dateTo ? new Date(dateTo + "T23:59:59").getTime() : undefined,
  }
  const serverFiltersRef = useRef(serverFilters)

  useEffect(() => {
    fetchActiveStores().then(setStores).catch(() => {})
  }, [])

  const hasServerFilters = !!(storeFilter || typeFilter || dateFrom || dateTo)

  const fetchPage = useCallback(async (filters: VisitFilters, cursor?: DocumentSnapshot) => {
    const hasActive = !!(filters.storeId || filters.visitType || filters.dateFrom || filters.dateTo)
    if (hasActive) return fetchVisitsFiltered(filters, cursor)
    return fetchVisitsPaginated(cursor)
  }, [])

  const loadInitial = useCallback(async (filters: VisitFilters) => {
    setIsLoading(true)
    try {
      const { visits: vs, nextPage: next } = await fetchPage(filters)
      setVisits(vs)
      setNextPage(next)
      setHasMore(vs.length === PAGE_SIZE)
    } catch {
      toast.error("Error al cargar visitas")
      setVisits([])
    } finally {
      setIsLoading(false)
    }
  }, [fetchPage, toast])

  useEffect(() => {
    serverFiltersRef.current = serverFilters
    loadInitial(serverFilters)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeFilter, typeFilter, dateFrom, dateTo])

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !nextPage) return
    setIsLoadingMore(true)
    try {
      const { visits: vs, nextPage: next } = await fetchPage(serverFiltersRef.current, nextPage)
      setVisits((prev) => [...prev, ...vs])
      setNextPage(next)
      setHasMore(vs.length === PAGE_SIZE)
    } catch {
      // leave existing list intact
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, nextPage, fetchPage])

  const handleSync = async () => {
    await sync()
    await loadInitial(serverFiltersRef.current)
    toast.success("Sincronización completa")
  }

  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      const matchesSearch = !searchQuery ||
        v.storeName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || v.status === statusFilter
      const matchesPromoter = !promoterFilter ||
        v.promoterName.toLowerCase().includes(promoterFilter.toLowerCase())
      return matchesSearch && matchesStatus && matchesPromoter
    })
  }, [visits, searchQuery, statusFilter, promoterFilter])

  const clearAllFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setPromoterFilter("")
    setStoreFilter("")
    setTypeFilter("")
    setDateFrom("")
    setDateTo("")
  }

  const hasAnyFilter = searchQuery || statusFilter !== "all" || promoterFilter ||
    storeFilter || typeFilter || dateFrom || dateTo

  const storeName = stores.find((s) => s.id === storeFilter)?.name

  return (
    <AppShell title="Dashboard" navItems={ADMIN_NAV}>
      <div className="space-y-4">
        <div className="card">
          {/* Online status + sync */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {isOnline
                ? <FiWifi className="w-4 h-4 text-green-600" />
                : <FiWifiOff className="w-4 h-4 text-red-500" />
              }
              <span className="text-sm text-gray-600">{isOnline ? "En línea" : "Sin conexión"}</span>
              {pendingCount > 0 && (
                <span className="text-sm text-warning">{pendingCount} pendiente(s)</span>
              )}
            </div>
            <button
              onClick={handleSync}
              disabled={isSyncing || !isOnline}
              className="btn btn-secondary text-sm flex items-center gap-2"
            >
              <FiRefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Sincronizando…" : "Sincronizar"}
            </button>
          </div>

          {/* Filters */}
          <div className="space-y-3 mb-4">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[160px]">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar tienda…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-9 text-sm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input w-auto text-sm"
              >
                <option value="all">Todos los estados</option>
                <option value="pending_sync">Pendiente</option>
                <option value="synced">Sincronizada</option>
                <option value="approved">Aprobada</option>
                <option value="rejected">Rechazada</option>
                <option value="error">Error</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="input w-auto text-sm"
              >
                <option value="">Todos los tipos</option>
                <option value="routine">Rutina</option>
                <option value="audit">Auditoría</option>
                <option value="special_event">Evento especial</option>
              </select>
            </div>

            <div className="flex gap-2 flex-wrap">
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="input w-auto text-sm flex-1 min-w-[140px]"
              >
                <option value="">Todas las tiendas</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Nombre de promotora…"
                value={promoterFilter}
                onChange={(e) => setPromoterFilter(e.target.value)}
                className="input text-sm flex-1 min-w-[140px]"
              />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input w-auto text-sm"
                aria-label="Desde"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input w-auto text-sm"
                aria-label="Hasta"
              />
              {hasAnyFilter && (
                <button onClick={clearAllFilters} className="btn btn-secondary text-sm">
                  <FiX className="w-4 h-4" /> Limpiar
                </button>
              )}
            </div>

            {hasServerFilters && (
              <div className="flex gap-2 flex-wrap text-xs">
                {storeName && (
                  <span className="bg-primary-100 text-primary px-2 py-1 rounded-full">
                    Tienda: {storeName}
                  </span>
                )}
                {typeFilter && (
                  <span className="bg-primary-100 text-primary px-2 py-1 rounded-full capitalize">
                    Tipo: {VISIT_TYPE_LABELS[typeFilter as keyof typeof VISIT_TYPE_LABELS] ?? typeFilter}
                  </span>
                )}
                {(dateFrom || dateTo) && (
                  <span className="bg-primary-100 text-primary px-2 py-1 rounded-full">
                    {dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : dateFrom ? `Desde ${dateFrom}` : `Hasta ${dateTo}`}
                  </span>
                )}
                <span className="text-gray-400 italic">Filtrado desde Firestore</span>
              </div>
            )}
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">Tienda</th>
                    <th className="pb-3 font-medium">Tipo</th>
                    <th className="pb-3 font-medium">Promotora</th>
                    <th className="pb-3 font-medium">Condición</th>
                    <th className="pb-3 font-medium">Estado</th>
                    <th className="pb-3 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonTableRow key={i} cols={6} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredVisits.length === 0 ? (
            <EmptyState
              icon="🔍"
              title={hasAnyFilter ? "Sin resultados" : "Sin visitas aún"}
              description={hasAnyFilter ? "Ajusta los filtros." : undefined}
              action={hasAnyFilter
                ? <button className="btn btn-secondary" onClick={clearAllFilters}>Limpiar filtros</button>
                : undefined
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b">
                      <th className="pb-3 font-medium">Tienda</th>
                      <th className="pb-3 font-medium">Tipo</th>
                      <th className="pb-3 font-medium">Promotora</th>
                      <th className="pb-3 font-medium">Condición</th>
                      <th className="pb-3 font-medium">Estado</th>
                      <th className="pb-3 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisits.map((v) => (
                      <tr
                        key={v.id}
                        onClick={() => navigate(`/visit/${v.id}`)}
                        className={`border-b last:border-b-0 hover:bg-gray-50 cursor-pointer ${v.status === "rejected" ? "bg-red-50" : ""}`}
                      >
                        <td className="py-3 font-medium">{v.storeName}</td>
                        <td className="py-3 text-sm capitalize">
                          {VISIT_TYPE_LABELS[v.visitType] ?? v.visitType}
                        </td>
                        <td className="py-3 text-sm">{v.promoterName}</td>
                        <td className="py-3 text-sm">
                          {v.overallCondition
                            ? VISIT_CONDITION_LABELS[v.overallCondition]
                            : "—"
                          }
                        </td>
                        <td className="py-3"><StatusBadge status={v.status} /></td>
                        <td className="py-3 text-sm text-gray-500">{formatDateTime(v.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {filteredVisits.length} mostradas
                  {visits.length !== filteredVisits.length && ` (${visits.length} cargadas)`}
                  {hasMore && " · hay más"}
                </span>
                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="btn btn-secondary text-sm"
                  >
                    {isLoadingMore ? "Cargando…" : "Cargar más"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
