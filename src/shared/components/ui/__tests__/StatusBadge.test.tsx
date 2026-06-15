import { render, screen } from "@testing-library/react"
import { StatusBadge } from "../StatusBadge"

describe("StatusBadge", () => {
  it('renders "Synced" label for synced status', () => {
    render(<StatusBadge status="synced" />)
    expect(screen.getByText("Synced")).toBeInTheDocument()
  })

  it('renders "Pending" label for pending_sync status', () => {
    render(<StatusBadge status="pending_sync" />)
    expect(screen.getByText("Pending")).toBeInTheDocument()
  })

  it('renders "Error" label for error status', () => {
    render(<StatusBadge status="error" />)
    expect(screen.getByText("Error")).toBeInTheDocument()
  })
})
