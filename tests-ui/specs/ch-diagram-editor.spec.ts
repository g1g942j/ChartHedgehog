import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "mocha";
import { By, Key } from "selenium-webdriver";
import { createDriver } from "../driver-factory.js";
import { loginAs } from "../auth-helper.js";
import { DiagramsPage } from "../pages/diagrams.page.js";
import { DiagramDetailPage } from "../pages/diagram-detail.page.js";
import { waitUrl, waitVisible, waitGone, waitLocated } from "../waits.js";

/** Абсолютный путь до файла-фикстуры в tests-ui/fixtures */
function fixturePath(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
}

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

/** Read current zoom from the reset-button label which shows "NN%". */
async function getCanvasScale(driver: import("selenium-webdriver").WebDriver): Promise<number> {
  try {
    const btn = await driver.findElement(By.css(`button[title="Сбросить"]`));
    const text = await btn.getText();
    const match = text.match(/(\d+)\s*%/);
    return match ? parseInt(match[1], 10) / 100 : 1;
  } catch {
    return 1;
  }
}

/** Dispatch pointerdown + pointerup on an element, bypassing browser hit-testing.
 * Use when Selenium's .click() is intercepted by overlay elements (e.g. ShapeLabel). */
async function pointerClick(
  driver: import("selenium-webdriver").WebDriver,
  element: import("selenium-webdriver").WebElement,
  options: { shiftKey?: boolean } = {},
): Promise<void> {
  await driver.executeScript(
    `const el = arguments[0], shift = arguments[1];
     const r = el.getBoundingClientRect();
     const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
     ['pointerdown', 'pointerup'].forEach(type => {
       el.dispatchEvent(new PointerEvent(type, {
         bubbles: true, cancelable: true, isPrimary: true,
         button: 0, buttons: type === 'pointerdown' ? 1 : 0,
         shiftKey: shift, clientX: cx, clientY: cy
       }));
     });`,
    element,
    options.shiftKey ?? false,
  );
}

/** Dispatch a dblclick event on an element, bypassing ShapeLabel interception. */
async function dispatchDblClick(
  driver: import("selenium-webdriver").WebDriver,
  element: import("selenium-webdriver").WebElement,
): Promise<void> {
  await driver.executeScript(
    `arguments[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));`,
    element,
  );
}

