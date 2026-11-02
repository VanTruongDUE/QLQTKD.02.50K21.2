import { Injectable, Module, Inject } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { randomUUID } from "node:crypto";

export type StarlightEventType =
  | "booking.confirmed"
  | "ticket.exchange.completed"
  | "ticket.refund.completed"
  | "ticket.checked_in";

export interface StarlightEventPayload {
  eventId: string;
  eventType: StarlightEventType;
  schemaVersion: number;
  occurredAt: string;
  recipientEmail?: string;
  booking?: {
    id: string;
    total: number;
    createdAt: string;
  };
  customer?: {
    id?: string;
    email: string;
    name?: string;
    phone?: string;
  };
  movie?: {
    id?: string;
    title: string;
    rating?: string;
    durationMinutes?: number;
    poster?: string;
  };
  showtime?: {
    id?: string;
    startsAt: string;
    room?: string;
    cinema?: string;
  };
  seats?: string[];
  tickets?: Array<{
    id: string;
    seatLabel: string;
    status: string;
  }>;
  combos?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  exchange?: {
    requestId: string;
    oldTickets: Array<{ id: string; seatLabel?: string }>;
    newTickets: Array<{ id: string; seatLabel?: string }>;
    payable: number;
    refundable: number;
  };
  refund?: {
    requestId: string;
    amount: number;
    tickets: Array<{ id: string; seatLabel?: string }>;
    reason?: string;
  };
  checkIn?: {
    ticketId: string;
    staffId: string;
    staffEmail?: string;
    checkedInAt: string;
    seatLabel: string;
    movieTitle: string;
  };
}

@Injectable()
export class N8nWebhookService {
  getUrl(): string {
    return process.env.N8N_WEBHOOK_URL || "";
  }

  getSecret(): string {
    return process.env.N8N_WEBHOOK_SECRET || "";
  }

  getTimeout(): number {
    return Number(process.env.N8N_WEBHOOK_TIMEOUT || 10000);
  }

  getMaxRetries(): number {
    return Number(process.env.N8N_WEBHOOK_MAX_RETRIES || 3);
  }

  async send(
    payload: StarlightEventPayload,
    options?: { url?: string; secret?: string; timeoutMs?: number },
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const url = options?.url ?? this.getUrl();
    const secret = options?.secret ?? this.getSecret();
    const timeoutMs = options?.timeoutMs ?? this.getTimeout();

    if (!url) {
      return { success: false, error: "N8N_WEBHOOK_URL_NOT_CONFIGURED" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": secret,
          "User-Agent": "Starlight-Cinema-Backend/1.0",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.ok) {
        return { success: true, statusCode: response.status };
      } else {
        const errorText = await response.text().catch(() => "");
        return {
          success: false,
          statusCode: response.status,
          error: `HTTP ${response.status}: ${errorText.slice(0, 300)}`,
        };
      }
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError" || err.message?.includes("aborted")) {
        return { success: false, error: `Webhook timed out after ${timeoutMs}ms` };
      }
      return { success: false, error: err.message || "Network failure" };
    }
  }
}

