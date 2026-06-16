import { By, WebDriver, WebElement } from "selenium-webdriver";
import { getAppUrl } from "../base-url.js";
import { waitVisible, waitTextInPage, waitGone } from "../waits.js";

export class ParticipantsPage {
  constructor(private readonly driver: WebDriver) {}

  async goto(diagramId: number): Promise<void> {
    await this.driver.get(`${getAppUrl()}/diagrams/${diagramId}/participants`);
  }

  async addSectionTitle() {
    return waitVisible(
      this.driver,
      By.xpath(`//*[contains(normalize-space(.), 'Добавить участника')]`),
      10_000,
    );
  }

  async searchInput() {
    return waitVisible(
      this.driver,
      By.xpath(`//label[contains(normalize-space(.), 'Логин или email')]/following::input[1]`),
      10_000,
    );
  }

  async addButton() {
    return waitVisible(
      this.driver,
      By.xpath(`//button[contains(normalize-space(.), 'Добавить')]`),
    );
  }

  async isAddButtonDisabled(): Promise<boolean> {
    const btn = await this.addButton();
    const disabled = await btn.getAttribute("disabled");
    return disabled !== null;
  }

  async participantsList(): Promise<WebElement[]> {
    return this.driver.findElements(
      By.xpath(`//ul[ancestor::*[contains(@class, 'Card')]]//li`),
    );
  }

  async participantRowByUsername(username: string): Promise<WebElement> {
    return waitVisible(
      this.driver,
      By.xpath(`//li[.//*[contains(normalize-space(.), '@${username}')]]`),
      10_000,
    );
  }

  async removeButtonForRow(row: WebElement) {
    return row.findElement(By.xpath(`.//button[contains(normalize-space(.), 'Удалить')]`));
  }

  async addErrorAlert() {
    return waitVisible(this.driver, By.css(".MuiAlert-message"), 5_000);
  }

  async hasErrorAlert(): Promise<boolean> {
    const els = await this.driver.findElements(By.css(".MuiAlert-colorError .MuiAlert-message"));
    return els.length > 0;
  }

  async autocompleteOptions(): Promise<WebElement[]> {
    await this.driver.sleep(800);
    return this.driver.findElements(By.css(".MuiAutocomplete-listbox li"));
  }

  async typeSearch(query: string): Promise<void> {
    const input = await this.searchInput();
    await input.clear();
    await input.sendKeys(query);
    await this.driver.sleep(600);
  }

  async selectFirstOption(): Promise<void> {
    const opts = await this.autocompleteOptions();
    if (!opts.length) throw new Error("No autocomplete options visible");
    await opts[0]!.click();
  }

  async emptyMessage(): Promise<boolean> {
    const els = await this.driver.findElements(
      By.xpath(`//*[contains(normalize-space(.), 'Нет участников')]`),
    );
    return els.length > 0;
  }

  async participantsCountTitle(): Promise<string> {
    const el = await waitVisible(
      this.driver,
      By.xpath(`//*[contains(normalize-space(.), 'Участники (')]`),
      10_000,
    );
    return (await el.getText()).trim();
  }
}
