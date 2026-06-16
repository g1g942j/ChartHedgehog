import assert from "node:assert/strict";
import { after, before, describe, it } from "mocha";
import { By, Key } from "selenium-webdriver";
import { createDriver } from "../driver-factory.js";
import { loginAs } from "../auth-helper.js";
import { DiagramsPage } from "../pages/diagrams.page.js";
import { DiagramDetailPage } from "../pages/diagram-detail.page.js";
import { waitUrl, waitVisible, waitGone } from "../waits.js";

async function createAndOpen(
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

/** Получить трансформ scale у CanvasContent */
async function getCanvasScale(driver: import("selenium-webdriver").WebDriver): Promise<number> {
  const transform = await driver.executeScript<string>(
    `const el = document.querySelector('[style*="scale"]');
     return el ? el.style.transform : "scale(1)";`,
  );
  const match = transform.match(/scale\(([0-9.]+)\)/);
  return match ? parseFloat(match[1]) : 1;
}

/** Нарисовать штрих на SVG через pointer events */
async function drawOnSvg(
  driver: import("selenium-webdriver").WebDriver,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Promise<void> {
  const svg = await driver.findElement(By.css("svg"));
  const actions = driver.actions({ async: true });
  await actions
    .move({ origin: svg, x: fromX, y: fromY })
    .press()
    .move({ origin: svg, x: fromX + 20, y: fromY + 10 })
    .move({ origin: svg, x: toX, y: toY })
    .release()
    .perform();
}

// ─── топ-бар ──────────────────────────────────────────────────────────────────

describe("Редактор диаграмм — топ-бар", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Editor_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("кнопка «Назад» отображается в топ-баре", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    assert.ok(await (await page.backButton()).isDisplayed());
  });

  it("кнопка «Назад» ведёт на /diagrams", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.backButton()).click();
    await driver.wait(async () => /\/diagrams$/.test(await driver.getCurrentUrl()), 10_000);
    assert.ok((await driver.getCurrentUrl()).endsWith("/diagrams"));
  });

  it("кнопка ⋮ (меню) отображается", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    assert.ok(await (await page.menuButton()).isDisplayed());
  });

  it("кнопка «Сохранить диаграмму» отображается для OWNER", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    assert.ok(await (await page.canvasSaveButton()).isDisplayed());
  });

  it("название диаграммы отображается в топ-баре", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const nameEl = await waitVisible(
      driver,
      By.xpath(`//header//span[string-length(normalize-space(.)) > 0]`),
      10_000,
    );
    assert.ok(await nameEl.isDisplayed());
  });
});

// ─── левая панель инструментов ────────────────────────────────────────────────

describe("Редактор диаграмм — левая панель инструментов", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Toolbar_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("левая панель инструментов (nav) отображается", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    assert.ok(await (await page.leftToolbar()).isDisplayed());
  });

  for (const title of [
    "Выбор / редактирование (двойной клик)",
    "Ластик",
    "Карандаш",
    "Линия",
    "Базовые элементы",
    "Шаблоны",
  ]) {
    it(`инструмент «${title}» отображается`, async () => {
      const page = new DiagramDetailPage(driver);
      await page.goto(diagramId);
      assert.ok(await (await page.toolButton(title)).isDisplayed());
    });
  }

  it("клик по «Линия» открывает панель настроек линии", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Линия")).click();
    const panel = await waitVisible(
      driver,
      By.xpath(`//*[contains(normalize-space(.), 'Стиль') and contains(normalize-space(.), 'Начало')]`),
      5_000,
    );
    assert.ok(await panel.isDisplayed());
  });

  it("клик по «Базовые элементы» открывает панель фигур", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Базовые элементы")).click();
    const panel = await waitVisible(
      driver,
      By.xpath(`//button[normalize-space(.) = 'Rectangle' or normalize-space(.) = 'Circle']`),
      5_000,
    );
    assert.ok(await panel.isDisplayed());
  });

  it("клик по «Шаблоны» открывает выпадающий список с UML", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    const umlItem = await waitVisible(
      driver,
      By.xpath(`//button[contains(normalize-space(.), 'UML')]`),
      5_000,
    );
    assert.ok(await umlItem.isDisplayed());
  });

  it("клик по UML в шаблонах открывает панель UML-блоков", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'UML')]`), 5_000)).click();
    const classItem = await waitVisible(
      driver,
      By.xpath(`//button[normalize-space(.) = 'Class' or normalize-space(.) = 'Interface']`),
      5_000,
    );
    assert.ok(await classItem.isDisplayed());
  });
});

