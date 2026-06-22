import { By, WebDriver, WebElement, until } from "selenium-webdriver";

export async function waitVisible(
  driver: WebDriver,
  locator: By,
  timeoutMs = 15_000,
): Promise<WebElement> {
  // Store the found element in a closure variable and return a boolean from the
  // condition function. Returning WebElement directly would cause driver.wait to
  // treat it as a Thenable and await it, resolving to void → condition never
  // satisfies. The closure approach avoids that ambiguity entirely.
  let found: WebElement | null = null;
  await driver.wait(async (): Promise<boolean> => {
    try {
      const els = await driver.findElements(locator);
      if (els.length === 0) return false;
      const el = els[0]!;
      if (await el.isDisplayed()) {
        found = el;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, timeoutMs);
  return found!;
}

export async function waitLocated(
  driver: WebDriver,
  locator: By,
  timeoutMs = 15_000,
): Promise<WebElement> {
  return driver.wait(until.elementLocated(locator), timeoutMs);
}

export async function waitGone(
  driver: WebDriver,
  locator: By,
  timeoutMs = 15_000,
): Promise<void> {
  await driver.wait(async () => {
    const els = await driver.findElements(locator);
    return els.length === 0;
  }, timeoutMs);
}

export async function waitTextInPage(
  driver: WebDriver,
  substring: string,
  timeoutMs = 20_000,
): Promise<void> {
  await driver.wait(async () => {
    const bodies = await driver.findElements(By.tagName("body"));
    if (!bodies.length) return false;
    const text = await bodies[0]!.getText();
    return text.includes(substring);
  }, timeoutMs);
}

export async function waitToast(
  driver: WebDriver,
  substring: string,
  timeoutMs = 8_000,
): Promise<string> {
  const container = By.css('[role="region"][aria-label="Уведомления"]');
  await driver.wait(until.elementLocated(container), timeoutMs);
  let found: WebElement | null = null;
  await driver.wait(async (): Promise<boolean> => {
    const msgs = await driver.findElements(By.css('[aria-label="Уведомления"] [class*="Message"]'));
    for (const m of msgs) {
      const text = await m.getText();
      if (text.includes(substring)) {
        found = m;
        return true;
      }
    }
    return false;
  }, timeoutMs);
  return (await found!.getText()).trim();
}

export async function waitUrl(
  driver: WebDriver,
  urlSubstring: string,
  timeoutMs = 15_000,
): Promise<void> {
  await driver.wait(async () => {
    const url = await driver.getCurrentUrl();
    return url.includes(urlSubstring);
  }, timeoutMs);
}
