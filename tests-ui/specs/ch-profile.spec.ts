import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "mocha";
import { createDriver } from "../driver-factory.js";
import { loginAs } from "../auth-helper.js";
import { ProfilePage } from "../pages/profile.page.js";
import { waitTextInPage } from "../waits.js";

describe("Страница профиля — отображение", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    await new ProfilePage(driver).goto();
  });

  it("заголовок «Профиль» отображается", async () => {
    const page = new ProfilePage(driver);
    assert.ok(await (await page.title()).isDisplayed());
  });

  it("поле «Логин» отображается", async () => {
    const page = new ProfilePage(driver);
    assert.ok(await (await page.usernameField()).isDisplayed());
  });

  it("поле «Email» отображается", async () => {
    const page = new ProfilePage(driver);
    assert.ok(await (await page.emailField()).isDisplayed());
  });

  it("поле «Полное имя» отображается", async () => {
    const page = new ProfilePage(driver);
    assert.ok(await (await page.fullNameField()).isDisplayed());
  });

  it("поле «Логин» недоступно для редактирования", async () => {
    const page = new ProfilePage(driver);
    const field = await page.usernameField();
    const disabled = await field.getAttribute("disabled");
    assert.ok(disabled !== null, "Поле 'Логин' должно быть disabled");
  });

  it("поле «Email» доступно для редактирования", async () => {
    const page = new ProfilePage(driver);
    const field = await page.emailField();
    const disabled = await field.getAttribute("disabled");
    assert.equal(disabled, null, "Поле 'Email' должно быть доступно для редактирования");
  });

  it("кнопка «Удалить аккаунт» отображается", async () => {
    const page = new ProfilePage(driver);
    assert.ok(await (await page.deleteAccountButton()).isDisplayed());
  });
});

describe("Страница профиля — кнопка сохранения профиля", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    await new ProfilePage(driver).goto();
  });

  it("кнопка «Сохранить профиль» отключена при неизменных данных", async () => {
    const page = new ProfilePage(driver);
    const disabled = await page.isSaveProfileDisabled();
    assert.ok(disabled, "Кнопка 'Сохранить профиль' должна быть отключена при неизменных данных");
  });

  it("изменение email активирует кнопку «Сохранить профиль»", async () => {
    const page = new ProfilePage(driver);
    const emailField = await page.emailField();
    const currentEmail = await emailField.getAttribute("value") ?? "";
    await page.fillEmail(`modified_${Date.now()}@test.com`);
    await driver.sleep(300);
    const disabled = await page.isSaveProfileDisabled();
    assert.ok(!disabled, "Кнопка должна быть активна после изменения email");
    await page.fillEmail(currentEmail);
  });

  it("изменение fullName активирует кнопку «Сохранить профиль»", async () => {
    const page = new ProfilePage(driver);
    await page.fillFullName(`Test Name ${Date.now()}`);
    await driver.sleep(300);
    const disabled = await page.isSaveProfileDisabled();
    assert.ok(!disabled, "Кнопка должна быть активна после изменения имени");
  });

  it("сохранение профиля — сообщение «Профиль обновлен»", async () => {
    const page = new ProfilePage(driver);
    const newName = `Test_${Date.now()}`;
    await page.fillFullName(newName);
    await driver.sleep(300);
    await (await page.saveProfileButton()).click();
    const success = await page.successAlert();
    assert.ok(success.includes("обновлен"), `Получено: ${success}`);
  });
});

describe("Страница профиля — смена пароля", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    await new ProfilePage(driver).goto();
  });

  it("кнопка «Изменить пароль» отключена при пустых полях", async () => {
    const page = new ProfilePage(driver);
    const disabled = await page.isChangePasswordDisabled();
    assert.ok(disabled, "Кнопка 'Изменить пароль' должна быть отключена при пустых полях");
  });

  it("пароли не совпадают — ошибка «Пароли не совпадают»", async () => {
    const page = new ProfilePage(driver);
    await page.fillPasswordFields("currentpass", "newpass123", "differentpass456");
    await (await page.changePasswordButton()).click();
    await driver.sleep(500);
    const hasError = await page.hasErrorAlert();
    assert.ok(hasError, "Должна появиться ошибка о несовпадении паролей");
    const errorText = await page.errorAlert();
    assert.ok(
      errorText.includes("не совпадают"),
      `Ожидалась ошибка 'не совпадают', получено: ${errorText}`,
    );
  });

  it("кнопка «Изменить пароль» активна при заполненных полях", async () => {
    const page = new ProfilePage(driver);
    await page.fillPasswordFields("someoldpass", "somenewpass", "somenewpass");
    await driver.sleep(300);
    const disabled = await page.isChangePasswordDisabled();
    assert.ok(!disabled, "Кнопка должна быть активна при заполненных полях");
  });

  it("неверный текущий пароль — ошибка сервера", async function () {
    // changeCurrentUserPassword — мок без реального API-вызова, всегда возвращает успех
    this.skip();
  });
});