// ─── холст — базовые элементы ─────────────────────────────────────────────────

describe("Редактор диаграмм — холст", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Canvas_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("холст (SVG-слой) присутствует на странице", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    assert.ok(await (await waitVisible(driver, By.css("svg"), 10_000)).isDisplayed());
  });

  it("добавление Rectangle отображает блок на холсте", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Базовые элементы")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    assert.ok(await (await waitVisible(driver, By.xpath(`//*[contains(normalize-space(.), 'Box')]`), 5_000)).isDisplayed());
  });

  it("добавление Sticky Note отображает блок на холсте", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Базовые элементы")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Sticky Note']`), 5_000)).click();
    assert.ok(await (await waitVisible(driver, By.xpath(`//*[contains(normalize-space(.), 'Note')]`), 5_000)).isDisplayed());
  });

  it("добавление UML-блока Class отображает блок на холсте", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'UML')]`), 5_000)).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Class']`), 5_000)).click();
    assert.ok(await (await waitVisible(driver, By.xpath(`//*[contains(normalize-space(.), 'User')]`), 5_000)).isDisplayed());
  });

  it("«Сохранить диаграмму» не выдаёт ошибку", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.canvasSaveButton()).click();
    await driver.sleep(1_000);
    const alerts = await driver.findElements(By.css(".MuiAlert-colorError, .MuiAlert-filledError"));
    assert.equal(alerts.length, 0, "Не должно быть ошибок после сохранения");
  });
});

// ─── карандаш ─────────────────────────────────────────────────────────────────

describe("Редактор диаграмм — карандаш", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Pencil_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("активация инструмента «Карандаш» добавляет класс crosshair курсору холста", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Карандаш")).click();
    const cursor = await driver.executeScript<string>(
      `const canvas = document.querySelector('[class*="Canvas"]');
       return canvas ? getComputedStyle(canvas).cursor : "";`,
    );
    assert.ok(cursor.includes("crosshair"), `Ожидался cursor: crosshair, получен: ${cursor}`);
  });

  it("рисование карандашом добавляет <path> в SVG", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Карандаш")).click();
    const pathsBefore = await driver.findElements(By.css("svg path"));
    await drawOnSvg(driver, -100, -50, 50, 30);
    await driver.sleep(300);
    const pathsAfter = await driver.findElements(By.css("svg path"));
    assert.ok(
      pathsAfter.length > pathsBefore.length,
      `Количество <path> должно увеличиться (было ${pathsBefore.length}, стало ${pathsAfter.length})`,
    );
  });

  it("два штриха карандашом добавляют два <path> в SVG", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Карандаш")).click();
    await drawOnSvg(driver, -80, -60, 20, 10);
    await driver.sleep(200);
    const after1 = (await driver.findElements(By.css("svg path"))).length;
    await drawOnSvg(driver, 30, 20, 80, -20);
    await driver.sleep(200);
    const after2 = (await driver.findElements(By.css("svg path"))).length;
    assert.ok(after2 > after1, `После второго штриха должен появиться ещё один <path>`);
  });

  it("переключение с карандаша на выбор убирает crosshair", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Карандаш")).click();
    await (await page.toolButton("Выбор / редактирование (двойной клик)")).click();
    const cursor = await driver.executeScript<string>(
      `const canvas = document.querySelector('[class*="Canvas"]');
       return canvas ? getComputedStyle(canvas).cursor : "";`,
    );
    assert.ok(!cursor.includes("crosshair"), `После выбора cursor не должен быть crosshair, получен: ${cursor}`);
  });
});

// ─── линия ────────────────────────────────────────────────────────────────────

