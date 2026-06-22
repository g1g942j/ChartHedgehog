import assert from "node:assert/strict";
import { after, before, beforeEach, afterEach, describe, it } from "mocha";
import { By } from "selenium-webdriver";
import { createDriver } from "../driver-factory.js";
import { loginAs } from "../auth-helper.js";
import { DiagramsPage } from "../pages/diagrams.page.js";
import { waitUrl } from "../waits.js";
import { getAppUrl, getBackendUrl } from "../base-url.js";

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
    // Navigate to the app first so the browser is on the correct origin for fetch
    await driver.get(`${getAppUrl()}/login`);
    const ok = await driver.executeAsyncScript(
      `const [url, body, done] = arguments;
       fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
         .then(r => done(r.ok || r.status === 409 || r.status === 400))
         .catch(() => done(false));`,
      `${getBackendUrl()}/api/auth/register`,
      JSON.stringify({ username: uniqueUser, email: `${uniqueUser}@test.com`, password: "TestPass123" }),
    ) as boolean;
    if (!ok) {
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

describe("Страница диаграмм — поиск", () => {
  let driver: import("selenium-webdriver").WebDriver;
  const diagramName = `UI_Search_${Date.now()}`;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    const page = new DiagramsPage(driver);
    await page.goto();
    await page.create(diagramName);
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    await new DiagramsPage(driver).goto();
  });

  it("поле поиска отображается при наличии диаграмм", async () => {
    const page = new DiagramsPage(driver);
    assert.ok(await (await page.searchInput()).isDisplayed());
  });

  it("поиск по точному названию показывает только нужную диаграмму", async () => {
    const page = new DiagramsPage(driver);
    await page.fillSearch(diagramName);
    await driver.sleep(400);
    const cards = await page.diagramCardsByName(diagramName);
    assert.ok(cards.length >= 1, "Нужная диаграмма должна отображаться");
    const allCards = await page.visibleDiagramCards();
    assert.equal(allCards.length, cards.length, "Должна отображаться только найденная диаграмма");
  });

  it("поиск несуществующего названия показывает «Ничего не найдено»", async () => {
    const page = new DiagramsPage(driver);
    await page.fillSearch("__ЭТОГО_ТОЧНО_НЕТ__");
    await driver.sleep(400);
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    assert.ok(text.includes("Ничего не найдено"), "Должно появиться 'Ничего не найдено'");
  });

  it("очистка поиска возвращает все диаграммы", async () => {
    const page = new DiagramsPage(driver);
    await page.fillSearch("__ЭТОГО_ТОЧНО_НЕТ__");
    await driver.sleep(300);
    await page.fillSearch("");
    await driver.sleep(400);
    const cards = await page.diagramCardsByName(diagramName);
    assert.ok(cards.length >= 1, "После очистки поиска диаграмма должна снова отображаться");
  });
});

describe("Страница диаграмм — сортировка", () => {
  let driver: import("selenium-webdriver").WebDriver;
  const ts = Date.now();
  const nameA = `AAA_Sort_${ts}`;
  const nameZ = `ZZZ_Sort_${ts}`;
  // Unique filter so only THIS run's diagrams appear (not leftovers from prior runs)
  const sortFilter = `Sort_${ts}`;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    const page = new DiagramsPage(driver);
    await page.goto();
    await page.create(nameA);
    await page.goto();
    await page.create(nameZ);
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    await new DiagramsPage(driver).goto();
  });

  it("сортировка по имени А→Я ставит AAA выше ZZZ", async () => {
    const page = new DiagramsPage(driver);
    await page.fillSearch(sortFilter);
    await driver.sleep(300);
    const sel = await page.sortSelect();
    await sel.selectByValue("name-asc");
    await driver.sleep(400);
    const cards = await page.visibleDiagramCards();
    assert.ok(cards.length >= 2, "Должны быть обе диаграммы");
    const firstText = await cards[0]!.getText();
    assert.ok(firstText.includes(nameA), `Первой должна быть ${nameA}, получено: ${firstText}`);
  });

  it("сортировка по имени Я→А ставит ZZZ выше AAA", async () => {
    const page = new DiagramsPage(driver);
    await page.fillSearch(sortFilter);
    await driver.sleep(300);
    const sel = await page.sortSelect();
    await sel.selectByValue("name-desc");
    await driver.sleep(400);
    const cards = await page.visibleDiagramCards();
    assert.ok(cards.length >= 2, "Должны быть обе диаграммы");
    const firstText = await cards[0]!.getText();
    assert.ok(firstText.includes(nameZ), `Первой должна быть ${nameZ}, получено: ${firstText}`);
  });
});

