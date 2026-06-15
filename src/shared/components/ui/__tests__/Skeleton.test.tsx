import { render } from "@testing-library/react"
import { SkeletonList, SkeletonRow } from "../Skeleton"

describe("Skeleton", () => {
  it("SkeletonRow renders three skeleton divs", () => {
    const { container } = render(<SkeletonRow />)
    expect(container.querySelectorAll(".skeleton")).toHaveLength(3)
  })

  it("SkeletonList renders the requested count", () => {
    const { container } = render(<SkeletonList count={5} />)
    // 5 rows × 3 skeleton divs each
    expect(container.querySelectorAll(".skeleton")).toHaveLength(15)
  })
})
