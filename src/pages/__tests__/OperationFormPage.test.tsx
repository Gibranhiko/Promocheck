import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { OperationFormPage } from "../OperationFormPage"
import * as operationsHook from "@/features/operations/hooks"
import { useAuthStore } from "@/features/auth/store/authStore"
import { makeUser } from "@/test/factories"

vi.mock("@/features/operations/hooks")
vi.mock("@/features/camera", () => ({
  CameraCapture: ({
    photoType,
    onCapture,
  }: {
    photoType: string
    onCapture: (b: Blob, t: string) => void
  }) => (
    <button onClick={() => onCapture(new Blob(["photo"]), photoType)}>
      Mock Capture
    </button>
  ),
}))

function renderFormPage(type = "load") {
  useAuthStore.setState({ user: makeUser(), isLoading: false })
  const saveMock = vi.fn().mockResolvedValue(undefined)
  vi.mocked(operationsHook.useOperations).mockReturnValue({
    saveOperationOffline: saveMock,
    operations: [],
    isLoading: false,
    error: null,
    pendingSyncCount: 0,
    loadLocalOperations: vi.fn(),
    loadServerOperations: vi.fn(),
    syncPendingOperations: vi.fn(),
    refreshPendingCount: vi.fn(),
  })
  render(
    <MemoryRouter initialEntries={[`/operation/new?type=${type}`]}>
      <Routes>
        <Route path="/operation/new" element={<OperationFormPage />} />
        <Route path="/operator" element={<div>Operator Home</div>} />
      </Routes>
    </MemoryRouter>
  )
  return { saveMock }
}

describe("OperationFormPage", () => {
  it("shows validation error when order number is too short", async () => {
    renderFormPage()
    await userEvent.type(screen.getByPlaceholderText(/ord12345/i), "AB")
    await userEvent.tab()
    expect(await screen.findByText(/at least 3/i)).toBeInTheDocument()
  })

  it("disables submit button until all fields and photos are valid", () => {
    renderFormPage()
    expect(screen.getByRole("button", { name: /save operation/i })).toBeDisabled()
  })

  it("calls saveOperationOffline on valid submit", async () => {
    const { saveMock } = renderFormPage()
    await userEvent.type(screen.getByPlaceholderText(/ord12345/i), "ORD001")
    await userEvent.type(screen.getByPlaceholderText(/d01/i), "D01")

    // Capture each required photo: click Capture → click Mock Capture in modal
    let captureButtons = screen.queryAllByRole("button", { name: /^capture$/i })
    while (captureButtons.length > 0) {
      await userEvent.click(captureButtons[0])
      await userEvent.click(await screen.findByRole("button", { name: /mock capture/i }))
      captureButtons = screen.queryAllByRole("button", { name: /^capture$/i })
    }

    await userEvent.click(screen.getByRole("button", { name: /save operation/i }))
    await waitFor(() => expect(saveMock).toHaveBeenCalledOnce())
  })
})
