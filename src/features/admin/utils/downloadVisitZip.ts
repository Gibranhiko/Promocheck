import JSZip from "jszip"
import { Capacitor } from "@capacitor/core"
import { Filesystem, Directory } from "@capacitor/filesystem"
import { Share } from "@capacitor/share"
import type { Visit } from "@/types/Visit"
import type { PhotoCategory } from "@/types/PhotoCategory"
import { PHOTO_CATEGORY_LABELS } from "@/types/PhotoCategory"

export async function downloadVisitZip(visit: Visit): Promise<void> {
  const photos = visit.photos ?? {}
  const entries = Object.entries(photos) as [PhotoCategory, { url: string; capturedAt: number }[]][]

  if (entries.length === 0) throw new Error("Sin fotos para descargar")

  const zip = new JSZip()

  const allDownloads = entries.flatMap(([category, records]) =>
    records.map(async (record, idx) => {
      const response = await fetch(record.url)
      if (!response.ok) throw new Error(`Error al descargar ${category} ${idx + 1}: ${response.status}`)
      const blob = await response.blob()
      const folder = zip.folder(PHOTO_CATEGORY_LABELS[category])!
      folder.file(`${category}_${idx + 1}.jpg`, blob)
    })
  )

  const results = await Promise.allSettled(allDownloads)
  const failed = results.filter((r) => r.status === "rejected")
  if (failed.length === results.length) {
    throw new Error("Todas las descargas fallaron. Revisa la configuración CORS de Firebase Storage.")
  }

  const date = new Date(visit.visitDate).toISOString().slice(0, 10)
  const zipName = `${visit.storeName.replace(/\s+/g, "_")}_${date}.zip`

  if (Capacitor.isNativePlatform()) {
    const base64 = await zip.generateAsync({ type: "base64" })
    const { uri } = await Filesystem.writeFile({
      path: zipName,
      data: base64,
      directory: Directory.Cache,
    })
    await Share.share({ title: zipName, files: [uri], dialogTitle: "Guardar o compartir fotos ZIP" })
  } else {
    const content = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(content)
    const a = document.createElement("a")
    a.href = url
    a.download = zipName
    a.click()
    URL.revokeObjectURL(url)
  }
}