describe("Редактор диаграмм — линия", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Line_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("активация инструмента «Линия» открывает панель с настройками", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Линия")).click();
    const panel = await waitVisible(
      driver,
      By.xpath(`//*[contains(normalize-space(.), 'Стиль')]`),
      5_000,
    );
    assert.ok(await panel.isDisplayed());
  });

  it("рисование линии добавляет <line> в SVG", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Линия")).click();
    const linesBefore = (await driver.findElements(By.css("svg line"))).length;
    await drawOnSvg(driver, -100, -80, 80, 40);
    await driver.sleep(300);
    const linesAfter = (await driver.findElements(By.css("svg line"))).length;
    assert.ok(
      linesAfter > linesBefore,
      `Количество <line> должно увеличиться (было ${linesBefore}, стало ${linesAfter})`,
    );
  });

  it("нарисованная линия имеет атрибуты x1/y1/x2/y2", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Линия")).click();
    await drawOnSvg(driver, -90, -60, 60, 30);
    await driver.sleep(300);
    const lines = await driver.findElements(By.css("svg line[x1]"));
    assert.ok(lines.length > 0, "Должна появиться хотя бы одна линия с атрибутом x1");
    const x1 = await lines[lines.length - 1]!.getAttribute("x1");
    assert.ok(x1 !== null && x1 !== "", `Атрибут x1 не должен быть пустым, получен: ${x1}`);
  });

  it("две линии — два элемента <line> в SVG", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Линия")).click();
    await drawOnSvg(driver, -70, -50, 50, 20);
    await driver.sleep(200);
    const after1 = (await driver.findElements(By.css("svg line[x1]"))).length;
    await drawOnSvg(driver, 60, -30, -40, 60);
    await driver.sleep(200);
    const after2 = (await driver.findElements(By.css("svg line[x1]"))).length;
    assert.ok(after2 > after1, "После второй линии элементов <line> должно стать больше");
  });
});

// ─── ластик ───────────────────────────────────────────────────────────────────

describe("Редактор диаграмм — ластик", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Eraser_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("активация «Ластика» меняет курсор холста на cell", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Ластик")).click();
    const cursor = await driver.executeScript<string>(
      `const canvas = document.querySelector('[class*="Canvas"]');
       return canvas ? getComputedStyle(canvas).cursor : "";`,
    );
    assert.ok(cursor.includes("cell"), `Ожидался cursor: cell, получен: ${cursor}`);
  });

  it("ластик удаляет блок с холста", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // добавить блок
    await (await page.toolButton("Базовые элементы")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    const block = await waitVisible(driver, By.xpath(`//*[contains(normalize-space(.), 'Box')]`), 5_000);
    assert.ok(await block.isDisplayed(), "Блок должен появиться на холсте");

    // переключиться на ластик и кликнуть по блоку
    await (await page.toolButton("Ластик")).click();
    await block.click();

    // блок должен исчезнуть
    await waitGone(driver, By.xpath(`//*[contains(normalize-space(.), 'Box')]`), 5_000);
    const remaining = await driver.findElements(By.xpath(`//*[contains(normalize-space(.), 'Box')]`));
    assert.equal(remaining.length, 0, "Блок должен быть удалён с холста");
  });

  it("ластик удаляет нарисованный path карандашом", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // нарисовать штрих
    await (await page.toolButton("Карандаш")).click();
    await drawOnSvg(driver, -50, -40, 50, 40);
    await driver.sleep(300);
    const pathsBefore = (await driver.findElements(By.css("svg path"))).length;
    assert.ok(pathsBefore > 0, "Должен появиться хотя бы один path");

    // удалить ластиком — кликнуть по path
    await (await page.toolButton("Ластик")).click();
    const paths = await driver.findElements(By.css("svg path"));
    if (paths.length > 0) {
      await paths[0]!.click();
      await driver.sleep(300);
    }
    const pathsAfter = (await driver.findElements(By.css("svg path"))).length;
    assert.ok(pathsAfter < pathsBefore, `После ластика путей должно стать меньше (было ${pathsBefore}, стало ${pathsAfter})`);
  });
});

// ─── зум ──────────────────────────────────────────────────────────────────────

