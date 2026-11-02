import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { DataSource } from "typeorm";
import { config } from "dotenv";
import { N8nWebhookService, NotificationService, StarlightEventPayload } from "../src/notification";

config({ path: "../../.env", quiet: true });
const testUrl = process.env.TEST_DATABASE_URL!;
if (!testUrl || !new URL(testUrl).pathname.endsWith("/starlight_test")) {
  throw new Error("TEST_DATABASE_URL must point to starlight_test");
}

let db: DataSource;
let webhookService: N8nWebhookService;
let notificationService: NotificationService;

// Mock n8n Webhook Server
let mockServer: http.Server;
let mockPort: number;
let mockWebhookUrl: string;
const expectedSecret = "test-n8n-secret-12345";
const receivedRequests: Array<{ headers: http.IncomingHttpHeaders; body: any }> = [];

let serverBehavior: "normal" | "delay" | "error" | "rejectAuth" = "normal";

beforeAll(async () => {
  const { databaseOptions } = await import("../src/database/source");
  db = new DataSource({ ...databaseOptions, url: testUrl });
  await db.initialize();
  await db.runMigrations();

  mockServer = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      let body: any = {};
      try {
        body = JSON.parse(raw);
      } catch {}

      receivedRequests.push({ headers: req.headers, body });

      if (serverBehavior === "rejectAuth" || req.headers["x-webhook-secret"] !== expectedSecret) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "UNAUTHORIZED" }));
        return;
      }

      if (serverBehavior === "error") {
        req.destroy();
        return;
      }

      if (serverBehavior === "delay") {
        setTimeout(() => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, delayed: true }));
        }, 1500);
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, eventId: body.eventId, status: "DELIVERED" }));
    });
  });

  await new Promise<void>((resolve) => {
    mockServer.listen(0, "127.0.0.1", () => {
      const addr = mockServer.address() as any;
      mockPort = addr.port;
      mockWebhookUrl = `http://127.0.0.1:${mockPort}/webhook/starlight-cinema-webhook`;
      resolve();
    });
  });

  webhookService = new N8nWebhookService();
  notificationService = new NotificationService(db, webhookService);
});

afterAll(async () => {
  await new Promise<void>((resolve) => mockServer.close(() => resolve()));
  await db?.destroy();
});

beforeEach(() => {
  receivedRequests.length = 0;
  serverBehavior = "normal";
});

