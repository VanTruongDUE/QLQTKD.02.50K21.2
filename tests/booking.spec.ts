import { test, expect } from "@playwright/test";

test("customer registers, books a future showtime, pays in test mode and keeps the QR after reload", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Hôm nay, xem gì/ })).toBeVisible();

  await page.getByRole("button", { name: /^Đăng nhập(?: \/ Đăng ký)?$/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Đăng ký khách hàng" }).click();
  const email = `browser-${Date.now()}-${info.project.name}@starlight.test`;
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Mật khẩu").fill("BrowserTest2026!");
  await dialog.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(dialog).not.toBeVisible();

  const showtimes = await page
    .getByRole("button", { name: /^\d{2}:\d{2}.*ghế$/ })
    .all();
  let availableSeats = page.locator(".overflow-x-auto button:not(:disabled)");
  for (const showtime of [...showtimes].reverse()) {
    await showtime.click();
    await page.locator(".overflow-x-auto button").first().waitFor();
    if (await availableSeats.count()) break;
  }

  const availableSeat = availableSeats.first();
  await expect(availableSeat).toBeVisible();
  const seatName = (await availableSeat.textContent())?.trim();
  await availableSeat.click();
  await page.getByRole("button", { name: "Tiếp tục: Bắp Nước >" }).click();
  await page.getByRole("button", { name: "Tiếp tục: Thanh Toán >" }).click();

  await page.getByPlaceholder(/gmail\.com/).fill(email);
  await page.getByRole("checkbox").last().check();
  await page.getByRole("button", { name: /Thanh Toán Ngay/ }).click();
  await expect(
    page.getByRole("heading", { name: "Đặt vé xem phim thành công" }),
  ).toBeVisible();
  await expect(page.getByText(seatName!, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Mở Thẻ Vé Điện Tử (Check-in)" })
    .click();

  if (info.project.name === "chromium") {
    await page.reload();
    await page.getByRole("button", { name: "Smart Check-in" }).click();
  }
  await page
    .getByRole("region", { name: "Danh sách phim đã đặt" })
    .getByRole("button")
    .first()
    .click();
  await expect(page.getByRole("img", { name: /Mã QR soát vé ghế/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