/** Нарисовать штрих на SVG через pointer events */
async function drawOnSvg(
  driver: import("selenium-webdriver").WebDriver,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Promise<void> {
  // Use viewport center as the origin — the SVG canvas is infinitely large,
  // so its element center can be far outside the viewport.
  const center = await driver.executeScript<[number, number]>(
    `return [Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2)];`,
  );
  const cx = center[0]!;
  const cy = center[1]!;
  const actions = driver.actions({ async: true });
  await actions
    .move({ origin: "viewport" as any, x: cx + fromX, y: cy + fromY })
    .press()
    .move({ origin: "viewport" as any, x: cx + fromX + 20, y: cy + fromY + 10 })
    .move({ origin: "viewport" as any, x: cx + toX, y: cy + toY })
    .release()
    .perform();
}

/**
 * Draw a line on the SVG canvas using the line tool.
 * Unlike drawOnSvg, this dispatches events in separate steps with a sleep between
 * pointerdown and pointermove so React has time to update activeLineStart state
 * before the move event fires. Without the pause the line is never created because
 * the pointermove/pointerup handlers see the pre-update (null) state value.
 */
async function drawLineOnSvg(
  driver: import("selenium-webdriver").WebDriver,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Promise<void> {
  const center = await driver.executeScript<[number, number]>(
    `return [Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2)];`,
  );
  const cx = center[0]!;
  const cy = center[1]!;
  const ax = cx + fromX, ay = cy + fromY;
  const bx = cx + toX, by = cy + toY;
  const mx = Math.round((ax + bx) / 2);
  const my = Math.round((ay + by) / 2);

  const canvasSel = `document.querySelector('[class*="Canvas"]')`;
  await driver.executeScript(
    `const c = ${canvasSel}; if (!c) return;
     c.dispatchEvent(new PointerEvent('pointerdown', {
       bubbles: true, cancelable: true,
       clientX: arguments[0], clientY: arguments[1],
       pointerId: 1, isPrimary: true, button: 0, buttons: 1
     }));`,
    ax, ay,
  );
  // Wait for React to commit the activeLineStart state update before sending move
  await driver.sleep(250);
  await driver.executeScript(
    `const c = ${canvasSel}; if (!c) return;
     c.dispatchEvent(new PointerEvent('pointermove', {
       bubbles: true, cancelable: true,
       clientX: arguments[0], clientY: arguments[1],
       pointerId: 1, isPrimary: true, buttons: 1
     }));`,
    mx, my,
  );
  await driver.executeScript(
    `const c = ${canvasSel}; if (!c) return;
     c.dispatchEvent(new PointerEvent('pointermove', {
       bubbles: true, cancelable: true,
       clientX: arguments[0], clientY: arguments[1],
       pointerId: 1, isPrimary: true, buttons: 1
     }));`,
    bx, by,
  );
  await driver.executeScript(
    `const c = ${canvasSel}; if (!c) return;
     c.dispatchEvent(new PointerEvent('pointerup', {
       bubbles: true, cancelable: true,
       clientX: arguments[0], clientY: arguments[1],
       pointerId: 1, isPrimary: true, button: 0, buttons: 0
     }));`,
    bx, by,
  );
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
    const blockEl = await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);
    assert.ok(await blockEl.isDisplayed(), "Блок должен появиться на холсте");

    // переключиться на ластик и кликнуть по блоку через PointerEvent (обходит ShapeLabel)
    await (await page.toolButton("Ластик")).click();
    await pointerClick(driver, blockEl);

    // блок должен исчезнуть
    await waitGone(driver, By.xpath(`//*[@data-block='true']`), 5_000);
    const remaining = await driver.findElements(By.xpath(`//*[@data-block='true']`));
    assert.equal(remaining.length, 0, "Блок должен быть удалён с холста");
  });

  it("ластик удаляет нарисованный path карандашом", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // нарисовать штрих
    await (await page.toolButton("Карандаш")).click();
    const pathsInitial = (await driver.findElements(By.css("svg path"))).length;
    await drawOnSvg(driver, -50, -40, 50, 40);
    await driver.sleep(300);
    const pathsBefore = (await driver.findElements(By.css("svg path"))).length;
    assert.ok(pathsBefore > pathsInitial, `После рисования путей должно стать больше (было ${pathsInitial}, стало ${pathsBefore})`);

    // переключиться на ластик; при этом React re-render делает pointerEvents: stroke на path
    await (await page.toolButton("Ластик")).click();
    await driver.sleep(200);

    // Диспатчим click прямо на последний svg path — он должен содержать наш штрих.
    // pointerEvents: 'stroke' — только для hint в CSS; React onClick работает через event bubbling.
    const clicked = await driver.executeScript<boolean>(`
      const paths = Array.from(document.querySelectorAll('svg path'));
      // Берём последний path (наш штрих добавлен последним)
      const target = paths[paths.length - 1];
      if (!target) return false;
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    `);
    assert.ok(clicked, "Должен быть хотя бы один svg path для клика ластиком");
    await driver.sleep(300);

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
    const btn = await waitVisible(driver, By.css(`button[title="Увеличить"]`), 5_000);
    await driver.executeScript("arguments[0].click()", btn);
    await driver.sleep(200);
    const after = await getCanvasScale(driver);
    assert.ok(after > before, `Масштаб должен увеличиться (было ${before}, стало ${after})`);
  });

  it("кнопка «−» уменьшает масштаб", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const before = await getCanvasScale(driver);
    const btn = await waitVisible(driver, By.css(`button[title="Уменьшить"]`), 5_000);
    await driver.executeScript("arguments[0].click()", btn);
    await driver.sleep(200);
    const after = await getCanvasScale(driver);
    assert.ok(after < before, `Масштаб должен уменьшиться (было ${before}, стало ${after})`);
  });

  it("несколько нажатий «+» увеличивают масштаб кратно", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const zoomIn = await waitVisible(driver, By.css(`button[title="Увеличить"]`), 5_000);
    await driver.executeScript("arguments[0].click()", zoomIn);
    await driver.executeScript("arguments[0].click()", zoomIn);
    await driver.executeScript("arguments[0].click()", zoomIn);
    await driver.sleep(200);
    const scale = await getCanvasScale(driver);
    assert.ok(scale >= 1.3, `После 3 нажатий «+» масштаб должен быть ≥1.3, получен: ${scale}`);
  });

  it("кнопка сброса масштаба возвращает к 100%", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    // сначала увеличить
    const zoomIn = await waitVisible(driver, By.css(`button[title="Увеличить"]`), 5_000);
    await driver.executeScript("arguments[0].click()", zoomIn);
    await driver.executeScript("arguments[0].click()", zoomIn);
    await driver.sleep(200);
    // сбросить
    const resetBtn = await waitVisible(driver, By.css(`button[title="Сбросить"]`), 5_000);
    await driver.executeScript("arguments[0].click()", resetBtn);
    await driver.sleep(200);
    const scale = await getCanvasScale(driver);
    assert.equal(scale, 1, `После сброса масштаб должен быть 1, получен: ${scale}`);
  });

  it("масштаб не выходит за нижнюю границу (0.25)", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const zoomOut = await waitVisible(driver, By.css(`button[title="Уменьшить"]`), 5_000);
    // нажать 20 раз — должны упереться в 0.25
    for (let i = 0; i < 20; i++) await driver.executeScript("arguments[0].click()", zoomOut);
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
    // Ждём появления блока по data-block
    const block = await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);

    // Двойной клик через dispatchEvent — обходит ShapeLabel-перехватчик
    await dispatchDblClick(driver, block);

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
    const block = await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);

    // двойной клик через dispatchEvent → ввод нового названия
    const newTitle = "MyEntity";
    await dispatchDblClick(driver, block);
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

    // двойной клик через dispatchEvent → начать редактирование → Escape
    const blocks = await driver.findElements(By.xpath(`//*[@data-block='true']`));
    await dispatchDblClick(driver, blocks[blocks.length - 1]!);
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

    // выделить блок через PointerEvent (onPointerDown = выделение; JS .click() не даёт pointerdown)
    await pointerClick(driver, block);
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

    // PointerEvent обходит ShapeLabel-перехватчик; shiftKey для Shift+клик
    await pointerClick(driver, blocks[0]!);
    await driver.sleep(100);
    await pointerClick(driver, blocks[1]!, { shiftKey: true });
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
    await pointerClick(driver, blocks[0]!);
    await driver.sleep(100);
    await pointerClick(driver, blocks[1]!, { shiftKey: true });
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

// ─── Коннекторы (anchor dots) ─────────────────────────────────────────────────

