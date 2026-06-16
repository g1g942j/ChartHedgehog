import { By, WebDriver, WebElement, until } from "selenium-webdriver";

export async function waitVisible(
  driver: WebDriver,
  locator: By,
  timeoutMs = 15_000,
): Promise<WebElement> {
  const el = await driver.wait(until.elementLocated(locator), timeoutMs);
  await driver.wait(until.elementIsVisible(el), timeoutMs);
  return el;
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
