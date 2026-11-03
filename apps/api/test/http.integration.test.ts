import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Test } from "@nestjs/testing";
import { DataSource } from "typeorm";
import request from "supertest";
import cookieParser from "cookie-parser";

config({ path: "../../.env", quiet: true });
const testUrl = process.env.TEST_DATABASE_URL!;
if (!testUrl || !new URL(testUrl).pathname.endsWith("/starlight_test"))
  throw new Error("TEST_DATABASE_URL must point to starlight_test");
process.env.DATABASE_URL = testUrl;

let app: import("@nestjs/common").INestApplication;
let db: DataSource;
let customerToken: string;
const email = `supertest-${randomUUID()}@starlight.test`;
const password = "SupertestPassword2026!";
const origin = process.env.WEB_ORIGIN!;

beforeAll(async () => {
  const { AppModule } = await import("../src/app");
  const { ApiErrors } = await import("../src/http");
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = module.createNestApplication();
  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  app.useGlobalFilters(new ApiErrors());
  await app.init();
  db = app.get(DataSource);
  await db.runMigrations();
});

afterAll(async () => {
  const [user] = await db.query("SELECT id FROM users WHERE email=$1", [email]);
  if (user) {
    await db.query("DELETE FROM refresh_sessions WHERE user_id=$1", [user.id]);
    await db.query("DELETE FROM users WHERE id=$1", [user.id]);
  }
  await app.close();
});

describe("Nest TestingModule and Supertest HTTP integration", () => {
  it("registers a public account strictly as CUSTOMER", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .set("Origin", origin)
      .send({ email, password })
      .expect(201);
    expect(response.body.user).toMatchObject({ email, role: "CUSTOMER" });
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    customerToken = response.body.accessToken;
  });

  it("rejects invalid credentials with a stable error contract", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({ email, password: "WrongPassword2026!" })
      .expect(401);
    expect(response.body).toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("validates JWT and denies anonymous access", async () => {
    await request(app.getHttpServer()).get("/api/v1/auth/me").expect(401);
    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);
    expect(response.body).toMatchObject({ email, role: "CUSTOMER" });
  });

  it("enforces CUSTOMER, STAFF and MANAGER boundaries at the guards", async () => {
    const managerOnly = await request(app.getHttpServer())
      .get("/api/v1/admin/staff")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(403);
    expect(managerOnly.body.code).toBe("FORBIDDEN_ROLE");

    const staffOnly = await request(app.getHttpServer())
      .post("/api/v1/check-in/inspect")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ code: randomUUID(), showtimeId: randomUUID() })
      .expect(403);
    expect(staffOnly.body.code).toBe("FORBIDDEN_ROLE");
  });
});
