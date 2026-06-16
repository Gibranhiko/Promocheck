import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/features/auth/hooks"
import { ProtectedRoute } from "@/shared/components/layout/ProtectedRoute"
import { LoginPage } from "@/pages/LoginPage"
import { PendingApprovalPage } from "@/pages/PendingApprovalPage"
import { PromoterPage } from "@/pages/PromoterPage"
import { AdminPage } from "@/pages/AdminPage"
import { VisitFormPage } from "@/pages/VisitFormPage"
import { VisitDetailPage } from "@/pages/VisitDetailPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { AccountPage } from "@/pages/AccountPage"
import { PromoterHistoryPage } from "@/pages/PromoterHistoryPage"
import { AdminUsersPage } from "@/pages/AdminUsersPage"
import { AdminStoresPage } from "@/pages/AdminStoresPage"

function AuthProvider() {
  useAuth()
  return <Outlet />
}

const router = createBrowserRouter([
  {
    element: <AuthProvider />,
    children: [
      // Public routes
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/pending-approval",
        element: <PendingApprovalPage />,
      },
      {
        path: "/unauthorized",
        element: (
          <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
            <h1 className="text-2xl font-bold mb-2">Acceso denegado</h1>
            <p className="text-gray-600 mb-4">
              No tienes permiso para ver esta página.
            </p>
            <a href="/login" className="btn btn-primary">
              Ir al inicio de sesión
            </a>
          </div>
        ),
      },

      // Shared protected routes (both roles)
      {
        element: <ProtectedRoute allowedRoles={["admin", "operator"]} />,
        children: [
          {
            path: "/",
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: "/dashboard",
            element: <DashboardPage />,
          },
          {
            path: "/account",
            element: <AccountPage />,
          },
          {
            path: "/visit/:id",
            element: <VisitDetailPage />,
          },
        ],
      },

      // Promoter-only routes
      {
        element: <ProtectedRoute allowedRoles={["operator"]} />,
        children: [
          {
            path: "/promoter",
            element: <PromoterPage />,
          },
          {
            path: "/visit/new",
            element: <VisitFormPage />,
          },
          {
            path: "/visit/:id/edit",
            element: <VisitFormPage />,
          },
          {
            path: "/promoter/history",
            element: <PromoterHistoryPage />,
          },
        ],
      },

      // Admin-only routes
      {
        element: <ProtectedRoute allowedRoles={["admin"]} />,
        children: [
          {
            path: "/admin",
            element: <AdminPage />,
          },
          {
            path: "/admin/users",
            element: <AdminUsersPage />,
          },
          {
            path: "/admin/stores",
            element: <AdminStoresPage />,
          },
        ],
      },

      // Fallback
      {
        path: "*",
        element: <Navigate to="/login" replace />,
      },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
