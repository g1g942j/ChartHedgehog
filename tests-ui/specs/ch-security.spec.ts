import assert from "node:assert/strict";
import { after, before, describe, it } from "mocha";
import { createDriver } from "../driver-factory.js";
import { loginAs, registerTestUser } from "../auth-helper.js";
import { getAppUrl } from "../base-url.js";
import { waitUrl } from "../waits.js";

// ─── Route guard ──────────────────────────────────────────────────────────────

describe("Безопасность — route guard: /diagrams", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
  });

  after(async () => { await driver?.quit(); });

  it("неавторизованный переходит на / при открытии /diagrams", async function () {
    this.timeout(20_000);
    await driver.get(`${getAppUrl()}/diagrams`);
    await driver.sleep(1_500);
    const url = await driver.getCurrentUrl();
    assert.ok(
      !url.includes("/diagrams"),
      `Неавторизованный не должен попасть на /diagrams, URL: ${url}`,
    );
  });

  it("неавторизованный переходит на / при открытии /profile", async function () {
    this.timeout(20_000);
    await driver.get(`${getAppUrl()}/profile`);
    await driver.sleep(1_500);
    const url = await driver.getCurrentUrl();
    assert.ok(
      !url.includes("/profile"),
      `Неавторизованный не должен попасть на /profile, URL: ${url}`,
    );
  });

  it("после логина /diagrams доступна", async function () {
    this.timeout(30_000);
    await loginAs(driver);
    await driver.get(`${getAppUrl()}/diagrams`);
    await waitUrl(driver, "/diagrams", 10_000);
    const url = await driver.getCurrentUrl();
    assert.ok(url.includes("/diagrams"), `После логина должны быть на /diagrams, URL: ${url}`);
  });
});

describe("Безопасность — route guard: после logout", () => {
  let driver: import("selenium-webdriver").WebDriver;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();
    await loginAs(driver);
  });

  after(async () => { await driver?.quit(); });

  it("после logout /diagrams снова защищён", async function () {
    this.timeout(30_000);
    // logout через API (очищает cookie ch_auth)
    const logoutResp = await driver.executeScript<string>(`
      return fetch('${getAppUrl()}/api/auth/logout', { method: 'POST', credentials: 'include' })
        .then(() => 'ok').catch(() => 'err');
    `);
    // очищаем sessionStorage так же как logoutUser()
    await driver.executeScript(`
      sessionStorage.clear();
      document.cookie = 'ch_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    `);
    await driver.sleep(300);
    await driver.get(`${getAppUrl()}/diagrams`);
    await driver.sleep(1_500);
    const url = await driver.getCurrentUrl();
    assert.ok(
      !url.includes("/diagrams"),
      `После logout /diagrams должен быть защищён, URL: ${url}`,
    );
  });
});

// ─── saveDiagramEditorState — VIEWER не может сохранить ───────────────────────

describe("Безопасность — VIEWER не может перезаписать диаграмму", () => {
  let driver: import("selenium-webdriver").WebDriver;
  const ownerUsername = `sec_owner_${Date.now()}`;
  const viewerUsername = `sec_viewer_${Date.now()}`;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();

    await registerTestUser(ownerUsername, "TestPass123");
    await registerTestUser(viewerUsername, "TestPass123");

    // Создаём диаграмму от имени владельца
    await loginAs(driver, ownerUsername, "TestPass123");
    const createResp = await driver.executeScript<string>(`
      return fetch('${getAppUrl()}/api/diagrams', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'SecTestDiagram_${Date.now()}' })
      }).then(r => r.json()).then(d => JSON.stringify(d));
    `);
    const created = JSON.parse(createResp) as { id?: number };
    diagramId = created.id ?? 0;
    if (!diagramId) { this.skip(); return; }

    // Добавляем viewer
    await driver.executeScript(`
      return fetch('${getAppUrl()}/api/diagrams/${diagramId}/participants', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: '${viewerUsername}', role: 'VIEWER' })
      });
    `);
  });

  after(async () => { await driver?.quit(); });

  it("VIEWER получает ошибку при попытке сохранить диаграмму", async function () {
    this.timeout(30_000);
    if (!diagramId) { this.skip(); return; }

    await loginAs(driver, viewerUsername, "TestPass123");

    const result = await driver.executeScript<string>(`
      return fetch('${getAppUrl()}/api/diagrams/${diagramId}/editor', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: [] })
      }).then(r => r.status.toString());
    `);

    assert.ok(
      result === "403" || result === "401" || result === "400",
      `VIEWER должен получить 401/403/400, получено: ${result}`,
    );
  });
});

// ─── fetchDiagramEditorState — чужая диаграмма недоступна ────────────────────