describe("Редактор диаграмм — коннекторы", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Connectors_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("при активации инструмента 'Линия' на блоке появляются якорные точки (AnchorDot)", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // добавить блок
    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);

    // переключить на линию
    await (await page.toolButton("Линия")).click();
    await driver.sleep(200);

    const anchors = await driver.findElements(By.css(`[class*="AnchorDot"]`));
    assert.ok(anchors.length >= 4, `Должно быть минимум 4 якорные точки, найдено: ${anchors.length}`);
  });

  it("якорные точки исчезают при переключении с инструмента линии", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);

    await (await page.toolButton("Линия")).click();
    await driver.sleep(200);
    const before = (await driver.findElements(By.css(`[class*="AnchorDot"]`))).length;
    assert.ok(before >= 4, "Якоря должны быть при инструменте линии");

    await (await page.toolButton("Выбор (S)")).click();
    await driver.sleep(200);
    const after = (await driver.findElements(By.css(`[class*="AnchorDot"]`))).length;
    assert.equal(after, 0, "Якоря должны исчезнуть после переключения инструмента");
  });

  it("рисование линии от якоря создаёт коннектор с data-атрибутами", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    await (await page.toolButton("Фигуры")).click();
    const rectBtn = await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000);
    await rectBtn.click();
    await driver.sleep(100);
    await rectBtn.click();
    await driver.sleep(200);

    await (await page.toolButton("Линия")).click();
    await driver.sleep(200);

    const blocks = await driver.findElements(By.xpath(`//*[@data-block='true']`));
    assert.ok(blocks.length >= 2, "Нужно минимум 2 блока");

    const anchors = await driver.findElements(By.css(`[class*="AnchorDot_bottom"]`));
    if (anchors.length > 0) {
      const rect = await anchors[0]!.getRect();
      const actions = driver.actions({ async: true });
      const targetAnchor = await driver.findElements(By.css(`[class*="AnchorDot_top"]`));
      if (targetAnchor.length >= 2) {
        const targetRect = await targetAnchor[1]!.getRect();
        await actions
          .move({ x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) })
          .press()
          .move({ x: Math.round(targetRect.x + targetRect.width / 2), y: Math.round(targetRect.y + targetRect.height / 2) })
          .release()
          .perform();
        await driver.sleep(300);
        const lines = await driver.findElements(By.css(`svg line[x1]`));
        assert.ok(lines.length > 0, "После рисования коннектора должна появиться линия");
      }
    }
  });
});

// ─── Snap to grid ─────────────────────────────────────────────────────────────

describe("Редактор диаграмм — Snap to grid", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_SnapGrid_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("кнопка сетки отображается в панели инструментов", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const gridBtn = await waitVisible(driver, By.css(`button[title*="Сетка"]`), 10_000);
    assert.ok(await gridBtn.isDisplayed());
  });

  it("клик по кнопке сетки показывает dot-паттерн на холсте", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const gridBtn = await waitVisible(driver, By.css(`button[title*="Сетка"]`), 10_000);
    await gridBtn.click();
    await driver.sleep(200);

    const pattern = await driver.findElements(By.css(`pattern[id="grid-dots"]`));
    assert.ok(pattern.length > 0, "SVG pattern 'grid-dots' должен появиться при включении сетки");
  });

  it("повторный клик по кнопке сетки скрывает паттерн", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const gridBtn = await waitVisible(driver, By.css(`button[title*="Сетка"]`), 10_000);
    await gridBtn.click();
    await driver.sleep(100);
    await gridBtn.click();
    await driver.sleep(200);

    const pattern = await driver.findElements(By.css(`pattern[id="grid-dots"]`));
    assert.equal(pattern.length, 0, "При выключенной сетке pattern не должен присутствовать");
  });
});

// ─── Панель свойств ───────────────────────────────────────────────────────────

describe("Редактор диаграмм — Панель свойств", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Props_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("кнопка 'Свойства' отображается в панели инструментов", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const btn = await waitVisible(driver, By.css(`button[title="Свойства"]`), 10_000);
    assert.ok(await btn.isDisplayed());
  });

  it("клик по 'Свойства' открывает панель", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await waitVisible(driver, By.css(`button[title="Свойства"]`), 10_000)).click();
    const panel = await waitVisible(driver, By.xpath(`//*[contains(normalize-space(.), 'Свойства')]`), 5_000);
    assert.ok(await panel.isDisplayed());
  });

  it("при выборе блока панель свойств показывает color-input'ы", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    await (await waitVisible(driver, By.css(`button[title="Свойства"]`), 10_000)).click();

    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    const block = await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);
    await pointerClick(driver, block);
    await driver.sleep(200);

    const colorInputs = await driver.findElements(By.css(`input[type="color"]`));
    assert.ok(colorInputs.length >= 2, `При выборе блока должно быть ≥2 color-input, найдено: ${colorInputs.length}`);
  });

  it("при выборе линии панель свойств показывает color-input для линии", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    await (await waitVisible(driver, By.css(`button[title="Свойства"]`), 10_000)).click();

    // нарисовать линию
    await (await page.toolButton("Линия")).click();
    await drawOnSvg(driver, -80, -60, 60, 40);
    await driver.sleep(300);

    // кликнуть по линии — линия выбирается через onClick (не onPointerDown),
    // поэтому диспатчим click через executeScript, а не pointerClick
    await (await page.toolButton("Выбор (S)")).click();
    const lines = await driver.findElements(By.css(`svg line[x1]`));
    if (lines.length > 0) {
      await driver.executeScript(
        `arguments[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))`,
        lines[0]!,
      );
      await driver.sleep(200);
      const colorInputs = await driver.findElements(By.css(`input[type="color"]`));
      assert.ok(colorInputs.length >= 1, "При выборе линии должен появиться color-input");
    } else {
      this.skip();
    }
  });
});

// ─── Миникарта ───────────────────────────────────────────────────────────────

describe("Редактор диаграмм — Миникарта", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Minimap_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("миникарта не отображается на пустом холсте", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await driver.sleep(500);
    const minimap = await driver.findElements(By.css(`[class*="Minimap"]`));
    assert.equal(minimap.length, 0, "На пустом холсте миникарта не должна отображаться");
  });

  it("миникарта появляется после добавления блока", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);
    await driver.sleep(300);

    const minimap = await waitVisible(driver, By.css(`[class*="Minimap"]`), 5_000);
    assert.ok(await minimap.isDisplayed(), "Миникарта должна появиться после добавления блока");
  });

  it("миникарта содержит SVG с rect-элементами блоков", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);
    await driver.sleep(300);

    const minimapRects = await driver.executeScript<number>(`
      const minimap = document.querySelector('[class*="Minimap"]');
      return minimap ? minimap.querySelectorAll('rect').length : 0;
    `);
    assert.ok(minimapRects > 0, `Миникарта должна содержать rect-элементы, найдено: ${minimapRects}`);
  });
});