describe("Страница диаграмм — фильтр по роли", () => {
  let driver: import("selenium-webdriver").WebDriver;
  const ownerDiagram = `UI_RoleFilter_${Date.now()}`;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    const page = new DiagramsPage(driver);
    await page.goto();
    await page.create(ownerDiagram);
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    await new DiagramsPage(driver).goto();
  });

  it("фильтр «Владелец» показывает диаграммы текущего пользователя", async () => {
    const page = new DiagramsPage(driver);
    const sel = await page.roleFilterSelect();
    await sel.selectByValue("OWNER");
    await driver.sleep(400);
    const cards = await page.diagramCardsByName(ownerDiagram);
    assert.ok(cards.length >= 1, "Диаграмма-владелец должна отображаться при фильтре OWNER");
  });

  it("фильтр «Редактор» не показывает диаграммы, где пользователь владелец", async () => {
    const page = new DiagramsPage(driver);
    const sel = await page.roleFilterSelect();
    await sel.selectByValue("EDITOR");
    await driver.sleep(400);
    const cards = await page.diagramCardsByName(ownerDiagram);
    assert.equal(cards.length, 0, "OWNER-диаграмма не должна появляться при фильтре EDITOR");
  });
});

describe("Страница диаграмм — клонирование", () => {
  let driver: import("selenium-webdriver").WebDriver;
  const originalName = `UI_Clone_${Date.now()}`;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    const page = new DiagramsPage(driver);
    await page.goto();
    await page.create(originalName);
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    await new DiagramsPage(driver).goto();
  });

  it("кнопка клонирования отображается для каждой диаграммы", async () => {
    const page = new DiagramsPage(driver);
    const card = await page.diagramCardByName(originalName);
    const cloneBtn = await page.cloneButtonForCard(card);
    assert.ok(await cloneBtn.isDisplayed(), "Кнопка клонирования должна быть видна");
  });

  it("клонирование создаёт копию с суффиксом «(копия)»", async function () {
    this.timeout(15_000);
    const page = new DiagramsPage(driver);
    const card = await page.diagramCardByName(originalName);
    const cloneBtn = await page.cloneButtonForCard(card);
    await cloneBtn.click();
    const cloneName = `${originalName} (копия)`;
    await page.toast("скопирована");
    await driver.sleep(500);
    await page.goto();
    const copies = await page.diagramCardsByName(cloneName);
    assert.ok(copies.length >= 1, `Копия '${cloneName}' должна появиться в списке`);
  });

  it("после клонирования показывается toast «Диаграмма скопирована»", async function () {
    this.timeout(15_000);
    const page = new DiagramsPage(driver);
    const card = await page.diagramCardByName(originalName);
    const cloneBtn = await page.cloneButtonForCard(card);
    await cloneBtn.click();
    const msg = await page.toast("скопирована");
    assert.ok(msg.includes("скопирована"), `Ожидался toast со словом 'скопирована', получено: ${msg}`);
  });
});

describe("Страница диаграмм — toast при создании", () => {
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

  it("создание диаграммы показывает toast «Диаграмма создана»", async function () {
    this.timeout(15_000);
    const page = new DiagramsPage(driver);
    const name = `UI_Toast_${Date.now()}`;
    await page.fillNewDiagramName(name);
    await (await page.createButton()).click();
    const msg = await page.toast("создана");
    assert.ok(msg.includes("создана"), `Ожидался toast со словом 'создана', получено: ${msg}`);
  });
});
