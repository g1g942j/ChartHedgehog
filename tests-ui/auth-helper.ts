import { WebDriver } from "selenium-webdriver";
import { getAppUrl, getTestUsername, getTestPassword } from "./base-url.js";
import { LoginPage } from "./pages/login.page.js";
import { waitUrl } from "./waits.js";

export async function loginAs(
  driver: WebDriver,
  username = getTestUsername(),
  password = getTestPassword(),
): Promise<void> {
  const page = new LoginPage(driver);
  await page.goto();
  await page.fillUsername(username);
  await page.fillPassword(password);
  await page.submit();
  await waitUrl(driver, "/diagrams", 15_000);
}

export async function registerTestUser(username: string, password: string): Promise<void> {
  const response = await fetch(`${getAppUrl()}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email: `${username}@test.com`, password }),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`Register failed: ${response.status}`);
  }
}
