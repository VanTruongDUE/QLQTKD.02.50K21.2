import { z } from "zod";
export const credentialsSchema = z
  .object({
    email: z.email().max(200),
    password: z.string().min(12).max(128),
  })
  .strict();
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
export type Role = "CUSTOMER" | "STAFF" | "MANAGER";
export type Principal = { id: string; role: Role; sessionId: string };

const checkInFields = {
  showtimeId: z.uuid(),
  token: z.string().trim().min(1).max(512).optional(),
  ticketCode: z.uuid().optional(),
};
const oneIdentifier = (v: { token?: string; ticketCode?: string }) =>
  Boolean(v.token) !== Boolean(v.ticketCode);
export const checkInSchema = z
  .object(checkInFields)
  .strict()
  .refine(oneIdentifier, {
    message: "Cung cấp QR hoặc mã vé, không cung cấp cả hai.",
  });
export const confirmCheckInSchema = z
  .object({ ...checkInFields, ageVerified: z.literal(true) })
  .strict()
  .refine(oneIdentifier);
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckInTicket = {
  id: string;
  status: string;
  movie_title: string;
  seat_label: string;
  showtime_id: string;
  starts_at: string;
  room: string;
  cinema: string;
  rating: string;
};
export type GateShowtime = {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  rating: string;
  poster: string;
  starts_at: string;
  ends_at: string;
  room: string;
  cinema: string;
  status: string;
  ticketCount: number;
  eligibleTicketCount: number;
  checkedInCount: number;
  checkInOpensAt: string;
  checkInClosesAt: string;
};
export type CheckInReceipt = {
  id: string;
  status: "CHECKED_IN";
  checkedInAt: string;
  staffId: string;
};
export type CheckInHistory = CheckInReceipt & {
  staffEmail: string;
  seat_label: string;
  movie_title: string;
};