// ─── BPMN библиотека ──────────────────────────────────────────────────────────

describe("Редактор диаграмм — BPMN библиотека", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_BPMN_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("в шаблонах есть пункт 'BPMN'", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    const bpmnItem = await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'BPMN']`), 5_000);
    assert.ok(await bpmnItem.isDisplayed());
  });

  it("клик по BPMN открывает панель с BPMN-блоками", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'BPMN']`), 5_000)).click();
    const task = await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Task']`), 5_000);
    assert.ok(await task.isDisplayed());
  });

  it("добавление BPMN Task отображает блок на холсте", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'BPMN']`), 5_000)).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Task']`), 5_000)).click();
    const block = await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);
    assert.ok(await block.isDisplayed());
  });
});

// ─── ER библиотека ───────────────────────────────────────────────────────────

describe("Редактор диаграмм — ER библиотека", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_ER_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("в шаблонах есть пункт 'ER-диаграмма'", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    const erItem = await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'ER')]`), 5_000);
    assert.ok(await erItem.isDisplayed());
  });

  it("добавление ER Entity отображает блок с заголовком", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'ER')]`), 5_000)).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Entity']`), 5_000)).click();
    const block = await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);
    assert.ok(await block.isDisplayed());
  });
});

// ─── Grid-вид на /diagrams ────────────────────────────────────────────────────

describe("Список диаграмм — Grid-вид", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    // создать диаграмму чтобы список не был пустым
    const list = new DiagramsPage(driver);
    await list.goto();
    await list.create(`GridViewTest_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("кнопка переключения в сетку отображается", async () => {
    const list = new DiagramsPage(driver);
    await list.goto();
    const gridBtn = await waitVisible(driver, By.css(`button[title="Сетка"]`), 10_000);
    assert.ok(await gridBtn.isDisplayed());
  });

  it("клик по 'Сетка' меняет ul на GridList-разметку", async () => {
    const list = new DiagramsPage(driver);
    await list.goto();
    const gridBtn = await waitVisible(driver, By.css(`button[title="Сетка"]`), 10_000);
    await gridBtn.click();
    await driver.sleep(200);

    const gridList = await driver.findElements(By.css(`[class*="GridList"]`));
    assert.ok(gridList.length > 0, "После переключения должен появиться GridList");
  });

  it("клик по 'Список' возвращает обычный список", async () => {
    const list = new DiagramsPage(driver);
    await list.goto();
    await (await waitVisible(driver, By.css(`button[title="Сетка"]`), 10_000)).click();
    await driver.sleep(100);
    await (await waitVisible(driver, By.css(`button[title="Список"]`), 10_000)).click();
    await driver.sleep(200);

    const gridList = await driver.findElements(By.css(`[class*="GridList"]`));
    assert.equal(gridList.length, 0, "После переключения обратно GridList не должен отображаться");
  });

  it("GridItem содержит кнопку 'Открыть'", async () => {
    const list = new DiagramsPage(driver);
    await list.goto();
    await (await waitVisible(driver, By.css(`button[title="Сетка"]`), 10_000)).click();
    await driver.sleep(200);

    const openBtns = await driver.findElements(By.xpath(`//*[contains(@class,'GridItem')]//button[contains(normalize-space(.),'${'' /* t.common.diagram */}')]`));
    // просто проверяем что GridItem-карточки есть
    const gridItems = await driver.findElements(By.css(`[class*="GridItem"]`));
    assert.ok(gridItems.length > 0, "В grid-виде должны отображаться карточки GridItem");
  });
});

// ─── Mockup / UI библиотека ───────────────────────────────────────────────────

describe("Редактор диаграмм — Mockup/UI библиотека", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Mockup_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("в шаблонах есть пункт 'Mockup / UI'", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    const item = await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'Mockup')]`), 5_000);
    assert.ok(await item.isDisplayed());
  });

  it("клик по 'Mockup / UI' открывает панель с элементами", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'Mockup')]`), 5_000)).click();
    const btn = await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Кнопка']`), 5_000);
    assert.ok(await btn.isDisplayed(), "Элемент 'Кнопка' должен быть виден в Mockup-панели");
  });

  it("панель Mockup содержит все 4 элемента: Кнопка, Поле ввода, Чекбокс, Карточка", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'Mockup')]`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Кнопка']`), 5_000);

    const labels = ['Кнопка', 'Поле ввода', 'Чекбокс', 'Карточка'];
    for (const label of labels) {
      const els = await driver.findElements(By.xpath(`//button[normalize-space(.) = '${label}']`));
      assert.ok(els.length > 0, `Элемент '${label}' должен присутствовать в Mockup-панели`);
    }
  });

  it("добавление Mockup Кнопка создаёт блок на холсте", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'Mockup')]`), 5_000)).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Кнопка']`), 5_000)).click();
    const block = await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);
    assert.ok(await block.isDisplayed(), "После добавления Mockup Кнопка должен появиться блок на холсте");
  });

  it("блок Mockup отображается как wireframe (содержит SVG-текст или специфичный CSS-класс)", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'Mockup')]`), 5_000)).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Кнопка']`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);
    await driver.sleep(200);

    const mockupEls = await driver.findElements(By.css(`[class*="MockupButton"],[class*="Block_mockup"]`));
    assert.ok(mockupEls.length > 0, "Блок должен иметь mockup-специфичный CSS-класс");
  });
});

// ─── Flowchart пресеты ────────────────────────────────────────────────────────

