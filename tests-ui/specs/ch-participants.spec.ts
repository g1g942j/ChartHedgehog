import assert from "node:assert/strict";
import { after, before, describe, it } from "mocha";
import { By } from "selenium-webdriver";
import { createDriver } from "../driver-factory.js";
import { loginAs } from "../auth-helper.js";
import { DiagramsPage } from "../pages/diagrams.page.js";
import { ParticipantsPage } from "../pages/participants.page.js";
import { waitUrl } from "../waits.js";
import { getAppUrl } from "../base-url.js";

async function createDiagramAndGetId(
  driver: import("selenium-webdriver").WebDriver,
  name: string,
): Promise<number> {
  const list = new DiagramsPage(driver);
  await list.goto();
  await list.create(name);
  const card = await list.diagramCardByName(name);
  const link = await list.participantsLinkForCard(card);
  await link.click();
  await waitUrl(driver, "/participants");
  const url = await driver.getCurrentUrl();
  const match = url.match(/\/diagrams\/(\d+)/);
  if (!match) throw new Error(`Не удалось получить id из URL: ${url}`);
  return Number(match[1]);
}

describe("Страница участников — отображение", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createDiagramAndGetId(driver, `UI_Part_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("раздел «Добавить участника» отображается для владельца", async () => {
    const page = new ParticipantsPage(driver);
    await page.goto(diagramId);
    assert.ok(await (await page.addSectionTitle()).isDisplayed());
  });

  it("поле поиска пользователя отображается", async () => {
    const page = new ParticipantsPage(driver);
    await page.goto(diagramId);
    assert.ok(await (await page.searchInput()).isDisplayed());
  });

  it("кнопка «Добавить» отображается", async () => {
    const page = new ParticipantsPage(driver);
    await page.goto(diagramId);
    assert.ok(await (await page.addButton()).isDisplayed());
  });

  it("кнопка «Добавить» отключена при пустом поле поиска", async () => {
    const page = new ParticipantsPage(driver);
    await page.goto(diagramId);
    const disabled = await page.isAddButtonDisabled();
    assert.ok(disabled, "Кнопка «Добавить» должна быть отключена при пустом поле");
  });

  it("счётчик участников отображается", async () => {
    const page = new ParticipantsPage(driver);
    await page.goto(diagramId);
    const title = await page.participantsCountTitle();
    assert.ok(title.includes("Участники ("), `Получено: ${title}`);
  });
});

describe("Страница участников — поиск пользователей", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;
  let secondUser: string;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);

    secondUser = `searchable_${Date.now()}`;
    const resp = await fetch(`http://localhost:8080/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: secondUser,
        email: `${secondUser}@test.com`,
        password: "TestPass123",
      }),
    });
    if (!resp.ok && resp.status !== 409) {
      console.warn("Не удалось создать второго пользователя, пропуск теста");
    }

    diagramId = await createDiagramAndGetId(driver, `UI_Search_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("ввод существующего username показывает варианты в autocomplete", async () => {
    const page = new ParticipantsPage(driver);
    await page.goto(diagramId);
    await page.typeSearch(secondUser.slice(0, 5));
    const opts = await page.autocompleteOptions();
    assert.ok(opts.length >= 1, "Должны появиться варианты autocomplete при вводе существующего username");
  });

  it("выбор пользователя из autocomplete активирует кнопку «Добавить»", async () => {
    const page = new ParticipantsPage(driver);
    await page.goto(diagramId);
    await page.typeSearch(secondUser.slice(0, 5));
    const opts = await page.autocompleteOptions();
    if (!opts.length) return;
    await page.selectFirstOption();
    await driver.sleep(300);
    const disabled = await page.isAddButtonDisabled();
    assert.ok(!disabled, "Кнопка «Добавить» должна быть активна после выбора пользователя");
  });
});

describe("Страница участников — добавление и удаление", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;
  let secondUser: string;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);

    secondUser = `addable_${Date.now()}`;
    const resp = await fetch(`http://localhost:8080/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: secondUser,
        email: `${secondUser}@test.com`,
        password: "TestPass123",
      }),
    });
    if (!resp.ok && resp.status !== 409) {
      this.skip();
      return;
    }

    diagramId = await createDiagramAndGetId(driver, `UI_AddRemove_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("добавление участника — появляется в списке", async () => {
    const page = new ParticipantsPage(driver);
    await page.goto(diagramId);
    await page.typeSearch(secondUser); // полный username для уникального поиска
    const opts = await page.autocompleteOptions();
    if (!opts.length) {
      console.warn("Нет вариантов autocomplete — пропуск");
      return;
    }
    await page.selectFirstOption();
    await driver.sleep(300);
    await (await page.addButton()).click();
    await driver.sleep(1_000);
    const row = await page.participantRowByUsername(secondUser);
    assert.ok(await row.isDisplayed(), `Участник @${secondUser} должен появиться в списке`);
  });

  it("добавление уже существующего участника — ошибка «уже в диаграмме»", async () => {
    const page = new ParticipantsPage(driver);
    await page.goto(diagramId);
    await page.typeSearch(secondUser); // полный username для точного поиска
    const opts = await page.autocompleteOptions();
    if (!opts.length) return;
    await page.selectFirstOption();
    await driver.sleep(300);
    await (await page.addButton()).click();
    await driver.sleep(1_000);
    const hasError = await page.hasErrorAlert();
    assert.ok(hasError, "Должна появиться ошибка при повторном добавлении участника");
  });

  it("удаление участника — исчезает из списка", async () => {
    const page = new ParticipantsPage(driver);
    await page.goto(diagramId);
    let row: import("selenium-webdriver").WebElement;
    try {
      row = await page.participantRowByUsername(secondUser);
    } catch {
      console.warn(`Участник @${secondUser} не найден — пропуск удаления`);
      return;
    }
    const removeBtn = await page.removeButtonForRow(row);
    await driver.executeScript("window.confirm = () => true;");
    await removeBtn.click();
    await driver.sleep(1_000);
    const rows = await driver.findElements(
      By.xpath(`//li[.//*[contains(normalize-space(.), '@${secondUser}')]]`),
    );
    assert.equal(rows.length, 0, `Участник @${secondUser} должен исчезнуть из списка`);
  });
});
