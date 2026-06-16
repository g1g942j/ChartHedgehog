import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "mocha";
import { createDriver } from "../driver-factory.js";
import { loginAs } from "../auth-helper.js";
import { NavbarPage } from "../pages/navbar.page.js";
import { waitUrl } from "../waits.js";
import { getAppUrl } from "../base-url.js";

describe("Навбар — отображение и навигация", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    await driver.get(`${getAppUrl()}/diagrams`);
  });

  it("логотип ChartHedgehog отображается", async () => {
    const nav = new NavbarPage(driver);
    assert.ok(await (await nav.brandLink()).isDisplayed());
  });

  it("ссылка «Мои диаграммы» в навигации отображается", async () => {
    const nav = new NavbarPage(driver);
    assert.ok(await (await nav.diagramsNavLink()).isDisplayed());
  });

  it("логотип ведёт на /diagrams", async () => {
    const nav = new NavbarPage(driver);
    await (await nav.brandLink()).click();
    await waitUrl(driver, "/diagrams");
  });

  it("кнопка «Мои диаграммы» ведёт на /diagrams", async () => {
    await driver.get(`${getAppUrl()}/profile`);
    const nav = new NavbarPage(driver);
    await (await nav.diagramsNavLink()).click();
    await waitUrl(driver, "/diagrams");
  });
});

describe("Навбар — меню пользователя", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    await driver.get(`${getAppUrl()}/diagrams`);
  });

  it("меню открывается по клику на имя пользователя", async () => {
    const nav = new NavbarPage(driver);
    await nav.openUserMenu();
    assert.ok(await (await nav.profileMenuItem()).isDisplayed());
    assert.ok(await (await nav.logoutMenuItem()).isDisplayed());
  });

  it("пункт «Профиль» ведёт на /profile", async () => {
    const nav = new NavbarPage(driver);
    await nav.openUserMenu();
    await (await nav.profileMenuItem()).click();
    await waitUrl(driver, "/profile");
  });

  it("пункт «Выйти» завершает сессию и переходит на /", async () => {
    const nav = new NavbarPage(driver);
    await nav.openUserMenu();
    await (await nav.logoutMenuItem()).click();
    await driver.wait(async () => {
      const url = await driver.getCurrentUrl();
      return !url.includes("/diagrams");
    }, 10_000, "После выхода URL должен измениться с /diagrams");
    const url = await driver.getCurrentUrl();
    assert.ok(!url.includes("/diagrams"), `URL после выхода: ${url}`);
  });
});

describe("Навбар — переключатель темы", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    await driver.get(`${getAppUrl()}/diagrams`);
  });

  it("кнопка темы имеет aria-label", async () => {
    const nav = new NavbarPage(driver);
    const label = await nav.currentThemeAriaLabel();
    assert.ok(label.length > 0, "Кнопка темы должна иметь aria-label");
  });

  it("клик по кнопке темы меняет aria-label", async () => {
    const nav = new NavbarPage(driver);
    const beforeLabel = await nav.currentThemeAriaLabel();
    await nav.clickThemeToggle();
    const afterLabel = await nav.currentThemeAriaLabel();
    assert.notEqual(beforeLabel, afterLabel, "aria-label темы должен изменяться после клика");
  });
});
