import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { FiSearch, FiRefreshCw, FiWifi, FiWifiOff, FiX, FiSliders } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { StatusBadge } from "@/shared/components/ui/StatusBadge"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
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
  const [showFilters, setShowFilters] = useState(false)

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

  const activeFilterCount = [
    statusFilter !== "all",
    !!promoterFilter,
    !!storeFilter,
    !!typeFilter,
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length

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
            <div className="flex gap-2">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar tienda…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-9 text-sm"
                />
              </div>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`btn text-sm flex items-center gap-1.5 flex-shrink-0 ${
                  activeFilterCount > 0
                    ? "bg-primary-50 text-primary border border-primary-200"
                    : "btn-secondary"
                }`}
              >
                <FiSliders className="w-4 h-4" />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="bg-primary text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {showFilters && (
              <div className="space-y-2 p-3 bg-surface-secondary rounded-xl border border-gray-100">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="input text-sm"
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
                    className="input text-sm"
                  >
                    <option value="">Todos los tipos</option>
                    <option value="routine">Rutina</option>
                    <option value="audit">Auditoría</option>
                    <option value="special_event">Evento especial</option>
                  </select>
                </div>
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="input text-sm w-full"
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
                  className="input text-sm w-full"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="input text-sm"
                    aria-label="Desde"
                  />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="input text-sm"
                    aria-label="Hasta"
                  />
                </div>
                {hasAnyFilter && (
                  <button onClick={clearAllFilters} className="btn btn-secondary text-sm w-full">
                    <FiX className="w-4 h-4" /> Limpiar filtros
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Results */}
          {isLoading ? (
            <SkeletonList count={6} />
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
              <div className="space-y-2">
                {filteredVisits.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => navigate(`/visit/${v.id}`)}
                    className={`card cursor-pointer active:bg-gray-50 ${
                      v.status === "rejected" ? "border-l-4 border-l-red-400" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900 truncate">{v.storeName}</p>
                      <StatusBadge status={v.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-gray-500">
                      <span>{v.promoterName}</span>
                      <span>·</span>
                      <span>{VISIT_TYPE_LABELS[v.visitType] ?? v.visitType}</span>
                      {v.overallCondition && (
                        <>
                          <span>·</span>
                          <span>{VISIT_CONDITION_LABELS[v.overallCondition]}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{formatDateTime(v.createdAt)}</span>
                    </div>
                  </div>
                ))}
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
