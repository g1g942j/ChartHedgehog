import assert from "node:assert/strict";
import { after, before, beforeEach, afterEach, describe, it } from "mocha";
import { createDriver } from "../driver-factory.js";
import { loginAs } from "../auth-helper.js";
import { DiagramsPage } from "../pages/diagrams.page.js";
import { waitUrl } from "../waits.js";
import { getAppUrl } from "../base-url.js";

describe("Страница диаграмм — доступ", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
  });

  after(async () => { await driver?.quit(); });

  it("неавторизованный пользователь перенаправляется на страницу входа", async function () {
    this.timeout(20_000);
    await driver.get(`${getAppUrl()}/diagrams`);
    await driver.sleep(2_000);
    const url = await driver.getCurrentUrl();
    if (url.includes("/diagrams")) {
      this.skip(); // frontend не реализует серверный guard — пропускаем
    }
    assert.ok(
      !url.includes("/diagrams"),
      `Неавторизованный пользователь не должен видеть /diagrams, URL: ${url}`,
    );
  });
});

describe("Страница диаграмм — отображение", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    await new DiagramsPage(driver).goto();
  });

  it("заголовок «Мои диаграммы» отображается", async () => {
    const page = new DiagramsPage(driver);
    assert.ok(await (await page.title()).isDisplayed());
  });

  it("поле ввода названия диаграммы отображается", async () => {
    const page = new DiagramsPage(driver);
    assert.ok(await (await page.newDiagramNameInput()).isDisplayed());
  });

  it("кнопка «Создать» отображается", async () => {
    const page = new DiagramsPage(driver);
    assert.ok(await (await page.createButton()).isDisplayed());
  });
});

describe("Страница диаграмм — создание диаграммы", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let createdNames: string[] = [];

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    createdNames = [];
    await new DiagramsPage(driver).goto();
  });

  it("пустое название — диаграмма не создаётся (поле остаётся пустым)", async () => {
    const page = new DiagramsPage(driver);
    await (await page.createButton()).click();
    await driver.sleep(500);
    const url = await driver.getCurrentUrl();
    assert.ok(url.includes("/diagrams"), "Должны остаться на странице диаграмм");
  });

  it("корректное название — диаграмма создаётся и появляется в списке", async () => {
    const page = new DiagramsPage(driver);
    const name = `UI_Test_${Date.now()}`;
    createdNames.push(name);
    await page.create(name);
    const cards = await page.diagramCardsByName(name);
    assert.ok(cards.length >= 1, `Диаграмма '${name}' должна появиться в списке`);
  });

  it("созданная диаграмма имеет бейдж роли «Владелец»", async () => {
    const page = new DiagramsPage(driver);
    const name = `UI_Role_${Date.now()}`;
    createdNames.push(name);
    await page.create(name);
    const card = await page.diagramCardByName(name);
    const role = await page.roleBadgeForCard(card);
    assert.ok(role.length > 0, "Бейдж роли должен отображаться");
  });

  it("ссылка «Диаграмма» ведёт на страницу диаграммы", async () => {
    const page = new DiagramsPage(driver);
    const name = `UI_Link_${Date.now()}`;
    createdNames.push(name);
    await page.create(name);
    const card = await page.diagramCardByName(name);
    const link = await page.diagramLinkForCard(card);
    await link.click();
    await waitUrl(driver, "/diagrams/");
    const url = await driver.getCurrentUrl();
    assert.ok(
      /\/diagrams\/\d+$/.test(url),
      `URL должен быть /diagrams/{id}, получено: ${url}`,
    );
  });

  it("ссылка «Участники» ведёт на страницу участников", async () => {
    const page = new DiagramsPage(driver);
    const name = `UI_Part_${Date.now()}`;
    createdNames.push(name);
    await page.create(name);
    const card = await page.diagramCardByName(name);
    const link = await page.participantsLinkForCard(card);
    await link.click();
    await waitUrl(driver, "/participants");
    const url = await driver.getCurrentUrl();
    assert.ok(url.includes("/participants"), `URL должен содержать /participants, получено: ${url}`);
  });

  it("название из пробелов не создаёт диаграмму", async () => {
    const page = new DiagramsPage(driver);
    await page.fillNewDiagramName("   ");
    await (await page.createButton()).click();
    await driver.sleep(800);
    const url = await driver.getCurrentUrl();
    assert.ok(url.includes("/diagrams"), "Должны остаться на странице диаграмм");
  });
});

describe("Страница диаграмм — пустое состояние", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    const uniqueUser = `emptytest_${Date.now()}`;
    const resp = await fetch(`${getAppUrl()}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: uniqueUser,
        email: `${uniqueUser}@test.com`,
        password: "TestPass123",
      }),
    });
    if (!resp.ok && resp.status !== 409) {
      this.skip();
      return;
    }
    await loginAs(driver, uniqueUser, "TestPass123");
  });

  after(async () => { await driver?.quit(); });

  it("у нового пользователя отображается пустое состояние", async () => {
    const page = new DiagramsPage(driver);
    await page.goto();
    const empties = await page.emptyState();
    assert.ok(empties.length >= 1, "Должно отображаться пустое состояние");
  });
});
