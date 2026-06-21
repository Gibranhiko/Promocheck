import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { FiDownload } from "react-icons/fi"
import { fetchActiveStores } from "@/features/admin/services/storeService"
import { fetchActiveProducts } from "@/features/stock/services/productService"
import { fetchAllActiveStoreProducts } from "@/features/stock/services/storeProductService"
import { fetchLatestSnapshotByStoreProduct } from "@/features/stock/services/stockSnapshotService"
import { calculateForecast } from "@/features/reports/services/forecastingService"
import { exportToCsv } from "@/features/reports/utils/exportCsv"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import type { Store } from "@/types/Store"
import type { Product } from "@/types/Product"
import type { StoreProduct } from "@/types/StoreProduct"
import type { StockSnapshot } from "@/types/StockSnapshot"
import type { ForecastResult } from "@/features/reports/services/forecastingService"

interface CellInfo {
  snapshot: StockSnapshot | null
  forecast: ForecastResult | null
  minThreshold: number
}

function cellColor(info: CellInfo): string {
  if (!info.snapshot) return "bg-red-100 text-red-700 border border-red-200"
  const days = info.forecast?.daysOfInventory
  if (days !== null && days !== undefined) {
    if (days >= 7) return "bg-green-100 text-green-700 border border-green-200"
    if (days >= 3) return "bg-yellow-100 text-yellow-700 border border-yellow-200"
    return "bg-red-100 text-red-700 border border-red-200"
  }
  // fall back to qty vs threshold
  if (info.snapshot.totalQty >= info.minThreshold) return "bg-green-100 text-green-700 border border-green-200"
  if (info.snapshot.totalQty > 0) return "bg-yellow-100 text-yellow-700 border border-yellow-200"
  return "bg-red-100 text-red-700 border border-red-200"
}

export function StockHealthReport() {
  const [stores, setStores] = useState<Store[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [cellMap, setCellMap] = useState<Map<string, CellInfo>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    Promise.all([fetchActiveStores(), fetchActiveProducts(), fetchAllActiveStoreProducts()])
      .then(async ([allStores, allProducts, allSP]: [Store[], Product[], StoreProduct[]]) => {
        if (cancelled) return
        setStores(allStores)
        setProducts(allProducts)

        const results = await Promise.all(
          allSP.map(async (sp) => {
            const [snapshot, forecast] = await Promise.all([
              fetchLatestSnapshotByStoreProduct(sp.storeId, sp.productId).catch(() => null),
              calculateForecast(sp.storeId, sp.productId, sp.minThreshold).catch(() => null),
            ])
            return { key: `${sp.storeId}::${sp.productId}`, snapshot, forecast, minThreshold: sp.minThreshold }
          })
        )

        if (cancelled) return
        const map = new Map<string, CellInfo>()
        for (const r of results) {
          map.set(r.key, { snapshot: r.snapshot, forecast: r.forecast, minThreshold: r.minThreshold })
        }
        setCellMap(map)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))

    return () => { cancelled = true }
  }, [])

  const handleExport = () => {
    const rows: Record<string, unknown>[] = []
    for (const store of stores) {
      for (const product of products) {
        const cell = cellMap.get(`${store.id}::${product.id}`)
        if (!cell) continue
        rows.push({
          Tienda: store.name,
          Producto: product.name,
          SKU: product.sku,
          "Stock Total": cell.snapshot?.totalQty ?? "—",
          "Stock Estante": cell.snapshot?.shelfQty ?? "—",
          "Stock Bodega": cell.snapshot?.backroomQty ?? "—",
          "Días Inventario": cell.forecast?.daysOfInventory ?? "—",
          "Consumo Diario": cell.forecast?.dailyConsumptionAvg ?? "—",
          "Umbral Mínimo": cell.minThreshold,
          "Última Captura": cell.snapshot
            ? new Date(cell.snapshot.capturedAt).toLocaleDateString("es-MX")
            : "—",
        })
      }
    }
    exportToCsv("stock_health.csv", rows)
  }

  if (isLoading) return <SkeletonList count={5} />

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={handleExport} className="btn btn-secondary text-sm">
          <FiDownload className="w-4 h-4" /> Exportar CSV
        </button>
      </div>
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[140px]">
                  Tienda
                </th>
                {products.map((p) => (
                  <th key={p.id} className="px-3 py-3 text-center font-medium text-gray-600 min-w-[90px]" title={p.name}>
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
                    <Link to={`/admin/stores/${store.id}/products`} className="font-medium text-gray-900 hover:text-brand-600 truncate block max-w-[130px]" title={store.name}>
                      {store.name}
                    </Link>
                  </td>
                  {products.map((product) => {
                    const cell = cellMap.get(`${store.id}::${product.id}`)
                    if (!cell) return <td key={product.id} className="px-3 py-2.5 text-center"><span className="text-gray-200">—</span></td>
                    const days = cell.forecast?.daysOfInventory
                    return (
                      <td key={product.id} className="px-2 py-2">
                        <div className={`rounded-lg px-2 py-1 text-center ${cellColor(cell)}`}>
                          <div className="font-semibold text-sm">{cell.snapshot?.totalQty ?? "0"}</div>
                          {days !== null && days !== undefined
                            ? <div className="text-[10px] opacity-80">{days}d</div>
                            : <div className="text-[10px] opacity-50">sin datos</div>
                          }
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
      <div className="flex gap-4 text-xs text-gray-500 px-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-200 border border-green-300" /> ≥ 7 días</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" /> 3–6 días</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> &lt; 3 días / sin datos</span>
      </div>
    </div>
  )
}
