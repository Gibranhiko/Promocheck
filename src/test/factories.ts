import type { Visit } from "@/types/Visit"
import type { AuthUser } from "@/features/auth/store/authStore"

export function makeVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: "visit_test_001",
    localId: "visit_test_001",
    visitType: "routine",
    visitDate: 1711756800000,
    promoterId: "user_001",
    promoterName: "test@example.com",
    storeId: "store_001",
    storeName: "Tienda Test",
    photos: {},
    status: "pending_sync",
    createdAt: 1711756800000,
    ...overrides,
  }
}

export function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    uid: "user_001",
    email: "promotora@example.com",
    role: "operator",
    ...overrides,
  }
}

export function makeAdminUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return makeUser({
    role: "admin",
    email: "admin@example.com",
    uid: "admin_001",
    ...overrides,
  })
}