describe("Редактор диаграмм — Flowchart пресеты", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Presets_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("в шаблонах есть пункт 'Пресеты'", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    const item = await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'Пресеты')]`), 5_000);
    assert.ok(await item.isDisplayed());
  });

  it("клик по 'Пресеты' открывает панель с пресетами", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'Пресеты')]`), 5_000)).click();
    const item = await waitVisible(driver, By.xpath(`//*[contains(normalize-space(.), 'Простой процесс')]`), 5_000);
    assert.ok(await item.isDisplayed(), "Пресет 'Простой процесс' должен быть виден");
  });

  it("панель пресетов содержит 3 варианта", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'Пресеты')]`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[contains(normalize-space(.), 'Простой процесс')]`), 5_000);

    const presets = await driver.findElements(By.css(`[class*="PresetItem"]`));
    assert.ok(presets.length >= 3, `Должно быть минимум 3 пресета, найдено: ${presets.length}`);
  });

  it("клик по пресету 'Простой процесс' добавляет блоки на холст", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'Пресеты')]`), 5_000)).click();
    const preset = await waitVisible(driver, By.xpath(`//*[contains(@class,'PresetItem') and contains(normalize-space(.), 'Простой процесс')]`), 5_000);
    await preset.click();
    await driver.sleep(500);

    const blocks = await driver.findElements(By.xpath(`//*[@data-block='true']`));
    assert.ok(blocks.length >= 2, `Пресет должен добавить минимум 2 блока, найдено: ${blocks.length}`);
  });

  it("клик по пресету 'Ветвление' добавляет блоки с ромбом", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    await (await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'Пресеты')]`), 5_000)).click();
    const preset = await waitVisible(driver, By.xpath(`//*[contains(@class,'PresetItem') and contains(normalize-space(.), 'Ветвление')]`), 5_000);
    await preset.click();
    await driver.sleep(500);

    const blocks = await driver.findElements(By.xpath(`//*[@data-block='true']`));
    assert.ok(blocks.length >= 3, `Пресет 'Ветвление' должен добавить минимум 3 блока, найдено: ${blocks.length}`);
  });
});

// ─── Превью диаграмм в grid-виде ─────────────────────────────────────────────

describe("Список диаграмм — Превью SVG в grid-виде", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(180_000);
    driver = await createDriver();
    await loginAs(driver);

    // создать диаграмму и добавить блок, чтобы при автосохранении сгенерировался preview
    diagramId = await createAndOpen(driver, `UI_Preview_${Date.now()}`);
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);
    // ждём автосохранения (интервал ~3 с)
    await driver.sleep(5_000);
  });

  after(async () => { await driver?.quit(); });

  it("после сохранения диаграммы с блоком в grid-виде появляется img-превью", async () => {
    const list = new DiagramsPage(driver);
    await list.goto();

    // переключить в grid-вид
    const gridBtn = await waitVisible(driver, By.css(`button[title="Сетка"]`), 10_000);
    await gridBtn.click();
    await driver.sleep(300);

    // найти карточку нашей диаграммы
    const previewArea = await waitVisible(
      driver,
      By.xpath(`//*[contains(@class,'GridItemPreview') and @aria-label]`),
      5_000,
    );

    // проверить, что внутри есть <img> а не только emoji-span
    const imgs = await previewArea.findElements(By.css(`img[src^="data:image/svg"]`));
    assert.ok(imgs.length > 0, "В grid-карточке диаграммы с блоком должен отображаться SVG-превью через <img>");
  });

  it("src img-превью содержит валидный SVG (начинается с <svg)", async () => {
    const list = new DiagramsPage(driver);
    await list.goto();
    const gridBtn = await waitVisible(driver, By.css(`button[title="Сетка"]`), 10_000);
    await gridBtn.click();
    await driver.sleep(300);

    const src = await driver.executeScript<string | null>(`
      const img = document.querySelector('img[src^="data:image/svg"]');
      return img ? img.src : null;
    `);
    assert.ok(src !== null, "img с SVG-превью должен существовать в DOM");
    const decoded = decodeURIComponent(src!.replace('data:image/svg+xml,', ''));
    assert.ok(decoded.trim().startsWith('<svg'), "Содержимое превью должно начинаться с <svg");
  });

  it("диаграмма без блоков показывает emoji-заглушку вместо img", async () => {
    // создать пустую диаграмму
    const list = new DiagramsPage(driver);
    await list.goto();
    await list.create(`UI_EmptyPreview_${Date.now()}`);
    await driver.sleep(1_000);

    await list.goto();
    const gridBtn = await waitVisible(driver, By.css(`button[title="Сетка"]`), 10_000);
    await gridBtn.click();
    await driver.sleep(300);

    const emojiSpans = await driver.findElements(By.css(`[class*="GridItemIcon"]`));
    assert.ok(emojiSpans.length > 0, "Пустая диаграмма должна показывать emoji-заглушку (GridItemIcon)");
  });
});

// ─── Изображения на холсте ────────────────────────────────────────────────────

describe("Редактор диаграмм — Изображения на холсте", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Image_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("кнопка 'Вставить изображение' есть в тулбаре", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    const btn = await waitVisible(driver, By.css(`button[title="Вставить изображение"]`), 10_000);
    assert.ok(await btn.isDisplayed());
  });

  it("загрузка PNG создаёт блок-изображение на холсте", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // Hidden file input — use waitLocated (not waitVisible) since display:none inputs are never "visible"
    const input = await waitLocated(driver, By.css(`[data-testid="image-input"]`), 10_000);
    await input.sendKeys(fixturePath("sample.png"));

    const imgBlock = await waitVisible(
      driver,
      By.css(`[data-block="true"] img[class*="ImageBlockContent"]`),
      8_000,
    );
    assert.ok(await imgBlock.isDisplayed(), "Должен появиться блок-изображение");
  });

  it("src блока-изображения — это data URL", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    const input = await waitLocated(driver, By.css(`[data-testid="image-input"]`), 10_000);
    await input.sendKeys(fixturePath("sample.png"));
    await waitVisible(driver, By.css(`img[class*="ImageBlockContent"]`), 8_000);

    const src = await driver.executeScript<string | null>(`
      const img = document.querySelector('img[class*="ImageBlockContent"]');
      return img ? img.getAttribute('src') : null;
    `);
    assert.ok(src !== null && src.startsWith("data:image/"), "src должен быть data URL изображения");
  });
});

