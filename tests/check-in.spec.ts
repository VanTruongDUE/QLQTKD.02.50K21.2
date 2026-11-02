import {
  test,
  expect,
  type Page,
  type BrowserContext,
  request as apiRequest,
} from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const apiRequire = createRequire(resolve("apps/api/package.json"));
type Fixture = {
  shows: { id: string; room: string }[];
  tickets: Record<string, { id: string; showtimeId: string }>;
};
let fixture: Fixture;
let password: string;
let customerCookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
let customerToken: string;
test.beforeAll(async () => {
  const dotenv = apiRequire("dotenv");
  dotenv.config({ path: resolve(".env"), quiet: true });
  password = process.env.DEMO_PASSWORD!;
  const output = execFileSync(
    process.execPath,
    [
      "-r",
      apiRequire.resolve("ts-node/register"),
      "src/database/seed-check-in.ts",
    ],
    { cwd: resolve("apps/api"), encoding: "utf8", timeout: 45000 },
  );
  fixture = JSON.parse(output.slice(output.indexOf("{")));
  const context = await apiRequest.newContext({
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
  });
  const response = await context.post("/api/v1/auth/login", {
    headers: { Origin: "http://localhost:3000" },
    data: { email: "checkin@starlight.demo", password },
  });
  expect(response.ok()).toBeTruthy();
  customerToken = (await response.json()).accessToken;
  customerCookies = (await context.storageState()).cookies;
  await context.dispose();
});
async function login(page: Page, email = "soatve@starlight.demo") {
  await page.goto("/staff/check-in");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Mật khẩu").fill(password);
  await dialog.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
async function selectShow(page: Page) {
  await page.getByLabel("Chọn suất chiếu").selectOption(fixture.shows[0].id);
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
    "soatve@starlight.demo",
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
  const list = await (
    await request.get("/api/v1/me/tickets", {
      headers: { Authorization: `Bearer ${customerToken}` },
    })
  ).json();
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
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 640, 480);
        ctx.drawImage(picture, 150, 70, 340, 340);
        const stream = canvas.captureStream(10);
        (window as unknown as { testCamera: MediaStream }).testCamera = stream;
        const timer = setInterval(() => {
          ctx.drawImage(picture, 150, 70, 340, 340);
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
  await expect(page.getByText("Vé đủ điều kiện kiểm tra")).toBeVisible();
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
  await page.getByLabel("Chọn suất chiếu").selectOption(fixture.shows[1].id);
  await expect(
    page.getByRole("button", { name: "Xác nhận vào phòng" }),
  ).toHaveCount(0);
});
test("customer cannot access staff controls", async ({ page }) => {
  await page.context().addCookies(customerCookies);
  await page.goto("/staff/check-in");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "không có quyền soát vé",
  );
  await expect(page.getByLabel("Chọn suất chiếu")).toHaveCount(0);
});
