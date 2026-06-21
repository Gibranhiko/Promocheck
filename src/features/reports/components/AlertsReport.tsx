import { useState, useEffect, useCallback } from "react"
import { FiDownload, FiAlertCircle } from "react-icons/fi"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import {
  fetchStockAlerts,
  saveAlertThresholdDays,
  fetchAlertThresholdDays,
  DEFAULT_ALERT_THRESHOLD_DAYS,
} from "@/features/reports/services/alertService"
import { exportToCsv } from "@/features/reports/utils/exportCsv"
import { useToast } from "@/shared/store/toastStore"
import type { StockAlert } from "@/features/reports/services/alertService"

export function AlertsReport() {
  const toast = useToast()
  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [thresholdDays, setThresholdDays] = useState(DEFAULT_ALERT_THRESHOLD_DAYS)
  const [thresholdInput, setThresholdInput] = useState(String(DEFAULT_ALERT_THRESHOLD_DAYS))
  const [isSavingThreshold, setIsSavingThreshold] = useState(false)

  const load = useCallback(async (days?: number) => {
    setIsLoading(true)
    try {
      const [loaded, t] = await Promise.all([
        fetchStockAlerts(days),
        days !== undefined ? Promise.resolve(days) : fetchAlertThresholdDays(),
      ])
      setAlerts(loaded)
      setThresholdDays(t)
      setThresholdInput(String(t))
    } catch {
      toast.error("Error al cargar alertas")
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleThresholdSave = async () => {
    const days = parseInt(thresholdInput)
    if (isNaN(days) || days < 1) return
    setIsSavingThreshold(true)
    try {
      await saveAlertThresholdDays(days)
      await load(days)
      toast.success("Umbral actualizado")
    } catch {
      toast.error("Error al guardar umbral")
    } finally {
      setIsSavingThreshold(false)
    }
  }

  const handleExport = () => {
    exportToCsv("alertas_stock.csv", alerts.map((a) => ({
      Tienda: a.storeName,
      Producto: a.productName,
      "Stock Actual": a.currentStock,
      "Días Inventario": a.daysOfInventory,
      Urgencia: a.urgency === "critical" ? "Crítico" : "Advertencia",
      "Pedido Sugerido": a.suggestedOrderQty,
    })))
  }

  const critical = alerts.filter((a) => a.urgency === "critical")
  const warning = alerts.filter((a) => a.urgency === "warning")

  return (
    <div className="space-y-4">
      {/* Threshold config */}
      <div className="card flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-gray-700">Umbral de alerta:</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
            className="input w-20 py-1 text-sm"
          />
          <span className="text-sm text-gray-500">días</span>
          <button
            onClick={handleThresholdSave}
            disabled={isSavingThreshold || thresholdInput === String(thresholdDays)}
            className="btn btn-primary text-sm py-1"
          >
            {isSavingThreshold ? "Guardando…" : "Aplicar"}
          </button>
        </div>
        <span className="text-xs text-gray-400 ml-auto">
          Crítico &lt; {thresholdDays}d · Advertencia &lt; {Math.round(thresholdDays * 1.5)}d
        </span>
      </div>

      {isLoading ? (
        <SkeletonList count={4} />
      ) : alerts.length === 0 ? (
        <EmptyState icon="✅" title="Sin alertas" description={`Todo el stock tiene más de ${thresholdDays} días de inventario.`} />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-red-600">{critical.length} crítico{critical.length !== 1 ? "s" : ""}</span>
              {" · "}
              <span className="font-semibold text-yellow-600">{warning.length} advertencia{warning.length !== 1 ? "s" : ""}</span>
            </p>
            <button onClick={handleExport} className="btn btn-secondary text-sm">
              <FiDownload className="w-4 h-4" /> Exportar CSV
            </button>
          </div>

          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Tienda</th>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium text-center">Stock</th>
                  <th className="px-4 py-3 font-medium text-center">Días</th>
                  <th className="px-4 py-3 font-medium text-center">Urgencia</th>
                  <th className="px-4 py-3 font-medium text-center">Pedido sugerido</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={`${alert.storeId}_${alert.productId}`} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{alert.storeName}</td>
                    <td className="px-4 py-3 text-gray-600">{alert.productName}</td>
                    <td className="px-4 py-3 text-center text-gray-700 font-semibold">{alert.currentStock}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${alert.urgency === "critical" ? "text-red-600" : "text-yellow-600"}`}>
                        {alert.daysOfInventory}d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        alert.urgency === "critical"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        <FiAlertCircle className="w-3 h-3" />
                        {alert.urgency === "critical" ? "Crítico" : "Advertencia"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{alert.suggestedOrderQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
