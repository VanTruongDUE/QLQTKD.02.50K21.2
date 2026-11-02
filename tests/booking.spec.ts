import { test, expect } from "@playwright/test";
test("movie → showtime → seats → mock payment → QR persists after reload", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hôm nay, xem gì?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Chưa có tài khoản? Đăng ký" })
    .click();
  await dialog
    .getByLabel("Email")
    .fill(`browser-${Date.now()}-${info.project.name}@starlight.demo`);
  await dialog.getByLabel("Mật khẩu").fill("BrowserDemo2026!");
  await dialog
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button")
    .filter({
      has: page.getByRole("heading", {
        name: "Chuyến tàu bình minh",
        exact: true,
      }),
    })
    .click();
  await page
    .locator(".show-list button")
    .filter({ hasText: "Phòng 1" })
    .first()
    .click();
  const available = page.locator(".seat.available:not(:disabled)");
  await expect(available.first()).toBeVisible();
  const seatName = await available.first().getAttribute("aria-label");
  await available.first().click();
  await page.getByRole("button", { name: "Giữ ghế & tiếp tục" }).click();
  await expect(page.getByRole("timer")).toContainText("Còn");
  await page
    .getByRole("button", { name: "Thanh toán thành công", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Vé của tôi", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /QR vé ghế/ })).toHaveCount(1);
  await expect(page.locator(".seat-name")).toContainText(
    seatName!.replace("Ghế ", ""),
  );
  await page.reload();
  await page.getByRole("button", { name: "Vé của tôi", exact: true }).click();
  await expect(page.getByRole("img", { name: /QR vé ghế/ })).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/tickets-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
});
