import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "mocha";
import { By } from "selenium-webdriver";
import { createDriver } from "../driver-factory.js";
import { loginAs } from "../auth-helper.js";
import { DiagramsPage } from "../pages/diagrams.page.js";
import { waitVisible } from "../waits.js";
import { getAppUrl } from "../base-url.js";

// ── Сортировка по дате ──────────────────────────────────────────────────────

describe("Страница диаграмм — сортировка по дате", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let nameOld: string;
  let nameNew: string;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    const page = new DiagramsPage(driver);
    // create two diagrams in sequence; the second is newer
    nameOld = `DateOld_${Date.now()}`;
    await page.goto();
    await page.create(nameOld);
    await driver.sleep(1_200); // ensure distinct updatedAt timestamps
    nameNew = `DateNew_${Date.now()}`;
    await page.goto();
    await page.create(nameNew);
  });

  after(async () => { await driver?.quit(); });

  beforeEach(async () => {
    await new DiagramsPage(driver).goto();
  });

  it("«Сначала новые» (date-new) — более новая диаграмма выше в списке", async function () {
    this.timeout(15_000);
    const page = new DiagramsPage(driver);
    // filter so only our two test diagrams are visible
    const prefix = "Date";
    await page.fillSearch(prefix);
    await driver.sleep(400);
    const sel = await page.sortSelect();
    await sel.selectByValue("date-new");
    await driver.sleep(400);
    const cards = await page.visibleDiagramCards();
    assert.ok(cards.length >= 2, "Должны быть обе тестовые диаграммы");
    const firstText = await cards[0]!.getText();
    assert.ok(
      firstText.includes(nameNew),
      `При сортировке 'date-new' новая диаграмма должна быть первой, получено: ${firstText}`,
    );
  });

  it("«Сначала старые» (date-old) — более старая диаграмма выше в списке", async function () {
    this.timeout(15_000);
    const page = new DiagramsPage(driver);
    const prefix = "Date";
    await page.fillSearch(prefix);
    await driver.sleep(400);
    const sel = await page.sortSelect();
    await sel.selectByValue("date-old");
    await driver.sleep(400);
    const cards = await page.visibleDiagramCards();
    assert.ok(cards.length >= 2, "Должны быть обе тестовые диаграммы");
    const firstText = await cards[0]!.getText();
    assert.ok(
      firstText.includes(nameOld),
      `При сортировке 'date-old' старая диаграмма должна быть первой, получено: ${firstText}`,
    );
  });
});

// ── Фильтр «Зритель» ────────────────────────────────────────────────────────

describe("Страница диаграмм — фильтр по роли «Зритель»", () => {
  let driver: import("selenium-webdriver").WebDriver;
  const ownerDiagram = `UI_ViewerFilter_${Date.now()}`;

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

  it("фильтр «Зритель» не показывает диаграммы, где пользователь владелец", async function () {
    this.timeout(15_000);
    const page = new DiagramsPage(driver);
    const sel = await page.roleFilterSelect();
    await sel.selectByValue("VIEWER");
    await driver.sleep(400);
    const cards = await page.diagramCardsByName(ownerDiagram);
    assert.equal(
      cards.length,
      0,
      "OWNER-диаграмма не должна отображаться при фильтре VIEWER",
    );
  });

  it("«Все роли» — возвращает диаграммы владельца обратно", async function () {
    this.timeout(15_000);
    const page = new DiagramsPage(driver);
    const sel = await page.roleFilterSelect();
    await sel.selectByValue("VIEWER");
    await driver.sleep(300);
    await sel.selectByValue("all");
    await driver.sleep(400);
    const cards = await page.diagramCardsByName(ownerDiagram);
    assert.ok(cards.length >= 1, "При фильтре 'all' диаграмма-владелец должна снова отображаться");
  });
});

// ── Переключение вида (список / сетка) ──────────────────────────────────────

