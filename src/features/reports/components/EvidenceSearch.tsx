import { useState } from "react"
import { FiSearch, FiX, FiDownload } from "react-icons/fi"
import { fetchVisitsFiltered } from "@/features/visits/services/visitService"
import { fetchActiveStores } from "@/features/admin/services/storeService"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import { ALL_PHOTO_CATEGORIES, PHOTO_CATEGORY_LABELS } from "@/types/PhotoCategory"
import type { PhotoCategory, PhotoRecord } from "@/types/PhotoCategory"
import type { Visit } from "@/types/Visit"
import type { Store } from "@/types/Store"
import { useEffect } from "react"

interface PhotoItem {
  url: string
  capturedAt: number
  category: PhotoCategory
  visit: Visit
}

interface LightboxItem extends PhotoItem {
  storeName: string
}

export function EvidenceSearch() {
  const [stores, setStores] = useState<Store[]>([])
  const [storeId, setStoreId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<PhotoCategory[]>([...ALL_PHOTO_CATEGORIES])
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null)

  useEffect(() => {
    fetchActiveStores().then(setStores).catch(() => {})
  }, [])

  const toggleCategory = (cat: PhotoCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const handleSearch = async () => {
    setIsLoading(true)
    setHasSearched(true)
    try {
      const filters = {
        storeId: storeId || undefined,
        dateFrom: dateFrom ? new Date(dateFrom).getTime() : undefined,
        dateTo: dateTo ? new Date(dateTo + "T23:59:59").getTime() : undefined,
      }
      const { visits } = await fetchVisitsFiltered(filters)
      const items: PhotoItem[] = []
      for (const visit of visits) {
        for (const cat of selectedCategories) {
          const records = visit.photos?.[cat] as PhotoRecord[] | undefined
          if (!records) continue
          for (const record of records) {
            if (record?.url) {
              items.push({ url: record.url, capturedAt: record.capturedAt, category: cat, visit })
            }
          }
        }
      }
      setPhotos(items.sort((a, b) => b.capturedAt - a.capturedAt))
    } catch {
      // leave empty
    } finally {
      setIsLoading(false)
    }
  }

  const storeMap = new Map(stores.map((s) => [s.id, s.name]))

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tienda</label>
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="input text-sm">
              <option value="">Todas</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Categorías</label>
          <div className="flex gap-2 flex-wrap">
            {ALL_PHOTO_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  selectedCategories.includes(cat)
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
              >
                {PHOTO_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={isLoading || selectedCategories.length === 0}
          className="btn btn-primary w-full"
        >
          <FiSearch className="w-4 h-4" />
          {isLoading ? "Buscando…" : "Buscar evidencias"}
        </button>
      </div>

      {/* Results */}
      {isLoading ? (
        <SkeletonList count={3} />
      ) : hasSearched && photos.length === 0 ? (
        <EmptyState icon="🔍" title="Sin resultados" description="No se encontraron fotos con los filtros seleccionados." />
      ) : photos.length > 0 ? (
        <div>
          <p className="text-sm text-gray-500 mb-3">{photos.length} foto{photos.length !== 1 ? "s" : ""} encontrada{photos.length !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((item, i) => (
              <button
                key={i}
                onClick={() => setLightbox({ ...item, storeName: storeMap.get(item.visit.storeId) ?? item.visit.storeName })}
                className="aspect-square rounded-xl overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity"
              >
                <img src={item.url} alt={PHOTO_CATEGORY_LABELS[item.category]} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white"
            >
              <FiX className="w-6 h-6" />
            </button>
            <img src={lightbox.url} alt={PHOTO_CATEGORY_LABELS[lightbox.category]} className="w-full rounded-xl" />
            <div className="bg-black/60 text-white rounded-b-xl px-4 py-3 text-sm space-y-0.5">
              <p className="font-medium">{lightbox.storeName}</p>
              <p className="text-white/70">{PHOTO_CATEGORY_LABELS[lightbox.category]} · {lightbox.visit.promoterName}</p>
              <p className="text-white/60 text-xs">
                {new Date(lightbox.capturedAt).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
              <a
                href={lightbox.url}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-300 mt-1"
              >
                <FiDownload className="w-3 h-3" /> Descargar
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
