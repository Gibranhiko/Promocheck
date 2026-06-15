import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EmptyState } from "../EmptyState"

describe("EmptyState", () => {
  it("renders icon, title, and description", () => {
    render(<EmptyState icon="📋" title="Nothing here" description="Add something to start." />)
    expect(screen.getByText("Nothing here")).toBeInTheDocument()
    expect(screen.getByText("Add something to start.")).toBeInTheDocument()
  })

  it("renders optional action and fires callback on click", async () => {
    const onClear = vi.fn()
    render(
      <EmptyState
        icon="🔍"
        title="No results"
        action={<button onClick={onClear}>Clear</button>}
      />
    )
    await userEvent.click(screen.getByText("Clear"))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it("renders nothing for description if omitted", () => {
    const { container } = render(<EmptyState icon="📋" title="Empty" />)
    expect(container.querySelector("p")).not.toBeInTheDocument()
  })
})
