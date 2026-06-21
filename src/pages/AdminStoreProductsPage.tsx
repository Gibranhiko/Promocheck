import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { FiArrowLeft, FiPackage } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import { fetchStore } from "@/features/admin/services/storeService"
import { fetchActiveProducts } from "@/features/stock/services/productService"
import {
  fetchStoreProducts,
  setStoreProduct,
  deactivateStoreProduct,
} from "@/features/stock/services/storeProductService"
import { useToast } from "@/shared/store/toastStore"
import { ADMIN_NAV } from "@/shared/constants/navItems"
import { PRODUCT_UNIT_LABELS } from "@/types/Product"
import type { Product } from "@/types/Product"
import type { StoreProduct } from "@/types/StoreProduct"
import type { Store } from "@/types/Store"

interface Assignment {
  storeProductId: string
  minThreshold: number
}

export function AdminStoreProductsPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [store, setStore] = useState<Store | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [assignments, setAssignments] = useState<Map<string, Assignment>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [thresholdDrafts, setThresholdDrafts] = useState<Map<string, number>>(new Map())

  const load = useCallback(async () => {
    if (!storeId) return
    setIsLoading(true)
    try {
      const [storeData, allProducts, storeProducts] = await Promise.all([
        fetchStore(storeId),
        fetchActiveProducts(),
        fetchStoreProducts(storeId),
      ])
      setStore(storeData)
      setProducts(allProducts)

      const map = new Map<string, Assignment>()
      for (const sp of storeProducts) {
        map.set(sp.productId, { storeProductId: sp.id, minThreshold: sp.minThreshold })
      }
      setAssignments(map)

      const drafts = new Map<string, number>()
      for (const sp of storeProducts) {
        drafts.set(sp.productId, sp.minThreshold)
      }
      setThresholdDrafts(drafts)
    } catch {
      toast.error("Error al cargar datos")
    } finally {
      setIsLoading(false)
    }
  }, [storeId, toast])

  useEffect(() => {
    load()
  }, [load])

  const toggleProduct = async (product: Product) => {
    if (!storeId) return
    const assigned = assignments.get(product.id)

    setSavingIds((prev) => new Set(prev).add(product.id))
    try {
      if (assigned) {
        await deactivateStoreProduct(assigned.storeProductId)
        setAssignments((prev) => {
          const next = new Map(prev)
          next.delete(product.id)
          return next
        })
      } else {
        const threshold = thresholdDrafts.get(product.id) ?? product.defaultMinThreshold
        const sp: StoreProduct = await setStoreProduct(storeId, product.id, threshold)
        setAssignments((prev) =>
          new Map(prev).set(product.id, { storeProductId: sp.id, minThreshold: sp.minThreshold })
        )
        setThresholdDrafts((prev) => new Map(prev).set(product.id, sp.minThreshold))
      }
    } catch {
      toast.error("Error al actualizar asignación")
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }
  }

  const updateThreshold = async (product: Product, value: number) => {
    if (!storeId) return
    const assigned = assignments.get(product.id)
    if (!assigned) return

    setThresholdDrafts((prev) => new Map(prev).set(product.id, value))
    setSavingIds((prev) => new Set(prev).add(product.id))
    try {
      const sp: StoreProduct = await setStoreProduct(storeId, product.id, value)
      setAssignments((prev) =>
        new Map(prev).set(product.id, { storeProductId: sp.id, minThreshold: sp.minThreshold })
      )
    } catch {
      toast.error("Error al actualizar umbral")
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }
  }

  const assignedCount = assignments.size

  return (
    <AppShell
      title={store ? `${store.name} — Productos` : "Productos de tienda"}
      navItems={ADMIN_NAV}
      headerRight={
        <button
          onClick={() => navigate("/admin/stores")}
          className="btn btn-secondary text-sm"
        >
          <FiArrowLeft className="w-4 h-4" />
          Tiendas
        </button>
      }
    >
      <div className="space-y-4">
        {store && (
          <div className="card bg-surface-secondary p-3">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">{store.name}</span>
              {" · "}
              <span>{assignedCount} producto{assignedCount !== 1 ? "s" : ""} asignado{assignedCount !== 1 ? "s" : ""}</span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Activa los productos que la promotora contará en cada visita a esta tienda.
            </p>
          </div>
        )}

        {isLoading ? (
          <SkeletonList count={5} />
        ) : products.length === 0 ? (
          <EmptyState
            icon="📦"
            title="Sin productos en el catálogo"
            description="Crea productos en la sección Productos antes de asignarlos a tiendas."
            action={
              <button className="btn btn-primary" onClick={() => navigate("/admin/products")}>
                <FiPackage className="w-4 h-4" /> Ir a Productos
              </button>
            }
          />
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Unidad</th>
                  <th className="px-4 py-3 font-medium w-28">Mínimo</th>
                  <th className="px-4 py-3 font-medium text-center w-20">Activo</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const assigned = assignments.get(product.id)
                  const isAssigned = !!assigned
                  const isSaving = savingIds.has(product.id)
                  const threshold = thresholdDrafts.get(product.id) ?? product.defaultMinThreshold

                  return (
                    <tr
                      key={product.id}
                      className={`border-b last:border-b-0 transition-opacity ${
                        !isAssigned ? "opacity-60" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{product.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {PRODUCT_UNIT_LABELS[product.unit]}
                      </td>
                      <td className="px-4 py-3">
                        {isAssigned ? (
                          <input
                            type="number"
                            min={0}
                            value={threshold}
                            disabled={isSaving}
                            onChange={(e) =>
                              updateThreshold(product, Math.max(0, parseInt(e.target.value) || 0))
                            }
                            className="input py-1 text-sm w-20"
                          />
                        ) : (
                          <span className="text-gray-400 text-xs">
                            {product.defaultMinThreshold} (def.)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleProduct(product)}
                          disabled={isSaving}
                          className={`w-10 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500 ${
                            isAssigned ? "bg-brand-600" : "bg-gray-300"
                          } ${isSaving ? "opacity-50" : ""}`}
                          aria-label={isAssigned ? "Desactivar producto" : "Activar producto"}
                        >
                          <span
                            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                              isAssigned ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}