describe("Безопасность — чужая диаграмма недоступна", () => {
  let driver: import("selenium-webdriver").WebDriver;
  const ownerUsername = `sec_own2_${Date.now()}`;
  const otherUsername = `sec_other_${Date.now()}`;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();

    await registerTestUser(ownerUsername, "TestPass123");
    await registerTestUser(otherUsername, "TestPass123");

    await loginAs(driver, ownerUsername, "TestPass123");
    const createResp = await driver.executeScript<string>(`
      return fetch('${getAppUrl()}/api/diagrams', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'SecPrivateDiagram_${Date.now()}' })
      }).then(r => r.json()).then(d => JSON.stringify(d));
    `);
    const created = JSON.parse(createResp) as { id?: number };
    diagramId = created.id ?? 0;
    if (!diagramId) this.skip();
  });

  after(async () => { await driver?.quit(); });

  it("посторонний пользователь не может получить содержимое диаграммы", async function () {
    this.timeout(30_000);
    if (!diagramId) { this.skip(); return; }

    await loginAs(driver, otherUsername, "TestPass123");

    const result = await driver.executeScript<string>(`
      return fetch('${getAppUrl()}/api/diagrams/${diagramId}/editor', {
        method: 'GET',
        credentials: 'include'
      }).then(r => r.status.toString());
    `);

    assert.ok(
      result === "403" || result === "401" || result === "404",
      `Посторонний должен получить 401/403/404, получено: ${result}`,
    );
  });
});

// ─── updateDiagramParticipantRole — EDITOR не может менять роли ───────────────

describe("Безопасность — EDITOR не может менять роли участников", () => {
  let driver: import("selenium-webdriver").WebDriver;
  const ownerUsername = `sec_own3_${Date.now()}`;
  const editorUsername = `sec_editor_${Date.now()}`;
  const targetUsername = `sec_target_${Date.now()}`;
  let diagramId: number;
  let targetUserId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();

    await registerTestUser(ownerUsername, "TestPass123");
    await registerTestUser(editorUsername, "TestPass123");
    await registerTestUser(targetUsername, "TestPass123");

    await loginAs(driver, ownerUsername, "TestPass123");
    const createResp = await driver.executeScript<string>(`
      return fetch('${getAppUrl()}/api/diagrams', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'SecRoleDiagram_${Date.now()}' })
      }).then(r => r.json()).then(d => JSON.stringify(d));
    `);
    const created = JSON.parse(createResp) as { id?: number };
    diagramId = created.id ?? 0;
    if (!diagramId) { this.skip(); return; }

    // Добавляем editor и target
    await driver.executeScript(`
      return Promise.all([
        fetch('${getAppUrl()}/api/diagrams/${diagramId}/participants', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: '${editorUsername}', role: 'EDITOR' })
        }),
        fetch('${getAppUrl()}/api/diagrams/${diagramId}/participants', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: '${targetUsername}', role: 'VIEWER' })
        })
      ]);
    `);

    // Получаем id target user
    const usersResp = await driver.executeScript<string>(`
      return fetch('${getAppUrl()}/api/users/search?q=${targetUsername}', {
        credentials: 'include'
      }).then(r => r.json()).then(d => JSON.stringify(d));
    `);
    const users = JSON.parse(usersResp) as Array<{ userId?: number }>;
    targetUserId = users[0]?.userId ?? 0;
  });

  after(async () => { await driver?.quit(); });

  it("EDITOR получает ошибку при попытке изменить роль участника", async function () {
    this.timeout(30_000);
    if (!diagramId || !targetUserId) { this.skip(); return; }

    await loginAs(driver, editorUsername, "TestPass123");

    const result = await driver.executeScript<string>(`
      return fetch('${getAppUrl()}/api/diagrams/${diagramId}/participants/${targetUserId}', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'EDITOR' })
      }).then(r => r.status.toString());
    `);

    assert.ok(
      result === "403" || result === "401",
      `EDITOR должен получить 401/403, получено: ${result}`,
    );
  });
});

// ─── fetchDiagramParticipants — VIEWER не видит список участников ─────────────

describe("Безопасность — VIEWER не видит список участников", () => {
  let driver: import("selenium-webdriver").WebDriver;
  const ownerUsername = `sec_own4_${Date.now()}`;
  const viewerUsername2 = `sec_view2_${Date.now()}`;
  let diagramId: number;

  before(async function () {
    this.timeout(120_000);
    driver = await createDriver();

    await registerTestUser(ownerUsername, "TestPass123");
    await registerTestUser(viewerUsername2, "TestPass123");

    await loginAs(driver, ownerUsername, "TestPass123");
    const createResp = await driver.executeScript<string>(`
      return fetch('${getAppUrl()}/api/diagrams', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'SecParticipantDiagram_${Date.now()}' })
      }).then(r => r.json()).then(d => JSON.stringify(d));
    `);
    const created = JSON.parse(createResp) as { id?: number };
    diagramId = created.id ?? 0;
    if (!diagramId) { this.skip(); return; }

    await driver.executeScript(`
      return fetch('${getAppUrl()}/api/diagrams/${diagramId}/participants', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: '${viewerUsername2}', role: 'VIEWER' })
      });
    `);
  });

  after(async () => { await driver?.quit(); });

  it("VIEWER получает ошибку при запросе списка участников", async function () {
    this.timeout(30_000);
    if (!diagramId) { this.skip(); return; }

    await loginAs(driver, viewerUsername2, "TestPass123");

    const result = await driver.executeScript<string>(`
      return fetch('${getAppUrl()}/api/diagrams/${diagramId}/participants', {
        method: 'GET',
        credentials: 'include'
      }).then(r => r.status.toString());
    `);

    assert.ok(
      result === "403" || result === "401",
      `VIEWER должен получить 401/403, получено: ${result}`,
    );
  });
});
