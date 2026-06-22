import { WebDriver } from "selenium-webdriver";
import { getAppUrl, getBackendUrl, getTestUsername, getTestPassword } from "./base-url.js";
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

/**
 * Register a test user by making the fetch from the browser context.
 * Node.js fetch to Next.js /api/auth/register returns 404 because the
 * Next.js dev server doesn't proxy that route for server-side requests,
 * but the same request succeeds when made from the browser.
 *
 * The driver must already have a page loaded on the app's origin
 * (e.g. navigate to /login first).
 */
export async function registerTestUser(
  driver: WebDriver,
  username: string,
  password: string,
): Promise<void> {
  const url = `${getBackendUrl()}/api/auth/register`;
  const body = JSON.stringify({ username, email: `${username}@test.com`, password });
  const ok = await driver.executeAsyncScript(
    `const [url, body, done] = arguments;
     fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
       .then(r => done(r.ok || r.status === 409 || r.status === 400))
       .catch(() => done(false));`,
    url,
    body,
  ) as boolean;
  if (!ok) {
    throw new Error(`Register failed for user: ${username}`);
  }
}
