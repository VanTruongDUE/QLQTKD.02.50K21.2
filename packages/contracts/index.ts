import { z } from "zod";
export const credentialsSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(12).max(128),
});
export const holdSchema = z.object({
  showtimeId: z.uuid(),
  seatIds: z
    .array(z.uuid())
    .min(1)
    .max(8)
    .refine((v) => new Set(v).size === v.length),
});
export const bookingSchema = z.object({
  holdId: z.uuid(),
  products: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .max(10)
    .default([]),
});
export const simulationSchema = z.object({
  outcome: z.enum(["success", "failed", "timeout"]),
});
export const eventSchema = z.object({
  eventId: z.uuid(),
  paymentId: z.uuid(),
  amount: z.number().int().nonnegative(),
  currency: z.literal("VND"),
  status: z.enum(["SUCCEEDED", "FAILED"]),
});
export type Role = "CUSTOMER" | "COUNTER" | "GATE" | "MANAGER";
export type Principal = { id: string; role: Role; sessionId: string };
