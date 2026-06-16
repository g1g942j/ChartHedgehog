import { By, Key, WebDriver } from "selenium-webdriver";
import { getAppUrl } from "../base-url.js";
import { waitVisible } from "../waits.js";

export class DiagramDetailPage {
  constructor(private readonly driver: WebDriver) {}

  async goto(id: number): Promise<void> {
    await this.driver.get(`${getAppUrl()}/diagrams/${id}`);
  }

  // ── top bar ──────────────────────────────────────────────────────────────

  async backButton() {
    return waitVisible(this.driver, By.css(`button[title="К списку"]`), 10_000);
  }

  async menuButton() {
    return waitVisible(this.driver, By.css(`button[title="Настройки"]`), 10_000);
  }

  async canvasSaveButton() {
    // Autosave is now automatic; this waits for the "Сохранено" status indicator
    return waitVisible(
      this.driver,
      By.xpath(`//span[contains(normalize-space(.), 'Сохранено')]`),
      12_000,
    );
  }

  async undoButton() {
    return waitVisible(this.driver, By.css(`button[title="Отменить (Ctrl+Z)"]`), 10_000);
  }

  async redoButton() {
    return waitVisible(this.driver, By.css(`button[title="Повторить (Ctrl+Y)"]`), 10_000);
  }

  async textPanelButton() {
    return waitVisible(this.driver, By.css(`button[title="Текст и комментарии"]`), 10_000);
  }

  async openMenu(): Promise<void> {
    const btn = await this.menuButton();
    await btn.click();
    // wait for settings panel to appear
    await waitVisible(
      this.driver,
      By.xpath(`//*[contains(normalize-space(.), 'Настройки диаграммы')]`),
      5_000,
    );
  }

  // ── settings panel (opened via ⋮ menu) ───────────────────────────────────

  async settingsTitle() {
    return waitVisible(
      this.driver,
      By.xpath(`//*[contains(normalize-space(.), 'Настройки диаграммы')]`),
      10_000,
    );
  }

  async nameInput() {
    return waitVisible(
      this.driver,
      By.xpath(`//label[contains(normalize-space(.), 'Название')]/following::input[1]`),
    );
  }

  /** Save button inside settings panel (not the canvas save button) */
  async saveButton() {
    return waitVisible(
      this.driver,
      By.xpath(
        `//button[normalize-space(.) = 'Сохранить' and not(contains(., 'диаграмму'))]`,
      ),
    );
  }

  async deleteButton() {
    return waitVisible(
      this.driver,
      By.xpath(`//button[contains(normalize-space(.), 'Удалить')]`),
    );
  }

  async participantsTab() {
    return waitVisible(
      this.driver,
      By.xpath(`//a[contains(normalize-space(.), 'Участники')]`),
    );
  }

  async isSaveButtonDisabled(): Promise<boolean> {
    const btn = await this.saveButton();
    const disabled = await btn.getAttribute("disabled");
    return disabled !== null;
  }

  async fillName(name: string): Promise<void> {
    const input = await this.nameInput();
    await input.click();
    await input.sendKeys(Key.chord(Key.CONTROL, "a"));
    await input.sendKeys(Key.DELETE);
    await input.sendKeys(name);
  }

  async save(): Promise<void> {
    await (await this.saveButton()).click();
  }

  async waitSaved(newName: string): Promise<void> {
    await this.driver.wait(async () => {
      const bodies = await this.driver.findElements(By.tagName("body"));
      if (!bodies.length) return false;
      const text = await bodies[0]!.getText();
      return text.includes(newName);
    }, 10_000);
  }

  async confirmDeleteInDialog(): Promise<void> {
    await this.driver.executeScript("window.confirm = () => true;");
    await (await this.deleteButton()).click();
  }

  // ── left toolbar ──────────────────────────────────────────────────────────

  async leftToolbar() {
    return waitVisible(this.driver, By.css("nav"), 10_000);
  }

  async toolButton(title: string) {
    return waitVisible(this.driver, By.css(`button[title="${title}"]`), 10_000);
  }
}
