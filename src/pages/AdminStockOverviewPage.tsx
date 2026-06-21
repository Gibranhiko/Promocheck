import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { FiRefreshCw, FiPackage } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import { fetchActiveStores } from "@/features/admin/services/storeService"
import { fetchActiveProducts } from "@/features/stock/services/productService"
import { fetchAllActiveStoreProducts } from "@/features/stock/services/storeProductService"
import { fetchLatestSnapshotByStoreProduct } from "@/features/stock/services/stockSnapshotService"
import { useToast } from "@/shared/store/toastStore"
import { ADMIN_NAV } from "@/shared/constants/navItems"
import type { Store } from "@/types/Store"
import type { Product } from "@/types/Product"
import type { StoreProduct } from "@/types/StoreProduct"
import type { StockSnapshot } from "@/types/StockSnapshot"

type TrafficLight = "green" | "yellow" | "red" | "none" | "unassigned"

interface CellData {
  storeProduct: StoreProduct
  snapshot: StockSnapshot | null
  status: TrafficLight
}

function getStatus(sp: StoreProduct, snapshot: StockSnapshot | null): TrafficLight {
  if (!snapshot) return "red"
  if (snapshot.totalQty >= sp.minThreshold) return "green"
  if (snapshot.totalQty > 0) return "yellow"
  return "red"
}

const LIGHT_STYLES: Record<TrafficLight, string> = {
  green:      "bg-green-100 text-green-800 border border-green-200",
  yellow:     "bg-yellow-100 text-yellow-800 border border-yellow-200",
  red:        "bg-red-100 text-red-700 border border-red-200",
  none:       "bg-gray-50 text-gray-400 border border-dashed border-gray-200",
  unassigned: "bg-transparent",
}

const LIGHT_DOT: Record<TrafficLight, string> = {
  green:      "bg-green-500",
  yellow:     "bg-yellow-400",
  red:        "bg-red-500",
  none:       "bg-gray-300",
  unassigned: "hidden",
}

export function AdminStockOverviewPage() {
  const toast = useToast()
  const [stores, setStores] = useState<Store[]>([])
  const [products, setProducts] = useState<Product[]>([])
  // cell map: `${storeId}::${productId}` → CellData
  const [cellMap, setCellMap] = useState<Map<string, CellData>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [allStores, allProducts, allSP] = await Promise.all([
        fetchActiveStores(),
        fetchActiveProducts(),
        fetchAllActiveStoreProducts(),
      ])

      setStores(allStores)
      setProducts(allProducts)

      // Build per-(store,product) assignment map
      const spMap = new Map<string, StoreProduct>()
      for (const sp of allSP) {
        spMap.set(`${sp.storeId}::${sp.productId}`, sp)
      }

      // Fetch latest snapshots for all assigned pairs in parallel
      const snapshotResults = await Promise.all(
        allSP.map((sp) =>
          fetchLatestSnapshotByStoreProduct(sp.storeId, sp.productId)
            .then((snap) => ({ key: `${sp.storeId}::${sp.productId}`, sp, snap }))
            .catch(() => ({ key: `${sp.storeId}::${sp.productId}`, sp, snap: null }))
        )
      )

      const map = new Map<string, CellData>()
      for (const { key, sp, snap } of snapshotResults) {
        map.set(key, { storeProduct: sp, snapshot: snap, status: getStatus(sp, snap) })
      }
      setCellMap(map)
      setLastRefreshed(new Date())
    } catch {
      toast.error("Error al cargar datos de stock")
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  // Summary counts
  const totalCells = cellMap.size
  const redCount = [...cellMap.values()].filter((c) => c.status === "red").length
  const yellowCount = [...cellMap.values()].filter((c) => c.status === "yellow").length
  const greenCount = [...cellMap.values()].filter((c) => c.status === "green").length

  if (!isLoading && (stores.length === 0 || products.length === 0)) {
    return (
      <AppShell title="Stock" navItems={ADMIN_NAV}>
        <EmptyState
          icon="📊"
          title="Sin datos aún"
          description="Necesitas tiendas activas y productos en el catálogo para ver el panel de stock."
          action={
            <Link to="/admin/products" className="btn btn-primary">
              <FiPackage className="w-4 h-4" /> Ir a Productos
            </Link>
          }
        />
      </AppShell>
    )
  }

  return (
    <AppShell
      title="Panel de Stock"
      navItems={ADMIN_NAV}
      headerRight={
        <button onClick={load} disabled={isLoading} className="btn btn-secondary text-sm">
          <FiRefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      }
    >
      <div className="space-y-4">
        {/* Summary chips */}
        {!isLoading && totalCells > 0 && (
          <div className="flex gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {redCount} crítico{redCount !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              {yellowCount} bajo{yellowCount !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {greenCount} OK
            </span>
            {lastRefreshed && (
              <span className="text-xs text-gray-400 ml-auto self-center">
                Actualizado {lastRefreshed.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        )}

        {isLoading ? (
          <SkeletonList count={5} />
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[140px]">
                      Tienda
                    </th>
                    {products.map((p) => (
                      <th
                        key={p.id}
                        className="px-3 py-3 text-center font-medium text-gray-600 min-w-[90px]"
                        title={p.name}
                      >
                        <div className="truncate max-w-[80px] mx-auto text-xs">{p.name}</div>
                        <div className="text-gray-400 font-normal font-mono text-[10px]">{p.sku}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store) => (
                    <tr key={store.id} className="border-b last:border-b-0 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 sticky left-0 bg-white z-10 border-r">
                        <Link
                          to={`/admin/stores/${store.id}/products`}
                          className="font-medium text-gray-900 hover:text-brand-600 block truncate max-w-[130px]"
                          title={store.name}
                        >
                          {store.name}
                        </Link>
                        {store.chain && (
                          <span className="text-xs text-gray-400">{store.chain}</span>
                        )}
                      </td>
                      {products.map((product) => {
                        const key = `${store.id}::${product.id}`
                        const cell = cellMap.get(key)

                        if (!cell) {
                          return (
                            <td key={product.id} className="px-3 py-2.5 text-center">
                              <span className="text-gray-200">—</span>
                            </td>
                          )
                        }

                        const { snapshot, status } = cell
                        const qty = snapshot?.totalQty ?? null

                        return (
                          <td key={product.id} className="px-3 py-2.5 text-center">
                            <div
                              className={`inline-flex flex-col items-center justify-center rounded-lg px-2 py-1 min-w-[52px] ${LIGHT_STYLES[status]}`}
                            >
                              <div className="flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${LIGHT_DOT[status]}`} />
                                <span className="font-semibold text-sm">
                                  {qty !== null ? qty : "—"}
                                </span>
                              </div>
                              <span className="text-[10px] opacity-70">
                                min {cell.storeProduct.minThreshold}
                              </span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legend */}
        {!isLoading && (
          <div className="flex gap-4 text-xs text-gray-500 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-green-200 border border-green-300" /> OK (≥ mínimo)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" /> Bajo (0 &lt; qty &lt; mínimo)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Crítico (0 o sin datos)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-gray-200">—</span> No asignado
            </span>
          </div>
        )}
      </div>
    </AppShell>
  )
}
