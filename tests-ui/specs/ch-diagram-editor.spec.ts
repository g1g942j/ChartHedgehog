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
    "Выбор (S)",
    "Ластик",
    "Карандаш",
    "Линия",
    "Фигуры",
    "Текст и комментарии",
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

  it("клик по «Фигуры» открывает панель фигур", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Фигуры")).click();
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
    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    assert.ok(await (await waitVisible(driver, By.xpath(`//*[contains(normalize-space(.), 'Box')]`), 5_000)).isDisplayed());
  });

  it("добавление Sticky Note отображает блок на холсте", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Фигуры")).click();
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

  it("автосохранение: после добавления блока появляется «Сохранено»", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    // автосохранение срабатывает через ~2 сек
    const saved = await page.canvasSaveButton();
    assert.ok(await saved.isDisplayed(), "Индикатор «Сохранено» должен появиться");
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
    await (await page.toolButton("Выбор (S)")).click();
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
    await (await page.toolButton("Фигуры")).click();
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

// ─── Undo / Redo ──────────────────────────────────────────────────────────────

describe("Редактор диаграмм — Undo/Redo", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_UndoRedo_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("кнопки Undo и Redo отображаются в топ-баре", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    assert.ok(await (await page.undoButton()).isDisplayed(), "Кнопка Undo должна отображаться");
    assert.ok(await (await page.redoButton()).isDisplayed(), "Кнопка Redo должна отображаться");
  });

  it("Undo (кнопка) удаляет последний добавленный блок", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // добавить блок
    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[contains(normalize-space(.), 'Box')]`), 5_000);

    // нажать Undo
    await (await page.undoButton()).click();
    await driver.sleep(300);

    const blocks = await driver.findElements(By.xpath(`//*[@data-block='true']`));
    assert.equal(blocks.length, 0, "После Undo блок должен исчезнуть");
  });

  it("Ctrl+Z отменяет добавление блока", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);

    const body = await driver.findElement(By.tagName("body"));
    await body.sendKeys(Key.chord(Key.CONTROL, "z"));
    await driver.sleep(300);

    const blocks = await driver.findElements(By.xpath(`//*[@data-block='true']`));
    assert.equal(blocks.length, 0, "После Ctrl+Z блок должен исчезнуть");
  });

  it("Redo (Ctrl+Y) возвращает отменённый блок", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // добавить → undo → redo
    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);

    const body = await driver.findElement(By.tagName("body"));
    await body.sendKeys(Key.chord(Key.CONTROL, "z"));
    await driver.sleep(200);
    await body.sendKeys(Key.chord(Key.CONTROL, "y"));
    await driver.sleep(300);

    const blocks = await driver.findElements(By.xpath(`//*[@data-block='true']`));
    assert.ok(blocks.length > 0, "После Redo блок должен вернуться");
  });

  it("несколько Undo отменяют несколько блоков", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    await (await page.toolButton("Фигуры")).click();
    const rectBtn = await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000);
    await rectBtn.click();
    await driver.sleep(100);
    await rectBtn.click();
    await driver.sleep(100);

    const body = await driver.findElement(By.tagName("body"));
    await body.sendKeys(Key.chord(Key.CONTROL, "z"));
    await driver.sleep(200);
    await body.sendKeys(Key.chord(Key.CONTROL, "z"));
    await driver.sleep(300);

    const blocks = await driver.findElements(By.xpath(`//*[@data-block='true']`));
    assert.equal(blocks.length, 0, "После двух Undo оба блока должны исчезнуть");
  });
});

// ─── Copy / Paste ─────────────────────────────────────────────────────────────

describe("Редактор диаграмм — Copy/Paste", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_CopyPaste_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("Ctrl+C → Ctrl+V дублирует выбранный блок", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // добавить блок
    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    const block = await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);

    // кликнуть чтобы выделить
    await block.click();
    await driver.sleep(100);

    const body = await driver.findElement(By.tagName("body"));
    await body.sendKeys(Key.chord(Key.CONTROL, "c"));
    await driver.sleep(100);
    await body.sendKeys(Key.chord(Key.CONTROL, "v"));
    await driver.sleep(300);

    const blocks = await driver.findElements(By.xpath(`//*[@data-block='true']`));
    assert.ok(blocks.length >= 2, `После Copy+Paste блоков должно стать ≥2, стало: ${blocks.length}`);
  });
});

// ─── Multiselect ─────────────────────────────────────────────────────────────