@Injectable()
export class NotificationService {
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(N8nWebhookService) private readonly webhookService: N8nWebhookService,
  ) {}

  async enqueue(
    m: EntityManager,
    params: {
      eventId?: string;
      eventType: StarlightEventType;
      bookingId?: string;
      recipientEmail: string;
      payload: StarlightEventPayload;
    },
  ): Promise<string> {
    const eventId = params.eventId || randomUUID();
    const payloadWithId: StarlightEventPayload = {
      ...params.payload,
      eventId,
      eventType: params.eventType,
      recipientEmail: params.recipientEmail,
      occurredAt: params.payload.occurredAt || new Date().toISOString(),
      schemaVersion: params.payload.schemaVersion || 1,
    };

    const [row] = await m.query(
      `INSERT INTO notification_outbox(
        event_id, event_type, booking_id, recipient_email, payload, status
      ) VALUES($1, $2, $3, $4, $5, 'PENDING')
      ON CONFLICT(event_id) DO NOTHING
      RETURNING id`,
      [
        eventId,
        params.eventType,
        params.bookingId || null,
        params.recipientEmail,
        JSON.stringify(payloadWithId),
      ],
    );

    return row ? row.id : "";
  }

  async dispatchPending(
    limit = 10,
    targetEventId?: string,
  ): Promise<{ processed: number; sent: number; failed: number }> {
    const maxRetries = this.webhookService.getMaxRetries();

    return this.db.transaction(async (m) => {
      const rows = await m.query(
        `WITH claimed AS (
          UPDATE notification_outbox
          SET status = 'PROCESSING',
              next_retry_at = clock_timestamp() + interval '1 minute',
              updated_at = clock_timestamp()
          WHERE id IN (
            SELECT id FROM notification_outbox
            WHERE status IN ('PENDING', 'PROCESSING')
              AND next_retry_at <= clock_timestamp()
              AND ($2::text IS NULL OR event_id = $2)
            ORDER BY next_retry_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT $1
          )
          RETURNING *
        )
        SELECT * FROM claimed`,
        [limit, targetEventId || null],
      );

      let sentCount = 0;
      let failedCount = 0;

      for (const row of rows) {
        const payload: StarlightEventPayload =
          typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;

        const result = await this.webhookService.send(payload);

        if (result.success) {
          await m.query(
            `UPDATE notification_outbox
             SET status = 'SENT',
                 sent_at = clock_timestamp(),
                 attempts = attempts + 1,
                 last_error = NULL,
                 updated_at = clock_timestamp()
             WHERE id = $1`,
            [row.id],
          );
          sentCount++;
        } else {
          const newAttempts = row.attempts + 1;
          const isFinalFailure = newAttempts >= maxRetries;
          const backoffSeconds = Math.min(300, Math.pow(2, newAttempts) * 5);

          await m.query(
            `UPDATE notification_outbox
             SET status = $2,
                 attempts = $3,
                 last_error = $4,
                 next_retry_at = clock_timestamp() + (interval '1 second' * $5),
                 updated_at = clock_timestamp()
             WHERE id = $1`,
            [
              row.id,
              isFinalFailure ? "FAILED" : "PENDING",
              newAttempts,
              result.error || "Delivery failed",
              backoffSeconds,
            ],
          );
          failedCount++;
        }
      }

      return {
        processed: rows.length,
        sent: sentCount,
        failed: failedCount,
      };
    });
  }

  async buildBookingConfirmedPayload(
    m: EntityManager,
    bookingId: string,
  ): Promise<{ recipientEmail: string; payload: StarlightEventPayload } | null> {
    const [b] = await m.query(
      `SELECT b.*, u.email, u.display_name, u.phone
       FROM bookings b
       JOIN users u ON u.id = b.owner_id
       WHERE b.id = $1`,
      [bookingId],
    );
    if (!b) return null;

    const items = await m.query(
      `SELECT bi.*, t.id AS ticket_id, t.status AS ticket_status,
              s.starts_at, s.movie_id, m.title AS movie_title, m.rating, m.duration_minutes, m.poster,
              a.name AS room, c.name AS cinema
       FROM booking_items bi
       LEFT JOIN tickets t ON t.item_id = bi.id
       JOIN showtimes s ON s.id = bi.showtime_id
       JOIN movies m ON m.id = s.movie_id
       JOIN auditoriums a ON a.id = s.auditorium_id
       JOIN cinemas c ON c.id = a.cinema_id
       WHERE bi.booking_id = $1
       ORDER BY bi.seat_label`,
      [bookingId],
    );

    const combos = await m.query(
      `SELECT opi.name, opi.quantity, opi.unit_price
       FROM order_product_items opi
       WHERE opi.booking_id = $1`,
      [bookingId],
    );

    const firstItem = items[0] || {};

    const payload: StarlightEventPayload = {
      eventId: randomUUID(),
      eventType: "booking.confirmed",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      recipientEmail: b.email,
      booking: {
        id: b.id,
        total: b.total,
        createdAt: b.created_at,
      },
      customer: {
        id: b.owner_id,
        email: b.email,
        name: b.display_name || undefined,
        phone: b.phone || undefined,
      },
      movie: {
        id: firstItem.movie_id,
        title: firstItem.movie_title || "Phim Starlight",
        rating: firstItem.rating,
        durationMinutes: firstItem.duration_minutes,
        poster: firstItem.poster,
      },
      showtime: {
        id: firstItem.showtime_id,
        startsAt: firstItem.starts_at ? new Date(firstItem.starts_at).toISOString() : "",
        room: firstItem.room,
        cinema: firstItem.cinema,
      },
      seats: items.map((i: any) => i.seat_label),
      tickets: items.map((i: any) => ({
        id: i.ticket_id || i.id,
        seatLabel: i.seat_label,
        status: i.ticket_status || "ISSUED",
      })),
      combos: combos.map((c: any) => ({
        name: c.name,
        quantity: c.quantity,
        unitPrice: c.unit_price,
      })),
    };

    return { recipientEmail: b.email, payload };
  }
}

@Module({
  providers: [N8nWebhookService, NotificationService],
  exports: [N8nWebhookService, NotificationService],
})
export class NotificationModule {}

