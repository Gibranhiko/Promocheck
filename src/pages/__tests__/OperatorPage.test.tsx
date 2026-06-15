import { render, screen } from "@testing-library/react"
import { vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { OperatorPage } from "../OperatorPage"
import * as offlineDb from "@/services/offline"
import * as onlineStatusHook from "@/shared/hooks"
import { makeOperation } from "@/test/factories"

vi.mock("@/services/offline")
vi.mock("@/shared/hooks")
vi.mock("@/shared/store/toastStore", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

function renderPage(pendingCount = 0) {
  vi.mocked(onlineStatusHook.useOnlineStatus).mockReturnValue({
    isOnline: true,
    isSyncing: false,
    pendingCount,
    sync: vi.fn(),
    lastSyncAt: null,
    lastSyncResults: [],
    backgroundSyncSupported: false,
    refreshPendingCount: vi.fn(),
  } as any)
  return render(
    <MemoryRouter>
      <OperatorPage />
    </MemoryRouter>
  )
}

describe("OperatorPage", () => {
  it("shows skeleton while loading operations", async () => {
    vi.mocked(offlineDb.getLocalOperations).mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(document.querySelectorAll(".skeleton").length).toBeGreaterThan(0)
  })

  it("shows empty state when no operations exist", async () => {
    vi.mocked(offlineDb.getLocalOperations).mockResolvedValueOnce([])
    renderPage()
    expect(await screen.findByText(/no operations yet/i)).toBeInTheDocument()
  })

  it("shows recent operations when data loads", async () => {
    vi.mocked(offlineDb.getLocalOperations).mockResolvedValueOnce([
      makeOperation({ orderNumber: "ORD999" }),
    ])
    renderPage()
    expect(await screen.findByText("ORD999")).toBeInTheDocument()
  })

  it("shows pending sync count when pendingCount > 0", async () => {
    vi.mocked(offlineDb.getLocalOperations).mockResolvedValueOnce([])
    renderPage(3)
    expect(await screen.findByText(/3 pending/i)).toBeInTheDocument()
  })
})