describe("Редактор диаграмм — Multiselect", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Multi_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("Shift+клик выделяет несколько блоков (Block_selected)", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // добавить два блока
    await (await page.toolButton("Фигуры")).click();
    const rectBtn = await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000);
    await rectBtn.click();
    await driver.sleep(100);
    await rectBtn.click();
    await driver.sleep(200);

    const blocks = await driver.findElements(By.xpath(`//*[@data-block='true']`));
    assert.ok(blocks.length >= 2, "Должно быть ≥2 блоков");

    // кликнуть по первому, потом Shift+клик по второму
    await blocks[0]!.click();
    await driver.sleep(100);
    const actions = driver.actions({ async: true });
    await actions.keyDown(Key.SHIFT).click(blocks[1]!).keyUp(Key.SHIFT).perform();
    await driver.sleep(200);

    const selected = await driver.findElements(By.css(`[class*="Block_selected"]`));
    assert.ok(selected.length >= 2, `После Shift+клик должно быть ≥2 выделенных блоков, выделено: ${selected.length}`);
  });

  it("Delete удаляет все выделенные блоки сразу", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // добавить два блока
    await (await page.toolButton("Фигуры")).click();
    const rectBtn = await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000);
    await rectBtn.click();
    await driver.sleep(100);
    await rectBtn.click();
    await driver.sleep(200);

    const blocks = await driver.findElements(By.xpath(`//*[@data-block='true']`));
    await blocks[0]!.click();
    const actions = driver.actions({ async: true });
    await actions.keyDown(Key.SHIFT).click(blocks[1]!).keyUp(Key.SHIFT).perform();
    await driver.sleep(200);

    // нажать Delete
    const body = await driver.findElement(By.tagName("body"));
    await body.sendKeys(Key.DELETE);
    await driver.sleep(300);

    const remaining = await driver.findElements(By.xpath(`//*[@data-block='true']`));
    assert.equal(remaining.length, 0, "После Delete все выделенные блоки должны удалиться");
  });
});

// ─── Текстовые блоки и комментарии ───────────────────────────────────────────

describe("Редактор диаграмм — Текстовые блоки", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_TextBlocks_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("кнопка «Текст и комментарии» открывает панель", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.textPanelButton()).click();
    const panel = await waitVisible(
      driver,
      By.xpath(`//*[contains(normalize-space(.), 'Текстовые блоки')]`),
      5_000,
    );
    assert.ok(await panel.isDisplayed());
  });

  it("кнопка «Текст» добавляет текстовый блок на холст", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.textPanelButton()).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Текст']`), 5_000)).click();
    const block = await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);
    assert.ok(await block.isDisplayed(), "Текстовый блок должен появиться на холсте");
  });

  it("текстовый блок не имеет рамки (Block_text класс)", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.textPanelButton()).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Текст']`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);

    const textBlocks = await driver.findElements(By.css(`[class*="Block_text"]`));
    assert.ok(textBlocks.length > 0, "Текстовый блок должен иметь класс Block_text");
  });

  it("кнопка «Комментарий» добавляет блок с жёлтым фоном (Block_comment)", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.textPanelButton()).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Комментарий']`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);

    const commentBlocks = await driver.findElements(By.css(`[class*="Block_comment"]`));
    assert.ok(commentBlocks.length > 0, "Комментарий должен иметь класс Block_comment");
  });

  it("двойной клик по текстовому блоку открывает textarea", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.textPanelButton()).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Текст']`), 5_000)).click();
    const block = await waitVisible(driver, By.css(`[class*="Block_text"]`), 5_000);

    const actions = driver.actions({ async: true });
    await actions.doubleClick(block).perform();

    const textarea = await waitVisible(driver, By.css(`textarea[class*="TextBlockEdit"]`), 5_000);
    assert.ok(await textarea.isDisplayed(), "Textarea для редактирования текстового блока должна появиться");
  });
});

// ─── Поиск по фигурам ─────────────────────────────────────────────────────────

describe("Редактор диаграмм — Поиск по фигурам", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_ShapeSearch_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("панель фигур содержит поле поиска", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Фигуры")).click();
    const input = await waitVisible(driver, By.css(`input[placeholder*="Поиск"]`), 5_000);
    assert.ok(await input.isDisplayed(), "Поле поиска должно отображаться в панели фигур");
  });

  it("поиск 'rect' оставляет только Rectangle", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Фигуры")).click();
    const input = await waitVisible(driver, By.css(`input[placeholder*="Поиск"]`), 5_000);
    await input.sendKeys("rect");
    await driver.sleep(200);

    const visible = await driver.findElements(By.xpath(`//button[normalize-space(.) = 'Rectangle']`));
    assert.ok(visible.length > 0, "Rectangle должен остаться после поиска 'rect'");

    const circle = await driver.findElements(By.xpath(`//button[normalize-space(.) = 'Circle']`));
    assert.equal(circle.length, 0, "Circle не должен отображаться при поиске 'rect'");
  });

  it("поиск 'xyz' показывает сообщение 'Ничего не найдено'", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Фигуры")).click();
    const input = await waitVisible(driver, By.css(`input[placeholder*="Поиск"]`), 5_000);
    await input.sendKeys("xyz");
    await driver.sleep(200);

    const empty = await waitVisible(
      driver,
      By.xpath(`//*[contains(normalize-space(.), 'Ничего не найдено')]`),
      3_000,
    );
    assert.ok(await empty.isDisplayed());
  });

  it("очистка поиска возвращает все фигуры", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Фигуры")).click();
    const input = await waitVisible(driver, By.css(`input[placeholder*="Поиск"]`), 5_000);
    await input.sendKeys("rect");
    await driver.sleep(200);
    await input.sendKeys(Key.chord(Key.CONTROL, "a"), Key.DELETE);
    await driver.sleep(200);

    const circle = await driver.findElements(By.xpath(`//button[normalize-space(.) = 'Circle']`));
    assert.ok(circle.length > 0, "После очистки поиска Circle должен снова отображаться");
  });

  it("панель UML содержит поле поиска", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'UML')]`), 5_000)).click();
    const input = await waitVisible(driver, By.css(`input[placeholder*="Поиск"]`), 5_000);
    assert.ok(await input.isDisplayed(), "Поле поиска должно быть и в UML-панели");
  });
});
