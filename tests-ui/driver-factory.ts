import { Builder, Browser, WebDriver } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome.js";

export async function createDriver(): Promise<WebDriver> {
  const options = new Options();
  if (process.env.CI || process.env.SELENIUM_HEADLESS === "1") {
    options.addArguments("--headless=new", "--window-size=1280,900");
  }
  options.addArguments(
    "--disable-search-engine-choice-screen",
    "--no-sandbox",
    "--disable-dev-shm-usage",
  );
  return new Builder().forBrowser(Browser.CHROME).setChromeOptions(options).build();
}
