import { z } from "zod"

export const operationSchema = z.object({
  orderNumber: z
    .string()
    .min(3, "Order number must be at least 3 characters")
    .max(20, "Order number must be at most 20 characters")
    .regex(
      /^[A-Za-z0-9]+$/,
      "Order number must be alphanumeric (letters and numbers only)"
    ),
  doorNumber: z
    .string()
    .min(1, "Door number is required")
    .max(10, "Door number must be at most 10 characters")
    .regex(
      /^[A-Za-z0-9]+$/,
      "Door number must be alphanumeric (letters and numbers only)"
    ),
  operationType: z.enum(["load", "unload"], {
    required_error: "Please select an operation type",
  }),
})

export type OperationFormValues = z.infer<typeof operationSchema>