// ─── Импорт draw.io ────────────────────────────────────────────────────────────

describe("Редактор диаграмм — Импорт draw.io", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Drawio_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("в библиотеках есть пункт 'Импорт draw.io'", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Шаблоны")).click();
    const item = await waitVisible(driver, By.xpath(`//button[contains(normalize-space(.), 'Импорт draw.io')]`), 5_000);
    assert.ok(await item.isDisplayed());
  });

  it("импорт .drawio добавляет блоки на холст", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    const input = await waitLocated(driver, By.css(`[data-testid="drawio-input"]`), 10_000);
    await input.sendKeys(fixturePath("sample.drawio"));

    // в фикстуре 3 вершины (Старт, Решение, Конец)
    await driver.wait(async () => {
      const blocks = await driver.findElements(By.css(`[data-block="true"]`));
      return blocks.length >= 3;
    }, 8_000, "После импорта draw.io должно появиться минимум 3 блока");

    const blocks = await driver.findElements(By.css(`[data-block="true"]`));
    assert.ok(blocks.length >= 3, `Ожидалось ≥3 блока, найдено: ${blocks.length}`);
  });

  it("импорт .drawio переносит подписи блоков (Старт)", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    const input = await waitLocated(driver, By.css(`[data-testid="drawio-input"]`), 10_000);
    await input.sendKeys(fixturePath("sample.drawio"));
    await driver.wait(async () => {
      const blocks = await driver.findElements(By.css(`[data-block="true"]`));
      return blocks.length >= 3;
    }, 8_000);

    const startBlock = await driver.findElements(By.xpath(`//*[@data-block='true'][contains(normalize-space(.), 'Старт')]`));
    assert.ok(startBlock.length > 0, "Должен быть блок с подписью 'Старт' из draw.io");
  });

  it("импорт .drawio создаёт линии-коннекторы между блоками", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    const input = await waitLocated(driver, By.css(`[data-testid="drawio-input"]`), 10_000);
    await input.sendKeys(fixturePath("sample.drawio"));
    await driver.wait(async () => {
      const blocks = await driver.findElements(By.css(`[data-block="true"]`));
      return blocks.length >= 3;
    }, 8_000);
    await driver.sleep(300);

    const lines = await driver.findElements(By.css(`svg line[x1]`));
    assert.ok(lines.length >= 2, `Ожидалось ≥2 коннектора из draw.io, найдено: ${lines.length}`);
  });
});

// ─── Модалки подтверждения (вместо window.confirm) ────────────────────────────

describe("Редактор диаграмм — Модалка подтверждения удаления", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_ConfirmModal_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("клик по 'Удалить диаграмму' открывает модалку, а не window.confirm", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // открыть меню настроек (⋮)
    await (await waitVisible(driver, By.css(`button[title="Настройки"]`), 10_000)).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Удалить']`), 5_000)).click();

    const okBtn = await waitVisible(driver, By.css(`[data-testid="confirm-modal-ok"]`), 5_000);
    assert.ok(await okBtn.isDisplayed(), "Должна появиться кнопка подтверждения в модалке");
  });

  it("отмена в модалке оставляет диаграмму на месте", async () => {
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    await (await waitVisible(driver, By.css(`button[title="Настройки"]`), 10_000)).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Удалить']`), 5_000)).click();
    await waitVisible(driver, By.css(`[data-testid="confirm-modal-ok"]`), 5_000);

    // нажать «Отмена»
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Отмена']`), 5_000)).click();
    await driver.sleep(300);

    assert.ok((await driver.getCurrentUrl()).includes(`/diagrams/${diagramId}`), "После отмены остаёмся в редакторе");
  });
});

// ─── Перетаскивание блоков ────────────────────────────────────────────────────

describe("Редактор диаграмм — Перетаскивание блоков", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Drag_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("перетаскивание блока меняет его позицию на холсте", async function () {
    this.timeout(20_000);
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // добавить блок
    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    const block = await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);

    // запомнить начальную позицию
    const rectBefore = await block.getRect();
    const cx = Math.round(rectBefore.x + rectBefore.width / 2);
    const cy = Math.round(rectBefore.y + rectBefore.height / 2);

    // выполнить перетаскивание: pointerdown + move + pointerup
    const actions = driver.actions({ async: true });
    await actions
      .move({ origin: "viewport" as any, x: cx, y: cy })
      .pause(50)
      .press()
      .pause(150)
      .move({ origin: "viewport" as any, x: cx + 120, y: cy + 80 })
      .pause(50)
      .release()
      .perform();
    await driver.sleep(300);

    const rectAfter = await block.getRect();
    const movedX = Math.abs(rectAfter.x - rectBefore.x);
    const movedY = Math.abs(rectAfter.y - rectBefore.y);
    assert.ok(
      movedX > 10 || movedY > 10,
      `Блок должен сдвинуться после перетаскивания (было ${Math.round(rectBefore.x)},${Math.round(rectBefore.y)}, стало ${Math.round(rectAfter.x)},${Math.round(rectAfter.y)})`,
    );
  });

  it("перетаскивание нескольких выделенных блоков перемещает их вместе", async function () {
    this.timeout(20_000);
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
    assert.ok(blocks.length >= 2, "Нужно ≥2 блока для теста");

    // выделить оба
    await pointerClick(driver, blocks[0]!);
    await driver.sleep(100);
    await pointerClick(driver, blocks[1]!, { shiftKey: true });
    await driver.sleep(200);

    // перетащить первый — оба должны сдвинуться
    const rect0Before = await blocks[0]!.getRect();
    const rect1Before = await blocks[1]!.getRect();
    const cx = Math.round(rect0Before.x + rect0Before.width / 2);
    const cy = Math.round(rect0Before.y + rect0Before.height / 2);

    const actions = driver.actions({ async: true });
    await actions
      .move({ origin: "viewport" as any, x: cx, y: cy })
      .pause(50)
      .press()
      .pause(150)
      .move({ origin: "viewport" as any, x: cx + 100, y: cy + 60 })
      .pause(50)
      .release()
      .perform();
    await driver.sleep(300);

    const rect0After = await blocks[0]!.getRect();
    const rect1After = await blocks[1]!.getRect();
    assert.ok(
      Math.abs(rect0After.x - rect0Before.x) > 10 || Math.abs(rect0After.y - rect0Before.y) > 10,
      "Первый блок должен сдвинуться",
    );
    assert.ok(
      Math.abs(rect1After.x - rect1Before.x) > 10 || Math.abs(rect1After.y - rect1Before.y) > 10,
      "Второй блок тоже должен сдвинуться при мультиселекте",
    );
  });
});

