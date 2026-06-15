import type { Operation } from "@/types/Operation"
import type { AuthUser } from "@/features/auth/store/authStore"

export function makeOperation(overrides: Partial<Operation> = {}): Operation {
  return {
    id: "op_test_001",
    localId: "op_test_001",
    orderNumber: "ORD001",
    doorNumber: "D01",
    operationType: "load",
    operatorId: "user_001",
    operatorName: "test@example.com",
    photos: {},
    status: "pending_sync",
    createdAt: 1711756800000, // 2024-03-30T00:00:00Z — fixed, deterministic
    ...overrides,
  }
}

export function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    uid: "user_001",
    email: "operator@example.com",
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
