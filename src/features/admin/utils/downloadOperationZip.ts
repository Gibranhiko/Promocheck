import JSZip from "jszip"
import { Capacitor } from "@capacitor/core"
import { Filesystem, Directory } from "@capacitor/filesystem"
import { Share } from "@capacitor/share"
import { isIncidentPhoto } from "@/types/PhotoType"
import type { Operation } from "@/types/Operation"

export async function downloadOperationZip(operation: Operation): Promise<void> {
  const photos = operation.photos
  const entries = Object.entries(photos) as [string, { url: string; capturedAt: number }][]

  if (entries.length === 0) throw new Error("No photos to download")

  const zip = new JSZip()
  const incidents = zip.folder("incidents")!

  const results = await Promise.allSettled(
    entries.map(async ([photoType, record]) => {
      const response = await fetch(record.url)
      if (!response.ok) throw new Error(`Failed to fetch ${photoType}: ${response.status}`)
      const blob = await response.blob()
      const filename = `${photoType}.jpg`
      if (isIncidentPhoto(photoType as any)) {
        incidents.file(filename, blob)
      } else {
        zip.file(filename, blob)
      }
    })
  )

  const failed = results.filter((r) => r.status === "rejected")
  if (failed.length === results.length) {
    throw new Error("All photo downloads failed. Check Firebase Storage CORS configuration.")
  }

  const date = new Date(operation.createdAt).toISOString().slice(0, 10)
  const zipName = `${operation.orderNumber}_${date}.zip`

  if (Capacitor.isNativePlatform()) {
    // On Android/iOS, blob URL anchor clicks are silently ignored by the WebView.
    // Write the ZIP to the cache directory then open the Android share sheet.
    const base64 = await zip.generateAsync({ type: "base64" })
    const { uri } = await Filesystem.writeFile({
      path: zipName,
      data: base64,
      directory: Directory.Cache,
    })
    // `files` is required for local file URIs on Android/iOS.
    // `url` is only for http/https web URLs and silently does nothing with file:// URIs.
    await Share.share({
      title: zipName,
      files: [uri],
      dialogTitle: "Save or share photos ZIP",
    })
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
