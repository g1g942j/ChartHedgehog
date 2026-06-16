import assert from "node:assert/strict";
import { after, before, describe, it } from "mocha";
import { createDriver } from "../driver-factory.js";
import { loginAs } from "../auth-helper.js";
import { DiagramsPage } from "../pages/diagrams.page.js";
import { DiagramDetailPage } from "../pages/diagram-detail.page.js";
import { waitUrl } from "../waits.js";

async function createAndOpenDiagram(
  driver: import("selenium-webdriver").WebDriver,
  name: string,
): Promise<number> {
  const list = new DiagramsPage(driver);
  await list.goto();
  await list.create(name);
  const card = await list.diagramCardByName(name);
  const link = await list.diagramLinkForCard(card);
  await link.click();
  await waitUrl(driver, "/diagrams/");
  const url = await driver.getCurrentUrl();
  const match = url.match(/\/diagrams\/(\d+)/);
  if (!match) throw new Error(`Не удалось получить id из URL: ${url}`);
  return Number(match[1]);
}

describe("Настройки диаграммы — отображение", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpenDiagram(driver, `UI_Settings_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("кнопка меню ⋮ отображается в топ-баре", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    assert.ok(await (await page.menuButton()).isDisplayed());
  });

  it("раздел «Настройки диаграммы» открывается через меню ⋮", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await page.openMenu();
    assert.ok(await (await page.settingsTitle()).isDisplayed());
  });

  it("поле названия отображается в панели настроек", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await page.openMenu();
    assert.ok(await (await page.nameInput()).isDisplayed());
  });

  it("кнопка «Сохранить» отключена при неизменном названии", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await page.openMenu();
    const disabled = await page.isSaveButtonDisabled();
    assert.ok(disabled, "Кнопка 'Сохранить' должна быть отключена при неизменном названии");
  });

  it("кнопка «Удалить» отображается в панели настроек", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await page.openMenu();
    assert.ok(await (await page.deleteButton()).isDisplayed());
  });

  it("ссылка «Участники» видна в панели настроек", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await page.openMenu();
    assert.ok(await (await page.participantsTab()).isDisplayed());
  });
});

describe("Настройки диаграммы — переименование", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;
  const originalName = `UI_Rename_${Date.now()}`;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpenDiagram(driver, originalName);
  });

  after(async () => { await driver?.quit(); });

  it("изменение названия активирует кнопку «Сохранить»", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await page.openMenu();
    await page.fillName(originalName + "_new");
    await driver.sleep(300);
    const disabled = await page.isSaveButtonDisabled();
    assert.ok(!disabled, "Кнопка 'Сохранить' должна быть активна после изменения названия");
  });

  it("сохранение нового названия — название обновляется", async () => {
    const page = new DiagramDetailPage(driver);
    const newName = `${originalName}_renamed`;
    await page.goto(diagramId);
    await page.openMenu();
    await page.fillName(newName);
    await driver.sleep(300);
    await page.save();
    await page.waitSaved(newName);
    const input = await page.nameInput();
    const value = await input.getAttribute("value");
    assert.equal(value, newName, `Название должно быть '${newName}', получено: '${value}'`);
  });

  it("после сохранения кнопка «Сохранить» снова отключена", async () => {
    const page = new DiagramDetailPage(driver);
    const newName = `${originalName}_v2`;
    await page.goto(diagramId);
    await page.openMenu();
    await page.fillName(newName);
    await driver.sleep(300);
    await page.save();
    await page.waitSaved(newName);
    await driver.sleep(500);
    const disabled = await page.isSaveButtonDisabled();
    assert.ok(disabled, "После сохранения кнопка должна снова быть отключена");
  });
});

describe("Настройки диаграммы — удаление", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
  });

  after(async () => { await driver?.quit(); });

  it("удаление диаграммы с подтверждением — переход на /diagrams", async () => {
    const name = `UI_Delete_${Date.now()}`;
    const id = await createAndOpenDiagram(driver, name);
    const page = new DiagramDetailPage(driver);
    await page.goto(id);
    await page.openMenu();
    await page.confirmDeleteInDialog();
    await driver.wait(async () => {
      const url = await driver.getCurrentUrl();
      return /\/diagrams$/.test(url);
    }, 10_000, "После удаления URL должен быть /diagrams (без ID)");
    const url = await driver.getCurrentUrl();
    assert.ok(url.endsWith("/diagrams"), `После удаления должен быть /diagrams, URL: ${url}`);
  });
});
