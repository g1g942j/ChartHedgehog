import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "mocha";
import { createDriver } from "../driver-factory.js";
import { RegisterPage } from "../pages/register.page.js";
import { waitUrl } from "../waits.js";

describe("Страница регистрации — отображение", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    await new RegisterPage(driver).goto();
  });

  it("отображается заголовок «Регистрация»", async () => {
    const page = new RegisterPage(driver);
    const title = await page.title();
    assert.ok(title.includes("Регистрация"), `Получено: ${title}`);
  });

  it("все поля формы отображаются", async () => {
    const page = new RegisterPage(driver);
    assert.ok(await (await page.usernameInput()).isDisplayed());
    assert.ok(await (await page.emailInput()).isDisplayed());
    assert.ok(await (await page.passwordInput()).isDisplayed());
    assert.ok(await (await page.confirmPasswordInput()).isDisplayed());
    assert.ok(await (await page.fullNameInput()).isDisplayed());
  });

  it("ссылка «Войти» ведёт на /", async () => {
    const page = new RegisterPage(driver);
    await (await page.loginLink()).click();
    await waitUrl(driver, "/");
  });
});

describe("Страница регистрации — валидация полей", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    await new RegisterPage(driver).goto();
  });

  it("пустая форма — ошибки на обязательных полях", async () => {
    const page = new RegisterPage(driver);
    await page.submit();
    const errors = await page.fieldErrors();
    assert.ok(errors.length >= 3, `Ожидались ошибки валидации, получено: ${JSON.stringify(errors)}`);
  });

  it("username: 2 символа — ошибка «минимум 3 символа»", async () => {
    const page = new RegisterPage(driver);
    await page.fill({ username: "ab" });
    await page.submit();
    const errors = await page.fieldErrors();
    assert.ok(
      errors.some((e) => e.includes("минимум 3")),
      `Ожидалась ошибка про 3 символа, получено: ${JSON.stringify(errors)}`,
    );
  });

  it("username: 3 символа — нет ошибки username (граничное значение)", async () => {
    const page = new RegisterPage(driver);
    await page.fill({
      username: "abc",
      email: "test@test.com",
      password: "password123",
      confirmPassword: "password123",
    });
    await page.submit();
    const errors = await page.fieldErrors();
    assert.ok(
      !errors.some((e) => e.includes("минимум 3")),
      `Не должно быть ошибки про 3 символа, получено: ${JSON.stringify(errors)}`,
    );
  });

  it("username: 51 символ — ошибка «максимум 50 символов»", async () => {
    const page = new RegisterPage(driver);
    await page.fill({ username: "a".repeat(51) });
    await page.submit();
    const errors = await page.fieldErrors();
    assert.ok(
      errors.some((e) => e.includes("максимум 50")),
      `Ожидалась ошибка про 50 символов, получено: ${JSON.stringify(errors)}`,
    );
  });

  it("некорректный email — ошибка «Некорректный email»", async () => {
    const page = new RegisterPage(driver);
    await page.fill({ username: "validuser", email: "notanemail" });
    await page.submit();
    const errors = await page.fieldErrors();
    assert.ok(
      errors.some((e) => e.includes("Некорректный email")),
      `Ожидалась ошибка про email, получено: ${JSON.stringify(errors)}`,
    );
  });

  it("email без домена — ошибка «Некорректный email»", async () => {
    const page = new RegisterPage(driver);
    await page.fill({ username: "validuser", email: "user@" });
    await page.submit();
    const errors = await page.fieldErrors();
    assert.ok(
      errors.some((e) => e.includes("Некорректный email")),
      `Получено: ${JSON.stringify(errors)}`,
    );
  });

  it("пароль: 5 символов — ошибка «минимум 6 символов»", async () => {
    const page = new RegisterPage(driver);
    await page.fill({ username: "validuser", email: "user@test.com", password: "12345" });
    await page.submit();
    const errors = await page.fieldErrors();
    assert.ok(
      errors.some((e) => e.includes("минимум 6")),
      `Ожидалась ошибка про 6 символов, получено: ${JSON.stringify(errors)}`,
    );
  });

  it("пароль: 6 символов — нет ошибки о минимуме (граничное значение)", async () => {
    const page = new RegisterPage(driver);
    await page.fill({
      username: "validuser",
      email: "user@test.com",
      password: "123456",
      confirmPassword: "123456",
    });
    await page.submit();
    const errors = await page.fieldErrors();
    assert.ok(
      !errors.some((e) => e.includes("минимум 6")),
      `Не должно быть ошибки минимума пароля, получено: ${JSON.stringify(errors)}`,
    );
  });

  it("пароли не совпадают — ошибка «Пароли не совпадают»", async () => {
    const page = new RegisterPage(driver);
    await page.fill({
      username: "validuser",
      email: "user@test.com",
      password: "password123",
      confirmPassword: "different456",
    });
    await page.submit();
    const errors = await page.fieldErrors();
    assert.ok(
      errors.some((e) => e.includes("не совпадают")),
      `Ожидалась ошибка несовпадения паролей, получено: ${JSON.stringify(errors)}`,
    );
  });

  it("confirmPassword пустой — ошибка «Подтвердите пароль»", async () => {
    const page = new RegisterPage(driver);
    await page.fill({
      username: "validuser",
      email: "user@test.com",
      password: "password123",
      confirmPassword: "",
    });
    await page.submit();
    const errors = await page.fieldErrors();
    assert.ok(
      errors.some((e) => e.includes("Подтвердите пароль")),
      `Получено: ${JSON.stringify(errors)}`,
    );
  });
});

describe("Страница регистрации — успешная регистрация", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
  });

  after(async () => { await driver?.quit(); });

  it("корректные данные → сообщение об успехе и редирект на /", async () => {
    const page = new RegisterPage(driver);
    await page.goto();
    const uniqueUser = `testui_${Date.now()}`;
    await page.fill({
      username: uniqueUser,
      email: `${uniqueUser}@test.com`,
      password: "TestPass123",
      confirmPassword: "TestPass123",
      fullName: "Test User",
    });
    await page.submit();
    const hasSuccess = await page.hasSuccessAlert();
    assert.ok(hasSuccess, "Должно появиться сообщение об успешной регистрации");
    await waitUrl(driver, "/", 10_000);
  });

  it("дублирующийся username → ошибка сервера", async () => {
    const page = new RegisterPage(driver);
    await page.goto();
    const uniqueUser = `testdup_${Date.now()}`;
    const commonData = {
      username: uniqueUser,
      email: `${uniqueUser}@test.com`,
      password: "TestPass123",
      confirmPassword: "TestPass123",
    };
    await page.fill(commonData);
    await page.submit();
    await page.goto();
    await page.fill({ ...commonData, email: `${uniqueUser}2@test.com` });
    await page.submit();
    const hasError = await page.hasErrorAlert();
    assert.ok(hasError, "Должна появиться ошибка при дублирующемся username");
  });
});
