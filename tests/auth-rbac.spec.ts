import { expect, test } from "@playwright/test";

const password = process.env.DEMO_PASSWORD || "StarlightE2ETest2026!";

test("rejects an invalid password and lets a manager open the protected dashboard", async ({
  page,
}) => {
  await page.goto("/manager/accounts");
  await page.locator(".staff-access-card button").click();

  const dialog = page.getByRole("dialog");
  const email = dialog.locator('input[type="email"]');
  const passwordInput = dialog.locator('input[type="password"]');
  const submit = dialog.locator("form button").last();

  await email.fill("quanly@starlight.demo");
  await passwordInput.fill("SaiMatKhau-2026!");
  await submit.click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Email hoặc mật khẩu không đúng",
  );

  await passwordInput.fill(password);
  await submit.click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dashboard kinh doanh" }),
  ).toBeVisible();
  await expect(page.locator(".staff-topbar-actions span")).toHaveText(
    "quanly@starlight.demo",
  );
});

