import { describe, it, expect, beforeEach } from "vitest"
import { useToastStore, useToast } from "../toastStore"
import { renderHook, act } from "@testing-library/react"

describe("useToastStore", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it("starts with no toasts", () => {
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it("show() adds a toast with the correct type and message", () => {
    useToastStore.getState().show("success", "Saved!")
    const { toasts } = useToastStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe("success")
    expect(toasts[0].message).toBe("Saved!")
  })

  it("show() assigns a unique id to each toast", () => {
    useToastStore.getState().show("info", "First")
    useToastStore.getState().show("info", "Second")
    const { toasts } = useToastStore.getState()
    expect(toasts[0].id).not.toBe(toasts[1].id)
  })

  it("show() stores the custom duration when provided", () => {
    useToastStore.getState().show("warning", "Watch out", 5000)
    expect(useToastStore.getState().toasts[0].duration).toBe(5000)
  })

  it("dismiss() removes only the matching toast by id", () => {
    useToastStore.getState().show("error", "Oops")
    useToastStore.getState().show("success", "Done")
    const id = useToastStore.getState().toasts[0].id
    useToastStore.getState().dismiss(id)
    const { toasts } = useToastStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toBe("Done")
  })

  it("multiple toasts can coexist", () => {
    useToastStore.getState().show("info", "A")
    useToastStore.getState().show("info", "B")
    useToastStore.getState().show("info", "C")
    expect(useToastStore.getState().toasts).toHaveLength(3)
  })
})

describe("useToast hook", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it("success() adds a success toast", () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.success("All good") })
    expect(useToastStore.getState().toasts[0].type).toBe("success")
    expect(useToastStore.getState().toasts[0].message).toBe("All good")
  })

  it("error() adds an error toast", () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.error("Something broke") })
    expect(useToastStore.getState().toasts[0].type).toBe("error")
  })

  it("warning() adds a warning toast", () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.warning("Be careful") })
    expect(useToastStore.getState().toasts[0].type).toBe("warning")
  })

  it("info() adds an info toast", () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.info("FYI") })
    expect(useToastStore.getState().toasts[0].type).toBe("info")
  })
})
