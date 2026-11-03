import {
  test,
  expect,
  beforeEach,
  type Page,
  type BrowserContext,
} from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const apiRequire = createRequire(resolve("apps/api/package.json"));
type Fixture = {
  shows: { id: string; room: string }[];
  tickets: Record<string, { id: string; showtimeId: string }>;
  gateEmail: string;
};
let fixture: Fixture;
let password: string;
let customerCookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
let staffCookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
let customerToken: string;
test.beforeAll(async () => {
  const dotenv = apiRequire("dotenv");
  dotenv.config({ path: resolve(".env"), quiet: true });
  const testDatabaseUrl =
    process.env.E2E_TEST_DATABASE_URL ||
    "postgresql://starlight:starlight_test@127.0.0.1:54330/starlight_test";
  if (!new URL(testDatabaseUrl).pathname.endsWith("/starlight_test"))
    throw new Error("E2E database must be starlight_test");
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.TEST_DATABASE_URL = testDatabaseUrl;
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "starlight-test-jwt-secret-at-least-32-characters";
  process.env.QR_SECRET = "starlight-test-qr-secret-at-least-32-characters";
  password = process.env.DEMO_PASSWORD || "StarlightE2ETest2026!";
  process.env.DEMO_PASSWORD = password;
  process.env.E2E_STAFF_EMAIL = `e2e-gate-${randomUUID()}@starlight.test`;
  const output = execFileSync(
    process.execPath,
    [
      "-r",
      apiRequire.resolve("ts-node/register"),
      "test/fixtures/seed-check-in.ts",
    ],
    { cwd: resolve("apps/api"), encoding: "utf8", timeout: 45000 },
  );
  fixture = JSON.parse(output.slice(output.indexOf("{")));
});
beforeEach(async () => {
  process.env.E2E_ISSUE_SESSIONS = "true";
  const output = execFileSync(
    process.execPath,
    [
      "-r",
      apiRequire.resolve("ts-node/register"),
      "test/fixtures/seed-check-in.ts",
    ],
    { cwd: resolve("apps/api"), encoding: "utf8", timeout: 30000 },
  );
  const sessions = JSON.parse(output.slice(output.indexOf("{")));
  customerToken = sessions.customer.accessToken;
  const cookie = (value: string) => ({
    name: "starlight_refresh",
    value,
    domain: new URL(process.env.E2E_BASE_URL || "http://127.0.0.1:3100").hostname,
    path: "/api/v1/auth",
    expires: Math.floor(Date.now() / 1000) + 7 * 86400,
    httpOnly: true,
    secure: false,
    sameSite: "Strict" as const,
  });
  customerCookies = [cookie(sessions.customer.refreshToken)];
  staffCookies = [cookie(sessions.staff.refreshToken)];
});
async function login(page: Page) {
  await page.context().addCookies(staffCookies);
  await page.goto("/staff/check-in");
  await expect(
    page.getByRole("heading", { name: "Soát vé vào phòng chiếu" }),
  ).toBeVisible();
}
async function selectShow(page: Page) {
  await page
    .locator(".assigned-show")
    .filter({ hasText: fixture.shows[0].room })
    .click();
}
test("manual ticket, explicit refusals, confirmation, history and duplicate rejection", async ({
  page,
}, info) => {
  await login(page);
  await selectShow(page);
  const manual = page.getByLabel("Mã vé", { exact: true });
  for (const [scenario, message] of [
    ["wrongShow", "Vé thuộc suất chiếu khác"],
    ["refunded", "Vé đã được hoàn tiền"],
    ["replaced", "Vé đã được đổi"],
    ["voided", "Vé đã bị hủy"],
  ]) {
    await manual.fill(fixture.tickets[scenario].id);
    await page.getByRole("button", { name: "Kiểm tra mã vé" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      message,
    );
  }
  await manual.fill(fixture.tickets.valid.id);
  await page.getByRole("button", { name: "Kiểm tra mã vé" }).click();
  await expect(
    page.getByRole("button", { name: "Xác nhận vào phòng" }),
  ).toBeDisabled();
  await page.getByLabel("Đã xác minh điều kiện độ tuổi").check();
  await page.getByRole("button", { name: "Xác nhận vào phòng" }).click();
  await expect(
    page.getByRole("heading", { name: "Đã xác nhận vào phòng" }),
  ).toBeVisible();
  await expect(page.locator(".gate-history")).toContainText(
    fixture.gateEmail,
  );
  await manual.fill(fixture.tickets.valid.id);
  await page.getByRole("button", { name: "Kiểm tra mã vé" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Vé đã check-in",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/check-in-${info.project.name}.png`,
    fullPage: true,
  });
  if (info.project.name === "chromium") {
    for (const width of [1440, 768]) {
      await page.setViewportSize({ width, height: 1024 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/check-in-${width}.png`,
        fullPage: true,
      });
    }
  }
});
test("actual QR decoding from simulated video, camera stops, explicit confirm", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/v1/me/tickets", {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
  expect(response.ok()).toBeTruthy();
  const list = await response.json();
  const qr = list.find(
    (t: { id: string }) => t.id === fixture.tickets.camera.id,
  ).qrImage;
  await page.addInitScript((dataUrl: string) => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const picture = new Image();
        picture.src = dataUrl;
        await picture.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 720;
        canvas.height = 480;
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 720, 480);
        ctx.drawImage(picture, 140, 20, 440, 440);
        const stream = canvas.captureStream(10);
        (window as unknown as { testCamera: MediaStream }).testCamera = stream;
        const timer = setInterval(() => {
          ctx.drawImage(picture, 140, 20, 440, 440);
          if (stream.getTracks().every((t) => t.readyState === "ended"))
            clearInterval(timer);
        }, 100);
        return stream;
      },
    });
    Object.defineProperty(navigator.mediaDevices, "enumerateDevices", {
      value: async () => [],
    });
  }, qr);
  await login(page);
  await selectShow(page);
  await page.getByRole("button", { name: "Bật camera quét QR" }).click();
  await expect(page.getByText("Vé đủ điều kiện kiểm tra")).toBeVisible({
    timeout: 10000,
  });
  expect(
    await page.evaluate(() =>
      (window as unknown as { testCamera: MediaStream }).testCamera
        .getTracks()
        .every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Xác nhận vào phòng" }),
  ).toBeDisabled();
  await page.getByLabel("Đã xác minh điều kiện độ tuổi").check();
  await page.getByRole("button", { name: "Xác nhận vào phòng" }).click();
  await expect(
    page.getByRole("heading", { name: "Đã xác nhận vào phòng" }),
  ).toBeVisible();
});
test("camera denial leaves manual entry usable; changing show discards old inspection", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    }),
  );
  await login(page);
  await selectShow(page);
  await page.getByRole("button", { name: "Bật camera quét QR" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Quyền camera bị từ chối",
  );
  await page
    .getByLabel("Mã vé", { exact: true })
    .fill(fixture.tickets.valid2.id);
  await page.getByRole("button", { name: "Kiểm tra mã vé" }).click();
  await expect(page.getByText("Vé đủ điều kiện kiểm tra")).toBeVisible();
  await page
    .locator(".assigned-show")
    .filter({ hasText: fixture.shows[1].room })
    .click();
  await expect(
    page.getByRole("button", { name: "Xác nhận vào phòng" }),
  ).toHaveCount(0);
});
test("customer cannot access staff controls", async ({ page }) => {
  await page.context().addCookies(customerCookies);
  await page.goto("/staff/check-in");
  await expect(page.locator(".staff-access-card h1")).toBeVisible();
  await expect(page.locator(".assigned-show")).toHaveCount(0);
});
