import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { FirebaseError } from "firebase/app"
import { LoginPage } from "../LoginPage"
import * as authService from "@/features/auth/services/authService"
import { useAuthStore } from "@/features/auth/store/authStore"

vi.mock("@/features/auth/services/authService")

function renderLoginPage() {
  useAuthStore.setState({ user: null, isLoading: false })
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

/** Submit the form bypassing HTML5 native email validation */
function submitForm() {
  fireEvent.submit(document.querySelector("form")!)
}

describe("LoginPage", () => {
  it("renders email and password fields", () => {
    renderLoginPage()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it("shows validation error for invalid email", async () => {
    renderLoginPage()
    await userEvent.type(screen.getByLabelText(/email/i), "bad-email")
    submitForm()
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument()
  })

  it("calls login() with correct credentials on valid submit", async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(undefined)
    renderLoginPage()
    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com")
    await userEvent.type(screen.getByLabelText(/password/i), "secret123")
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }))
    expect(authService.login).toHaveBeenCalledWith("user@example.com", "secret123")
  })

  it("shows error message when login fails with wrong password", async () => {
    vi.mocked(authService.login).mockRejectedValueOnce(
      new FirebaseError("auth/wrong-password", "Wrong password")
    )
    renderLoginPage()
    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com")
    await userEvent.type(screen.getByLabelText(/password/i), "wrongpass")
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }))
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()
  })
})
