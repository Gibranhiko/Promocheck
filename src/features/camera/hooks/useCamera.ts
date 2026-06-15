import { useRef, useState, useCallback, useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera"

export type CameraError =
  | "permission-denied"
  | "not-found"
  | "not-supported"
  | "capture-failed"

export interface CameraErrorDetail {
  type: CameraError
  raw: string
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  stream: MediaStream | null
  capturedBlob: Blob | null
  previewUrl: string | null
  error: CameraErrorDetail | null
  isActive: boolean
  isNative: boolean
  startCamera: () => Promise<void>
  stopCamera: () => void
  capturePhoto: () => void
  resetCapture: () => void
  // Native path: triggers capture directly (no stream/video element needed)
  captureNative: () => Promise<void>
}

const IS_NATIVE = Capacitor.isNativePlatform()

export function useCamera(): UseCameraReturn {
  const videoRef   = useRef<HTMLVideoElement | null>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const [stream, setStream]               = useState<MediaStream | null>(null)
  const [capturedBlob, setCapturedBlob]   = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl]       = useState<string | null>(null)
  const [error, setError]                 = useState<CameraErrorDetail | null>(null)
  // On native, "active" means ready to capture (no stream), not streaming
  const [nativeReady, setNativeReady]     = useState(IS_NATIVE)

  const isActive = IS_NATIVE
    ? nativeReady && capturedBlob === null
    : stream !== null && capturedBlob === null

  // ─── Web: assign srcObject after stream state settles ───────────────────────
  useEffect(() => {
    if (IS_NATIVE || !stream || !videoRef.current) return
    videoRef.current.srcObject = stream
    videoRef.current.play().catch((err) => {
      if (import.meta.env.DEV) console.warn("video.play() prevented:", err)
    })
  }, [stream])

  // ─── Web: stop stream ────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (IS_NATIVE) return // nothing to stop on native
    const video = videoRef.current
    if (video) {
      video.pause()
      video.srcObject = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStream(null)
  }, [])

  // ─── Web: start getUserMedia stream ─────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setError(null)

    if (IS_NATIVE) {
      // On native, request permissions up-front; actual capture is in captureNative()
      try {
        const perms = await Camera.requestPermissions({ permissions: ["camera"] })
        if (perms.camera === "denied") {
          setError({ type: "permission-denied", raw: "Camera permission denied by user" })
          setNativeReady(false)
        } else {
          setNativeReady(true)
        }
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err)
        setError({ type: "not-supported", raw })
        setNativeReady(false)
      }
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError({ type: "not-supported", raw: "navigator.mediaDevices.getUserMedia is not available" })
      return
    }

    try {
      let mediaStream: MediaStream
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 800 }, height: { ideal: 600 } },
          audio: false,
        })
      } catch {
        // Fallback: drop resolution constraints (needed on some Samsung devices)
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        })
      }
      streamRef.current = mediaStream
      setStream(mediaStream)
    } catch (err) {
      const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") setError({ type: "permission-denied", raw })
        else if (err.name === "NotFoundError") setError({ type: "not-found", raw })
        else setError({ type: "not-supported", raw })
      } else {
        setError({ type: "not-supported", raw })
      }
    }
  }, [])

  // ─── Native: open system camera and get blob ─────────────────────────────────
  const captureNative = useCallback(async () => {
    setError(null)
    try {
      const photo = await Camera.getPhoto({
        quality: 70,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        correctOrientation: true,
      })

      if (!photo.base64String) {
        setError({ type: "capture-failed", raw: "No base64 data returned from native camera" })
        return
      }

      const byteChars = atob(photo.base64String)
      const bytes = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
      const blob = new Blob([bytes], { type: "image/jpeg" })
      const url  = URL.createObjectURL(blob)

      setCapturedBlob(blob)
      setPreviewUrl(url)
      setNativeReady(false) // captured — no longer in "ready" state
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      // User cancelled — not an error we need to surface
      if (raw.toLowerCase().includes("cancel") || raw.toLowerCase().includes("dismissed")) return
      setError({ type: "capture-failed", raw })
    }
  }, [])

  // ─── Web: canvas capture from video element ──────────────────────────────────
  const capturePhoto = useCallback(() => {
    if (IS_NATIVE) return // native uses captureNative() instead

    if (!videoRef.current) {
      setError({ type: "capture-failed", raw: "videoRef.current is null at capture time" })
      return
    }
    const canvas = document.createElement("canvas")
    const MAX_WIDTH = 800
    const MAX_HEIGHT = 600
    const srcW = videoRef.current.videoWidth
    const srcH = videoRef.current.videoHeight
    const scale = Math.min(1, MAX_WIDTH / srcW, MAX_HEIGHT / srcH)
    canvas.width  = Math.round(srcW * scale)
    canvas.height = Math.round(srcH * scale)

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      setError({ type: "capture-failed", raw: "canvas.getContext('2d') returned null" })
      return
    }
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError({ type: "capture-failed", raw: "canvas.toBlob() returned null" })
          return
        }
        setCapturedBlob(blob)
        setPreviewUrl(URL.createObjectURL(blob))
        stopCamera()
      },
      "image/jpeg",
      0.4
    )
  }, [stopCamera])

  const resetCapture = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setCapturedBlob(null)
    setPreviewUrl(null)
    setError(null)
    if (IS_NATIVE) setNativeReady(true)
  }, [previewUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (!IS_NATIVE) {
        const video = videoRef.current
        if (video) { video.pause(); video.srcObject = null }
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    videoRef,
    stream,
    capturedBlob,
    previewUrl,
    error,
    isActive,
    isNative: IS_NATIVE,
    startCamera,
    stopCamera,
    capturePhoto,
    resetCapture,
    captureNative,
  }
}
