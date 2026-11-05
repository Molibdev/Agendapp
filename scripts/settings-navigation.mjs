import { expect } from "@playwright/test";
export async function settingsSection(page, title) {
  const area = page.getByTestId("settings-page");
  await expect(area).toBeVisible();
  const back = page.getByRole("button", {
    name: "Volver a Ajustes",
    exact: true,
  });
  if (await back.count()) {
    if (await area.getByText(title, { exact: true }).count()) return;
    await back.click();
  }
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(back).toBeVisible();
}