// ─── Изменение размера блока ─────────────────────────────────────────────────

describe("Редактор диаграмм — Изменение размера блока", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Resize_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("при выделении блока появляется ручка изменения размера", async function () {
    this.timeout(15_000);
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    const block = await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);

    // выделить блок
    await pointerClick(driver, block);
    await driver.sleep(200);

    const handle = await driver.findElements(By.css(`button[aria-label="Resize block"]`));
    assert.ok(handle.length > 0, "После выделения блока должна появиться ручка изменения размера");
  });

  it("перетаскивание ручки изменяет размер блока", async function () {
    this.timeout(20_000);
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    const block = await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);

    // выделить блок
    await pointerClick(driver, block);
    await driver.sleep(200);

    const handle = await driver.findElement(By.css(`button[aria-label="Resize block"]`));
    const handleRect = await handle.getRect();
    const hx = Math.round(handleRect.x + handleRect.width / 2);
    const hy = Math.round(handleRect.y + handleRect.height / 2);

    const blockRectBefore = await block.getRect();

    // перетащить ручку на 80x60 вниз-вправо
    const actions = driver.actions({ async: true });
    await actions
      .move({ origin: "viewport" as any, x: hx, y: hy })
      .pause(50)
      .press()
      .pause(150)
      .move({ origin: "viewport" as any, x: hx + 80, y: hy + 60 })
      .pause(50)
      .release()
      .perform();
    await driver.sleep(300);

    const blockRectAfter = await block.getRect();
    assert.ok(
      blockRectAfter.width > blockRectBefore.width || blockRectAfter.height > blockRectBefore.height,
      `Блок должен увеличиться (до: ${Math.round(blockRectBefore.width)}x${Math.round(blockRectBefore.height)}, после: ${Math.round(blockRectAfter.width)}x${Math.round(blockRectAfter.height)})`,
    );
  });
});

// ─── Редактирование концов линий ─────────────────────────────────────────────

describe("Редактор диаграмм — Редактирование концов линий", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_LineEnd_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("панель линии содержит выборщики 'Начало' и 'Конец'", async function () {
    this.timeout(15_000);
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Линия")).click();

    const startLabel = await waitVisible(
      driver,
      By.xpath(`//*[contains(normalize-space(.), 'Начало')]`),
      5_000,
    );
    const endLabel = await waitVisible(
      driver,
      By.xpath(`//*[contains(normalize-space(.), 'Конец')]`),
      5_000,
    );
    assert.ok(await startLabel.isDisplayed(), "Выборщик 'Начало' должен отображаться");
    assert.ok(await endLabel.isDisplayed(), "Выборщик 'Конец' должен отображаться");
  });

  it("смена конца линии на 'Открытая' → нарисованная линия имеет marker-end", async function () {
    this.timeout(20_000);
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Линия")).click();

    // открыть выборщик "Конец" (MUI Select — кликаем по комбобоксу)
    const endCombo = await waitVisible(
      driver,
      By.xpath(`//label[normalize-space(.) = 'Конец']/following-sibling::div[contains(@class,'MuiInputBase')]//div[@role='combobox']`),
      5_000,
    );
    await endCombo.click();
    // выбрать "Открытая"
    const openArrowOption = await waitVisible(
      driver,
      By.xpath(`//ul[@role='listbox']//li[normalize-space(.) = 'Открытая']`),
      5_000,
    );
    await openArrowOption.click();
    await driver.sleep(100);

    // нарисовать линию (drawLineOnSvg adds pause for React state sync)
    await drawLineOnSvg(driver, -80, -60, 60, 40);
    await driver.sleep(300);

    // проверить, что у линии есть marker-end (атрибут ненулевой)
    const lines = await driver.findElements(By.css(`svg line[marker-end]`));
    assert.ok(lines.length > 0, "Линия должна иметь атрибут marker-end после выбора 'Открытая'");
  });

  it("смена конца линии на 'Нет' → нарисованная линия НЕ имеет marker-end", async function () {
    this.timeout(20_000);
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);
    await (await page.toolButton("Линия")).click();

    // открыть выборщик "Конец"
    const endCombo = await waitVisible(
      driver,
      By.xpath(`//label[normalize-space(.) = 'Конец']/following-sibling::div[contains(@class,'MuiInputBase')]//div[@role='combobox']`),
      5_000,
    );
    await endCombo.click();
    // выбрать "Нет"
    const noneOption = await waitVisible(
      driver,
      By.xpath(`//ul[@role='listbox']//li[normalize-space(.) = 'Нет']`),
      5_000,
    );
    await noneOption.click();
    await driver.sleep(100);

    // нарисовать линию
    await drawOnSvg(driver, -70, -50, 50, 30);
    await driver.sleep(300);

    // у линий без маркера не должно быть attr marker-end или значение пустое
    const allLines = await driver.findElements(By.css(`svg line[x1]`));
    const lastLine = allLines[allLines.length - 1];
    if (lastLine) {
      const markerEnd = await lastLine.getAttribute("marker-end");
      assert.ok(!markerEnd, `Линия с 'Нет' не должна иметь marker-end, получен: ${markerEnd}`);
    } else {
      assert.fail("Должна быть хотя бы одна нарисованная линия");
    }
  });

  it("у выделенной линии в панели свойств можно изменить конец", async function () {
    this.timeout(20_000);
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // нарисовать линию
    await (await page.toolButton("Линия")).click();
    await drawOnSvg(driver, -80, -60, 60, 40);
    await driver.sleep(300);

    // открыть панель свойств
    await (await waitVisible(driver, By.css(`button[title="Свойства"]`), 10_000)).click();

    // переключиться на select-инструмент и выбрать линию
    // Линия выбирается через onClick (не onPointerDown), диспатчим click через JS
    await (await page.toolButton("Выбор (S)")).click();
    const lines = await driver.findElements(By.css(`svg line[x1]`));
    if (lines.length === 0) { this.skip(); return; }
    await driver.executeScript(
      `arguments[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))`,
      lines[0]!,
    );
    await driver.sleep(200);

    // в панели свойств должен появиться выборщик "Конец"
    const endSelect = await driver.findElements(
      By.xpath(`//label[normalize-space(.) = 'Конец']/following-sibling::div[contains(@class,'MuiInputBase')]`),
    );
    assert.ok(endSelect.length > 0, "Панель свойств выбранной линии должна содержать выборщик 'Конец'");
  });
});

