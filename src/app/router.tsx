import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/features/auth/hooks"
import { ProtectedRoute } from "@/shared/components/layout/ProtectedRoute"
import { LoginPage } from "@/pages/LoginPage"
import { PendingApprovalPage } from "@/pages/PendingApprovalPage"
import { OperatorPage } from "@/pages/OperatorPage"
import { AdminPage } from "@/pages/AdminPage"
import { OperationFormPage } from "@/pages/OperationFormPage"
import { OperationDetailPage } from "@/pages/OperationDetailPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { AccountPage } from "@/pages/AccountPage"
import { OperatorHistoryPage } from "@/pages/OperatorHistoryPage"
import { AdminUsersPage } from "@/pages/AdminUsersPage"
import { AdminClientsPage } from "@/pages/AdminClientsPage"

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
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-4">
              You do not have permission to view this page.
            </p>
            <a href="/login" className="btn btn-primary">
              Go to Login
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
            path: "/operation/:id",
            element: <OperationDetailPage />,
          },
        ],
      },

      // Operator-only routes
      {
        element: <ProtectedRoute allowedRoles={["operator"]} />,
        children: [
          {
            path: "/operator",
            element: <OperatorPage />,
          },
          {
            path: "/operation/new",
            element: <OperationFormPage />,
          },
          {
            path: "/operation/:id/edit",
            element: <OperationFormPage />,
          },
          {
            path: "/operator/history",
            element: <OperatorHistoryPage />,
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
            path: "/admin/clients",
            element: <AdminClientsPage />,
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