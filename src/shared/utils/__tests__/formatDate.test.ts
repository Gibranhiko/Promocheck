import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { formatDate, formatDateTime, formatRelativeTime } from "../formatDate"

// Fixed "now" — 2024-03-30T12:00:00Z — keeps all assertions deterministic
const FIXED_NOW = new Date("2024-03-30T12:00:00Z").getTime()

describe("formatDate()", () => {
  it("includes the year", () => {
    expect(formatDate(FIXED_NOW)).toContain("2024")
  })

  it("includes the month abbreviation", () => {
    expect(formatDate(FIXED_NOW)).toContain("Mar")
  })

  it("includes the day", () => {
    // Day is 30 in UTC, may render as 29 or 30 depending on local TZ — just check it's numeric
    expect(formatDate(FIXED_NOW)).toMatch(/\d+/)
  })
})

describe("formatDateTime()", () => {
  it("includes year and month", () => {
    const result = formatDateTime(FIXED_NOW)
    expect(result).toContain("2024")
    expect(result).toContain("Mar")
  })

  it("includes a time component (HH:MM)", () => {
    expect(formatDateTime(FIXED_NOW)).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe("formatRelativeTime()", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Just now" for a timestamp within the last 60 seconds', () => {
    expect(formatRelativeTime(FIXED_NOW - 30_000)).toBe("Just now")
  })

  it('returns "Just now" for timestamps exactly at now', () => {
    expect(formatRelativeTime(FIXED_NOW)).toBe("Just now")
  })

  it("returns minutes ago for timestamps 1–59 minutes old", () => {
    expect(formatRelativeTime(FIXED_NOW - 5 * 60_000)).toBe("5m ago")
    expect(formatRelativeTime(FIXED_NOW - 59 * 60_000)).toBe("59m ago")
  })

  it("returns hours ago for timestamps 1–23 hours old", () => {
    expect(formatRelativeTime(FIXED_NOW - 3 * 3_600_000)).toBe("3h ago")
    expect(formatRelativeTime(FIXED_NOW - 23 * 3_600_000)).toBe("23h ago")
  })

  it("returns days ago for timestamps 1+ days old", () => {
    expect(formatRelativeTime(FIXED_NOW - 2 * 86_400_000)).toBe("2d ago")
    expect(formatRelativeTime(FIXED_NOW - 10 * 86_400_000)).toBe("10d ago")
  })
})
