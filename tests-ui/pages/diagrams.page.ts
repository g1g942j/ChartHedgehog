import { By, WebDriver, WebElement } from "selenium-webdriver";
import { getAppUrl } from "../base-url.js";
import { waitVisible, waitTextInPage } from "../waits.js";

export class DiagramsPage {
  constructor(private readonly driver: WebDriver) {}

  async goto(): Promise<void> {
    await this.driver.get(`${getAppUrl()}/diagrams`);
  }

  async title() {
    return waitVisible(this.driver, By.xpath(`//h1[contains(normalize-space(.), 'Мои диаграммы')]`));
  }

  async newDiagramNameInput() {
    return waitVisible(
      this.driver,
      By.xpath(`//label[contains(normalize-space(.), 'Название')]/following::input[1]`),
    );
  }

  async createButton() {
    return waitVisible(this.driver, By.xpath(`//button[contains(normalize-space(.), 'Создать')]`));
  }

  async emptyState() {
    return this.driver.findElements(By.xpath(`//*[contains(normalize-space(.), 'У вас пока нет диаграмм')]`));
  }

  async createErrorAlert() {
    return waitVisible(this.driver, By.css(".MuiAlert-message"), 5_000);
  }

  async diagramCardByName(name: string): Promise<WebElement> {
    return waitVisible(
      this.driver,
      By.xpath(`//li[.//span[contains(normalize-space(.), '${name}')]]`),
      10_000,
    );
  }

  async diagramCardsByName(name: string): Promise<WebElement[]> {
    return this.driver.findElements(
      By.xpath(`//li[.//span[contains(normalize-space(.), '${name}')]]`),
    );
  }

  async diagramLinkForCard(card: WebElement) {
    return card.findElement(By.xpath(`.//a[contains(normalize-space(.), 'Диаграмма')]`));
  }

  async participantsLinkForCard(card: WebElement) {
    return card.findElement(By.xpath(`.//a[contains(normalize-space(.), 'Участники')]`));
  }

  async roleBadgeForCard(card: WebElement): Promise<string> {
    const badge = await card.findElement(By.xpath(`.//span[contains(@class, 'RoleBadge')]`));
    return (await badge.getText()).trim();
  }

  async fillNewDiagramName(name: string): Promise<void> {
    const input = await this.newDiagramNameInput();
    await input.clear();
    await input.sendKeys(name);
  }

  async create(name: string): Promise<void> {
    await this.fillNewDiagramName(name);
    await (await this.createButton()).click();
    await waitTextInPage(this.driver, name, 10_000);
  }

  async hasCreateError(): Promise<boolean> {
    const els = await this.driver.findElements(By.css(".MuiAlert-message"));
    return els.length > 0;
  }
}
