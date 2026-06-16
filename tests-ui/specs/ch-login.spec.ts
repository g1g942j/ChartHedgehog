import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "mocha";
import { createDriver } from "../driver-factory.js";
import { LoginPage } from "../pages/login.page.js";
import { getTestUsername, getTestPassword } from "../base-url.js";
import { waitUrl } from "../waits.js";

describe("Страница входа — отображение", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    const page = new LoginPage(driver);
    await page.goto();
  });

  it("отображается заголовок «Вход»", async () => {
    const page = new LoginPage(driver);
    const title = await page.title();
    assert.ok(title.includes("Вход"), `Ожидался заголовок с 'Вход', получено: ${title}`);
  });

  it("поле имени пользователя отображается", async () => {
    const page = new LoginPage(driver);
    assert.ok(await (await page.usernameInput()).isDisplayed());
  });

  it("поле пароля отображается", async () => {
    const page = new LoginPage(driver);
    assert.ok(await (await page.passwordInput()).isDisplayed());
  });

  it("кнопка «Войти» отображается", async () => {
    const page = new LoginPage(driver);
    assert.ok(await (await page.submitButton()).isDisplayed());
  });

  it("ссылка «Зарегистрироваться» ведёт на /register", async () => {
    const page = new LoginPage(driver);
    await (await page.registerLink()).click();
    await waitUrl(driver, "/register");
  });
});

describe("Страница входа — валидация", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    const page = new LoginPage(driver);
    await page.goto();
  });

  it("пустой username — поле помечается как невалидное браузером", async () => {
    const page = new LoginPage(driver);
    await page.fillPassword("somepassword");
    await page.submit();
    await driver.sleep(300);
    const url = await driver.getCurrentUrl();
    assert.ok(!url.includes("/diagrams"), "Не должен переходить на /diagrams при пустом username");
  });

  it("пустой пароль — форма не отправляется", async () => {
    const page = new LoginPage(driver);
    await page.fillUsername("someuser");
    await page.submit();
    await driver.sleep(300);
    const url = await driver.getCurrentUrl();
    assert.ok(!url.includes("/diagrams"), "Не должен переходить на /diagrams при пустом пароле");
  });

  it("неверные credentials — отображается сообщение об ошибке", async () => {
    const page = new LoginPage(driver);
    await page.fillUsername("nonexistent_user_xyzxyz");
    await page.fillPassword("wrongpassword");
    await page.submit();
    const errorText = await page.waitForError(15_000);
    assert.ok(
      errorText.length > 0,
      "Должно появиться сообщение об ошибке при неверных credentials",
    );
  });

  it("неверный пароль для существующего пользователя — ошибка", async () => {
    const page = new LoginPage(driver);
    await page.fillUsername(getTestUsername());
    await page.fillPassword("totally_wrong_password_123!");
    await page.submit();
    const errorText = await page.waitForError(15_000);
    assert.ok(errorText.length > 0);
  });
});

describe("Страница входа — успешный вход", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
  });

  after(async () => { await driver?.quit(); });

  it("верные credentials → редирект на /diagrams", async () => {
    const page = new LoginPage(driver);
    await page.goto();
    await page.fillUsername(getTestUsername());
    await page.fillPassword(getTestPassword());
    await page.submit();
    await waitUrl(driver, "/diagrams", 15_000);
    const url = await driver.getCurrentUrl();
    assert.ok(url.includes("/diagrams"), `Ожидался переход на /diagrams, текущий URL: ${url}`);
  });
});
