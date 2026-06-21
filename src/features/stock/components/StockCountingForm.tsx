import { useState, useEffect, useCallback } from "react"
import { loadStoreProducts } from "@/features/stock/hooks/useStock"
import type { StockCountEntry } from "@/features/stock/hooks/useStock"

interface Props {
  storeId: string
  onCountsChange: (counts: StockCountEntry[]) => void
  onProductsLoaded?: (count: number) => void
}

export function StockCountingForm({ storeId, onCountsChange, onProductsLoaded }: Props) {
  const [counts, setCounts] = useState<StockCountEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const sps = await loadStoreProducts(storeId)
      const initial: StockCountEntry[] = sps.map((sp) => ({
        productId: sp.productId,
        productName: sp.product.name,
        shelfQty: 0,
        backroomQty: 0,
        minThreshold: sp.minThreshold,
      }))
      setCounts(initial)
      onCountsChange(initial)
      onProductsLoaded?.(initial.length)
    } catch {
      onProductsLoaded?.(0)
    } finally {
      setIsLoading(false)
    }
  }, [storeId, onCountsChange, onProductsLoaded])

  useEffect(() => {
    load()
  }, [load])

  const updateCount = (index: number, field: "shelfQty" | "backroomQty", value: number) => {
    setCounts((prev) => {
      const next = prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
      onCountsChange(next)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="py-4 text-center text-sm text-gray-400 animate-pulse">
        Cargando productos…
      </div>
    )
  }

  if (counts.length === 0) return null

  return (
    <div className="space-y-3">
      {counts.map((count, index) => {
        const total = count.shelfQty + count.backroomQty
        const isBelowMin = total < count.minThreshold

        return (
          <div
            key={count.productId}
            className={`rounded-xl border p-3 space-y-2 ${
              isBelowMin ? "border-red-200 bg-red-50/40" : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm text-gray-900">{count.productName}</p>
              <div className="flex items-center gap-1.5 text-xs">
                <span className={`font-semibold ${isBelowMin ? "text-red-600" : "text-gray-700"}`}>
                  Total: {total}
                </span>
                {isBelowMin && (
                  <span className="text-red-500 font-medium">
                    (mín {count.minThreshold})
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estante</label>
                <input
                  type="number"
                  min={0}
                  value={count.shelfQty}
                  onChange={(e) =>
                    updateCount(index, "shelfQty", Math.max(0, parseInt(e.target.value) || 0))
                  }
                  className="input py-2 text-center text-base font-semibold"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bodega</label>
                <input
                  type="number"
                  min={0}
                  value={count.backroomQty}
                  onChange={(e) =>
                    updateCount(index, "backroomQty", Math.max(0, parseInt(e.target.value) || 0))
                  }
                  className="input py-2 text-center text-base font-semibold"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
