import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { FiMapPin, FiCheckCircle, FiClock, FiAlertCircle } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import { fetchVisitPlansByPromoter, markOverduePlans } from "@/features/routes/services/visitPlanService"
import { useAuth } from "@/features/auth/hooks"
import { useToast } from "@/shared/store/toastStore"
import { PROMOTER_NAV } from "@/shared/constants/navItems"
import type { VisitPlan } from "@/types/Route"

type DayView = "today" | "week"

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfWeekMonday(): Date {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function groupByDay(plans: VisitPlan[]): Map<string, VisitPlan[]> {
  const map = new Map<string, VisitPlan[]>()
  for (const plan of plans) {
    const key = new Date(plan.plannedDate).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
    const arr = map.get(key) ?? []
    arr.push(plan)
    map.set(key, arr)
  }
  return map
}

function PlanStatusIcon({ status }: { status: VisitPlan["status"] }) {
  if (status === "completed") return <FiCheckCircle className="w-5 h-5 text-green-500" />
  if (status === "missed") return <FiAlertCircle className="w-5 h-5 text-red-400" />
  return <FiClock className="w-5 h-5 text-gray-400" />
}

export function PromoterRoutePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [plans, setPlans] = useState<VisitPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [view, setView] = useState<DayView>("today")

  const load = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      await markOverduePlans(user.uid)
      const weekStart = startOfWeekMonday()
      const data = await fetchVisitPlansByPromoter(user.uid, weekStart)
      setPlans(data)
    } catch {
      toast.error("Error al cargar tu ruta")
    } finally {
      setIsLoading(false)
    }
  }, [user, toast])

  useEffect(() => { load() }, [load])

  const today = startOfDay(Date.now())
  const todayPlans = plans.filter((p) => p.plannedDate === today)
  const weekGroups = groupByDay(plans)

  const pendingToday = todayPlans.filter((p) => p.status === "pending").length

  const handleStartVisit = (plan: VisitPlan) => {
    navigate(`/visit/new?storeId=${plan.storeId}&planId=${plan.id}`)
  }

  return (
    <AppShell title="Mi Ruta" navItems={PROMOTER_NAV}>
      <div className="space-y-4">
        {/* View toggle */}
        <div className="flex gap-1 bg-surface-secondary rounded-xl p-1">
          {([["today", "Hoy"], ["week", "Semana"]] as [DayView, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === id ? "bg-white shadow text-gray-900" : "text-gray-500"
              }`}
            >
              {label}
              {id === "today" && pendingToday > 0 && (
                <span className="ml-1.5 bg-brand-600 text-white text-xs rounded-full px-1.5 py-0.5">{pendingToday}</span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <SkeletonList count={3} />
        ) : view === "today" ? (
          todayPlans.length === 0 ? (
            <EmptyState icon="✅" title="Sin visitas hoy" description="No tienes tiendas programadas para hoy." />
          ) : (
            <div className="space-y-2">
              {todayPlans.map((plan) => (
                <div key={plan.id} className="card flex items-center gap-3">
                  <PlanStatusIcon status={plan.status} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{plan.storeName}</p>
                    <p className={`text-xs mt-0.5 ${
                      plan.status === "completed" ? "text-green-600" :
                      plan.status === "missed" ? "text-red-500" : "text-gray-400"
                    }`}>
                      {plan.status === "completed" ? "Completada" : plan.status === "missed" ? "Vencida" : "Pendiente"}
                    </p>
                  </div>
                  {plan.status === "pending" && (
                    <button
                      onClick={() => handleStartVisit(plan)}
                      className="btn btn-primary text-sm px-3 py-1.5 flex-shrink-0"
                    >
                      <FiMapPin className="w-4 h-4" /> Iniciar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          plans.length === 0 ? (
            <EmptyState icon="📅" title="Sin planes esta semana" description="No hay tiendas programadas para esta semana." />
          ) : (
            <div className="space-y-4">
              {[...weekGroups.entries()].map(([day, dayPlans]) => (
                <div key={day}>
                  <p className="text-sm font-medium text-gray-500 mb-2 capitalize">{day}</p>
                  <div className="space-y-2">
                    {dayPlans.map((plan) => (
                      <div key={plan.id} className="card flex items-center gap-3">
                        <PlanStatusIcon status={plan.status} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{plan.storeName}</p>
                        </div>
                        {plan.status === "pending" && plan.plannedDate === today && (
                          <button onClick={() => handleStartVisit(plan)} className="btn btn-primary text-sm px-3 py-1.5 flex-shrink-0">
                            <FiMapPin className="w-4 h-4" /> Iniciar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </AppShell>
  )
}
