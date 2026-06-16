import { useEffect } from "react"
import { FiCamera, FiRotateCcw, FiCheck, FiAlertCircle } from "react-icons/fi"
import { App } from "@capacitor/app"
import { useCamera } from "../hooks/useCamera"

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void
  onCancel?: () => void
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const {
    videoRef: externalVideoRef,
    startCamera,
    stopCamera,
    capturePhoto,
    captureNative,
    resetCapture,
    capturedBlob,
    previewUrl,
    error,
    isActive,
    isNative,
  } = useCamera()

  const videoRef = externalVideoRef as React.RefObject<HTMLVideoElement>

  useEffect(() => {
    startCamera()
    return () => { stopCamera() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCamera])

  // On Android (web path only): release camera when backgrounded, restart on resume.
  // Native path uses Camera.getPhoto() which is stateless — no stream to manage.
  useEffect(() => {
    if (isNative) return
    let listener: Awaited<ReturnType<typeof App.addListener>> | null = null
    App.addListener("appStateChange", ({ isActive: appIsActive }) => {
      if (!appIsActive) {
        stopCamera()
      } else {
        // Small delay lets Android Chrome release the hardware camera lock
        setTimeout(() => { startCamera() }, 300)
      }
    }).then((l) => { listener = l })
    return () => { listener?.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative])

  const handleConfirm = () => {
    if (capturedBlob) {
      onCapture(capturedBlob)
    }
  }

  const handleRetry = () => {
    resetCapture()
    if (!isNative) {
      // Small delay lets Android Chrome release the hardware camera lock
      setTimeout(() => { startCamera() }, 300)
    }
  }

  const handleCancel = () => {
    stopCamera()
    resetCapture()
    onCancel?.()
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 bg-gray-50 rounded-xl">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
          <FiAlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <div className="text-center">
          <p className="text-red-600 font-medium mb-1">
            {error.type === "permission-denied" && "Camera access denied"}
            {error.type === "not-found" && "No camera found"}
            {error.type === "not-supported" && "Camera not supported"}
            {error.type === "capture-failed" && "Failed to capture photo"}
          </p>
          <p className="text-gray-500 text-sm mb-2">
            Please check your camera permissions and try again.
          </p>
        </div>
        <div className="flex gap-3">
          {onCancel && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // ─── Native path: no video preview — just a "Take Photo" button ─────────────
  if (isNative) {
    return (
      <div className="flex flex-col gap-4">
        {previewUrl ? (
          <>
            <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden">
              <img
                src={previewUrl}
                alt="Captured preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <FiRotateCcw className="w-5 h-5" />
                Retake
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FiCheck className="w-5 h-5" />
                Use Photo
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 p-6 bg-gray-50 rounded-xl">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <FiCamera className="w-8 h-8 text-primary" />
            </div>
            <p className="text-gray-600 text-sm text-center">
              Tap the button below to open the camera.
            </p>
            <div className="flex gap-3 w-full">
              {onCancel && (
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={captureNative}
                disabled={!isActive}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiCamera className="w-5 h-5" />
                Take Photo
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Web path: video preview with canvas capture ─────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden">
        {!previewUrl ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {isActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-20 h-20 rounded-full border-4 border-white/50 flex items-center justify-center">
                  <FiCamera className="w-8 h-8 text-white/50" />
                </div>
              </div>
            )}
          </>
        ) : (
          <img
            src={previewUrl}
            alt="Captured preview"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="flex gap-3">
        {!previewUrl ? (
          <>
            {onCancel && (
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={capturePhoto}
              disabled={!isActive}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiCamera className="w-5 h-5" />
              Capture
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleRetry}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FiRotateCcw className="w-5 h-5" />
              Retake
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FiCheck className="w-5 h-5" />
              Use Photo
            </button>
          </>
        )}
      </div>
    </div>
  )
}
