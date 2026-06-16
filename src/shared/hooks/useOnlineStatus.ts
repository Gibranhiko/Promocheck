import { useEffect, useState, useCallback } from "react"
import { Capacitor } from "@capacitor/core"
import { App } from "@capacitor/app"
import {
  startBackgroundSync,
  stopBackgroundSync,
  registerBackgroundSync,
  runSyncEngine,
  type SyncResult,
} from "@/services/offline/syncEngine"
import { getPendingVisits } from "@/services/offline/db"
import { useToast } from "@/shared/store/toastStore"

interface OnlineStatusState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: number | null
  lastSyncResults: SyncResult[]
  backgroundSyncSupported: boolean
  uploadProgress: { uploaded: number; total: number } | null
  syncingVisitId: string | null
}

export function useOnlineStatus() {
  const toast = useToast()
  const [state, setState] = useState<OnlineStatusState>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    lastSyncResults: [],
    backgroundSyncSupported: false,
    uploadProgress: null,
    syncingVisitId: null,
  })

  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingVisits()
    setState((s) => ({ ...s, pendingCount: pending.length }))
  }, [])

  const sync = useCallback(async () => {
    if (!navigator.onLine || state.isSyncing) return

    setState((s) => ({ ...s, isSyncing: true, uploadProgress: null, syncingVisitId: null }))
    try {
      const results = await runSyncEngine(
        (uploaded, total) => {
          setState((s) => ({ ...s, uploadProgress: { uploaded, total } }))
        },
        (operationId) => {
          setState((s) => ({ ...s, syncingVisitId: operationId, uploadProgress: null }))
        }
      )
      setState((s) => ({
        ...s,
        isSyncing: false,
        uploadProgress: null,
        syncingVisitId: null,
        lastSyncAt: Date.now(),
        lastSyncResults: results,
      }))
      const failed = results.filter((r) => !r.success)
      if (failed.length > 0) {
        const reason = failed[0].error ?? "Unknown error"
        toast.error(`${failed.length} visita(s) no se pudieron sincronizar: ${reason}`)
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown error"
      toast.error(`Error de sincronización: ${reason}`)
      setState((s) => ({ ...s, isSyncing: false, uploadProgress: null, syncingVisitId: null }))
    }
    await refreshPendingCount()
  }, [state.isSyncing, refreshPendingCount, toast])

  useEffect(() => {
    refreshPendingCount()

    const handleOnline = async () => {
      setState((s) => ({ ...s, isOnline: true }))
      await sync()
    }

    const handleOffline = () => {
      setState((s) => ({ ...s, isOnline: false }))
    }

    const handleSyncMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_REQUESTED") {
        sync()
      }
    }

    startBackgroundSync()
    registerBackgroundSync().then((supported) => {
      setState((s) => ({ ...s, backgroundSyncSupported: supported }))
    })

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    navigator.serviceWorker?.addEventListener("message", handleSyncMessage)

    // On native (iOS/Android), SyncManager is unavailable. Trigger sync whenever
    // the app returns to the foreground and there is a network connection.
    let appListener: Awaited<ReturnType<typeof App.addListener>> | null = null
    if (Capacitor.isNativePlatform()) {
      App.addListener("appStateChange", ({ isActive: appIsActive }) => {
        if (appIsActive && navigator.onLine) {
          sync()
        }
      }).then((l) => { appListener = l })
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      navigator.serviceWorker?.removeEventListener("message", handleSyncMessage)
      stopBackgroundSync()
      appListener?.remove()
    }
  }, [sync, refreshPendingCount])

  return {
    ...state,
    sync,
    refreshPendingCount,
  }
}
