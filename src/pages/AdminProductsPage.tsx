import { useState, useEffect, useCallback, useMemo } from "react"
import { FiPlus, FiSearch, FiEdit2, FiToggleLeft, FiToggleRight } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import {
  fetchAllProducts,
  createProduct,
  updateProduct,
  deactivateProduct,
  reactivateProduct,
} from "@/features/stock/services/productService"
import { useToast } from "@/shared/store/toastStore"
import { ADMIN_NAV } from "@/shared/constants/navItems"
import type { Product, ProductUnit } from "@/types/Product"
import { PRODUCT_UNIT_LABELS } from "@/types/Product"

interface ProductFormData {
  name: string
  sku: string
  unit: ProductUnit
  defaultMinThreshold: number
  active: boolean
}

const EMPTY_FORM: ProductFormData = {
  name: "",
  sku: "",
  unit: "unit",
  defaultMinThreshold: 0,
  active: true,
}

export function AdminProductsPage() {
  const toast = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState<ProductFormData>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const loadProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      setProducts(await fetchAllProducts())
    } catch {
      toast.error("Error al cargar productos")
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return products
    const q = searchQuery.toLowerCase()
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    )
  }, [products, searchQuery])

  const openCreate = () => {
    setEditingProduct(null)
    setFormData(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      defaultMinThreshold: product.defaultMinThreshold,
      active: product.active,
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingProduct(null)
    setFormData(EMPTY_FORM)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.sku.trim()) return
    setIsSaving(true)
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData)
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? { ...p, ...formData } : p))
        )
        toast.success("Producto actualizado")
      } else {
        const created = await createProduct(formData)
        setProducts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success(`Producto "${created.name}" creado`)
      }
      closeForm()
    } catch {
      toast.error("Error al guardar producto")
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggle = async (product: Product) => {
    try {
      if (product.active) {
        await deactivateProduct(product.id)
      } else {
        await reactivateProduct(product.id)
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, active: !p.active } : p))
      )
    } catch {
      toast.error("Error al actualizar producto")
    }
  }

  return (
    <AppShell
      title="Productos"
      navItems={ADMIN_NAV}
      headerRight={
        <button onClick={openCreate} className="btn btn-primary text-sm">
          <FiPlus className="w-4 h-4" />
          Nuevo producto
        </button>
      }
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 text-sm w-full"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <SkeletonList count={4} />
        ) : products.length === 0 ? (
          <EmptyState
            icon="📦"
            title="Sin productos aún"
            description="Agrega los productos que las promotoras contarán en cada visita."
            action={
              <button className="btn btn-primary" onClick={openCreate}>
                <FiPlus className="w-4 h-4" /> Nuevo producto
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon="🔍" title="Sin resultados" description="Intenta con otro nombre o SKU." />
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Unidad</th>
                  <th className="px-4 py-3 font-medium">Mín.</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr
                    key={product.id}
                    className={`border-b last:border-b-0 ${!product.active ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{product.sku}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {PRODUCT_UNIT_LABELS[product.unit]}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{product.defaultMinThreshold}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        product.active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {product.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(product)}
                          className="p-1.5 rounded-lg hover:bg-surface-tertiary text-gray-500"
                          aria-label="Editar"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(product)}
                          className="p-1.5 rounded-lg hover:bg-surface-tertiary text-gray-500"
                          aria-label={product.active ? "Desactivar" : "Activar"}
                        >
                          {product.active
                            ? <FiToggleRight className="w-5 h-5 text-success" />
                            : <FiToggleLeft className="w-5 h-5" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-card-elevated">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-bold text-gray-900">
                {editingProduct ? "Editar producto" : "Nuevo producto"}
              </h2>
              <button onClick={closeForm} className="p-1 rounded-lg hover:bg-surface-tertiary">
                <span className="sr-only">Cerrar</span>
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
                  placeholder="ej. Leche Entera 1L"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData((f) => ({ ...f, sku: e.target.value }))}
                    className="input font-mono"
                    placeholder="ej. LECH-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData((f) => ({ ...f, unit: e.target.value as ProductUnit }))}
                    className="input"
                  >
                    {(Object.keys(PRODUCT_UNIT_LABELS) as ProductUnit[]).map((u) => (
                      <option key={u} value={u}>{PRODUCT_UNIT_LABELS[u]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mínimo de stock por defecto
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.defaultMinThreshold}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, defaultMinThreshold: Math.max(0, parseInt(e.target.value) || 0) }))
                  }
                  className="input"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Cada tienda puede sobreescribir este valor.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeForm} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !formData.name.trim() || !formData.sku.trim()}
                  className="btn btn-primary flex-1"
                >
                  {isSaving ? "Guardando…" : editingProduct ? "Guardar cambios" : "Crear producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
