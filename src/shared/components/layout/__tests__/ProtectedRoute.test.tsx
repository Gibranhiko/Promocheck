import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { ProtectedRoute } from "../ProtectedRoute"
import { useAuthStore } from "@/features/auth/store/authStore"
import { makeUser, makeAdminUser } from "@/test/factories"

function renderRoute(allowedRoles: string[], userOverride: any = null) {
  useAuthStore.setState({ user: userOverride, isLoading: false })
  render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={allowedRoles as any} />}>
          <Route path="/protected" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
        <Route path="/pending-approval" element={<div>Pending Approval Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe("ProtectedRoute", () => {
  it("redirects to /login when no user is authenticated", () => {
    renderRoute(["operator"])
    expect(screen.getByText("Login Page")).toBeInTheDocument()
  })

  it("renders children when user role is allowed", () => {
    renderRoute(["operator"], makeUser())
    expect(screen.getByText("Protected Content")).toBeInTheDocument()
  })

  it("redirects to /unauthorized when role does not match", () => {
    renderRoute(["admin"], makeUser()) // operator trying to access admin route
    expect(screen.getByText("Unauthorized Page")).toBeInTheDocument()
  })

  it("allows admin to access admin-only routes", () => {
    renderRoute(["admin"], makeAdminUser())
    expect(screen.getByText("Protected Content")).toBeInTheDocument()
  })
})