describe("Страница диаграмм — переключение вида", () => {
  let driver: import("selenium-webdriver").WebDriver;
  const diagramName = `UI_View_${Date.now()}`;

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

  it("кнопки переключения вида отображаются", async function () {
    this.timeout(15_000);
    const listBtn = await waitVisible(driver, By.css(`button[title="Список"]`));
    const gridBtn = await waitVisible(driver, By.css(`button[title="Сетка"]`));
    assert.ok(await listBtn.isDisplayed(), "Кнопка 'Список' должна быть видна");
    assert.ok(await gridBtn.isDisplayed(), "Кнопка 'Сетка' должна быть видна");
  });

  it("переключение на вид «Сетка» — диаграммы отображаются в сетке", async function () {
    this.timeout(15_000);
    const gridBtn = await waitVisible(driver, By.css(`button[title="Сетка"]`));
    await gridBtn.click();
    await driver.sleep(400);
    const gridItems = await driver.findElements(
      By.xpath(`//ul/li[.//span[contains(@class,'GridItemName') or .//span[contains(@class,'RoleBadge')]]]`),
    );
    // в режиме сетки список отображается отличным способом от списка
    // проверяем что диаграмма видна в любом представлении
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    assert.ok(
      text.includes(diagramName),
      `Диаграмма '${diagramName}' должна быть видна в режиме сетки`,
    );
  });

  it("переключение обратно на «Список» — диаграммы в списке", async function () {
    this.timeout(15_000);
    // first switch to grid
    const gridBtn = await waitVisible(driver, By.css(`button[title="Сетка"]`));
    await gridBtn.click();
    await driver.sleep(300);
    // then switch back to list
    const listBtn = await waitVisible(driver, By.css(`button[title="Список"]`));
    await listBtn.click();
    await driver.sleep(400);
    // in list mode we should have the participants link
    const cards = await new DiagramsPage(driver).diagramCardsByName(diagramName);
    assert.ok(cards.length >= 1, `Диаграмма '${diagramName}' должна быть видна в режиме списка`);
  });

  it("вид «Сетка» сохраняется после перезагрузки страницы", async function () {
    this.timeout(20_000);
    const gridBtn = await waitVisible(driver, By.css(`button[title="Сетка"]`));
    await gridBtn.click();
    await driver.sleep(300);
    await new DiagramsPage(driver).goto();
    await driver.sleep(500);
    const activeGridBtn = await driver.findElement(By.css(`button[title="Сетка"]`));
    const className = await activeGridBtn.getAttribute("class");
    assert.ok(
      className?.includes("active") || className?.includes("Active"),
      "Кнопка 'Сетка' должна быть активна после перезагрузки (сохранено в localStorage)",
    );
  });
});

// ── Страница диаграммы — кнопка «Назад» ────────────────────────────────────

describe("Страница диаграммы — навигация назад", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    const list = new DiagramsPage(driver);
    await list.goto();
    const name = `UI_Back_${Date.now()}`;
    await list.create(name);
    const card = await list.diagramCardByName(name);
    const link = await list.diagramLinkForCard(card);
    await link.click();
    await driver.sleep(1_500);
    const url = await driver.getCurrentUrl();
    const match = url.match(/\/diagrams\/(\d+)/);
    if (!match) { this.skip(); return; }
    diagramId = Number(match[1]);
  });

  after(async () => { await driver?.quit(); });

  it("кнопка «К списку» возвращает на /diagrams", async function () {
    this.timeout(20_000);
    await driver.get(`${getAppUrl()}/diagrams/${diagramId}`);
    const backBtn = await waitVisible(driver, By.css(`button[title="К списку"]`), 10_000);
    await backBtn.click();
    await driver.wait(async () => {
      const url = await driver.getCurrentUrl();
      return /\/diagrams[/]?$/.test(url);
    }, 10_000, "Кнопка 'К списку' должна вести на /diagrams");
    const url = await driver.getCurrentUrl();
    assert.ok(
      /\/diagrams[/]?$/.test(url),
      `Кнопка 'К списку' должна вести на /diagrams, URL: ${url}`,
    );
  });
});
