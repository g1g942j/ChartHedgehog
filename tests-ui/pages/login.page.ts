import { By, WebDriver } from "selenium-webdriver";
import { getAppUrl } from "../base-url.js";
import { waitVisible, waitTextInPage } from "../waits.js";

export class LoginPage {
  constructor(private readonly driver: WebDriver) {}

  async goto(): Promise<void> {
    await this.driver.get(`${getAppUrl()}/`);
  }

  async title(): Promise<string> {
    const el = await waitVisible(this.driver, By.xpath(`//h1[contains(normalize-space(.), "Вход")]`));
    return (await el.getText()).trim();
  }

  async usernameInput() {
    return waitVisible(this.driver, By.css("input[name='username']"));
  }

  async passwordInput() {
    return waitVisible(this.driver, By.css("input[name='password']"));
  }

  async submitButton() {
    return waitVisible(this.driver, By.xpath(`//button[@type='submit' and contains(normalize-space(.), 'Войти')]`));
  }

  async registerLink() {
    return waitVisible(this.driver, By.xpath(`//a[contains(normalize-space(.), 'Зарегистрироваться')]`));
  }

  async alertError() {
    return waitVisible(this.driver, By.css(".MuiAlert-message"), 10_000);
  }

  async fillUsername(value: string): Promise<void> {
    const el = await this.usernameInput();
    await el.clear();
    await el.sendKeys(value);
  }

  async fillPassword(value: string): Promise<void> {
    const el = await this.passwordInput();
    await el.clear();
    await el.sendKeys(value);
  }

  async submit(): Promise<void> {
    await (await this.submitButton()).click();
  }

  async waitForError(timeoutMs = 10_000): Promise<string> {
    const alert = await this.alertError();
    return (await alert.getText()).trim();
  }

  async hasAlert(): Promise<boolean> {
    const els = await this.driver.findElements(By.css(".MuiAlert-message"));
    return els.length > 0;
  }
}