describe("n8n Cloud Integration and Notification Outbox (Tests 22-33)", () => {
  // Test 22: Booking notification event
  it("Test 22: generates and enqueues booking.confirmed event", async () => {
    const eventId = `test-booking-${randomUUID()}`;
    const payload: StarlightEventPayload = {
      eventId,
      eventType: "booking.confirmed",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      recipientEmail: "khach@starlight.demo",
      booking: { id: randomUUID(), total: 170000, createdAt: new Date().toISOString() },
      customer: { email: "khach@starlight.demo", name: "Nguyễn Văn A" },
      movie: { title: "Chuyến tàu bình minh", rating: "T13" },
      showtime: { startsAt: new Date().toISOString(), room: "Phòng 1", cinema: "Starlight Đà Nẵng" },
      seats: ["A1", "A2"],
    };

    const outboxId = await db.transaction((m) =>
      notificationService.enqueue(m, {
        eventId,
        eventType: "booking.confirmed",
        recipientEmail: payload.recipientEmail!,
        payload,
      }),
    );

    expect(outboxId).toBeTruthy();

    const [row] = await db.query("SELECT * FROM notification_outbox WHERE event_id = $1", [eventId]);
    expect(row).toBeDefined();
    expect(row.event_type).toBe("booking.confirmed");
    expect(row.status).toBe("PENDING");
    expect(row.recipient_email).toBe("khach@starlight.demo");
  });

  // Test 23: Exchange notification event
  it("Test 23: generates and enqueues ticket.exchange.completed event", async () => {
    const eventId = `test-exchange-${randomUUID()}`;
    const payload: StarlightEventPayload = {
      eventId,
      eventType: "ticket.exchange.completed",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      recipientEmail: "khach@starlight.demo",
      exchange: {
        requestId: randomUUID(),
        oldTickets: [{ id: randomUUID() }],
        newTickets: [{ id: randomUUID(), seatLabel: "B3" }],
        payable: 0,
        refundable: 0,
      },
    };

    await db.transaction((m) =>
      notificationService.enqueue(m, {
        eventId,
        eventType: "ticket.exchange.completed",
        recipientEmail: payload.recipientEmail!,
        payload,
      }),
    );

    const [row] = await db.query("SELECT * FROM notification_outbox WHERE event_id = $1", [eventId]);
    expect(row.event_type).toBe("ticket.exchange.completed");
    expect(row.status).toBe("PENDING");
  });

  // Test 24: Refund notification event
  it("Test 24: generates and enqueues ticket.refund.completed event", async () => {
    const eventId = `test-refund-${randomUUID()}`;
    const payload: StarlightEventPayload = {
      eventId,
      eventType: "ticket.refund.completed",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      recipientEmail: "khach@starlight.demo",
      refund: {
        requestId: randomUUID(),
        amount: 85000,
        tickets: [{ id: randomUUID() }],
        reason: "Khách bận việc đột xuất",
      },
    };

    await db.transaction((m) =>
      notificationService.enqueue(m, {
        eventId,
        eventType: "ticket.refund.completed",
        recipientEmail: payload.recipientEmail!,
        payload,
      }),
    );

    const [row] = await db.query("SELECT * FROM notification_outbox WHERE event_id = $1", [eventId]);
    expect(row.event_type).toBe("ticket.refund.completed");
    expect(row.status).toBe("PENDING");
  });

  // Test 25: Check-in event recording
  it("Test 25: records ticket.checked_in audit event without sending spam email", async () => {
    const eventId = `test-checkin-${randomUUID()}`;
    const payload: StarlightEventPayload = {
      eventId,
      eventType: "ticket.checked_in",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      checkIn: {
        ticketId: randomUUID(),
        staffId: randomUUID(),
        checkedInAt: new Date().toISOString(),
        seatLabel: "C4",
        movieTitle: "Quỹ đạo cuối cùng",
      },
    };

    await db.transaction((m) =>
      notificationService.enqueue(m, {
        eventId,
        eventType: "ticket.checked_in",
        recipientEmail: "audit@starlight.cinema",
        payload,
      }),
    );

    const [row] = await db.query("SELECT * FROM notification_outbox WHERE event_id = $1", [eventId]);
    expect(row.event_type).toBe("ticket.checked_in");
    expect(row.recipient_email).toBe("audit@starlight.cinema");
  });

  // Test 26: Invalid webhook authentication
  it("Test 26: rejects webhook transmission when X-Webhook-Secret is invalid", async () => {
    const result = await webhookService.send(
      {
        eventId: randomUUID(),
        eventType: "booking.confirmed",
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
      },
      {
        url: mockWebhookUrl,
        secret: "wrong-secret-token",
      },
    );

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.error).toContain("401");
  });

  // Test 27: Missing customer email handling
  it("Test 27: handles missing customer email gracefully without breaking transaction", async () => {
    const eventId = `test-missing-email-${randomUUID()}`;
    const payload: StarlightEventPayload = {
      eventId,
      eventType: "booking.confirmed",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
    };

    // Enqueuing with empty email must not crash the database transaction
    await expect(
      db.transaction((m) =>
        notificationService.enqueue(m, {
          eventId,
          eventType: "booking.confirmed",
          recipientEmail: "",
          payload,
        }),
      ),
    ).resolves.toBeDefined();
  });

  // Test 28: Duplicate event protection
  it("Test 28: deduplicates identical eventId and prevents duplicate processing", async () => {
    const eventId = `dedup-test-${randomUUID()}`;
    const payload: StarlightEventPayload = {
      eventId,
      eventType: "booking.confirmed",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      recipientEmail: "dedup@starlight.demo",
    };

    const firstId = await db.transaction((m) =>
      notificationService.enqueue(m, {
        eventId,
        eventType: "booking.confirmed",
        recipientEmail: "dedup@starlight.demo",
        payload,
      }),
    );
    expect(firstId).toBeTruthy();

    // Re-inserting with exact same eventId should not insert a second row
    const secondId = await db.transaction((m) =>
      notificationService.enqueue(m, {
        eventId,
        eventType: "booking.confirmed",
        recipientEmail: "dedup@starlight.demo",
        payload,
      }),
    );
    expect(secondId).toBe("");

    const rows = await db.query("SELECT * FROM notification_outbox WHERE event_id = $1", [eventId]);
    expect(rows).toHaveLength(1);
  });

  // Test 29: n8n timeout handling
  it("Test 29: handles webhook timeout within configured limit", async () => {
    serverBehavior = "delay";

    const result = await webhookService.send(
      {
        eventId: randomUUID(),
        eventType: "booking.confirmed",
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
      },
      {
        url: mockWebhookUrl,
        secret: expectedSecret,
        timeoutMs: 300, // Very short timeout
      },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("timed out");
  });

  // Test 30: Network failure handling
  it("Test 30: handles network connection drops safely", async () => {
    serverBehavior = "error";

    const result = await webhookService.send(
      {
        eventId: randomUUID(),
        eventType: "booking.confirmed",
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
      },
      {
        url: mockWebhookUrl,
        secret: expectedSecret,
      },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // Test 31: Retry behavior with exponential backoff
  it("Test 31: increments attempts and applies backoff retry when delivery fails", async () => {
    const eventId = `retry-test-${randomUUID()}`;
    await db.query(
      `INSERT INTO notification_outbox(event_id, event_type, recipient_email, payload, status, next_retry_at)
       VALUES($1, 'booking.confirmed', 'retry@test.local', '{}', 'PENDING', clock_timestamp() - interval '1 second')`,
      [eventId],
    );

    // Mock send failure by passing unreachable port
    process.env.N8N_WEBHOOK_URL = `http://127.0.0.1:${mockPort}`;
    process.env.N8N_WEBHOOK_SECRET = "wrong-secret"; // Will fail auth with 401
    process.env.N8N_WEBHOOK_MAX_RETRIES = "3";

    await notificationService.dispatchPending(1, eventId);

    const [after] = await db.query("SELECT * FROM notification_outbox WHERE event_id = $1", [eventId]);
    expect(after.attempts).toBe(1);
    expect(after.status).toBe("PENDING");
    expect(after.last_error).toContain("401");
    expect(new Date(after.next_retry_at).getTime()).toBeGreaterThan(Date.now());
  });

  // Test 32: Notification status persistence
  it("Test 32: successfully transitions status to SENT and records sent_at timestamp", async () => {
    const eventId = `sent-test-${randomUUID()}`;
    await db.query(
      `INSERT INTO notification_outbox(event_id, event_type, recipient_email, payload, status, next_retry_at)
       VALUES($1, 'booking.confirmed', 'sent@test.local', '{}', 'PENDING', clock_timestamp() - interval '1 second')`,
      [eventId],
    );

    process.env.N8N_WEBHOOK_URL = mockWebhookUrl;
    process.env.N8N_WEBHOOK_SECRET = expectedSecret;

    await notificationService.dispatchPending(1, eventId);

    const [row] = await db.query("SELECT * FROM notification_outbox WHERE event_id = $1", [eventId]);
    expect(row.status).toBe("SENT");
    expect(row.attempts).toBe(1);
    expect(row.sent_at).not.toBeNull();
    expect(row.last_error).toBeNull();
  });

  // Test 33: Failed delivery tracking
  it("Test 33: transitions status to FAILED when max retries exceeded", async () => {
    const eventId = `failed-test-${randomUUID()}`;
    await db.query(
      `INSERT INTO notification_outbox(event_id, event_type, recipient_email, payload, status, attempts, next_retry_at)
       VALUES($1, 'booking.confirmed', 'fail@test.local', '{}', 'PENDING', 2, clock_timestamp() - interval '1 second')`,
      [eventId],
    );

    process.env.N8N_WEBHOOK_URL = mockWebhookUrl;
    process.env.N8N_WEBHOOK_SECRET = "invalid-secret"; // Will fail
    process.env.N8N_WEBHOOK_MAX_RETRIES = "3";

    await notificationService.dispatchPending(1, eventId);

    const [row] = await db.query("SELECT * FROM notification_outbox WHERE event_id = $1", [eventId]);
    expect(row.status).toBe("FAILED");
    expect(row.attempts).toBe(3);
    expect(row.last_error).toContain("401");
  });
});

