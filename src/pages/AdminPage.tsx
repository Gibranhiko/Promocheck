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
  fetchOperationsPaginated,
  fetchOperationsFiltered,
  type OperationFilters,
} from "@/features/operations/services/operationService"
import { fetchActiveClients, type Client } from "@/features/admin/services/clientService"
import { formatDateTime } from "@/shared/utils"
import { ADMIN_NAV } from "@/shared/constants/navItems"
import type { Operation } from "@/types"
import type { DocumentSnapshot } from "firebase/firestore"

const PAGE_SIZE = 20

export function AdminPage() {
  const navigate = useNavigate()
  const { isOnline, pendingCount, sync, isSyncing } = useOnlineStatus()
  const toast = useToast()

  const [operations, setOperations] = useState<Operation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextPage, setNextPage] = useState<DocumentSnapshot | null>(null)

  // Client-side filters (applied to loaded results)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [operatorFilter, setOperatorFilter] = useState("")

  // Server-side filters (trigger a full reset + re-fetch when changed)
  const [clientFilter, setClientFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [clients, setClients] = useState<Client[]>([])

  // Track server filter values to detect changes
  const serverFilters: OperationFilters = {
    clientId: clientFilter || undefined,
    operationType: typeFilter || undefined,
    dateFrom: dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : undefined,
    dateTo: dateTo ? new Date(dateTo + "T23:59:59").getTime() : undefined,
  }
  const serverFiltersRef = useRef(serverFilters)

  useEffect(() => {
    fetchActiveClients().then(setClients).catch(() => {})
  }, [])

  const hasServerFilters = !!(clientFilter || typeFilter || dateFrom || dateTo)

  const fetchPage = useCallback(async (
    filters: OperationFilters,
    cursor?: DocumentSnapshot
  ) => {
    const hasActive = !!(filters.clientId || filters.operationType || filters.dateFrom || filters.dateTo)
    if (hasActive) {
      return fetchOperationsFiltered(filters, cursor)
    }
    return fetchOperationsPaginated(cursor)
  }, [])

  const loadInitial = useCallback(async (filters: OperationFilters) => {
    setIsLoading(true)
    try {
      const { operations: ops, nextPage: next } = await fetchPage(filters)
      setOperations(ops)
      setNextPage(next)
      setHasMore(ops.length === PAGE_SIZE)
    } catch {
      toast.error("Failed to load operations")
      setOperations([])
    } finally {
      setIsLoading(false)
    }
  }, [fetchPage, toast])

  // Re-fetch from scratch whenever server-side filters change
  useEffect(() => {
    serverFiltersRef.current = serverFilters
    loadInitial(serverFilters)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientFilter, typeFilter, dateFrom, dateTo])

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !nextPage) return
    setIsLoadingMore(true)
    try {
      const { operations: ops, nextPage: next } = await fetchPage(serverFiltersRef.current, nextPage)
      setOperations((prev) => [...prev, ...ops])
      setNextPage(next)
      setHasMore(ops.length === PAGE_SIZE)
    } catch {
      // leave existing list intact
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, nextPage, fetchPage])

  const handleSync = async () => {
    await sync()
    await loadInitial(serverFiltersRef.current)
    toast.success("Sync complete")
  }

  const filteredOperations = useMemo(() => {
    return operations.filter((op) => {
      const matchesSearch = !searchQuery ||
        op.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || op.status === statusFilter
      const matchesOperator = !operatorFilter ||
        op.operatorName.toLowerCase().includes(operatorFilter.toLowerCase())
      return matchesSearch && matchesStatus && matchesOperator
    })
  }, [operations, searchQuery, statusFilter, operatorFilter])

  const clearAllFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setOperatorFilter("")
    setClientFilter("")
    setTypeFilter("")
    setDateFrom("")
    setDateTo("")
  }

  const hasAnyFilter = searchQuery || statusFilter !== "all" || operatorFilter ||
    clientFilter || typeFilter || dateFrom || dateTo

  const clientName = clients.find((c) => c.id === clientFilter)?.name

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
              <span className="text-sm text-gray-600">{isOnline ? "Online" : "Offline"}</span>
              {pendingCount > 0 && (
                <span className="text-sm text-warning">{pendingCount} pending</span>
              )}
            </div>
            <button
              onClick={handleSync}
              disabled={isSyncing || !isOnline}
              className="btn btn-secondary text-sm flex items-center gap-2"
            >
              <FiRefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing…" : "Sync"}
            </button>
          </div>

          {/* Filters */}
          <div className="space-y-3 mb-4">
            {/* Row 1: search + status + type */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[160px]">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Order number…"
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
                <option value="all">All status</option>
                <option value="pending_sync">Pending</option>
                <option value="synced">Synced</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="error">Error</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="input w-auto text-sm"
              >
                <option value="">All types</option>
                <option value="load">Load</option>
                <option value="unload">Unload</option>
              </select>
            </div>

            {/* Row 2: client + operator + date range */}
            <div className="flex gap-2 flex-wrap">
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="input w-auto text-sm flex-1 min-w-[140px]"
              >
                <option value="">All clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Operator name…"
                value={operatorFilter}
                onChange={(e) => setOperatorFilter(e.target.value)}
                className="input text-sm flex-1 min-w-[140px]"
              />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input w-auto text-sm"
                aria-label="From date"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input w-auto text-sm"
                aria-label="To date"
              />
              {hasAnyFilter && (
                <button onClick={clearAllFilters} className="btn btn-secondary text-sm">
                  <FiX className="w-4 h-4" /> Clear
                </button>
              )}
            </div>

            {/* Active server-side filter chips */}
            {hasServerFilters && (
              <div className="flex gap-2 flex-wrap text-xs">
                {clientName && (
                  <span className="bg-primary-100 text-primary px-2 py-1 rounded-full">
                    Client: {clientName}
                  </span>
                )}
                {typeFilter && (
                  <span className="bg-primary-100 text-primary px-2 py-1 rounded-full capitalize">
                    Type: {typeFilter}
                  </span>
                )}
                {(dateFrom || dateTo) && (
                  <span className="bg-primary-100 text-primary px-2 py-1 rounded-full">
                    {dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : dateFrom ? `From ${dateFrom}` : `Until ${dateTo}`}
                  </span>
                )}
                <span className="text-gray-400 italic">Filtered from Firestore</span>
              </div>
            )}
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">Order #</th>
                    <th className="pb-3 font-medium">Client</th>
                    <th className="pb-3 font-medium">Door</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Operator</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonTableRow key={i} cols={7} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredOperations.length === 0 ? (
            <EmptyState
              icon="🔍"
              title={hasAnyFilter ? "No results found" : "No operations yet"}
              description={hasAnyFilter ? "Try adjusting your filters." : undefined}
              action={hasAnyFilter
                ? <button className="btn btn-secondary" onClick={clearAllFilters}>Clear filters</button>
                : undefined
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b">
                      <th className="pb-3 font-medium">Order #</th>
                      <th className="pb-3 font-medium">Client</th>
                      <th className="pb-3 font-medium">Door</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Operator</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOperations.map((op) => (
                      <tr
                        key={op.id}
                        onClick={() => navigate(`/operation/${op.id}`)}
                        className={`border-b last:border-b-0 hover:bg-gray-50 cursor-pointer ${op.status === "rejected" ? "bg-red-50" : ""}`}
                      >
                        <td className="py-3 font-medium">{op.orderNumber}</td>
                        <td className="py-3 text-sm text-gray-600">{op.clientName || "—"}</td>
                        <td className="py-3">{op.doorNumber}</td>
                        <td className="py-3 capitalize text-sm">{op.operationType}</td>
                        <td className="py-3 text-sm">{op.operatorName}</td>
                        <td className="py-3"><StatusBadge status={op.status} /></td>
                        <td className="py-3 text-sm text-gray-500">{formatDateTime(op.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {filteredOperations.length} shown
                  {operations.length !== filteredOperations.length && ` (${operations.length} loaded)`}
                  {hasMore && " · more available"}
                </span>
                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="btn btn-secondary text-sm"
                  >
                    {isLoadingMore ? "Loading…" : "Load more"}
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
