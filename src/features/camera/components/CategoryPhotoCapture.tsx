import { useState, useEffect } from "react"
import { FiCamera, FiX, FiAlertCircle } from "react-icons/fi"
import { CameraCapture } from "./CameraCapture"
import type { PhotoCategory } from "@/types/PhotoCategory"
import { PHOTO_CATEGORY_LABELS } from "@/types/PhotoCategory"

interface CategoryPhotoCaptureProps {
  category: PhotoCategory
  required: boolean
  blobs: Blob[]
  onPhotosChange: (blobs: Blob[]) => void
}

export function CategoryPhotoCapture({
  category,
  required,
  blobs,
  onPhotosChange,
}: CategoryPhotoCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

  // Generate object URLs for thumbnail previews
  useEffect(() => {
    const urls = blobs.map((b) => URL.createObjectURL(b))
    setPreviewUrls(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [blobs])

  const handleCapture = (blob: Blob) => {
    onPhotosChange([...blobs, blob])
    setIsCapturing(false)
  }

  const handleDelete = (index: number) => {
    onPhotosChange(blobs.filter((_, i) => i !== index))
  }

  const isMissing = required && blobs.length === 0

  if (isCapturing) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between p-4 bg-black/80">
          <span className="text-white font-medium">
            {PHOTO_CATEGORY_LABELS[category]}
          </span>
          <button
            onClick={() => setIsCapturing(false)}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <CameraCapture
              onCapture={handleCapture}
              onCancel={() => setIsCapturing(false)}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border-2 p-4 transition-colors ${
      isMissing ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800">
            {PHOTO_CATEGORY_LABELS[category]}
          </span>
          {required && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              Requerida
            </span>
          )}
        </div>
        {isMissing && (
          <FiAlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        )}
      </div>

      {/* Thumbnail grid */}
      {previewUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {previewUrls.map((url, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
              <img
                src={url}
                alt={`${PHOTO_CATEGORY_LABELS[category]} ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => handleDelete(index)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <FiX className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add photo button */}
      <button
        onClick={() => setIsCapturing(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-primary hover:text-primary transition-colors"
      >
        <FiCamera className="w-4 h-4" />
        <span className="text-sm font-medium">
          {blobs.length === 0 ? "Agregar foto" : "Agregar otra foto"}
        </span>
      </button>

      {isMissing && (
        <p className="mt-2 text-xs text-red-500">
          Esta categoría requiere al menos una foto
        </p>
      )}
    </div>
  )
}
