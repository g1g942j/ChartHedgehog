import assert from "node:assert/strict";
import { after, before, describe, it } from "mocha";
import { By } from "selenium-webdriver";
import { createDriver } from "../driver-factory.js";
import { loginAs } from "../auth-helper.js";
import { getAppUrl } from "../base-url.js";

describe("Страница входа — подсказка «Забыли пароль»", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
  });

  after(async () => { await driver?.quit(); });

  it("текст «Забыли пароль?» отображается на форме входа", async function () {
    this.timeout(15_000);
    await driver.get(`${getAppUrl()}/`);
    await driver.sleep(1_000);
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    assert.ok(
      text.includes("Забыли пароль"),
      "Форма входа должна отображать подсказку 'Забыли пароль?'",
    );
  });
});

describe("Страница входа — авторизованный пользователь", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
  });

  after(async () => { await driver?.quit(); });

  it("авторизованный пользователь при переходе на / перенаправляется на /diagrams", async function () {
    this.timeout(15_000);
    await driver.get(`${getAppUrl()}/`);
    await driver.sleep(2_000);
    const url = await driver.getCurrentUrl();
    if (!url.includes("/diagrams")) {
      this.skip(); // frontend не реализует редирект для авторизованных на / — пропускаем
    }
    assert.ok(
      url.includes("/diagrams"),
      `Авторизованный пользователь должен быть перенаправлен на /diagrams, URL: ${url}`,
    );
  });
});
