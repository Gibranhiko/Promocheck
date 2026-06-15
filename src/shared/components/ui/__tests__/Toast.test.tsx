import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { Toast } from "../Toast"

const baseToast = { id: "t1", type: "success" as const, message: "Saved successfully!" }

describe("Toast", () => {
  it("renders the message", () => {
    render(<Toast toast={baseToast} onDismiss={vi.fn()} />)
    expect(screen.getByText("Saved successfully!")).toBeInTheDocument()
  })

  it("calls onDismiss when X button is clicked", async () => {
    const dismiss = vi.fn()
    render(<Toast toast={baseToast} onDismiss={dismiss} />)
    await userEvent.click(screen.getByLabelText("Dismiss"))
    expect(dismiss).toHaveBeenCalledWith("t1")
  })

  it("auto-dismisses after the given duration", async () => {
    vi.useFakeTimers()
    const dismiss = vi.fn()
    render(<Toast toast={{ ...baseToast, duration: 1000 }} onDismiss={dismiss} />)
    vi.advanceTimersByTime(1001)
    expect(dismiss).toHaveBeenCalledWith("t1")
    vi.useRealTimers()
  })
})
