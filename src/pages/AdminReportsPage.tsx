import { useState } from "react"
import { AppShell } from "@/shared/components/layout/AppShell"
import { CoverageReport } from "@/features/reports/components/CoverageReport"
import { StockHealthReport } from "@/features/reports/components/StockHealthReport"
import { AlertsReport } from "@/features/reports/components/AlertsReport"
import { PromoterActivityReport } from "@/features/reports/components/PromoterActivityReport"
import { EvidenceSearch } from "@/features/reports/components/EvidenceSearch"
import { RouteComplianceReport } from "@/features/reports/components/RouteComplianceReport"
import { ADMIN_NAV } from "@/shared/constants/navItems"

type Tab = "coverage" | "stock" | "alerts" | "activity" | "evidence" | "routes"

const TABS: { id: Tab; label: string }[] = [
  { id: "coverage",  label: "Cobertura" },
  { id: "stock",     label: "Stock Health" },
  { id: "alerts",    label: "Alertas" },
  { id: "activity",  label: "Actividad" },
  { id: "routes",    label: "Rutas" },
  { id: "evidence",  label: "Evidencias" },
]

function todayMs(): number {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

function thirtyDaysAgoMs(): number {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function toDateValue(ms: number): string {
  return new Date(ms).toISOString().split("T")[0]
}

function fromDateValue(value: string, endOfDay = false): number {
  const d = new Date(value)
  if (endOfDay) d.setHours(23, 59, 59, 999)
  else d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("coverage")
  const [dateFromStr, setDateFromStr] = useState(toDateValue(thirtyDaysAgoMs()))
  const [dateToStr, setDateToStr] = useState(toDateValue(todayMs()))

  const dateFrom = fromDateValue(dateFromStr)
  const dateTo = fromDateValue(dateToStr, true)

  const needsDates = activeTab === "coverage" || activeTab === "activity" || activeTab === "routes"

  return (
    <AppShell title="Reportes" navItems={ADMIN_NAV}>
      <div className="space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-brand-600 text-white"
                  : "text-gray-600 hover:bg-surface-tertiary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date range picker — shown only for tabs that use it */}
        {needsDates && (
          <div className="card flex items-center gap-3 flex-wrap py-3">
            <label className="text-sm font-medium text-gray-700">Período:</label>
            <input
              type="date"
              value={dateFromStr}
              max={dateToStr}
              onChange={(e) => setDateFromStr(e.target.value)}
              className="input py-1 text-sm w-36"
            />
            <span className="text-gray-400 text-sm">—</span>
            <input
              type="date"
              value={dateToStr}
              min={dateFromStr}
              max={toDateValue(todayMs())}
              onChange={(e) => setDateToStr(e.target.value)}
              className="input py-1 text-sm w-36"
            />
          </div>
        )}

        {/* Active report */}
        {activeTab === "coverage"  && <CoverageReport dateFrom={dateFrom} dateTo={dateTo} />}
        {activeTab === "stock"     && <StockHealthReport />}
        {activeTab === "alerts"    && <AlertsReport />}
        {activeTab === "activity"  && <PromoterActivityReport dateFrom={dateFrom} dateTo={dateTo} />}
        {activeTab === "routes"    && <RouteComplianceReport dateFrom={dateFrom} dateTo={dateTo} />}
        {activeTab === "evidence"  && <EvidenceSearch />}
      </div>
    </AppShell>
  )
}
