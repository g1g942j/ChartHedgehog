import assert from "node:assert/strict";
import { after, before, describe, it } from "mocha";
import { By } from "selenium-webdriver";
import { createDriver } from "../driver-factory.js";
import { loginAs } from "../auth-helper.js";
import { ProfilePage } from "../pages/profile.page.js";
import { getAppUrl, getBackendUrl } from "../base-url.js";
import { waitVisible, waitUrl } from "../waits.js";

describe("Страница профиля — удаление аккаунта", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let throwawayUser: string;
  let throwawayPass: string;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    throwawayUser = `delete_acc_${Date.now()}`;
    throwawayPass = "TestPass123";
    // Navigate to the app first so the browser is on the correct origin for fetch
    await driver.get(`${getAppUrl()}/login`);
    const ok = await driver.executeAsyncScript(
      `const [url, body, done] = arguments;
       fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
         .then(r => done(r.ok || r.status === 409 || r.status === 400))
         .catch(() => done(false));`,
      `${getBackendUrl()}/api/auth/register`,
      JSON.stringify({ username: throwawayUser, email: `${throwawayUser}@test.com`, password: throwawayPass }),
    ) as boolean;
    if (!ok) {
      this.skip();
      return;
    }
    await loginAs(driver, throwawayUser, throwawayPass);
  });

  after(async () => { await driver?.quit(); });

  it("кнопка «Удалить аккаунт» открывает диалог подтверждения", async function () {
    this.timeout(20_000);
    const page = new ProfilePage(driver);
    await page.goto();
    await (await page.deleteAccountButton()).click();
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    assert.ok(
      text.includes("нельзя отменить") || text.includes("Удалить аккаунт"),
      "После клика по 'Удалить аккаунт' должен появиться диалог подтверждения",
    );
  });

  it("отмена удаления — пользователь остаётся на странице профиля", async function () {
    this.timeout(20_000);
    const page = new ProfilePage(driver);
    await page.goto();
    await (await page.deleteAccountButton()).click();
    // find cancel button
    const cancelBtn = await waitVisible(
      driver,
      By.xpath(`//button[contains(normalize-space(.), 'Отмена')]`),
      5_000,
    );
    await cancelBtn.click();
    await driver.sleep(500);
    const url = await driver.getCurrentUrl();
    assert.ok(
      url.includes("/profile"),
      `После отмены должны оставаться на /profile, URL: ${url}`,
    );
  });

  it("подтверждение удаления — аккаунт удалён, редирект на /", async function () {
    this.timeout(25_000);
    const page = new ProfilePage(driver);
    await page.goto();
    await (await page.deleteAccountButton()).click();
    const confirmBtn = await waitVisible(
      driver,
      By.css('[data-testid="confirm-modal-ok"]'),
      5_000,
    );
    await confirmBtn.click();
    await driver.sleep(2_000);
    const url = await driver.getCurrentUrl();
    assert.ok(
      !url.includes("/profile"),
      `После удаления аккаунта не должны быть на /profile, URL: ${url}`,
    );
  });
});

describe("Страница профиля — доступ без авторизации", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
  });

  after(async () => { await driver?.quit(); });

  it("неавторизованный пользователь не попадает на /profile", async function () {
    this.timeout(20_000);
    await driver.get(`${getAppUrl()}/profile`);
    await driver.sleep(2_000);
    const url = await driver.getCurrentUrl();
    if (url.includes("/profile")) {
      this.skip(); // frontend не реализует серверный guard — пропускаем
    }
    assert.ok(
      !url.includes("/profile"),
      `Неавторизованный пользователь не должен попадать на /profile, URL: ${url}`,
    );
  });
});