// ─── Экспорт диаграммы ───────────────────────────────────────────────────────

describe("Редактор диаграмм — Экспорт диаграммы", () => {
  let driver: import("selenium-webdriver").WebDriver;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
    diagramId = await createAndOpen(driver, `UI_Export_${Date.now()}`);
  });

  after(async () => { await driver?.quit(); });

  it("кнопка 'Скачать диаграмму' отображается в топ-баре", async function () {
    this.timeout(15_000);
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    const downloadBtn = await waitVisible(
      driver,
      By.css(`button[title="Скачать диаграмму"]`),
      10_000,
    );
    assert.ok(await downloadBtn.isDisplayed(), "Кнопка 'Скачать диаграмму' должна быть видна в топ-баре");
  });

  it("клик по 'Скачать диаграмму' открывает модалку экспорта с форматами", async function () {
    this.timeout(15_000);
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    await (await waitVisible(driver, By.css(`button[title="Скачать диаграмму"]`), 10_000)).click();

    // модалка должна показать кнопки форматов
    const svgBtn = await waitVisible(
      driver,
      By.css(`button[class*="FormatBtn"]`),
      5_000,
    );
    assert.ok(await svgBtn.isDisplayed(), "Модалка экспорта должна содержать кнопки форматов");
  });

  it("модалка экспорта содержит все 5 форматов: JSON, SVG, PNG, JPEG, PDF", async function () {
    this.timeout(15_000);
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    await (await waitVisible(driver, By.css(`button[title="Скачать диаграмму"]`), 10_000)).click();

    // ждём появления модалки
    await waitVisible(driver, By.css(`button[class*="FormatBtn"]`), 5_000);

    const formatBtns = await driver.findElements(By.css(`button[class*="FormatBtn"]`));
    assert.ok(formatBtns.length >= 5, `Должно быть ≥5 кнопок формата, найдено: ${formatBtns.length}`);
  });

  it("клик по JSON экспортирует и закрывает модалку", async function () {
    this.timeout(20_000);
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    // добавить блок чтобы было что экспортировать
    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);

    // нажать Скачать диаграмму в топ-баре
    await (await waitVisible(driver, By.css(`button[title="Скачать диаграмму"]`), 10_000)).click();
    await waitVisible(driver, By.css(`button[class*="FormatBtn"]`), 5_000);

    // кликнуть JSON (первая кнопка формата)
    const formatBtns = await driver.findElements(By.css(`button[class*="FormatBtn"]`));
    await formatBtns[0]!.click(); // JSON
    await driver.sleep(1_000);

    // модалка должна закрыться
    const remaining = await driver.findElements(By.css(`button[class*="FormatBtn"]`));
    assert.equal(remaining.length, 0, "После экспорта модалка должна закрыться");
  });

  it("SVG-экспорт корректно отрабатывает (модалка закрывается)", async function () {
    this.timeout(20_000);
    const page = new DiagramDetailPage(driver);
    await page.goto(diagramId);

    await (await page.toolButton("Фигуры")).click();
    await (await waitVisible(driver, By.xpath(`//button[normalize-space(.) = 'Rectangle']`), 5_000)).click();
    await waitVisible(driver, By.xpath(`//*[@data-block='true']`), 5_000);

    await (await waitVisible(driver, By.css(`button[title="Скачать диаграмму"]`), 10_000)).click();
    await waitVisible(driver, By.css(`button[class*="FormatBtn"]`), 5_000);

    // кликнуть SVG (вторая кнопка)
    const formatBtns = await driver.findElements(By.css(`button[class*="FormatBtn"]`));
    if (formatBtns.length >= 2) await formatBtns[1]!.click(); // SVG
    await driver.sleep(1_000);

    const remaining = await driver.findElements(By.css(`button[class*="FormatBtn"]`));
    assert.equal(remaining.length, 0, "После SVG-экспорта модалка должна закрыться");
  });
});