describe("Редактор диаграмм — зум", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Zoom_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("начальный масштаб холста равен 1 (100%)", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const scale = await getCanvasScale(driver);
    assert.equal(scale, 1, `Начальный масштаб должен быть 1, получен: ${scale}`);
  });

  it("кнопка «+» увеличивает масштаб", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const before = await getCanvasScale(driver);
    await (await waitVisible(driver, By.css(`button[title="Увеличить"]`), 5_000)).click();
    await driver.sleep(200);
    const after = await getCanvasScale(driver);
    assert.ok(after > before, `Масштаб должен увеличиться (было ${before}, стало ${after})`);
  });

  it("кнопка «−» уменьшает масштаб", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const before = await getCanvasScale(driver);
    await (await waitVisible(driver, By.css(`button[title="Уменьшить"]`), 5_000)).click();
    await driver.sleep(200);
    const after = await getCanvasScale(driver);
    assert.ok(after < before, `Масштаб должен уменьшиться (было ${before}, стало ${after})`);
  });

  it("несколько нажатий «+» увеличивают масштаб кратно", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const zoomIn = await waitVisible(driver, By.css(`button[title="Увеличить"]`), 5_000);
    await zoomIn.click();
    await zoomIn.click();
    await zoomIn.click();
    await driver.sleep(200);
    const scale = await getCanvasScale(driver);
    assert.ok(scale >= 1.3, `После 3 нажатий «+» масштаб должен быть ≥1.3, получен: ${scale}`);
  });

  it("кнопка сброса масштаба возвращает к 100%", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    // сначала увеличить
    const zoomIn = await waitVisible(driver, By.css(`button[title="Увеличить"]`), 5_000);
    await zoomIn.click();
    await zoomIn.click();
    await driver.sleep(200);
    // сбросить
    await (await waitVisible(driver, By.css(`button[title="Сбросить"]`), 5_000)).click();
    await driver.sleep(200);
    const scale = await getCanvasScale(driver);
    assert.equal(scale, 1, `После сброса масштаб должен быть 1, получен: ${scale}`);
  });

  it("масштаб не выходит за нижнюю границу (0.25)", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const zoomOut = await waitVisible(driver, By.css(`button[title="Уменьшить"]`), 5_000);
    // нажать 20 раз — должны упереться в 0.25
    for (let i = 0; i < 20; i++) await zoomOut.click();
    await driver.sleep(300);
    const scale = await getCanvasScale(driver);
    assert.ok(scale >= 0.25, `Масштаб не должен быть меньше 0.25, получен: ${scale}`);
  });

  it("метка зума отображает текущий процент", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const label = await waitVisible(driver, By.css(`button[title="Сбросить"]`), 5_000);
    const text = await label.getText();
    assert.match(text, /\d+%/, `Метка зума должна содержать проценты, получено: "${text}"`);
  });
});

// ─── инлайн-редактирование ────────────────────────────────────────────────────

describe("Редактор диаграмм — редактирование блока", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Edit_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("двойной клик по UML-блоку открывает поле ввода названия", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // добавить UML Class
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'UML')]`), 5_000)).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Class']`), 5_000)).click();
    const block = await waitVisible(driver, By.xpath(`//*[contains(normalize-space(.), 'User')]`), 5_000);

    // двойной клик
    const actions = driver.actions({ async: true });
    await actions.doubleClick(block).perform();

    const input = await waitVisible(driver, By.css(`input[class*="BlockEditTitle"]`), 5_000);
    assert.ok(await input.isDisplayed(), "Поле ввода названия должно появиться");
  });

  it("редактирование названия блока сохраняется после Enter", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // добавить блок
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'UML')]`), 5_000)).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Class']`), 5_000)).click();
    const block = await waitVisible(driver, By.xpath(`//*[contains(normalize-space(.), 'User')]`), 5_000);

    // двойной клик → ввод нового названия
    const newTitle = "MyEntity";
    const actions = driver.actions({ async: true });
    await actions.doubleClick(block).perform();
    const input = await waitVisible(driver, By.css(`input[class*="BlockEditTitle"]`), 5_000);
    await input.sendKeys(Key.chord(Key.CONTROL, "a"), Key.DELETE, newTitle, Key.RETURN);

    // новое название должно появиться на холсте
    const updated = await waitVisible(
      driver,
      By.xpath(`//*[contains(normalize-space(.), '${newTitle}')]`),
      5_000,
    );
    assert.ok(await updated.isDisplayed(), `Блок должен отображать новое название «${newTitle}»`);
  });

  it("Escape отменяет редактирование без изменения названия", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // добавить блок
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'UML')]`), 5_000)).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Class']`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[contains(normalize-space(.), 'User')]`), 5_000);

    // двойной клик → начать редактирование → Escape
    const blocks = await driver.findElements(By.xpath(`//*[contains(normalize-space(.), 'User')]`));
    const actions = driver.actions({ async: true });
    await actions.doubleClick(blocks[blocks.length - 1]!).perform();
    const input = await waitVisible(driver, By.css(`input[class*="BlockEditTitle"]`), 5_000);
    await input.sendKeys("DiscardedText", Key.ESCAPE);
    await driver.sleep(300);

    // поле должно исчезнуть
    const inputs = await driver.findElements(By.css(`input[class*="BlockEditTitle"]`));
    assert.equal(inputs.length, 0, "После Escape поле ввода должно закрыться");

    // "DiscardedText" не должно появиться
    const discarded = await driver.findElements(By.xpath(`//*[contains(normalize-space(.), 'DiscardedText')]`));
    assert.equal(discarded.length, 0, "Отменённый текст не должен отображаться");
  });
});
